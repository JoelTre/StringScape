(() => {
    'use strict';
    const SYSTEM_PROMPT = `You select experimental PDB reference structures for homology modelling of a protein complex.
Use only the supplied rows; never invent IDs or metadata.
First identify the protein or complex the user actually requested. Compare PDB titles, chain/protein names, UniProt IDs and mapping details. Reject unrelated enzymes, similarly named proteins, and isolated domains/subunits when the requested intact complex is represented. Search score is supporting evidence, not proof of identity. Respect explicit species, composition, ligand or state requirements; homologous species can be useful when the query allows them. If identity is ambiguous or no row is suitable, return no IDs and explain the uncertainty.
If the user asked for specific components, cover each requested component with suitable references (i.e., pick reference PDBs that cover each requested component); do not reject a requested subcomplex merely because another hit covers the larger assembly. Explain which selected PDB covers each component.
Ideally choose PDBs that contain many proteins, so long as they are relevant to the user's request. Among entries for the SAME protein complex, prefer a compact, nonredundant set representing distinct conformational or functional states explicitly supported by titles: activated/inhibited, state A/B, open/closed, ligand-bound/unbound (in other words, if there are PDBs for different confomational states of the protein complex the user asked for, pick those PDB IDs to show the range of conformations). Distinguish ligand occupancy from a demonstrated conformational change: do not claim titles prove a structural transition. Do not mix unrelated complexes merely to obtain diverse state names. Avoid redundant entries of the same state unless composition or coverage justifies them (like if they contain a different, but overlapping, set of prtoteins). A single relevant entry is better than adding an unrelated or unsupported state. If the user query is general ("a key neuron protein"), just pick any PDB that would fit the general request. Select up to 5 references, prioritising identity and useful complex coverage before state diversity. Do not infer resolution or quality absent from the rows. To summarise, pick PDBs that contain many proteins, are of the complex the user asked for,cover all requested components, and represent distinct conformational or functional states when supported by titles.,
Assign selected references to groups of compatible conformations of the requested assembly. Keep different conformations of the SAME component in separate groups to avoid averaging their coordinates. Membership is many-to-many: add any reference structure that does not change conformation to EVERY compatible group for the other components, reusing its draft instead of creating a separate group. For example, with C-ring state A (1AAA), C-ring state B (2BBB), and MS-ring (3CCC) with no distinct conformations, use [{"name":"C-ring state A","pdbIds":["1AAA","3CCC"]},{"name":"C-ring state B","pdbIds":["2BBB","3CCC"]}]. Do not invent a conformational change for the MS-ring or other shared components; explain uncertainty. If no distinct conformations are supported, use one combined group containing all selected references. Include every selected ID in at least one group, only selected IDs, and no duplicate IDs within a group.
Return ONLY JSON: {"pdbIds":["1ABC"],"groups":[{"name":"Combined model","pdbIds":["1ABC"]}],"reason":"Brief explanation of identity, state diversity, shared components, and any uncertainty."}. An empty pdbIds array with empty groups is allowed.`;
    const SEARCH_PROMPT = `Plan concise RCSB PDB full-text searches for the user's protein modelling request. Treat the user text as a description of the desired model, possibly including instructions for you.
Return one to five complementary search phrases covering all explicitly requested complexes, components or subcomplexes. Split compound requests into separate searches instead of copying a long sentence. Preserve organism requirements, expand abbreviations where useful (E. coli -> Escherichia coli), and use relevant protein/complex names and established synonyms. Include searches likely to find different functional states when useful, but do not overconstrain every search to one state. Each phrase is matched as required terms: avoid prose, Boolean operators, quotes and redundant words. Do not invent results.
For example, "E. coli flagellar motor C-ring plus MS ring" could use "Escherichia coli FliG FliM FliN", "Escherichia coli flagellar motor C-ring", "Escherichia coli MS ring" and "Escherichia coli FliF" search.
Return ONLY JSON: {"searches":["concise search phrase"]}.`;
    const RETRY_PROMPT = SEARCH_PROMPT + `
This is a fresh planning call after reviewers found no suitable reference PDBs. The supplied history contains only previous search phrases and reviewer conclusions, not results tables. Try different established synonyms, component names, abbreviations or less restrictive combinations. Do not repeat earlier phrases. Preserve the user's explicit requirements; do not silently relax species or complex identity. You cannot infer that a structure does not exist from failed searches.`;
    const SUMMARY_PROMPT = `Write a short, informative, to-the-point message after three unsuccessful PDB reference-search rounds. You see ONLY the modelling request, search phrases and each AI's conclusion; you cannot see any results tables. Summarize the search approaches and the limitations reported by AIs, distinguishing their assessments from verified facts. Do not invent PDB IDs, result details, counts, or claim that no suitable structure exists. Suggest one or two concrete next steps based on the history (including searching the RCSB protein Data bank themselves for the reference PDB structres they want used and manuelly putting them into the app). Aim for 100–160 words. Return ONLY JSON: {"message":"your message"}.`;
    const FLAGELLAR_GUIDANCE = `When making models of bacterial flagellar motors, I recommend using these references:
- 8XP0 (part of C-ring, CCW state, Salmonella)
- 8XP1 (part of C-ring, CW state, Salmonella)
- 8WL2 (MS-ring, bushing, driveshaft, and hook, CW state, Salmonella)
- 8WLT (MS-ring, bushing, driveshaft, and hook, CCW state, Salmonella)
- 7CGO (MS-ring, bushing, driveshaft, and hook, Salmonella)
- 8Z60 (MS-ring, bushing, driveshaft, hook, and vibrio LPHT-ring, Vibrio)
- 9YH7 (MS-ring, bushing, driveshaft, and vibrio LPHT-ring in higher FOMC conformation, Vibrio)
- 8WO5 (C-ring, MS-ring, bushing, driveshaft, and hook, CCW state, Salmonella)
- 8WOE (C-ring, MS-ring, bushing, driveshaft, and hook, CW state, Salmonella)
- 6AHQ (FliL ring, Vibrio)
- 8UOX (C-ring, CCW state, Salmonella)
- 8UPL (C-ring, CW state, Salmonella)
- 9HMF (periplasmic scaffold C. jejuni)
- 9YDT (LPHT-ring, closed state, Vibrio cholerae)
- 9YDO (LPHT-ring, open state, vibrio cholerae)
- 8Z60 (LPHT-ring, MS-ring, bushing, driveshaft, and hook, Vibrio alginolyticus)
- 9YDS (H-ring subunits FlgO and FlgP, open state, Vibrio cholerae)
- 9LJL (MotB periplasmic PG-binding domain, Bacillus subtilis)
- 2ZOV (MotB periplasmic PG-binding domain, crystal form I, Salmonella)
- 2ZVY (MotB periplasmic PG-binding domain, crystal form II, Salmonella)
- 2ZVZ (MotB periplasmic PG-binding domain, crystal form III, Salmonella)
- 3S02 (MotB periplasmic PG-binding domain, Helicobacter pylori)
- 8UCS (MotAB stator bound to FliG, Clostridium sporogenes)
- 6YSF (MotAB stator, Clostridium sporogenes)
- 6YKR (MotAB stator, unplugged, Campylobacter jejuni)
- 6YKM (MotAB stator, Campylobacter jejuni)
- 6YKP (MotAB stator, unplugged, Campylobacter jejuni)
- 6YSL (MotAB stator, Bacillus subtilis)
- 8ZYV (PomAB sodium-driven stator, with 100 nM NaCl)
- 12DU (export gate with FliF, Borreliella burgdorferi)
- 7BGl (LP-ring (bushing), Salmonella)
- 6K3I (hook, 66 subunits, Salmonella)
- 9N8M (FlaC filament, Vibrio cholerae)
- 9RCD (sheathed filament, Vibrio alginolyticus)
- 9RCB (unsheathed filament, Vibrio alginolyticus)
- 9YH1 (FlaB filament, Helicobacter pylori)
- 9YH1 (FlaA filament, Helicobacter pylori)
- 9LAH (MR-1 filament, Shewanella oneidensis)
- 5WJW (H84R filament, Bacillus subtilis)
- 9PIN (inner curvature side of think flagella filament, Treponema denticola)
- 9X7K (filament, Leptospira biflexa)
- 9GSX (hook-filament junction cap-complex without filament, Campylobacter jejuni)
- 9MCG (hook-filament junction with filament, conformation 1, Salmonella)
- 9U4R (hook-filament junction with filament, conformation 2, Salmonella)
- 9U7Y (hook-filament junction with filament, conformation 3, Salmonella)

If building a model of the whole motor, I recommend using 8WO5, 8WOE, 6K3I, 9MCG, 12DU, and 8UCS (if in a Vibrio species, include 8Z60. If in a Campylobacter species, include 9HMF). If just making a model of the C-ring, use 8UOX and 8UPL. If just making a model of the MotAB stator, use the appropriate references. Feel free to search for more references if you think you need to.`;
    function referencePrompt(system, input) {
        return /flagella|flagellar|flagellum|motab|pomab/i.test(String(input || '')) ? system + '\n\n' + FLAGELLAR_GUIDANCE : system;
    }
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
    async function retrySearches(query,rounds,onRetry,input=query) {
        const history=searchRoundHistory(rounds);
        return requestSearchPlan(referencePrompt(RETRY_PROMPT,input),{query,history},{previous:history.flatMap(round=>round.searches),onRetry});
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
    let active = null, revision = 0, connectionMode = 'cloud', cloudProvider = 'openai', sharedKey = false;
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
        // Membership is many-to-many: validate coverage, not a partition.
        let groups;
        if(value.groups===undefined)groups=ids.length?[{name:'Combined model',pdbIds:ids.slice()}]:[];
        else {
            if(!Array.isArray(value.groups)||value.groups.length>5)throw new Error('AI returned invalid conformation groups.');
            groups=value.groups.map(group=>{
                if(!group||typeof group.name!=='string'||!group.name.trim()||!Array.isArray(group.pdbIds)||!group.pdbIds.length)throw new Error('AI returned an invalid conformation group.');
                const members=[...new Set(group.pdbIds.map(id=>typeof id==='string'?id.toUpperCase():''))];
                if(members.some(id=>!ids.includes(id)))throw new Error('AI conformation group contains an unselected reference.');
                return {name:group.name.trim().slice(0,120),pdbIds:members};
            });
            if(ids.some(id=>!groups.some(group=>group.pdbIds.includes(id))))throw new Error('AI conformation groups omit a selected reference.');
        }
        return {pdbIds:ids,groups,reason:value.reason.slice(0,1500)};
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
    async function planSearches(query,onRetry,input=query) {
        return requestSearchPlan(referencePrompt(SEARCH_PROMPT,input),{query},{onRetry});
    }
    async function chooseReferences({query,sequences,results,searches,input=query}) {
        const rows=results.map(hit=>({pdbId:hit.identifier,title:hit.name||'',species:hit.species||[],score:hit.score,searchMatches:hit.searchMatches||[],proteins:hit.mapping?.records||[],notes:hit.mapping?.notes||[]}));
        return parseDecision(await askJson(referencePrompt(SYSTEM_PROMPT,input),{query:query||null,sequences:sequences||[],searches:searches||[],results:rows}),results);
    }
    async function searchReferences({query,sequences,searchPdb,signal,onStatus=()=>{},input=query}) {
        const system=referencePrompt(`You find experimental PDB references for a protein modelling request. Search the PDB and PubMed as often as useful, trying synonyms and alternative queries when needed. Inspect returned titles, protein names and mappings; respect the request and avoid inventing IDs or evidence. Select up to five relevant PDB IDs from actual PDB search results, covering requested components and distinct supported states. When searches are exhausted, explain the limitations and suggest refining the query or selecting PDBs manually. Do not assign conformation groups. Return only JSON: {"pdbIds":["1ABC"],"reason":"explanation"}. An empty array is allowed.`,input);
        const pdbTool={name:'Search_PDB',description:'Search RCSB PDB for structures and return titles and protein mappings.',parameters:{type:'object',properties:{query:{type:'string',description:'Concise full-text search terms; leave empty to search supplied sequences'}},required:['query'],additionalProperties:false}};
        const messages=[{role:'user',content:JSON.stringify({query,sequences})}],seen=new Map();let fallback=false,corrections=0;
        while(true){
            const result=await streamComplex({system:system+(fallback?' Native tools are unavailable. Request a search with JSON {"tool":"Search_PDB" or "Search_PubMed","query":"terms"}, or return the final decision JSON.':''),messages,tools:fallback?[]:[pdbTool,window.ComplexPubMed.tool],signal});
            if(result.toolsUnavailable&&result.fallbackMessages)messages.splice(0,messages.length,...result.fallbackMessages);
            fallback ||= result.toolsUnavailable;
            let calls=result.calls;
            if(!calls.length){
                let value;try{value=JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(typeof value.answer==='string')value=JSON.parse(value.answer);else if(value.answer&&typeof value.answer==='object')value=value.answer;}catch{}
                if(fallback&&value&&(value.tool||value.query)){calls=[{name:value.tool||'Search_PubMed',arguments:JSON.stringify({query:value.query||''}),id:'fallback'}];}
                else if(value&&Array.isArray(value.pdbIds)&&typeof value.reason==='string'){
                    const ids=[...new Set(value.pdbIds.map(id=>String(id).toUpperCase()))];
                    if(ids.length<=5&&ids.every(id=>seen.has(id)))return {pdbIds:ids,reason:value.reason,results:[...seen.values()]};
                }
                if(!calls.length){if(++corrections>2)throw Error('AI returned an invalid reference selection.');messages.push({role:'assistant',content:result.text||'(empty response)'},{role:'user',content:'Return valid decision JSON using only IDs returned by PDB searches, or request another search.'});continue;}
            }
            if(!fallback){if(result.anthropic)messages.push({role:'assistant',content:[...(result.text?[{type:'text',text:result.text}]:[]),...calls.map(call=>({type:'tool_use',id:call.id,name:call.name,input:JSON.parse(call.arguments||'{}')}))]});else messages.push({role:'assistant',content:result.text||null,tool_calls:calls.map(call=>({id:call.id,type:'function',function:{name:call.name,arguments:call.arguments}}))});}
            else messages.push({role:'assistant',content:result.text});
            const outputs=[];
            for(const call of calls){let output;try{const args=JSON.parse(call.arguments||'{}');onStatus(`AI searching ${call.name==='Search_PDB'?'PDB':'PubMed'}: ${args.query||'input sequences'}…`);if(call.name==='Search_PDB'){output=await searchPdb(args.query||'');for(const hit of output)seen.set(hit.identifier,hit);}else if(call.name==='Search_PubMed')output=await window.ComplexPubMed.search(args.query,signal);else throw Error('Unknown tool');}catch(error){if(signal.aborted)throw error;output={error:error.message};}outputs.push({call,content:JSON.stringify(output)});}
            if(fallback)messages.push({role:'user',content:JSON.stringify({toolResults:outputs.map(({call,content})=>({tool:call.name,result:JSON.parse(content)}))})});
            else if(result.anthropic)messages.push({role:'user',content:outputs.map(({call,content})=>({type:'tool_result',tool_use_id:call.id,content}))});else for(const {call,content} of outputs)messages.push({role:'tool',tool_call_id:call.id,content});
        }
    }
    async function assignReferenceGroups(query,results,selection){
        if(!selection.pdbIds.length)return [];
        const rows=results.filter(hit=>selection.pdbIds.includes(hit.identifier));
        const prompt=SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('Assign selected references'));
        const text=await askJson(prompt,{query,selectedPdbIds:selection.pdbIds,results:rows});
        const decision=parseDecision(text,rows);
        if(selection.pdbIds.some(id=>!decision.pdbIds.includes(id))||decision.pdbIds.length!==selection.pdbIds.length)throw Error('Group assignment changed the reference selection.');
        return decision.groups;
    }
    async function streamComplex({system,messages,tools=[],signal,onText=()=>{}}) {
        const c=active,version=revision;
        if(!c)throw Error('Connect an AI first.');
        const anthropic=c.provider==='anthropic';
        const body=anthropic?{model:c.model,max_tokens:4096,system,messages,stream:true,...(tools.length?{tools:tools.map(tool=>({name:tool.name,description:tool.description,input_schema:tool.parameters}))}:{})}
            :{model:c.model,messages:[{role:'system',content:system},...messages],stream:true,...(tools.length?{tools:tools.map(tool=>({type:'function',function:tool}))}:{})};
        const send=()=>fetch(c.apiBase+(anthropic?'/messages':'/chat/completions'),{method:'POST',headers:headers(c),body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});
        function plainToolHistory(history){
            const plain=[];
            for(const message of history){
                if(message.role==='tool'){
                    plain.push({role:'user',content:JSON.stringify({pubmedToolResult:message.content,toolCallId:message.tool_call_id})});
                    continue;
                }
                let content=message.content;
                if(Array.isArray(content))content=content.map(part=>{
                    if(part.type==='text')return part.text||'';
                    if(part.type==='tool_use')return JSON.stringify({pubmedToolRequest:part.input,toolCallId:part.id});
                    if(part.type==='tool_result')return JSON.stringify({pubmedToolResult:part.content,toolCallId:part.tool_use_id});
                    return JSON.stringify(part);
                }).join('\n');
                if(message.tool_calls?.length)content=[content||'',JSON.stringify({pubmedToolRequests:message.tool_calls.map(call=>({id:call.id,name:call.function?.name,arguments:call.function?.arguments}))})].filter(Boolean).join('\n');
                plain.push({role:message.role,content:content||'(empty response)'});
            }
            return plain;
        }
        async function errorDetail(response){
            try{
                const data=await response.json();
                const message=typeof data?.error==='string'?data.error:data?.error?.message||data?.message;
                return typeof message==='string'?message.replace(/\b(?:Bearer\s+|sk-[A-Za-z0-9_-]+)[^\s,;]*/gi,'[redacted]').replace(/\s+/g,' ').slice(0,500):'';
            }catch{return '';}
        }
        let response=await send(),toolsUnavailable=false,fallbackMessages=null,initialDetail='';
        // Some providers reject native tools, including after returning a tool call.
        // Preserve the actual search results as ordinary messages for the retry.
        if(!response.ok&&[400,422].includes(response.status)&&tools.length){
            initialDetail=await errorDetail(response);try{await response.body?.cancel?.();}catch{/* The error body may already have been consumed. */}delete body.tools;toolsUnavailable=true;
            fallbackMessages=plainToolHistory(messages);
            const instruction=tools.some(tool=>tool.name==='Search_PDB')?'Native tools are unavailable. Request a search with JSON {"tool":"Search_PDB" or "Search_PubMed","query":"terms"}, or return your final JSON decision.':'Native tools are unavailable. You can still request a PubMed search through the app. Return ONLY JSON: {"tool":"Get_chain_sequences","arguments":{}} to inspect chains, {"tool":"Select_model_entity","arguments":{...}} to select, {"editAnimation":"description"} to edit animation, {"query":"PubMed search terms"} to search, or {"answer":"your answer"}. Do not claim to have searched PubMed until the app supplies results.';
            if(anthropic){body.system+='\n'+instruction;body.messages=fallbackMessages;}
            else body.messages=[{role:'system',content:system+'\n'+instruction},...fallbackMessages];
            response=await send();
        }
        if(!response.ok){
            const detail=await errorDetail(response)||initialDetail;
            throw Error(`AI provider returned HTTP ${response.status}${detail?`: ${detail}`:'. Check the connection and model settings.'}`);
        }
        const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',text='',finished=false;const calls=new Map();
        function consume(event){
            if(event==='[DONE]'){finished=true;return;}
            const data=JSON.parse(event);if(data.error)throw Error(data.error.message||'AI stream failed.');
            if(version!==revision)throw Error('AI connection changed. Refresh the summary.');
            if(data.type==='message_stop')finished=true;
            if(data.type==='content_block_start'&&data.content_block.type==='tool_use')calls.set(data.index,{id:data.content_block.id,name:data.content_block.name,arguments:''});
            if(data.type==='content_block_delta'){
                if(data.delta.text){text+=data.delta.text;if(!toolsUnavailable)onText(data.delta.text);}
                if(data.delta.partial_json)calls.get(data.index).arguments+=data.delta.partial_json;
            }
            const choice=data.choices?.[0],delta=choice?.delta;
            if(choice?.finish_reason==='length'||data.delta?.stop_reason==='max_tokens')throw Error('AI response reached its output limit. Try a shorter question.');
            if(delta?.content){text+=delta.content;if(!toolsUnavailable)onText(delta.content);}
            for(const part of delta?.tool_calls||[]){const call=calls.get(part.index)||{id:'',name:'',arguments:''};call.id+=part.id||'';call.name+=part.function?.name||'';call.arguments+=part.function?.arguments||'';calls.set(part.index,call);}
        }
        try{while(true){const {done,value}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});pending=pending.replace(/\r\n/g,'\n');let end;
            while((end=pending.indexOf('\n\n'))!==-1){const block=pending.slice(0,end);pending=pending.slice(end+2);const event=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(event)consume(event);}
            if(done)break;
        }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
        if(!finished)throw Error('AI stream ended early. Please retry.');
        return {text,calls:[...calls.values()],anthropic,toolsUnavailable,fallbackMessages};
    }

    window.ModellerAI = {streamComplex,searchReferences,assignReferenceGroups,connected:()=>!!active,planSearches,retrySearches,summarizeSearchFailure,chooseReferences};
    // Pure selection validation is also used by the offline regression suite.
    if (typeof module !== 'undefined') module.exports = {parseDecision,parseSearchPlan,searchRoundHistory,requestSearchPlan,referencePrompt,FLAGELLAR_GUIDANCE,SYSTEM_PROMPT,SEARCH_PROMPT,RETRY_PROMPT,SUMMARY_PROMPT};
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
                if(savedModel && !models.some(model=>model.id===savedModel))throw new Error('Your saved AI model is unavailable. Open AI connection and choose a model to reconnect.');
                if(!models.length)throw new Error('No AI models are available for this key.');
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
    function updateSharedKeyControls() {
        el('Key').disabled=sharedKey;
        el('DifferentKey').hidden=!sharedKey;
    }
    function providerChanged() {
        updateSharedKeyControls();
        const local=connectionMode==='local';
        el('Url').value=endpoints[local?'local':el('Provider').value];
        el('Shared').hidden=local || !window.SharedAIKey;
        el('KeyLabel').hidden=local;
        el('KeyLabel').style.display=local?'none':'';
        el('ProviderLabel').hidden=local;
        el('ProviderLabel').style.display=local?'none':'';
        el('Privacy').textContent=sharedKey ? 'Shared access is kept in memory for this page session. The key is accessible to anyone using it and requests are sent to the provider. Cloud API charges may apply.' : local
            ? 'Search queries (or input sequences) and result tables are sent to your local server to select references. No cloud API key is needed.'
            : 'Connecting saves your API key and connection settings in this browser for automatic reconnection. The key is masked here but stored in browser site storage, not an encrypted password vault. Disconnect removes the saved connection. Searches send your query (or input sequences) and results to your provider. Cloud API charges may apply.';
        el('Help').textContent=local?'In LM Studio, load a model, enable CORS in the developer server settings, and start the server.':'Enter an API key from your provider. Models load automatically; then choose a chat model.';
        pickers.Provider?.refresh();
        scheduleModels();
    }
    el('Open').addEventListener('click',()=>el('Dialog').showModal());
    el('Close').addEventListener('click',()=>el('Dialog').close());
    el('Provider').addEventListener('change',()=>{if(sharedKey){sharedKey=false;el('Key').value='';}cloudProvider=el('Provider').value;providerChanged();});
    el('Mode').addEventListener('click',()=>{
        if(sharedKey){sharedKey=false;el('Key').value='';}
        connectionMode=connectionMode==='cloud'?'local':'cloud';
        const local=connectionMode==='local';
        el('Mode').dataset.mode=connectionMode;
        el('Mode').setAttribute('aria-pressed',String(local));
        el('Mode').setAttribute('aria-label',local?'Switch to Cloud AI':'Switch to Local LLM');
        el('Provider').value=cloudProvider;
        providerChanged();
    });
    el('Url').addEventListener('input',scheduleModels);
    el('Key').addEventListener('input',()=>{sharedKey=false;scheduleModels();});
    async function unlockSharedKey(passcode,{autoConnect=false}={}) {
        const data=window.SharedAIKey;
        try {
            if (!data || data.version!==1 || !['openai','anthropic','google'].includes(data.provider) || data.iterations!==600000) throw new Error('Invalid shared key configuration.');
            if (!window.isSecureContext || !crypto.subtle) throw new Error('Shared access requires HTTPS or localhost.');
            const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
            const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passcode),'PBKDF2',false,['deriveKey']);
            const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(data.salt),iterations:data.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
            const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(data.iv)},key,bytes(data.ciphertext));
            el('Provider').value=data.provider;cloudProvider=data.provider;providerChanged();
            el('Key').value=new TextDecoder().decode(plain);sharedKey=true;updateSharedKeyControls();el('Privacy').textContent='Shared access is kept in memory for this page session. The key is accessible to anyone using it and requests are sent to the provider. Cloud API charges may apply.';if(autoConnect){invalidateModels();await loadModels({autoConnect:true});}else scheduleModels();
        } catch(error) {
            const message=error.name==='OperationError'?'Incorrect passcode or damaged shared key.':error.message;
            el('Status').textContent=message;
            if(autoConnect){el('Open').textContent='Connect an AI';el('State').textContent='Shared AI connection failed: '+message;}
        }
    }
    el('Unlock').addEventListener('click',async()=>{
        let passcode;
        try {
            if (!navigator.clipboard?.readText) throw new Error('Clipboard unavailable');
            passcode=await navigator.clipboard.readText();
        } catch {
            passcode=window.prompt('Paste your shared access passcode:');
        }
        if (passcode) await unlockSharedKey(passcode);
    });
    el('DifferentKey').addEventListener('click',()=>{
        sharedKey=false;active=null;el('Key').value='';updateSharedKeyControls();
        el('Open').textContent='Connect an AI';el('Open').title='';el('State').textContent='';
        providerChanged();el('Key').focus();
    });
    el('Model').addEventListener('change',updateConnectButton);
    function connect(){
        const c=config(); if(modelsPending||!c.model)throw new Error('Wait for models to load and select a chat model first.');
        let saved=true;
        try{if(sharedKey) localStorage.removeItem(connectionStorageKey); else localStorage.setItem(connectionStorageKey,JSON.stringify({mode:connectionMode,cloudProvider,...c}));}catch{saved=false;}
        active=c;revision++;el('State').textContent=sharedKey?'Shared AI connected for this page session.':saved?'':'AI connected, but this browser could not save the connection. Reconnect manually next time.';
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
        active=null;sharedKey=false;el('Key').value='';updateSharedKeyControls();invalidateModels();el('State').textContent=removed?'AI disconnected.':'AI disconnected, but saved site data could not be removed. Clear this site’s browser storage to forget the key.';el('Open').textContent='Connect an AI';el('Open').title='';el('Status').textContent='Disconnected.';
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
    const urlPasscode=window.sharedAIPasscodeFromUrl;
    delete window.sharedAIPasscodeFromUrl;
    if(urlPasscode!==undefined && urlPasscode!==null){
        providerChanged();
        el('Open').textContent='Connecting AI…';
        el('State').textContent='Connecting shared AI…';
        void unlockSharedKey(urlPasscode,{autoConnect:true});
    } else if(!restoreConnection())providerChanged();
})();
