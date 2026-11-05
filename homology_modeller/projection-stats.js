// Distributions are binned in the projection worker; only small summaries are retained.
(function(root){
    const records=[];let frame=0;
    function schedule(){if(!frame)frame=requestAnimationFrame(render);}
    function reset(){records.length=0;schedule();}
    function start(label){const record={label,samples:[],status:'Running'};records.push(record);schedule();return record;}
    function add(record,sample){if(!records.includes(record))return;record.samples.push(sample);schedule();}
    function finish(record,status){if(!records.includes(record))return;record.status=status;schedule();}
    function render(){
        frame=0;const host=document.getElementById('projectionStatsRows');if(!host)return;
        host.replaceChildren();
        if(!records.length){host.textContent='Projection statistics appear when a build starts.';return;}
        const ns='http://www.w3.org/2000/svg';
        for(const record of records){
            const section=document.createElement('div');section.style.cssText='margin:0 0 24px;';
            const heading=document.createElement('h4');heading.style.cssText='font-weight:600;color:#a78bfa;margin:0 0 4px';heading.textContent=`${record.label} · ${record.status}`;section.append(heading);
            const note=document.createElement('p');note.style.cssText='font-size:12px;color:#94a3b8;margin:0 0 8px';note.textContent='Bars: clash pairs. Heatmap: residues by their worst overlap as a percentage of the exclusion distance (5% bins); brighter means more residues. Residues without clashes are excluded.';section.append(note);
            if(!record.samples.length){const empty=document.createElement('p');empty.textContent='Waiting for the first completed repeat…';empty.style.fontSize='12px';section.append(empty);host.append(section);continue;}
            const wrap=document.createElement('div');wrap.style.cssText='overflow-x:auto;max-width:100%';
            const width=Math.max(560,75+record.samples.length*12),height=270,left=64,right=12,top=20,barHeight=65,heatTop=105,heatHeight=120,plotWidth=width-left-right,col=plotWidth/record.samples.length;
            const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${record.label}: clash counts and residue overlap distribution across ${record.samples.length} projection repeats`);svg.style.cssText='display:block;max-width:none;font:11px sans-serif;color:#cbd5e1';
            const el=(name,attrs,text)=>{const item=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))item.setAttribute(k,String(v));if(text!==undefined)item.textContent=text;svg.append(item);return item;};
            const maxClashes=Math.max(1,...record.samples.map(s=>s.clashes));
            let maxBin=1;for(const sample of record.samples)for(const count of sample.bins)maxBin=Math.max(maxBin,count);
            const text=(x,y,value,anchor='end')=>el('text',{x,y,fill:'#94a3b8','text-anchor':anchor},value);
            text(left-6,top+9,'Clashes');text(left-6,top+22,maxClashes.toLocaleString());text(left-6,heatTop+4,'100%');text(left-6,heatTop+heatHeight/2+4,'50%');text(left-6,heatTop+heatHeight+4,'0%');
            for(let i=0;i<record.samples.length;i++){
                const sample=record.samples[i],x=left+i*col,h=barHeight*sample.clashes/maxClashes;
                const bar=el('rect',{x:x+0.5,y:top+barHeight-h,width:Math.max(0.5,col-1),height:h,fill:'#a78bfa'});const barTitle=document.createElementNS(ns,'title');barTitle.textContent=`Repeat ${i+1}: ${sample.clashes} clash pairs`;bar.append(barTitle);
                for(let bin=0;bin<sample.bins.length;bin++){
                    const count=sample.bins[bin],brightness=count?Math.sqrt(count/maxBin):0;
                    const fill=count?`rgb(${Math.round(35+220*brightness)},${Math.round(32+190*brightness)},${Math.round(48+35*brightness)})`:'#101827';
                    const cell=el('rect',{x:x+0.5,y:heatTop+heatHeight-(bin+1)*heatHeight/sample.bins.length,width:Math.max(0.5,col-1),height:heatHeight/sample.bins.length,fill});
                    const title=document.createElementNS(ns,'title');title.textContent=`Repeat ${i+1}: ${count} residues, overlap ${bin*5}–${(bin+1)*5}%`;cell.append(title);
                }
            }
            el('line',{x1:left,y1:top+barHeight,x2:width-right,y2:top+barHeight,stroke:'#64748b'});
            text(left,heatTop+heatHeight+18,'1','start');text(width-right,heatTop+heatHeight+18,String(record.samples.length));text(left+plotWidth/2,height-4,'Projection repeat','middle');
            wrap.append(svg);section.append(wrap);host.append(section);
        }
    }
    root.ProjectionStats={reset,start,add,finish};
})(globalThis);
