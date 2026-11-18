// In-memory diagnostics: model data and logs are never persisted.
(function(root){
    const key='stringscape-developer-mode',limit=5000;
    let enabled=false,host,list,frame=0,lastMessage='',lastProgress='';
    const entries=[];
    try{enabled=localStorage.getItem(key)==='true';}catch{}
    function record(message){
        if(!enabled||!message)return;
        message=String(message);
        if(message===lastMessage)return;
        lastMessage=message;
        entries.push({time:new Date().toLocaleTimeString(),message});
        if(entries.length>limit)entries.splice(0,entries.length-limit);
        if(!frame)frame=requestAnimationFrame(render);
    }
    function render(){
        frame=0;if(!list||!host.open||host.hidden)return;
        const follow=list.scrollHeight-list.scrollTop-list.clientHeight<40;
        const fragment=document.createDocumentFragment();
        for(const entry of entries){const row=document.createElement('li');row.textContent=`${entry.time}  ${entry.message}`;fragment.append(row);}
        if(!entries.length){const row=document.createElement('li');row.textContent='Waiting for model-building activity…';fragment.append(row);}
        list.replaceChildren(fragment);
        if(follow)list.scrollTop=list.scrollHeight;
    }
    function progress(operation,event){
        // Keep worker progress to stage changes and 10% milestones.
        const percent=event.total>0?Math.floor(10*event.completed/event.total)*10:null;
        const stamp=`${operation}:${event.stage}:${percent}`;
        if(stamp===lastProgress)return;lastProgress=stamp;
        record(`${operation} · ${event.stage || 'processing'}${percent===null?'':` · ${event.completed}/${event.total} (${percent}%)`}`);
    }
    function mount(){
        const toggle=document.getElementById('developerModeToggle'),about=document.getElementById('aboutProteinComplex');
        if(!toggle||!about||host)return;
        host=document.createElement('details');host.id='developerLog';host.className='developer-log';host.open=true;host.hidden=!enabled;
        const summary=document.createElement('summary');summary.textContent='Developer activity log';
        list=document.createElement('ol');list.setAttribute('role','log');list.setAttribute('aria-label','Model-building activity');list.setAttribute('aria-live','polite');list.setAttribute('aria-relevant','additions');
        const note=document.createElement('p');note.textContent='Latest 5,000 events · captured while developer mode is on · kept for this visit';
        const toolbar=document.createElement('div');toolbar.className='developer-log-toolbar';
        const copy=document.createElement('button');copy.type='button';copy.className='developer-log-copy';copy.textContent='Copy log';copy.setAttribute('aria-label','Copy developer activity log');
        const copyStatus=document.createElement('span');copyStatus.setAttribute('role','status');
        let feedbackTimer;
        copy.addEventListener('click',async()=>{
            const text=entries.map(entry=>`${entry.time}  ${entry.message}`).join('\n');
            try{
                await navigator.clipboard.writeText(text);
                copyStatus.textContent='Copied';
            }catch{copyStatus.textContent='Could not copy log. Try again.';}
            clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{copyStatus.textContent='';},3000);
        });
        toolbar.append(note,copy);host.append(summary,toolbar,copyStatus,list);about.before(host);
        host.addEventListener('toggle',render);
        toggle.checked=enabled;
        toggle.addEventListener('change',()=>{
            enabled=toggle.checked;host.hidden=!enabled;
            try{localStorage.setItem(key,String(enabled));}catch{}
            if(enabled){record('Developer mode enabled');render();}
        });
        // Existing simulation messages expose convergence, phases, and network progress.
        for(const id of ['groupSimulationStatusText','physicsLoadingStatus','loadingStatus']){
            const element=document.getElementById(id);if(!element)continue;
            let previous='';new MutationObserver(()=>{const text=element.textContent.trim();if(text&&text!==previous){previous=text;record(text);}}).observe(element,{childList:true,subtree:true,characterData:true});
        }
        if(enabled)record('Developer mode enabled');render();
    }
    root.DeveloperLog={record,progress,mount};
})(globalThis);
