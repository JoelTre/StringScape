'use strict';
function benchmarkPlotColours(){
    return document.documentElement.dataset.theme==='light'
        ? {background:'#f7fafc', grid:'#d6e1e8', text:'#344e60', axis:'#587184', label:'#172b3c', emphasis:'#172b3c', identity:'#71899a', muted:'#587184'}
        : {background:'#0a1726', grid:'#263d50', text:'#b9cddb', axis:'#a8bdcd', label:'#dbe8f7', emphasis:'#ffffff', identity:'#c2d1df', muted:'#a8bbd0'};
}
function benchmarkMeanByX(points){
    const groups=new Map();
    for(const point of points){const group=groups.get(point.x)||{x:point.x,y:0,n:0};group.y+=point.y;group.n++;groups.set(point.x,group);}
    return [...groups.values()].map(({x,y,n})=>({x,y:y/n}));
}
// A constant or empty axis needs a nonzero span for drawing and interaction.
function benchmarkScatterBounds(points){
    const axis=key=>{let min=Infinity,max=-Infinity;for(const point of points){const value=point[key];if(Number.isFinite(value)){min=Math.min(min,value);max=Math.max(max,value);}}if(min===Infinity)return [0,1];if(min===max){const padding=Math.max(Math.abs(min)*0.05,0.5);return [min-padding,max+padding];}return [min,max];};
    const [xMin,xMax]=axis('x'),[yMin,yMax]=axis('y');return {xMin,xMax,yMin,yMax};
}
function benchmarkClampView(view,bounds){
    const clamp=(min,max,low,high)=>{const span=Math.min(max-min,high-low);min=Math.max(low,Math.min(min,high-span));return [min,min+span];};
    const [xMin,xMax]=clamp(view.xMin,view.xMax,bounds.xMin,bounds.xMax),[yMin,yMax]=clamp(view.yMin,view.yMax,bounds.yMin,bounds.yMax);return {xMin,xMax,yMin,yMax};
}
// Count neighbours within a radius of 5% of each axis range, centred on each point.
function benchmarkPointDensity(points){
    if(!points.length)return [];
    const bounds=benchmarkScatterBounds(points),radius=.05,cellSize=radius/2,cells=new Map();
    const coords=points.map(point=>({x:(point.x-bounds.xMin)/(bounds.xMax-bounds.xMin),y:(point.y-bounds.yMin)/(bounds.yMax-bounds.yMin)}));
    for(const point of coords){point.cx=Math.floor(point.x/cellSize);point.cy=Math.floor(point.y/cellSize);const key=`${point.cx},${point.cy}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(point);}
    return coords.map(point=>{let count=-1;
        for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
            const cx=point.cx+dx,cy=point.cy+dy,cell=cells.get(`${cx},${cy}`);if(!cell)continue;
            const left=cx*cellSize,right=left+cellSize,top=cy*cellSize,bottom=top+cellSize;
            const nearX=Math.max(left-point.x,0,point.x-right),nearY=Math.max(top-point.y,0,point.y-bottom);
            if(nearX*nearX+nearY*nearY>radius*radius)continue;
            const farX=Math.max(Math.abs(left-point.x),Math.abs(right-point.x)),farY=Math.max(Math.abs(top-point.y),Math.abs(bottom-point.y));
            if(farX*farX+farY*farY<=radius*radius){count+=cell.length;continue;}
            for(const other of cell)if((other.x-point.x)**2+(other.y-point.y)**2<=radius*radius)count++;
        }
        return count;
    });
}
// Quadratic least-squares fit in a centred, scaled x coordinate for stability.
function benchmarkQuadratic(points){
    if(points.length<3)return null;
    const xs=points.map(p=>p.x),min=xs.reduce((a,b)=>Math.min(a,b),Infinity),max=xs.reduce((a,b)=>Math.max(a,b),-Infinity),scale=(max-min)/2,centre=(max+min)/2;
    if(!(scale>0)||new Set(xs).size<3)return null;
    const sums=Array(5).fill(0),rhs=Array(3).fill(0);
    for(const {x,y} of points){const t=(x-centre)/scale;let power=1;for(let i=0;i<5;i++){sums[i]+=power;if(i<3)rhs[i]+=power*y;power*=t;}}
    const a=Array.from({length:3},(_,i)=>[...Array.from({length:3},(_,j)=>sums[i+j]),rhs[i]]);
    for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;if(Math.abs(a[pivot][i])<1e-10)return null;[a[i],a[pivot]]=[a[pivot],a[i]];const divisor=a[i][i];for(let j=i;j<4;j++)a[i][j]/=divisor;for(let k=0;k<3;k++)if(k!==i){const f=a[k][i];for(let j=i;j<4;j++)a[k][j]-=f*a[i][j];}}
    const coefficients=a.map(row=>row[3]);const fit=x=>{const t=(x-centre)/scale;return coefficients[0]+coefficients[1]*t+coefficients[2]*t*t;};const quadratic=coefficients[2]/(scale*scale),linear=coefficients[1]/scale-2*centre*quadratic,constant=coefficients[0]-coefficients[1]*centre/scale+quadratic*centre*centre;fit.coefficients={quadratic,linear,constant};return fit;
}
function benchmarkNumber(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function benchmarkScatter(canvas,points,options={}){
    const colours=benchmarkPlotColours();
    const {xLabel,yLabel,markYZero=false,identityLine=false,trend=false,legend=null}=options;
    let dotSize=1;
    if(canvas.closest?.('#results')&&canvas.parentNode){
        let slider=canvas._benchmarkDotSizeSlider;
        if(!slider){
            const label=document.createElement('label'),value=document.createElement('output');slider=document.createElement('input');
            label.className='scatter-dot-size';slider.type='range';slider.min='1';slider.max='10';slider.step='0.5';slider.value='1';
            slider.setAttribute('aria-label',`Dot size for ${canvas.getAttribute('aria-label')||'scatter plot'}`);
            value.textContent=slider.value;label.append('Dot size ',slider,' ',value);const reset=document.createElement('button');reset.type='button';reset.className='button secondary';reset.textContent='Reset zoom';reset.addEventListener('click',()=>{canvas._benchmarkZoom=null;canvas._benchmarkRedrawScatter?.();});label.append(' ',reset);const hint=document.createElement('span');hint.textContent='Scroll to zoom; drag with either mouse button to pan';label.append(' ',hint);canvas.parentNode.insertBefore(label,canvas);
            canvas.addEventListener('wheel',event=>{const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*1200,y=(event.clientY-rect.top)/rect.height*600,p=canvas._benchmarkPlotBounds;if(!p||x<p.left||x>p.right||y<p.top||y>p.bottom)return;event.preventDefault();const factor=Math.exp(Math.max(-1,Math.min(1,event.deltaY*.0015))),fx=(x-p.left)/(p.right-p.left),fy=(p.bottom-y)/(p.bottom-p.top),view=canvas._benchmarkView,anchorX=view.xMin+fx*(view.xMax-view.xMin),anchorY=view.yMin+fy*(view.yMax-view.yMin),width=(view.xMax-view.xMin)*factor,height=(view.yMax-view.yMin)*factor;if(width<1e-9||height<1e-9||width>1e12||height>1e12)return;canvas._benchmarkZoom=benchmarkClampView({xMin:anchorX-fx*width,xMax:anchorX+(1-fx)*width,yMin:anchorY-fy*height,yMax:anchorY+(1-fy)*height},canvas._benchmarkDataBounds);canvas._benchmarkRedrawScatter?.();},{passive:false});
            canvas.addEventListener('contextmenu',event=>event.preventDefault());
            canvas.addEventListener('pointerdown',event=>{if(event.button!==0&&event.button!==2)return;const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*1200,y=(event.clientY-rect.top)/rect.height*600,p=canvas._benchmarkPlotBounds;if(!p||x<p.left||x>p.right||y<p.top||y>p.bottom)return;event.preventDefault();canvas._benchmarkDrag={id:event.pointerId,x:event.clientX,y:event.clientY,view:{...canvas._benchmarkView}};canvas.setPointerCapture(event.pointerId);});
            canvas.addEventListener('pointermove',event=>{const drag=canvas._benchmarkDrag;if(!drag||drag.id!==event.pointerId)return;const rect=canvas.getBoundingClientRect(),p=canvas._benchmarkPlotBounds,view=drag.view,dx=(event.clientX-drag.x)/rect.width*1200/(p.right-p.left)*(view.xMax-view.xMin),dy=(event.clientY-drag.y)/rect.height*600/(p.bottom-p.top)*(view.yMax-view.yMin);canvas._benchmarkZoom=benchmarkClampView({xMin:view.xMin-dx,xMax:view.xMax-dx,yMin:view.yMin+dy,yMax:view.yMax+dy},canvas._benchmarkDataBounds);canvas._benchmarkRedrawScatter?.();});
            const endDrag=event=>{if(canvas._benchmarkDrag?.id===event.pointerId)canvas._benchmarkDrag=null;};
            canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
            canvas._benchmarkDotSizeSlider=slider;
            slider.addEventListener('input',()=>{value.textContent=slider.value;canvas._benchmarkRedrawScatter?.();});
        }
        dotSize=Number(slider.value)||1;
        canvas._benchmarkRedrawScatter=()=>benchmarkScatter(canvas,points,options);
    }
    const w=1200,h=600,ratio=2,p={left:110,right:35,top:30,bottom:95};canvas.width=w*ratio;canvas.height=h*ratio;
    const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle=colours.background;ctx.fillRect(0,0,w,h);
    const bottom=h-p.bottom,right=w-p.right,iw=right-p.left,ih=bottom-p.top;
    const bounds=benchmarkScatterBounds(points),previous=canvas._benchmarkDataBounds;
    if(previous&&Object.keys(bounds).some(key=>bounds[key]!==previous[key]))canvas._benchmarkZoom=null;
    canvas._benchmarkDataBounds=bounds;
    const {xMin,xMax,yMin,yMax}=canvas._benchmarkZoom?benchmarkClampView(canvas._benchmarkZoom,bounds):bounds;
    canvas._benchmarkView={xMin,xMax,yMin,yMax};canvas._benchmarkPlotBounds={left:p.left,right,top:p.top,bottom};
    const X=x=>p.left+(x-xMin)/(xMax-xMin)*iw,Y=y=>bottom-(y-yMin)/(yMax-yMin)*ih;
    ctx.font='16px system-ui';ctx.lineWidth=1;ctx.textBaseline='middle';
    for(let i=0;i<=5;i++){const x=p.left+iw*i/5,y=bottom-ih*i/5;ctx.strokeStyle=colours.grid;ctx.beginPath();ctx.moveTo(x,p.top);ctx.lineTo(x,bottom);ctx.moveTo(p.left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle=colours.text;ctx.textAlign='center';ctx.fillText(Number((xMin+(xMax-xMin)*i/5).toPrecision(4)).toString(),x,bottom+20);ctx.textAlign='right';ctx.fillText(Number((yMin+(yMax-yMin)*i/5).toPrecision(4)).toString(),p.left-12,y);}
    ctx.strokeStyle=colours.axis;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.left,p.top);ctx.lineTo(p.left,bottom);ctx.lineTo(right,bottom);for(let i=0;i<=5;i++){const x=p.left+iw*i/5,y=bottom-ih*i/5;ctx.moveTo(x,bottom);ctx.lineTo(x,bottom+6);ctx.moveTo(p.left-6,y);ctx.lineTo(p.left,y);}ctx.stroke();
    ctx.fillStyle=colours.label;ctx.font='19px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(xLabel,(p.left+right)/2,h-23);ctx.save();ctx.translate(25,(p.top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText(yLabel,0,0);ctx.restore();
    if(markYZero&&yMin<=0&&yMax>=0){const zeroY=Y(0);ctx.save();ctx.strokeStyle=colours.emphasis;ctx.lineWidth=2.5;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(p.left,zeroY);ctx.lineTo(right,zeroY);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=colours.emphasis;ctx.font='bold 17px system-ui';ctx.textAlign='right';ctx.fillText('0',p.left-12,zeroY);ctx.restore();}
    if(identityLine){const start=Math.max(xMin,yMin),end=Math.min(xMax,yMax);if(start<=end){ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,iw,ih);ctx.clip();ctx.strokeStyle=colours.identity;ctx.lineWidth=1;ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(X(start),Y(start));ctx.lineTo(X(end),Y(end));ctx.stroke();ctx.restore();}}
    const fit=trend?benchmarkQuadratic(points):null;
    ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,iw,ih);ctx.clip();
    for(const point of points){ctx.fillStyle=point.color||'#57d8c3';ctx.beginPath();ctx.arc(X(point.x),Y(point.y),dotSize,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    if(fit){ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,iw,ih);ctx.clip();ctx.strokeStyle=colours.emphasis;ctx.setLineDash([9,6]);ctx.lineWidth=2.5;ctx.beginPath();const fitMin=points.reduce((m,p)=>Math.min(m,p.x),Infinity),fitMax=points.reduce((m,p)=>Math.max(m,p.x),-Infinity);for(let i=0;i<=250;i++){const x=fitMin+(fitMax-fitMin)*i/250,px=X(x),py=Y(fit(x));if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.restore();}
    if(!points.length){ctx.fillStyle=colours.muted;ctx.font='18px system-ui';ctx.fillText('No comparable data available',(p.left+right)/2,(p.top+bottom)/2);}
    if(legend){legend.replaceChildren();const groups=new Map(points.map(point=>[point.id,point.color]));for(const [id,color] of groups){const span=document.createElement('span');span.textContent=`● ${id}`;span.style.color=color;legend.append(span);}if(trend){const span=document.createElement('span');span.textContent=fit?'⋯ Quadratic trend (all residues)':'Quadratic trend unavailable: at least three distinct confidence values required';span.style.color=colours.emphasis;legend.append(span);}}
}
// Triangle vertices for mean initial-to-reference, final-to-reference and displacement distances.
// Classical multidimensional scaling of a symmetric distance matrix.
function benchmarkMds(distances,dimensions=3){
    const n=distances.length;if(!n||distances.some((row,i)=>row.length!==n||row.some((v,j)=>!Number.isFinite(v)||v<0||Math.abs(v-distances[j][i])>1e-8)))return null;
    const squared=distances.map(row=>row.map(v=>v*v)),means=squared.map(row=>row.reduce((a,b)=>a+b,0)/n),grand=means.reduce((a,b)=>a+b,0)/n;
    const matrix=squared.map((row,i)=>row.map((v,j)=>-.5*(v-means[i]-means[j]+grand)));
    const vectors=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
    for(let iter=0;iter<100*n*n;iter++){
        let p=0,q=0,biggest=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(matrix[i][j])>biggest){biggest=Math.abs(matrix[i][j]);p=i;q=j;}
        if(biggest<1e-12)break;
        const angle=.5*Math.atan2(2*matrix[p][q],matrix[q][q]-matrix[p][p]),c=Math.cos(angle),s=Math.sin(angle),app=matrix[p][p],aqq=matrix[q][q],apq=matrix[p][q];
        for(let k=0;k<n;k++)if(k!==p&&k!==q){const kp=matrix[k][p],kq=matrix[k][q];matrix[k][p]=matrix[p][k]=c*kp-s*kq;matrix[k][q]=matrix[q][k]=s*kp+c*kq;}
        matrix[p][p]=c*c*app-2*s*c*apq+s*s*aqq;matrix[q][q]=s*s*app+2*s*c*apq+c*c*aqq;matrix[p][q]=matrix[q][p]=0;
        for(let k=0;k<n;k++){const vp=vectors[k][p],vq=vectors[k][q];vectors[k][p]=c*vp-s*vq;vectors[k][q]=s*vp+c*vq;}
    }
    const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>matrix[b][b]-matrix[a][a]);
    const coordinates=Array.from({length:n},(_,i)=>Array.from({length:dimensions},(_,d)=>{const col=order[d];return col===undefined?0:vectors[i][col]*Math.sqrt(Math.max(0,matrix[col][col]));}));
    let sum=0,count=0;for(let i=0;i<n;i++)for(let j=0;j<i;j++){const fitted=Math.hypot(...coordinates[i].map((v,k)=>v-coordinates[j][k]));sum+=(fitted-distances[i][j])**2;count++;}
    return {coordinates,rmse:count?Math.sqrt(sum/count):0};
}
function benchmarkMeanTriangle(initialReference,finalReference,displacement){
    const a=initialReference,b=finalReference,c=displacement;
    if(![a,b,c].every(v=>Number.isFinite(v)&&v>=0))return null;
    const tolerance=1e-9*Math.max(1,a,b,c);
    if(a+b+tolerance<c||a+c+tolerance<b||b+c+tolerance<a)return null;
    if(c<=tolerance)return {initial:{x:0,y:0},final:{x:0,y:0},reference:{x:0,y:a}};
    const x=(a*a+c*c-b*b)/(2*c),height=Math.sqrt(Math.max(0,a*a-x*x));
    return {initial:{x:0,y:0},final:{x:c,y:0},reference:{x,y:height}};
}
function benchmarkDistributionStats(values){
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;
    if(!n)return {mean:null,median:null};
    return {mean:sorted.reduce((sum,value)=>sum+value,0)/n,median:(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2};
}
// All series share bin boundaries so their counts can be compared directly.
function benchmarkHistogramBins(series,binCount=20){
    const values=series.flatMap(item=>item.values.filter(Number.isFinite));
    if(!values.length)return {min:0,max:1,counts:series.map(()=>Array(binCount).fill(0))};
    let min=values.reduce((a,b)=>Math.min(a,b),Infinity),max=values.reduce((a,b)=>Math.max(a,b),-Infinity);
    if(min===max){const padding=Math.max(.5,Math.abs(min)*.05);min-=padding;max+=padding;}
    const counts=series.map(item=>{const bins=Array(binCount).fill(0);for(const value of item.values)if(Number.isFinite(value)){const index=Math.min(binCount-1,Math.max(0,Math.floor((value-min)/(max-min)*binCount)));bins[index]++;}return bins;});
    return {min,max,counts};
}
function benchmarkHistogram(canvas,series,xLabel,{binCount=20,xTicks=5,logScale=false,markZero=false,normalise=false}={}){
    const colours=benchmarkPlotColours();
    const {min,max,counts:rawCounts}=benchmarkHistogramBins(series,binCount),counts=normalise?rawCounts.map(values=>{const total=values.reduce((a,b)=>a+b,0);return values.map(value=>total?value/total:0);}):rawCounts,w=1200,h=500,p={left:100,right:35,top:30,bottom:90},ratio=2;
    canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle=colours.background;ctx.fillRect(0,0,w,h);
    const bottom=h-p.bottom,right=w-p.right,iw=right-p.left,ih=bottom-p.top,maxCount=Math.max(normalise?0:1,...counts.flat())||1,bins=counts[0]?.length||20;
    ctx.font='16px system-ui';ctx.textBaseline='middle';
    for(let i=0;i<=xTicks;i++){const x=p.left+iw*i/xTicks;ctx.strokeStyle=colours.grid;ctx.beginPath();ctx.moveTo(x,p.top);ctx.lineTo(x,bottom);ctx.stroke();ctx.fillStyle=colours.text;ctx.textAlign='center';ctx.fillText((min+(max-min)*i/xTicks).toFixed(2),x,bottom+20);}
    for(let i=0;i<=5;i++){const y=bottom-ih*i/5;ctx.strokeStyle=colours.grid;ctx.beginPath();ctx.moveTo(p.left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle=colours.text;ctx.textAlign='right';ctx.fillText(String(Number((logScale?Math.expm1(Math.log1p(maxCount)*i/5):maxCount*i/5).toPrecision(3))),p.left-12,y);}
    counts.forEach((values,j)=>{ctx.fillStyle=series[j].color;ctx.globalAlpha=series.length>1?.55:.85;values.forEach((count,i)=>{const width=iw/bins;ctx.fillRect(p.left+i*width,bottom-(logScale?Math.log1p(count)/Math.log1p(maxCount):count/maxCount)*ih,Math.max(1,width-1),(logScale?Math.log1p(count)/Math.log1p(maxCount):count/maxCount)*ih);});});ctx.globalAlpha=1;
    if(markZero&&min<=0&&max>=0){const zeroX=p.left+(0-min)/(max-min)*iw;ctx.save();ctx.strokeStyle=colours.emphasis;ctx.lineWidth=2.5;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(zeroX,p.top);ctx.lineTo(zeroX,bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=colours.emphasis;ctx.textAlign='center';ctx.font='bold 17px system-ui';ctx.fillText('0',zeroX,bottom+40);ctx.restore();}
    ctx.strokeStyle=colours.axis;ctx.beginPath();ctx.moveTo(p.left,p.top);ctx.lineTo(p.left,bottom);ctx.lineTo(right,bottom);ctx.stroke();ctx.fillStyle=colours.label;ctx.font='19px system-ui';ctx.textAlign='center';ctx.fillText(xLabel,(p.left+right)/2,h-23);ctx.save();ctx.translate(25,(p.top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText(normalise?'Fraction of residues':logScale?'Residue count (log₁₀(count + 1))':'Residue count',0,0);ctx.restore();
    if(!series.some(item=>item.values.some(Number.isFinite))){ctx.fillStyle=colours.muted;ctx.fillText('No comparable data available',(p.left+right)/2,(p.top+bottom)/2);}
}
if(typeof module!=='undefined')module.exports={benchmarkPointDensity,benchmarkScatterBounds,benchmarkClampView,benchmarkMeanByX,benchmarkQuadratic,benchmarkNumber,benchmarkHistogramBins,benchmarkDistributionStats,benchmarkMeanTriangle,benchmarkMds};
