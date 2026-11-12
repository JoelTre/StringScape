'use strict';
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
function benchmarkScatter(canvas,points,{xLabel,yLabel,xMin=0,xMax=1,trend=false,legend=null}={}){
    const w=1200,h=600,ratio=2,p={left:110,right:35,top:30,bottom:95};canvas.width=w*ratio;canvas.height=h*ratio;
    const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#0a1726';ctx.fillRect(0,0,w,h);
    const bottom=h-p.bottom,right=w-p.right,iw=right-p.left,ih=bottom-p.top;
    const maximumY=points.reduce((max,point)=>Math.max(max,point.y),1);const yMax=Math.ceil(maximumY*1.05*10)/10;
    const X=x=>p.left+(x-xMin)/(xMax-xMin)*iw,Y=y=>bottom-y/yMax*ih;
    ctx.font='16px system-ui';ctx.lineWidth=1;ctx.textBaseline='middle';
    for(let i=0;i<=5;i++){const x=p.left+iw*i/5,y=bottom-ih*i/5;ctx.strokeStyle='#263d50';ctx.beginPath();ctx.moveTo(x,p.top);ctx.lineTo(x,bottom);ctx.moveTo(p.left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#b9cddb';ctx.textAlign='center';ctx.fillText((xMin+(xMax-xMin)*i/5).toFixed(2),x,bottom+20);ctx.textAlign='right';ctx.fillText((yMax*i/5).toFixed(1),p.left-12,y);}
    ctx.strokeStyle='#a8bdcd';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.left,p.top);ctx.lineTo(p.left,bottom);ctx.lineTo(right,bottom);for(let i=0;i<=5;i++){const x=p.left+iw*i/5,y=bottom-ih*i/5;ctx.moveTo(x,bottom);ctx.lineTo(x,bottom+6);ctx.moveTo(p.left-6,y);ctx.lineTo(p.left,y);}ctx.stroke();
    ctx.fillStyle='#dbe8f7';ctx.font='19px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(xLabel,(p.left+right)/2,h-23);ctx.save();ctx.translate(25,(p.top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText(yLabel,0,0);ctx.restore();
    const fit=trend?benchmarkQuadratic(points):null;
    for(const point of points){ctx.fillStyle=point.color||'#57d8c3';ctx.beginPath();ctx.arc(X(point.x),Y(point.y),4,0,Math.PI*2);ctx.fill();}
    if(fit){ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,iw,ih);ctx.clip();ctx.strokeStyle='#fff';ctx.setLineDash([9,6]);ctx.lineWidth=2.5;ctx.beginPath();const fitMin=points.reduce((m,p)=>Math.min(m,p.x),Infinity),fitMax=points.reduce((m,p)=>Math.max(m,p.x),-Infinity);for(let i=0;i<=250;i++){const x=fitMin+(fitMax-fitMin)*i/250,px=X(x),py=Y(fit(x));if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.restore();}
    if(!points.length){ctx.fillStyle='#a8bbd0';ctx.font='18px system-ui';ctx.fillText('No comparable data available',(p.left+right)/2,(p.top+bottom)/2);}
    if(legend){legend.replaceChildren();const groups=new Map(points.map(point=>[point.id,point.color]));for(const [id,color] of groups){const span=document.createElement('span');span.textContent=`● ${id}`;span.style.color=color;legend.append(span);}if(trend){const span=document.createElement('span');span.textContent=fit?'⋯ Quadratic trend (all residues)':'Quadratic trend unavailable: at least three distinct confidence values required';span.style.color='#fff';legend.append(span);}}
}
if(typeof module!=='undefined')module.exports={benchmarkQuadratic,benchmarkNumber};
