/* Variable types describe scientific values, never their rendered colours. */
(function(root){
    const metadata={};
    const add=(names,type,level,unit='')=>names.split(' ').forEach(name=>metadata[name]={id:name,type,level,unit});
    add('chain protein-id uniform','categorical','chain');
    add('element side-chains','categorical','atom');
    add('origin aligned membrane membrane-repelled charge secondary binding-sites binding-site-type','categorical','residue');
    add('residue-index','continuous','residue','zero-based');
    add('accessible-surface-area','continuous','residue','0–1; estimated accessibility');
    add('hydrophobicity','continuous','residue','Kyte–Doolittle');
    add('plddt','continuous','residue','0–100');
    add('pattern-variance','continuous','chain','Å');
    add('rotational-symmetry equivalent-protein-shape keyframe-difference difference af-difference','continuous','residue','Å');
    add('residue-speed','continuous','residue','Å/s');
    add('mutation-effect-basic membrane-placement','continuous','residue','0–1');
    add('constraint-confidence membrane-score model-confidence qmeandisco','continuous','residue','0–1; mean of incident restraints where applicable');
    add('spring-strain','continuous','residue','fraction; mean of incident restraints');
    add('alpha-pae','continuous','residue','Å; mean of incident restraints');
    const featureNames='topological domain transmembrane intramembrane active-site binding-site signal transit region motif modified glycosylation disulfide';
    featureNames.split(' ').forEach(name=>metadata['uniprot-'+name]={type:'categorical',level:'residue',unit:''});
    function plan(x,y){
        const indexAxis=x.id==='residue-index'?'x':y.id==='residue-index'?'y':null;
        return {indexAxis,kind:indexAxis&&(indexAxis==='x'?y:x).type==='categorical'?'sequence':x.type==='continuous'&&y.type==='continuous'?'scatter':x.type==='categorical'&&y.type==='categorical'?'heatmap':'box',
            level:x.level==='atom'||y.level==='atom'?'atom':x.level==='chain'&&y.level==='chain'?'chain':'residue'};
    }
    const valid=(value,meta)=>meta.type==='continuous'?Number.isFinite(value):value!==null&&value!==undefined&&value!=='';
    function pairRows(rows,x,y){return rows.filter(row=>valid(row.x,x)&&valid(row.y,y));}
    function quantile(sorted,p){const index=(sorted.length-1)*p,lo=Math.floor(index);return sorted[lo]+(sorted[Math.ceil(index)]-sorted[lo])*(index-lo);}
    function palette(light){return light?{background:'#ffffff',text:'#0f172a',grid:'#64748b',empty:'#f1f5f9'}:{background:'#020617',text:'#cbd5e1',grid:'#1e293b',empty:'#1e293b'};}
    function visibleRows(rows,hiddenChains){return rows.filter(row=>!hiddenChains?.has(row.chain||'Unknown'));}
    function exportKey(chains,hiddenChains,xMode,yMode){return xMode==='chain'||yMode==='chain'?[]:chains.filter(entry=>!hiddenChains?.has(entry.chain));}
    function chainSeries(rows,indexAxis){
        const groups=new Map();for(const row of rows){const chain=row.chain||'Unknown';if(!groups.has(chain))groups.set(chain,[]);groups.get(chain).push(row);}
        return [...groups.values()].map(group=>group.slice().sort((a,b)=>a[indexAxis]-b[indexAxis]));
    }
    function wrapLabel(value,maxWidth,measure){
        const words=String(value).split(/\s+/),lines=[];let line='';
        for(const word of words){
            if(line&&measure(line+' '+word)<=maxWidth){line+=' '+word;continue;}
            if(line){lines.push(line);line='';}
            for(const char of word){if(line&&measure(line+char)>maxWidth){lines.push(line);line='';}line+=char;}
        }
        if(line)lines.push(line);return lines.length?lines:[''];
    }
    function plotLayout(containerWidth,xCategories,yCategories,mode,chainCount,labels,measure,measureTitle){
        const widest=values=>values.reduce((max,value)=>Math.max(max,measure(value)),0);
        const xSlot=Math.max(70,Math.min(180,widest(xCategories)+20),mode.kind==='sequence'?chainCount*12:0);
        const xLines=new Map(xCategories.map(value=>[value,wrapLabel(value,xSlot-14,measure)]));
        const yLines=new Map(yCategories.map(value=>[value,wrapLabel(value,240,measure)]));
        const maxLines=map=>Math.max(1,...[...map.values()].map(lines=>lines.length));
        const left=Math.max(130,widest([...yLines.values()].flat())+65),bottomMargin=Math.max(105,maxLines(xLines)*16+65);
        const ySlot=Math.max(30,maxLines(yLines)*16+12,mode.kind==='sequence'?chainCount*12:0);
        const width=Math.max(containerWidth||650,650,left+35+450,left+35+xCategories.length*xSlot,left+35+measureTitle(labels[0])+20);
        const height=Math.max(420,25+bottomMargin+290,25+bottomMargin+yCategories.length*ySlot,25+bottomMargin+measureTitle(labels[1])+20);
        return {width,height,left,top:25,right:width-35,bottom:height-bottomMargin,xLines,yLines};
    }
    function linearRegression(rows){
        const values=rows.filter(row=>Number.isFinite(row.x)&&Number.isFinite(row.y)),n=values.length;
        if(n<2)return {n,slope:null,intercept:null,r:null};
        // Online centred moments avoid subtracting nearly equal large sums.
        let meanX=0,meanY=0,xx=0,yy=0,xy=0,count=0;
        for(const row of values){count++;const dx=row.x-meanX,dy=row.y-meanY;meanX+=dx/count;meanY+=dy/count;xx+=dx*(row.x-meanX);yy+=dy*(row.y-meanY);xy+=dx*(row.y-meanY);}
        const slope=xx>0?xy/xx:null,r=xx>0&&yy>0?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
        return {n,slope,intercept:slope===null?null:meanY-slope*meanX,r,meanX,meanY};
    }
    function chainRegressions(rows){
        return chainSeries(rows,'x').map(series=>({chain:series[0].chain||'Unknown',color:series[0].color||'#38bdf8',rows:series,...linearRegression(series)}));
    }
    function draw(canvas,rows,x,y,labels,options={}){
        rows=visibleRows(rows,options.hiddenChains);
        const colors=palette(options.light);
        const mode=plan(x,y);
        // Bound categorical grids while preserving every observation and count.
        for(const [key,meta] of [['x',x],['y',y]])if(meta.type==='categorical'){
            const counts=new Map();for(const row of rows)counts.set(row[key],(counts.get(row[key])||0)+1);
            if(counts.size>24){const keep=new Set([...counts].sort((a,b)=>b[1]-a[1]).slice(0,23).map(entry=>entry[0]));rows=rows.map(row=>({...row,[key]:keep.has(row[key])?row[key]:'Other categories (grouped)'}));}
        }
        const xc=[...new Set(rows.map(r=>r.x))].sort((a,b)=>String(a).localeCompare(String(b))),yc=[...new Set(rows.map(r=>r.y))].sort((a,b)=>String(a).localeCompare(String(b)));
        const cats=x.type==='categorical'?xc:yc,chains=[...new Set(rows.map(row=>row.chain||'Unknown'))];
        const chainColor=chain=>rows.find(row=>(row.chain||'Unknown')===chain)?.color||'#38bdf8';
        const ctx=canvas.getContext('2d'),fontFamily=options.fontFamily||'system-ui, -apple-system, sans-serif';
        ctx.font=`12px ${fontFamily}`;
        const measure=value=>ctx.measureText?.(String(value))?.width??String(value).length*7;
        const measureTitle=value=>{ctx.font=`bold 16px ${fontFamily}`;const width=measure(value);ctx.font=`12px ${fontFamily}`;return width;};
        const layout=plotLayout(options.width??canvas.parentElement?.clientWidth,x.type==='categorical'?xc:[],y.type==='categorical'?yc:[],mode,chains.length,labels,measure,measureTitle);
        const fits=options.trend&&mode.kind==='scatter'?chainRegressions(rows):[];
        const correlationLabels=fits.map(fit=>({color:fit.color,lines:wrapLabel(`${fit.chain}: Pearson r = ${fit.r===null?'undefined (insufficient data or constant variable)':Number(fit.r.toFixed(3)).toFixed(3)} · n = ${fit.n}`,layout.right-layout.left,measure)}));
        const extraTop=Math.max(0,12+correlationLabels.reduce((count,label)=>count+label.lines.length,0)*18-layout.top);
        const {width,left,right,xLines,yLines}=layout,top=layout.top+extraTop,height=layout.height+extraTop,bottom=layout.bottom+extraTop;
        const ratio=options.pixelRatio||window.devicePixelRatio||1;canvas.width=width*ratio;canvas.height=height*ratio;canvas.style.width=width+'px';canvas.style.height=height+'px';
        ctx.scale(ratio,ratio);ctx.fillStyle=colors.background;ctx.fillRect(0,0,width,height);ctx.font=`12px ${fontFamily}`;
        const hits=[];
        const text=(s,px,py,align='left',color=colors.text)=>{ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,px,py);};
        const categoryText=(value,px,py,align)=>{const vertical=align==='right',lines=(vertical?yLines:xLines).get(value)||[String(value)];lines.forEach((line,i)=>text(line,px,py+i*16-(vertical?(lines.length-1)*8:0),align));};
        function range(values){let lo=Infinity,hi=-Infinity;for(const v of values){lo=Math.min(lo,v);hi=Math.max(hi,v);}if(lo===hi){lo-=.5;hi+=.5;}return [lo,hi];}
        function axis(values,horizontal){const [lo,hi]=range(values);for(let i=0;i<=4;i++){const indexAxis=mode.indexAxis===(horizontal?'x':'y'),value=indexAxis?Math.round(lo+(hi-lo)*i/4):lo+(hi-lo)*i/4,p=horizontal?left+(right-left)*(value-lo)/(hi-lo):bottom-(bottom-top)*(value-lo)/(hi-lo),label=indexAxis?String(value):value.toPrecision(3);ctx.strokeStyle=colors.grid;ctx.beginPath();if(horizontal){ctx.moveTo(p,top);ctx.lineTo(p,bottom);text(label,p,bottom+20,'center');}else{ctx.moveTo(left,p);ctx.lineTo(right,p);text(label,left-10,p+4,'right');}ctx.stroke();}return v=>horizontal?left+(v-lo)/(hi-lo)*(right-left):bottom-(v-lo)/(hi-lo)*(bottom-top);}
        if(!rows.length){
            text('All chains are hidden. Use the chain key to show a chain.',width/2,height/2,'center');canvas.onclick=event=>options.onClear?.(event);canvas.onmousemove=null;canvas.style.cursor='default';canvas.setAttribute('aria-label','All chains hidden');return;
        }
        if(mode.kind==='scatter'){
            const px=axis(rows.map(r=>r.x),true),py=axis(rows.map(r=>r.y),false);
            if(mode.indexAxis){
                for(const series of chainSeries(rows,mode.indexAxis)){
                    ctx.strokeStyle=series[0].color||'#38bdf8';ctx.lineWidth=1.3;ctx.globalAlpha=.8;ctx.beginPath();
                    series.forEach((row,i)=>{if(i===0)ctx.moveTo(px(row.x),py(row.y));else ctx.lineTo(px(row.x),py(row.y));});ctx.stroke();
                }
                ctx.globalAlpha=1;
            }
            if(options.trend){
                const [ymin,ymax]=range(rows.map(row=>row.y));
                for(const fit of fits){
                    if(fit.slope===null)continue;
                    const [xmin,xmax]=range(fit.rows.map(row=>row.x));let lo=xmin,hi=xmax;
                    if(fit.slope!==0){const a=fit.meanX+(ymin-fit.meanY)/fit.slope,b=fit.meanX+(ymax-fit.meanY)/fit.slope;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
                    if(lo<=hi){ctx.strokeStyle=fit.color;ctx.lineWidth=2;ctx.setLineDash?.([6,4]);ctx.beginPath();ctx.moveTo(px(lo),py(fit.meanY+fit.slope*(lo-fit.meanX)));ctx.lineTo(px(hi),py(fit.meanY+fit.slope*(hi-fit.meanX)));ctx.stroke();ctx.setLineDash?.([]);}
                }
                let labelY=16;for(const label of correlationLabels)for(const line of label.lines){text(line,left,labelY,'left',label.color);labelY+=18;}
            }
            // Draw selected points last so overlapping residues cannot cover the glow.
            for(const row of [...rows].sort((a,b)=>Number(!!a.selected)-Number(!!b.selected))){
                const a=px(row.x),b=py(row.y);ctx.fillStyle=row.selected?'#facc15':row.color||'#38bdf8';ctx.globalAlpha=row.selected?1:.7;
                ctx.shadowColor=row.selected?'#facc15':'transparent';ctx.shadowBlur=row.selected?14:0;
                ctx.beginPath();ctx.arc(a,b,row.selected?4.5:3,0,Math.PI*2);ctx.fill();
                hits.push({x:a,y:b,row,label:`${row.label}: ${row.x} × ${row.y}`});
            }
            ctx.globalAlpha=1;ctx.shadowBlur=0;
        }else if(mode.kind==='sequence'){
            // Keep the residue positions: distributions hide where categories change along a chain.
            const horizontal=mode.indexAxis==='x',indexKey=mode.indexAxis,categoryKey=horizontal?'y':'x',scale=axis(rows.map(row=>row[indexKey]),horizontal);
            const span=horizontal?bottom-top:right-left,categoryStep=span/cats.length,chainStep=categoryStep/chains.length;
            const [lo,hi]=range(rows.map(row=>row[indexKey])),tick=Math.max(1,(horizontal?right-left:bottom-top)/(hi-lo)*.8);
            cats.forEach((cat,i)=>{
                categoryText(cat,horizontal?left-10:left+(i+.5)*categoryStep,horizontal?top+(i+.5)*categoryStep+4:bottom+22,horizontal?'right':'center');
                ctx.strokeStyle=colors.grid;ctx.globalAlpha=.3;ctx.beginPath();
                if(horizontal){ctx.moveTo(left,top+i*categoryStep);ctx.lineTo(right,top+i*categoryStep);}else{ctx.moveTo(left+i*categoryStep,top);ctx.lineTo(left+i*categoryStep,bottom);}ctx.stroke();ctx.globalAlpha=1;
            });
            for(const row of rows){
                const category=cats.indexOf(row[categoryKey]),chain=chains.indexOf(row.chain||'Unknown'),position=(horizontal?top:left)+category*categoryStep+(chain+.5)*chainStep,index=scale(row[indexKey]);
                const half=Math.max(1,Math.min(5,chainStep*.35));ctx.fillStyle=row.selected?'#facc15':row.color||'#38bdf8';
                ctx.shadowColor=row.selected?'#facc15':'transparent';ctx.shadowBlur=row.selected?10:0;
                if(horizontal)ctx.fillRect(index-tick/2,position-half,tick,half*2);else ctx.fillRect(position-half,index-tick/2,half*2,tick);
                hits.push({x:horizontal?index:position,y:horizontal?position:index,row,label:`${row.label}: residue index ${row[indexKey]} · ${row[categoryKey]}`,radius:Math.max(5,half)});
            }
            ctx.shadowBlur=0;
        }else if(mode.kind==='heatmap'){
            const counts=new Map();for(const row of rows){const key=JSON.stringify([row.x,row.y]);if(!counts.has(key))counts.set(key,new Map());const group=counts.get(key),chain=row.chain||'Unknown';group.set(chain,(group.get(chain)||0)+1);}
            const cw=(right-left)/xc.length,ch=(bottom-top)/yc.length;
            xc.forEach((a,i)=>categoryText(a,left+(i+.5)*cw,bottom+22,'center'));yc.forEach((b,j)=>categoryText(b,left-10,top+(j+.5)*ch+4,'right'));
            xc.forEach((a,i)=>yc.forEach((b,j)=>{
                const group=counts.get(JSON.stringify([a,b]))||new Map(),count=[...group.values()].reduce((a,b)=>a+b,0);let offset=0;
                ctx.fillStyle=colors.empty;ctx.fillRect(left+i*cw,top+j*ch,cw-1,ch-1);
                for(const chain of chains){const n=group.get(chain)||0;if(!n)continue;const segment=(cw-1)*n/count;ctx.fillStyle=chainColor(chain);ctx.globalAlpha=1;ctx.fillRect(left+i*cw+offset,top+j*ch,segment,ch-1);offset+=segment;}
                ctx.globalAlpha=1;text(count,left+(i+.5)*cw,top+(j+.5)*ch+4,'center');
                hits.push({x:left+(i+.5)*cw,y:top+(j+.5)*ch,bounds:[left+i*cw,top+j*ch,left+(i+1)*cw,top+(j+1)*ch],label:`${a} × ${b}: ${count} ${mode.level}s · ${[...group].map(([chain,n])=>`${chain}: ${n}`).join(', ')}`,radius:Math.min(cw,ch)/2});
            }));
        }else{
            const horizontal=x.type==='continuous',scale=axis(rows.map(r=>horizontal?r.x:r.y),horizontal),groups=new Map(cats.map(c=>[c,new Map()]));
            rows.forEach(r=>{const group=groups.get(horizontal?r.y:r.x),chain=r.chain||'Unknown';if(!group.has(chain))group.set(chain,[]);group.get(chain).push(horizontal?r.x:r.y);});
            const step=(horizontal?bottom-top:right-left)/cats.length;
            cats.forEach((cat,i)=>{
                const group=groups.get(cat),present=chains.filter(chain=>group.has(chain)),slot=step*.8/present.length;
                categoryText(cat,horizontal?left-10:left+(i+.5)*step,horizontal?top+(i+.5)*step+4:bottom+22,horizontal?'right':'center');
                present.forEach((chain,j)=>{
                    const values=group.get(chain).sort((a,b)=>a-b),q=[values[0],quantile(values,.25),quantile(values,.5),quantile(values,.75),values.at(-1)].map(scale),pos=(horizontal?top:left)+(i+.1)*step+(j+.5)*slot,half=Math.min(16,slot*.35);
                    ctx.strokeStyle=chainColor(chain);ctx.fillStyle=chainColor(chain);ctx.beginPath();
                    if(horizontal){ctx.moveTo(q[0],pos);ctx.lineTo(q[4],pos);ctx.globalAlpha=.35;ctx.fillRect(q[1],pos-half,q[3]-q[1],half*2);ctx.globalAlpha=1;ctx.strokeRect(q[1],pos-half,q[3]-q[1],half*2);ctx.moveTo(q[2],pos-half);ctx.lineTo(q[2],pos+half);}
                    else{ctx.moveTo(pos,q[0]);ctx.lineTo(pos,q[4]);ctx.globalAlpha=.35;ctx.fillRect(pos-half,q[3],half*2,q[1]-q[3]);ctx.globalAlpha=1;ctx.strokeRect(pos-half,q[3],half*2,q[1]-q[3]);ctx.moveTo(pos-half,q[2]);ctx.lineTo(pos+half,q[2]);}
                    ctx.stroke();hits.push({x:horizontal?q[2]:pos,y:horizontal?pos:q[2],bounds:horizontal?[Math.min(q[0],q[4]),pos-half,Math.max(q[0],q[4]),pos+half]:[pos-half,Math.min(q[0],q[4]),pos+half,Math.max(q[0],q[4])],label:`${cat} · ${chain}: n=${values.length}, median=${quantile(values,.5).toPrecision(4)}, range=${values[0]}–${values.at(-1)}`,radius:Math.max(6,Math.min(25,slot/2))});
                });
            });
        }
        ctx.font=`bold 16px ${fontFamily}`;text(labels[0],(left+right)/2,height-22,'center');ctx.save();ctx.translate(24,(top+bottom)/2);ctx.rotate(-Math.PI/2);text(labels[1],0,0,'center');ctx.restore();ctx.font=`12px ${fontFamily}`;
        const hitAt=event=>{const rect=canvas.getBoundingClientRect(),px=(event.clientX-rect.left)*width/rect.width,py=(event.clientY-rect.top)*height/rect.height;let nearest=null,distance=Infinity;for(const hit of hits){const d=Math.hypot(px-hit.x,py-hit.y);const inside=hit.bounds?px>=hit.bounds[0]&&py>=hit.bounds[1]&&px<=hit.bounds[2]&&py<=hit.bounds[3]:d<(hit.radius||9);if(inside&&d<=distance){nearest=hit;distance=d;}}return nearest;};
        canvas.onmousemove=event=>{const hit=hitAt(event);document.getElementById('physicsCompareHover').textContent=hit?.label||'Hover over the plot to inspect values.';canvas.style.cursor=['scatter','sequence'].includes(mode.kind)&&hit?'pointer':'default';};
        canvas.onclick=event=>{const hit=hitAt(event);if(hit?.row&&['scatter','sequence'].includes(mode.kind))options.onSelect?.(hit.row,event);else if(!hit)options.onClear?.(event);};
        canvas.setAttribute('aria-label',`${mode.kind} plot comparing ${labels.join(' and ')}; ${rows.length} ${mode.level} observations.`);
    }
    const api={metadata,plan,pairRows,quantile,palette,visibleRows,chainSeries,wrapLabel,plotLayout,exportKey,linearRegression,chainRegressions,draw};if(typeof module!=='undefined')module.exports=api;else root.ProteinVariableComparison=api;
})(typeof window==='undefined'?globalThis:window);
