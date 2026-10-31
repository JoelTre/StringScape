// Browser memory signals are estimates, not system-wide available RAM.
(function(root){
    'use strict';
    function create(perf, isolated, onUpdate, clock=()=>Date.now()){
        const state={pageBytes:null,heapUsedBytes:null,heapHeadroomBytes:null,pageStatus:'unavailable'};
        let pending=false,lastAttempt=-Infinity;
        function update(){
            const heap=perf.memory;
            const used=Number(heap?.usedJSHeapSize),limit=Number(heap?.jsHeapSizeLimit);
            state.heapUsedBytes=Number.isFinite(used)&&used>=0?used:null;
            state.heapHeadroomBytes=state.heapUsedBytes!==null&&Number.isFinite(limit)&&limit>0?Math.max(0,limit-used):null;
            onUpdate(state);
            if(!isolated||typeof perf.measureUserAgentSpecificMemory!=='function'||pending||clock()-lastAttempt<10000)return;
            pending=true;lastAttempt=clock();
            Promise.resolve().then(()=>perf.measureUserAgentSpecificMemory()).then(result=>{
                state.pageBytes=Number.isFinite(result?.bytes)&&result.bytes>=0?result.bytes:null;
                state.pageStatus=state.pageBytes===null?'unavailable':'estimated';
            }).catch(()=>{state.pageBytes=null;state.pageStatus='unavailable';}).finally(()=>{pending=false;onUpdate(state);});
        }
        return {state,update};
    }
    root.MemoryMonitor={create};
})(globalThis);
