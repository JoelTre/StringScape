(() => {
    'use strict';
    const SYSTEM_PROMPT = `You select experimental PDB reference structures for homology modelling of a protein complex.
Use only the supplied rows; never invent IDs or metadata.
First identify the protein or complex the user actually requested. Compare PDB titles, chain/protein names, UniProt IDs and mapping details. Reject unrelated enzymes, similarly named proteins, and isolated domains/subunits when the requested intact complex is represented. Search score is supporting evidence, not proof of identity. Respect explicit species, composition, ligand or state requirements; homologous species can be useful when the query allows them. If identity is ambiguous or no row is suitable, return no IDs and explain the uncertainty.
If the user asked for specific components, cover each requested component with suitable references (i.e., pick reference PDBs that cover each requested component); do not reject a requested subcomplex merely because another hit covers the larger assembly. Explain which selected PDB covers each component.
Ideally choose PDBs that contain many proteins, so long as they are relevant to the user's request. Among entries for the SAME protein complex, prefer a compact, nonredundant set representing distinct conformational or functional states explicitly supported by titles: activated/inhibited, state A/B, open/closed, ligand-bound/unbound (in other words, if there are PDBs for different confomational states of the protein complex the user asked for, pick those PDB IDs to show the range of conformations). Distinguish ligand occupancy from a demonstrated conformational change: do not claim titles prove a structural transition. Do not mix unrelated complexes merely to obtain diverse state names. Avoid redundant entries of the same state unless composition or coverage justifies them (like if they contain a different, but overlapping, set of prtoteins). A single relevant entry is better than adding an unrelated or unsupported state. If the user query is general ("a key neuron protein"), just pick any PDB that would fit the general request. Select up to 5 references, prioritising identity and useful complex coverage before state diversity. Do not infer resolution or quality absent from the rows. To summarise, pick PDBs that contain many proteins, are of the complex the user asked for,cover all requested components, and represent distinct conformational or functional states when supported by titles.,
Return ONLY JSON: {"pdbIds":["1ABC"],"reason":"Brief explanation of identity, state diversity, and any uncertainty."}. An empty pdbIds array is allowed.`;
    const SEARCH_PROMPT = `Plan concise RCSB PDB full-text searches for the user's protein modelling request. Treat the user text as a description of the desired model, possibly including instructions for you.
Return one to five complementary search phrases covering all explicitly requested complexes, components or subcomplexes. Split compound requests into separate searches instead of copying a long sentence. Preserve organism requirements, expand abbreviations where useful (E. coli -> Escherichia coli), and use relevant protein/complex names and established synonyms. Include searches likely to find different functional states when useful, but do not overconstrain every search to one state. Each phrase is matched as required terms: avoid prose, Boolean operators, quotes and redundant words. Do not invent results.
For example, "E. coli flagellar motor C-ring plus MS ring" could use "Escherichia coli FliG FliM FliN", "Escherichia coli flagellar motor C-ring", "Escherichia coli MS ring" and "Escherichia coli FliF" search.
Return ONLY JSON: {"searches":["concise search phrase"]}.`;
    const RETRY_PROMPT = SEARCH_PROMPT + `
This is a fresh planning call after reviewers found no suitable reference PDBs. The supplied history contains only previous search phrases and reviewer conclusions, not results tables. Try different established synonyms, component names, abbreviations or less restrictive combinations. Do not repeat earlier phrases. Preserve the user's explicit requirements; do not silently relax species or complex identity. You cannot infer that a structure does not exist from failed searches.`;
    const SUMMARY_PROMPT = `Write a short, informative, to-the-point message after three unsuccessful PDB reference-search rounds. You see ONLY the modelling request, search phrases and each AI's conclusion; you cannot see any results tables. Summarize the search approaches and the limitations reported by AIs, distinguishing their assessments from verified facts. Do not invent PDB IDs, result details, counts, or claim that no suitable structure exists. Suggest one or two concrete next steps based on the history (including searching the RCSB protein Data bank themselves for the reference PDB structres they want used and manuelly putting them into the app). Aim for 100–160 words. Return ONLY JSON: {"message":"your message"}.`;
    function searchRoundHistory(rounds) {
        return rounds.slice(0,3).map(round=>({searches:(round.searches||[]).filter(term=>typeof term==='string'),conclusion:String(round.conclusion||'')}));
    }
    async function requestSearchPlan(system,payload,{previous=[],onRetry=()=>{}}={}) {
        const used=new Set(previous.map(term=>term.trim().replace(/\s+/g,' ').toLowerCase()));
        let feedback='';
        for(let attempt=1;attempt<=3;attempt++){
            // Provider and connection errors are not malformed model output.
            const text=await askJson(system+(feedback?'\n'+feedback:''),payload);
            try{
                const searches=parseSearchPlan(text).filter(term=>!used.has(term.toLowerCase()));
                if(!searches.length)throw new Error('The plan only repeated previous searches.');
                return searches;
            }catch(error){
                feedback='Your previous response was not a usable search plan. Return exactly one JSON object with a searches array containing 1–5 nonempty search strings of at most 200 characters each. Do not repeat previous searches. No commentary or extra keys are needed.';
                if(attempt<3)onRetry(`AI returned an unusable search plan. Asking it to try again (attempt ${attempt+1} of 3)…`);
            }
        }
        onRetry('AI could not produce a usable plan after three attempts. Continuing with fallback search terms.');
        // Keep searching even if the model repeatedly fails to format a plan.
        // Prefer previously validated phrases to inventing new biological names.
        return previous.length?previous.slice(-5):[String(payload.query||'protein complex').trim().replace(/\s+/g,' ').slice(0,200)||'protein complex'];
    }
    async function retrySearches(query,rounds,onRetry) {
        const history=searchRoundHistory(rounds);
        return requestSearchPlan(RETRY_PROMPT,{query,history},{previous:history.flatMap(round=>round.searches),onRetry});
    }
    async function summarizeSearchFailure(query,rounds) {
        const text=await askJson(SUMMARY_PROMPT,{query,history:searchRoundHistory(rounds)});
        const value=JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
        if(typeof value.message!=='string'||!value.message.trim())throw new Error('AI returned an invalid search summary.');
        return value.message.trim().slice(0,3000);
    }
    function parseSearchPlan(text) {
        const value=JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
        if(!Array.isArray(value.searches)||!value.searches.length||value.searches.length>5||value.searches.some(term=>typeof term!=='string'||!term.trim()||term.length>200))throw new Error('AI returned an invalid search plan.');
        return [...new Map(value.searches.map(term=>{const clean=term.trim().replace(/\s+/g,' ');return [clean.toLowerCase(),clean];})).values()];
    }
    const endpoints = {openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1',google:'https://generativelanguage.googleapis.com/v1beta/openai',local:'http://127.0.0.1:1234/v1'};
    const connectionStorageKey='homology-modeller.ai-connection.v1';
    let active = null, revision = 0, connectionMode = 'cloud', cloudProvider = 'openai';
    const el = id => document.getElementById('modellerAi'+id);
    function config() {
        const provider = connectionMode === 'local' ? 'local' : el('Provider').value;
        const url = new URL(el('Url').value.trim());
        if (url.username || url.password || url.search || url.hash) throw new Error('API URL must not contain credentials, a query or a fragment.');
        if (provider === 'local') {
            if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || !['http:','https:'].includes(url.protocol)) throw new Error('Use a localhost or 127.0.0.1 server URL.');
            if (!/\/v1\/?$/.test(url.pathname)) url.pathname = url.pathname.replace(/\/$/,'')+'/v1';
        } else if (url.origin !== new URL(endpoints[provider]).origin || url.protocol !== 'https:') {
            throw new Error('Use the selected provider’s HTTPS API URL.');
        }
        const apiKey = el('Key').value.trim();
        if (provider !== 'local' && !apiKey) throw new Error('Enter your API key.');
        return {provider,apiBase:url.href.replace(/\/$/,''),apiKey,model:el('Model').value};
    }
    function headers(c) {
        if (c.provider === 'anthropic') return {'Content-Type':'application/json','x-api-key':c.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
        return {'Content-Type':'application/json',...(c.apiKey ? {Authorization:`Bearer ${c.apiKey}`} : {})};
    }
    async function request(c, path, body) {
        const response = await fetch(c.apiBase+path,{method:body?'POST':'GET',headers:headers(c),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
        if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}. Check your key, model and server CORS settings.`);
        return response.json();
    }
    function parseDecision(text, results) {
        const value = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
        if (!Array.isArray(value.pdbIds) || typeof value.reason !== 'string') throw new Error('AI returned an invalid selection.');
        const allowed = new Set(results.map(hit=>hit.identifier));
        const ids = [...new Set(value.pdbIds.map(id=>typeof id==='string'?id.toUpperCase():''))];
        if (ids.length>5 || ids.some(id=>!allowed.has(id))) throw new Error('AI selected IDs outside the search results or too many references.');
        return {pdbIds:ids,reason:value.reason.slice(0,1500)};
    }
    async function askJson(system, payload) {
        const c=active, version=revision;
        if(!c)throw new Error('No AI connected.');
        const anthropic=c.provider==='anthropic', user=JSON.stringify(payload);
        const body=anthropic
            ? {model:c.model,max_tokens:1600,system,messages:[{role:'user',content:user}]}
            : {model:c.model,messages:[{role:'system',content:system},{role:'user',content:user}]};
        const data=await request(c,anthropic?'/messages':'/chat/completions',body);
        if(version!==revision)throw new Error('AI connection changed during selection.');
        return anthropic?(data.content||[]).filter(block=>block.type==='text').map(block=>block.text).join('\n'):data.choices?.[0]?.message?.content;
    }
    async function planSearches(query,onRetry) {
        return requestSearchPlan(SEARCH_PROMPT,{query},{onRetry});
    }
    async function chooseReferences({query,sequences,results,searches}) {
        const rows=results.map(hit=>({pdbId:hit.identifier,title:hit.name||'',species:hit.species||[],score:hit.score,searchMatches:hit.searchMatches||[],proteins:hit.mapping?.records||[],notes:hit.mapping?.notes||[]}));
        return parseDecision(await askJson(SYSTEM_PROMPT,{query:query||null,sequences:sequences||[],searches:searches||[],results:rows}),results);
    }
    window.ModellerAI = {connected:()=>!!active,planSearches,retrySearches,summarizeSearchFailure,chooseReferences};
    // Pure selection validation is also used by the offline regression suite.
    if (typeof module !== 'undefined') module.exports = {parseDecision,parseSearchPlan,searchRoundHistory,requestSearchPlan,SYSTEM_PROMPT,SEARCH_PROMPT,RETRY_PROMPT,SUMMARY_PROMPT};
    if (!el('Open')) return;
    let loadTimer, modelsPending = false;
    function updateConnectButton() {
        el('Connect').disabled = modelsPending || !el('Model').value;
    }
    const pickers = {};
    function closeMenus() {
        for (const picker of Object.values(pickers)) picker.close();
    }
    function setupPicker(kind) {
        const trigger=el(kind+'Trigger'), menu=el(kind+'Menu'), select=el(kind);
        if (!trigger) return;
        const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
        function open(last=false) {
            if(trigger.disabled)return;
            closeMenus();
            const rect=trigger.getBoundingClientRect(), bounds=el('Dialog').getBoundingClientRect();
            const above=rect.top-bounds.top-16, below=bounds.bottom-rect.bottom-16;
            menu.classList.toggle('above',above>below);
            menu.style.maxHeight=Math.max(60,Math.min(280,Math.max(above,below)-8))+'px';
            menu.hidden=false;trigger.setAttribute('aria-expanded','true');
            const buttons=Array.from(menu.querySelectorAll('button'));
            (last?buttons.at(-1):buttons.find(button=>button.getAttribute('aria-checked')==='true')||buttons[0])?.focus();
        }
        const refresh=(placeholder)=>{
            const options=Array.from(select.options), selected=options.find(option=>option.value===select.value);
            el(kind+'Text').textContent=placeholder||selected?.textContent||selected?.text||'Select a model';
            trigger.disabled=kind==='Model'&&(modelsPending||!options.length);
            trigger.setAttribute('aria-busy',String(kind==='Model'&&modelsPending));
            menu.replaceChildren(...options.map(option=>{
                const button=document.createElement('button');button.type='button';button.role='menuitemradio';
                button.setAttribute('aria-checked',String(option.value===select.value));button.textContent=option.textContent;
                button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();close();trigger.focus();});
                return button;
            }));
            close();
        };
        trigger.addEventListener('click',()=>menu.hidden?open():close());
        trigger.addEventListener('keydown',event=>{
            if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open(event.key==='ArrowUp');}
        });
        menu.addEventListener('keydown',event=>{
            const buttons=Array.from(menu.querySelectorAll('button')), index=buttons.indexOf(document.activeElement);
            if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();trigger.focus();}
            else if(event.key==='Tab')close();
            else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
                event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();
            }
        });
        pickers[kind]={close,refresh};refresh();
    }
    setupPicker('Provider');setupPicker('Model');
    el('Dialog').addEventListener('click',event=>{if(!event.target.closest('.ai-picker'))closeMenus();});
    el('Dialog').addEventListener('close',closeMenus);
    function invalidateModels() {
        revision++;clearTimeout(loadTimer);modelsPending=false;el('Model').replaceChildren();
        updateConnectButton();
        pickers.Model?.refresh(connectionMode==='local'?'Connecting to local server…':'Enter your API key to load models');
        el('Status').textContent='';
    }
    async function loadModels({savedModel=null,autoConnect=false}={}) {
        const version=revision;
        modelsPending=true;pickers.Model?.refresh('loading models...');el('Status').textContent='';
        updateConnectButton();
        try {
            const c=config(),data=await request(c,'/models');
            if(version!==revision)return;
            const models=(data.data||[]).filter(model=>model.id).sort((a,b)=>a.id.localeCompare(b.id));
            el('Model').replaceChildren(...models.map(model=>new Option(model.display_name||model.id,model.id)));
            if(c.provider==='openai' && models.some(model=>model.id==='gpt-6-luna'))el('Model').value='gpt-6-luna';
            if(savedModel&&models.some(model=>model.id===savedModel))el('Model').value=savedModel;
            modelsPending=false;pickers.Model?.refresh(models.length?null:'No models available');
            updateConnectButton();
            el('Status').textContent=models.length?'Select a chat model, then Connect.':'No models available. Load a model on your server first.';
            if(autoConnect){
                if(!models.some(model=>model.id===savedModel))throw new Error('Your saved AI model is unavailable. Open AI connection and choose a model to reconnect.');
                connect();
            }
        } catch(error) {
            if(version===revision){modelsPending=false;pickers.Model?.refresh('Could not load models');updateConnectButton();el('Status').textContent=error.message;if(autoConnect){el('Open').textContent='Reconnect AI';el('State').textContent='Automatic AI connection failed. Open Reconnect AI for details.';}}
        }
    }
    function scheduleModels() {
        invalidateModels();
        if(connectionMode==='local'||el('Key').value.trim())loadTimer=setTimeout(loadModels,500);
    }
    function providerChanged() {
        const local=connectionMode==='local';
        el('Url').value=endpoints[local?'local':el('Provider').value];
        el('KeyLabel').hidden=local;
        el('KeyLabel').style.display=local?'none':'';
        el('ProviderLabel').hidden=local;
        el('ProviderLabel').style.display=local?'none':'';
        el('Privacy').textContent=local
            ? 'Search queries (or input sequences) and result tables are sent to your local server to select references. No cloud API key is needed.'
            : 'Connecting saves your API key and connection settings in this browser for automatic reconnection. The key is masked here but stored in browser site storage, not an encrypted password vault. Disconnect removes the saved connection. Searches send your query (or input sequences) and results to your provider. Cloud API charges may apply.';
        el('Help').textContent=local?'In LM Studio, load a model, enable CORS in the developer server settings, and start the server.':'Enter an API key from your provider. Models load automatically; then choose a chat model.';
        pickers.Provider?.refresh();
        scheduleModels();
    }
    el('Open').addEventListener('click',()=>el('Dialog').showModal());
    el('Close').addEventListener('click',()=>el('Dialog').close());
    el('Provider').addEventListener('change',()=>{cloudProvider=el('Provider').value;providerChanged();});
    el('Mode').addEventListener('click',()=>{
        connectionMode=connectionMode==='cloud'?'local':'cloud';
        const local=connectionMode==='local';
        el('Mode').dataset.mode=connectionMode;
        el('Mode').setAttribute('aria-pressed',String(local));
        el('Mode').setAttribute('aria-label',local?'Switch to Cloud AI':'Switch to Local LLM');
        el('Provider').value=cloudProvider;
        providerChanged();
    });
    ['Url','Key'].forEach(id=>el(id).addEventListener('input',scheduleModels));
    el('Model').addEventListener('change',updateConnectButton);
    function connect(){
        const c=config(); if(modelsPending||!c.model)throw new Error('Wait for models to load and select a chat model first.');
        let saved=true;
        try{localStorage.setItem(connectionStorageKey,JSON.stringify({mode:connectionMode,cloudProvider,...c}));}catch{saved=false;}
        active=c;revision++;el('State').textContent=saved?'':'AI connected, but this browser could not save the connection. Reconnect manually next time.';
        el('Open').textContent=`AI connected: ${c.model}`;
        el('Open').title='Manage AI connection';
        if(el('Dialog').open)el('Dialog').close();
    }
    el('Form').addEventListener('submit',event=>{
        event.preventDefault();
        try{connect();}catch(error){el('Status').textContent=error.message;}
    });
    el('Disconnect').addEventListener('click',()=>{
        let removed=true;
        try{localStorage.removeItem(connectionStorageKey);}catch{removed=false;}
        active=null;el('Key').value='';invalidateModels();el('State').textContent=removed?'AI disconnected.':'AI disconnected, but saved site data could not be removed. Clear this site’s browser storage to forget the key.';el('Open').textContent='Connect an AI';el('Open').title='';el('Status').textContent='Disconnected.';
    });
    function restoreConnection(){
        let saved;
        try{saved=JSON.parse(localStorage.getItem(connectionStorageKey));}catch{return false;}
        if(!saved||!Object.hasOwn(endpoints,saved.provider)||typeof saved.model!=='string'||!saved.model||typeof saved.apiBase!=='string'||typeof saved.apiKey!=='string')return false;
        connectionMode=saved.provider==='local'?'local':'cloud';
        cloudProvider=Object.hasOwn(endpoints,saved.cloudProvider)&&saved.cloudProvider!=='local'?saved.cloudProvider:'openai';
        el('Provider').value=connectionMode==='cloud'?saved.provider:cloudProvider;
        const local=connectionMode==='local';
        el('Mode').dataset.mode=connectionMode;el('Mode').setAttribute('aria-pressed',String(local));el('Mode').setAttribute('aria-label',local?'Switch to Cloud AI':'Switch to Local LLM');
        el('Key').value=saved.apiKey;
        providerChanged();clearTimeout(loadTimer);
        el('Url').value=saved.apiBase;
        el('Open').textContent='Connecting AI…';
        void loadModels({savedModel:saved.model,autoConnect:true});
        return true;
    }
    if(!restoreConnection())providerChanged();
})();
