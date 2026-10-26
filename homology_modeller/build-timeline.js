// Wall-clock stage timings; concurrent work may overlap in the timeline.
(function(root){
    const state={startedAt:null,finishedAt:null,rows:[],preparing:false,lastRender:0};
    function reset(preparing=false){Object.assign(state,{startedAt:performance.now(),finishedAt:null,rows:[],preparing,lastRender:0});render();}
    function start(label,aggregate=false){
        if(state.startedAt===null)reset();
        if(state.finishedAt!==null)return null;
        let row=aggregate?state.rows.find(item=>item.label===label):null;
        if(row){if(row.end!==null){row.start=performance.now();row.end=null;}row.depth++;row.status='Running';}
        else {row={label,start:performance.now(),end:null,status:'Running',elapsed:0,depth:1};state.rows.push(row);}
        render();return row;
    }
    function end(row,status='Done'){if(!row||row.end!==null)return;if(--row.depth>0)return;row.end=performance.now();row.elapsed+=row.end-row.start;row.status=status;render();}
    function finish(status='Done'){completeCalculations(status);for(const row of state.rows)if(row.end===null){row.depth=1;end(row,status);}state.finishedAt=performance.now();state.preparing=false;render();}
    function beginBuild(){if(!state.preparing||state.finishedAt!==null)reset();state.preparing=false;}
    function prepare(){if(!state.preparing||state.finishedAt!==null)reset(true);}
    function render(){
        const host=document.getElementById('buildTimelineRows'),total=document.getElementById('buildTimelineTotal');
        if(!host||!total)return;
        const now=performance.now();state.lastRender=now;
        // Always use seconds, including sub-second stages.
        total.textContent=state.startedAt===null?'—':`${(((state.finishedAt??now)-state.startedAt)/1000).toFixed(1)} s`;
        host.replaceChildren();
        if(!state.rows.length){const empty=document.createElement('li');empty.textContent='Stage timings appear when a search or build starts.';host.append(empty);}
        for(const row of state.rows){
            const item=document.createElement('li'),label=document.createElement('span'),value=document.createElement('span');
            label.textContent=row.label;value.textContent=`${((row.elapsed+(row.end===null?now-row.start:0))/1000).toFixed(1)} s · ${row.status}`;
            item.className=row.end===null||row.calculation&&!row.sealed?'build-timeline-running':'';item.append(label,value);host.append(item);
        }
    }
    function wrap(label,fn){return function(...args){
        if(state.startedAt===null||state.finishedAt!==null)return fn.apply(this,args);
        const row=start(typeof label==='function'?label():label,true);
        try{const result=fn.apply(this,args);if(result&&typeof result.then==='function')return result.then(value=>{end(row);return value;},error=>{end(row,'Failed');throw error;});end(row);return result;}
        catch(error){end(row,'Failed');throw error;}
    };}
    const calculationStack=[];
    function recordCalculation(label,duration){
        if(state.startedAt===null||state.finishedAt!==null)return;
        let row=state.rows.find(item=>item.label===label);
        if(!row){row={label,start:performance.now(),end:performance.now(),status:'Calculating (on demand)',elapsed:0,depth:0,calculation:true,sealed:false};state.rows.push(row);}
        if(row.sealed)return;
        row.elapsed+=Math.max(0,duration);
    }
    function completeCalculations(status='Done'){
        for(const row of state.rows)if(row.calculation&&!row.sealed){row.sealed=true;row.status=status;row.end=performance.now();}
        render();
    }
    function wrapCalculation(label,fn){return function(...args){
        if(state.startedAt===null||state.finishedAt!==null)return fn.apply(this,args);
        const name=typeof label==='function'?label(...args):label;
        if(!name)return fn.apply(this,args);
        const sample={start:performance.now(),children:0};calculationStack.push(sample);
        try{return fn.apply(this,args);}
        finally{
            const elapsed=performance.now()-sample.start;calculationStack.pop();
            if(calculationStack.length)calculationStack[calculationStack.length-1].children+=elapsed;
            recordCalculation(name,elapsed-sample.children);
        }
    };}
    root.BuildTimeline={state,reset,start,end,finish,beginBuild,prepare,render,wrap,wrapCalculation,completeCalculations};
    setInterval(()=>{if(state.startedAt!==null&&state.finishedAt===null)render();},250);
})(globalThis);
