/* EMDB volume parsing and viewer controls. Coordinates are in deposited Å. */
(function(root){
'use strict';
function* tokens(s){let i=0;while(i<s.length){if(/\s/.test(s[i])){i++;continue;}if(s[i]==='#'){while(i<s.length&&s[i]!=='\n')i++;continue;}if(s[i]===';'&&(i===0||s[i-1]==='\n')){let a=++i;while(i<s.length&&!(s[i]===';'&&s[i-1]==='\n'))i++;yield s.slice(a,i).trim();i++;continue;}if(s[i]==="'"||s[i]==='"'){let q=s[i++],a=i;while(i<s.length&&!(s[i]===q&&(i+1===s.length||/\s/.test(s[i+1]))))i++;yield s.slice(a,i);i++;continue;}let a=i;while(i<s.length&&!/\s/.test(s[i]))i++;yield s.slice(a,i);}}
function entries(text){const t=tokens(text), found=[], single={};let n=t.next();while(!n.done){if(n.value.toLowerCase().startsWith('_pdbx_database_related.')){const field=n.value.toLowerCase().split('.')[1];n=t.next();if(!n.done){single[field]=n.value;n=t.next();}continue;}if(n.value!=='loop_'){n=t.next();continue;}const f=[];n=t.next();while(!n.done&&n.value.startsWith('_')){f.push(n.value.toLowerCase());n=t.next();}const target=f.some(x=>x.startsWith('_pdbx_database_related.'));if(!target)continue;while(!n.done&&!/^(?:_|loop_|data_|save_|stop_)/i.test(n.value)){const row=[];for(let i=0;i<f.length&&!n.done;i++){row.push(n.value);n=t.next();}if(row.length!==f.length)break;const obj=Object.fromEntries(f.map((x,i)=>[x.split('.')[1],row[i]]));if(!/emdb/i.test(obj.db_name||''))continue;const match=String(obj.db_id||'').match(/(?:EMD[-_])?(\d+)/i);if(match)found.push({id:'EMD-'+match[1],primary:/associated em volume/i.test(obj.content_type||'')});}}if(/emdb/i.test(single.db_name||'')){const match=String(single.db_id||'').match(/(?:EMD[-_])?(\d+)/i);if(match)found.push({id:'EMD-'+match[1],primary:/associated em volume/i.test(single.content_type||'')});}const seen=new Set();return found.sort((a,b)=>Number(b.primary)-Number(a.primary)).filter(x=>!seen.has(x.id)&&seen.add(x.id));}
function parse(buffer){const d=new DataView(buffer);if(buffer.byteLength<1024)throw Error('Map header is incomplete');let le=true;let nx=d.getInt32(0,true),mode=d.getInt32(12,true);if(nx<=0||nx>100000||![0,1,2,6].includes(mode)){le=false;nx=d.getInt32(0,false);mode=d.getInt32(12,false);}const I=o=>d.getInt32(o,le),F=o=>d.getFloat32(o,le),dims=[nx,I(4),I(8)],grid=[I(28),I(32),I(36)],lengths=[F(40),F(44),F(48)],angles=[F(52),F(56),F(60)],axes=[I(64),I(68),I(72)],starts=[I(16),I(20),I(24)],origin=[F(196),F(200),F(204)];if(!dims.every(x=>x>0&&x<100000)||!grid.every(x=>x>0)||!lengths.every(x=>Number.isFinite(x)&&x>0)||axes.slice().sort().join(',')!=='1,2,3'||!angles.every(x=>Number.isFinite(x)&&Math.abs(x-90)<0.01)||![0,1,2,6].includes(mode))throw Error('Unsupported map header');const count=dims.reduce((a,b)=>a*b,1);if(count>250000000)throw Error('Map is too large for this browser');const size=mode===2?4:mode===0?1:2,offset=1024+I(92);if(offset<1024||offset+count*size>buffer.byteLength)throw Error('Map data is incomplete');const values=new Float32Array(count);let min=Infinity,max=-Infinity,sum=0,sum2=0;for(let i=0;i<count;i++){const p=offset+i*size,v=mode===2?d.getFloat32(p,le):mode===1?d.getInt16(p,le):mode===6?d.getUint16(p,le):d.getInt8(p);values[i]=Number.isFinite(v)?v:0;min=Math.min(min,values[i]);max=Math.max(max,values[i]);sum+=values[i];sum2+=values[i]*values[i];}const spacing=lengths.map((v,i)=>v/grid[i]);return {dims,axes,starts,origin:origin.map(x=>Number.isFinite(x)?x:0),spacing,values,min,max,mean:sum/count,sigma:Math.sqrt(Math.max(0,sum2/count-(sum/count)**2))};}
function position(map,c,r,s){const xyz=map.origin.slice(),index=[c,r,s];for(let i=0;i<3;i++){const a=map.axes[i]-1;xyz[a]+=(index[i]+map.starts[i])*map.spacing[a];}return xyz;}
function geometry(map,method,threshold,curve,strideOverride){const [nx,ny,nz]=map.dims, stride=strideOverride||Math.max(1,Math.ceil(Math.cbrt(nx*ny*nz/(method==='surface'?180000:350000))));const out=[], vals=map.values,at=(x,y,z)=>vals[x+nx*(y+ny*z)], range=map.max-map.min||1;const interp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
if(method==='cloud'){
 // Independent, deterministic samples avoid the lattice and radial streaks caused by
 // rendering one correlated point at each voxel centre.
 const random=(x,y,z,seed)=>{let h=(Math.imul(x,0x8da6b343)^Math.imul(y,0xd8163841)^Math.imul(z,0xcb1ab31f)^seed)>>>0;h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296;};
 const sample=(x,y,z)=>{const x0=Math.floor(x),y0=Math.floor(y),z0=Math.floor(z),x1=Math.min(x0+1,nx-1),y1=Math.min(y0+1,ny-1),z1=Math.min(z0+1,nz-1),a=x-x0,b=y-y0,c=z-z0;const mix=(v,w,t)=>v+(w-v)*t;return mix(mix(mix(at(x0,y0,z0),at(x1,y0,z0),a),mix(at(x0,y1,z0),at(x1,y1,z0),a),b),mix(mix(at(x0,y0,z1),at(x1,y0,z1),a),mix(at(x0,y1,z1),at(x1,y1,z1),a),b),c);};
 const floor=Number.isFinite(map.mean)?map.mean:map.min,span=map.max-floor||1;
 for(let z=0;z<nz;z+=stride)for(let y=0;y<ny;y+=stride)for(let x=0;x<nx;x+=stride){
  const jitter=(v,n,r)=>{const lo=Math.max(0,v-stride/2),hi=Math.min(n-1,v+stride/2);return lo+(hi-lo)*r;};
  const px=jitter(x,nx,random(x,y,z,1)),py=jitter(y,ny,random(x,y,z,2)),pz=jitter(z,nz,random(x,y,z,3));
  const t=Math.max(0,Math.min(1,(sample(px,py,pz)-floor)/span)),u=t*(curve.length-1),i=Math.min(curve.length-2,Math.floor(u)),p=curve[i]*(1-(u-i))+curve[i+1]*(u-i);
  if(random(x,y,z,4)<p*.65)out.push(...position(map,px,py,pz));
 }return out;
}
const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];for(let z=0;z+stride<nz;z+=stride)for(let y=0;y+stride<ny;y+=stride)for(let x=0;x+stride<nx;x+=stride){const coords=corners.map(v=>[x+v[0]*stride,y+v[1]*stride,z+v[2]*stride]),v=coords.map(p=>at(...p));if(Math.min(...v)>threshold||Math.max(...v)<threshold)continue;for(const tet of tetra){const hits=[];for(const [a,b] of edges){const ia=tet[a],ib=tet[b];if((v[ia]>=threshold)===(v[ib]>=threshold))continue;const t=(threshold-v[ia])/(v[ib]-v[ia]);hits.push(position(map,...interp(coords[ia],coords[ib],t)));}if(hits.length>=3){const inside=tet.filter(i=>v[i]>=threshold),outside=tet.filter(i=>v[i]<threshold),centroid=ids=>ids.reduce((sum,i)=>{const p=position(map,...coords[i]);return sum.map((n,j)=>n+p[j]/ids.length);},[0,0,0]),a=centroid(inside),b=centroid(outside),direction=b.map((n,i)=>n-a[i]);const face=(p,q,r)=>{const u=q.map((n,i)=>n-p[i]),w=r.map((n,i)=>n-p[i]),normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];if(normal[0]*direction[0]+normal[1]*direction[1]+normal[2]*direction[2]<0)out.push(...p,...r,...q);else out.push(...p,...q,...r);};face(hits[0],hits[1],hits[2]);if(hits.length===4)face(hits[1],hits[3],hits[2]);}}}return out;}
// One Loop subdivision pass on welded triangles. The shared vertices are also
// retained for smooth shading instead of assigning a separate normal per face.
function subdivideSurface(triangles){
 const vertices=[],indices=[],vertexMap=new Map(),edges=new Map(),neighbours=[],boundary=[];
 function vertex(x,y,z){const key=`${Math.round(x*100000)},${Math.round(y*100000)},${Math.round(z*100000)}`;let id=vertexMap.get(key);if(id===undefined){id=vertices.length;vertexMap.set(key,id);vertices.push([x,y,z]);neighbours.push(new Set());boundary.push([]);}return id;}
 function edge(a,b,opposite){const lo=Math.min(a,b),hi=Math.max(a,b),key=`${lo},${hi}`;let item=edges.get(key);if(!item){item={a:lo,b:hi,opposites:[],index:-1};edges.set(key,item);neighbours[lo].add(hi);neighbours[hi].add(lo);}item.opposites.push(opposite);return item;}
 for(let i=0;i+8<triangles.length;i+=9){const a=vertex(triangles[i],triangles[i+1],triangles[i+2]),b=vertex(triangles[i+3],triangles[i+4],triangles[i+5]),c=vertex(triangles[i+6],triangles[i+7],triangles[i+8]);if(a===b||b===c||c===a)continue;indices.push(a,b,c);edge(a,b,c);edge(b,c,a);edge(c,a,b);}
 for(const e of edges.values())if(e.opposites.length===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
 const out=new Float32Array((vertices.length+edges.size)*3),set=(i,p)=>{out[i*3]=p[0];out[i*3+1]=p[1];out[i*3+2]=p[2];};
 for(let i=0;i<vertices.length;i++){const p=vertices[i],b=boundary[i],ns=[...neighbours[i]];if(b.length===2)set(i,p.map((v,k)=>.75*v+.125*(vertices[b[0]][k]+vertices[b[1]][k])));else if(b.length||ns.length<3)set(i,p);else{const weight=ns.length===3?3/16:3/(8*ns.length);set(i,p.map((v,k)=>(1-ns.length*weight)*v+weight*ns.reduce((sum,j)=>sum+vertices[j][k],0)));}}
 let next=vertices.length;for(const e of edges.values()){e.index=next++;const a=vertices[e.a],b=vertices[e.b];if(e.opposites.length===2){const c=vertices[e.opposites[0]],d=vertices[e.opposites[1]];set(e.index,a.map((v,k)=>.375*(v+b[k])+.125*(c[k]+d[k])));}else set(e.index,a.map((v,k)=>(v+b[k])*.5));}
 const result=new Uint32Array(indices.length*4);let p=0;const edgeIndex=(a,b)=>edges.get(`${Math.min(a,b)},${Math.max(a,b)}`).index;
 for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2],ab=edgeIndex(a,b),bc=edgeIndex(b,c),ca=edgeIndex(c,a);for(const value of [a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca])result[p++]=value;}
 return {positions:out,indices:result};
}
function subdividedMapSurface(map,threshold){
 const base=Math.max(1,Math.ceil(Math.cbrt(map.dims.reduce((a,b)=>a*b,1)/180000)));let stride=base,triangles=geometry(map,'surface',threshold,null,stride);
 // Increase sampling stride for unusually intricate maps before the 4x split.
 while(triangles.length/9>120000&&stride<Math.max(...map.dims)){stride++;triangles=geometry(map,'surface',threshold,null,stride);}
 return subdivideSurface(triangles);
}
// A compact 2D atlas allows the volume shader to run on WebGL 1 and 2.
function volumeAtlas(map,maxDimension=96){
 if(map.dims.some(n=>n<2))throw Error('The EM map must have at least two voxels on each axis');
 const dims=map.dims.map(n=>Math.max(2,Math.min(maxDimension,n))),[nx,ny,nz]=dims,columns=Math.ceil(Math.sqrt(nz)),rows=Math.ceil(nz/columns),width=nx*columns,height=ny*rows,data=new Uint8Array(width*height*4),[sx,sy,sz]=map.dims;
 const at=(x,y,z)=>map.values[x+sx*(y+sy*z)],mix=(a,b,t)=>a+(b-a)*t;
 const floor=Number.isFinite(map.mean)?map.mean:map.min,ceiling=Math.min(map.max,floor+6*(map.sigma||0))>floor?Math.min(map.max,floor+6*map.sigma):map.max,range=ceiling-floor||1;
 for(let z=0;z<nz;z++){const pz=z*(sz-1)/(nz-1),z0=Math.floor(pz),z1=Math.min(sz-1,z0+1),fz=pz-z0,tileX=z%columns,tileY=Math.floor(z/columns);
  for(let y=0;y<ny;y++){const py=y*(sy-1)/(ny-1),y0=Math.floor(py),y1=Math.min(sy-1,y0+1),fy=py-y0;
   for(let x=0;x<nx;x++){const px=x*(sx-1)/(nx-1),x0=Math.floor(px),x1=Math.min(sx-1,x0+1),fx=px-x0;
    const lo=mix(mix(at(x0,y0,z0),at(x1,y0,z0),fx),mix(at(x0,y1,z0),at(x1,y1,z0),fx),fy),hi=mix(mix(at(x0,y0,z1),at(x1,y0,z1),fx),mix(at(x0,y1,z1),at(x1,y1,z1),fx),fy),value=Math.max(0,Math.min(1,(mix(lo,hi,fz)-floor)/range)),index=4*((tileY*ny+y)*width+tileX*nx+x);
    data[index]=Math.round(value*255);data[index+3]=255;
   }
  }
 }
 // Integrate the original map along deposited +Y, excluding the current voxel.
 // Each atlas column samples a corresponding original grid column.
 const vertical=map.axes.indexOf(2),other=[0,1,2].filter(i=>i!==vertical),shadow=new Float32Array(nx*ny*nz);let minimum=Infinity,maximum=-Infinity;
 for(let a=0;a<dims[other[0]];a++)for(let b=0;b<dims[other[1]];b++){
  const coord=[0,0,0],source=[0,0,0];coord[other[0]]=a;coord[other[1]]=b;
  for(const axis of other)source[axis]=Math.round(coord[axis]*(map.dims[axis]-1)/(dims[axis]-1));
  let sum=0,next=dims[vertical]-1;
  for(let v=map.dims[vertical]-1;v>=0;v--){
   while(next>=0&&Math.round(next*(map.dims[vertical]-1)/(dims[vertical]-1))===v){coord[vertical]=next--;const index=coord[0]+nx*(coord[1]+ny*coord[2]);shadow[index]=sum;minimum=Math.min(minimum,sum);maximum=Math.max(maximum,sum);}
   source[vertical]=v;sum+=Math.max(0,at(...source)-floor);
  }
 }
 if(maximum>minimum)for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)data[4*((Math.floor(z/columns)*ny+y)*width+(z%columns)*nx+x)+1]=Math.round(255*(shadow[x+nx*(y+ny*z)]-minimum)/(maximum-minimum));
 const shadowHistogram=new Float64Array(64);for(const value of shadow){const normalized=maximum>minimum?(value-minimum)/(maximum-minimum):0;shadowHistogram[Math.min(63,Math.floor(normalized*64))]++;}
 return {data,dims,columns,rows,width,height,floor,ceiling,shadowHistogram};
}
function densityHistogram(map,bins=64){
 const floor=Number.isFinite(map.mean)?map.mean:map.min,upper=Math.min(map.max,floor+6*(map.sigma||0)),ceiling=upper>floor?upper:map.max,range=ceiling-floor,counts=new Float64Array(bins);
 if(!(range>0))return counts;
 for(const value of map.values){if(value<floor||value>ceiling||!Number.isFinite(value))continue;const i=Math.min(bins-1,Math.floor((value-floor)/range*bins));counts[i]++;}
 return counts;
}
function bezierPoint(points,t){
 const u=1-t,weights=[u*u*u*u,4*u*u*u*t,6*u*u*t*t,4*u*t*t*t,t*t*t*t];let x=0,y=0;for(let i=0;i<5;i++){x+=points[i].x*weights[i];y+=points[i].y*weights[i];}return {x,y};
}
function curveValue(points,x){
 if(x<=points[0].x)return points[0].y;if(x>=points[points.length-1].x)return points[points.length-1].y;
 let lo=0,hi=1;for(let i=0;i<18;i++){const t=(lo+hi)/2;if(bezierPoint(points,t).x<x)lo=t;else hi=t;}return bezierPoint(points,(lo+hi)/2).y;
}
function curveTextureData(points,size=256){const data=new Uint8Array(size*4);for(let i=0;i<size;i++){data[i*4]=Math.round(Math.max(0,Math.min(1,curveValue(points,i/(size-1))))*255);data[i*4+3]=255;}return data;}
function defaultCurve(){return [0,.25,.5,.75,1].map(value=>({x:value,y:value}));}
function defaultShadowCurve(){return [{x:.07,y:1},{x:.075,y:0},{x:.5,y:.52},{x:.735,y:.27},{x:1,y:0}];}

function moveCurvePoint(points,index,x,y){
 const gap=.005,min=index?points[index-1].x+gap:0,max=index<points.length-1?points[index+1].x-gap:1;
 points[index]={x:Math.max(min,Math.min(max,x)),y:Math.max(0,Math.min(1,y))};return points[index];
}
// Draft coordinates are centred before fitting. Map coordinates are deposited
// coordinates, so compose the draft centring with the fit into the merged frame.
function stagedPlacement(file,state){
 if(state?.kind!=='combined'||!state.assembly?.fits||!Array.isArray(state.files))return null;
 const id=String(file?.pdbId||'').toUpperCase(),index=state.files.findIndex(candidate=>candidate===file||String(candidate.pdbId||'').toUpperCase()===id);
 if(index<0)return null;const fit=state.assembly.fits[index],offset=state.drafts?.[index]?.viewState?.offset;
 if(!fit?.R||!fit?.t||!offset)return null;
 const R=fit.R.map(row=>Array.from(row)),t=Array.from(fit.t),centre=[offset.cx,offset.cy,offset.cz];
 if(R.length!==3||R.some(row=>row.length!==3||row.some(value=>!Number.isFinite(value)))||t.length!==3||!t.every(Number.isFinite)||!centre.every(Number.isFinite))return null;
 return {rotation:R,translation:t.map((value,i)=>value-R[i].reduce((sum,component,j)=>sum+component*centre[j],0))};
}
function pdbId(text){
 const match=String(text||'').match(/^\s*_entry\.id\s+["']?([A-Za-z0-9_]+)["']?(?:\s|$)/im)||String(text||'').match(/^\s*data_([A-Za-z0-9_]+)\s*$/im);
 const header=String(text||'').match(/^HEADER.{56}([0-9][A-Za-z0-9]{3})(?:\s|$)/m);
 const value=(match?.[1]||header?.[1])?.toUpperCase();return /^(?:[0-9][A-Z0-9]{3}|PDB_[A-Z0-9]{8})$/.test(value||'')?value:null;
}
const metadataCache=new Map();
function lookupEntry(id){
 id=String(id||'').toUpperCase();if(!/^(?:[0-9][A-Z0-9]{3}|PDB_[A-Z0-9]{8})$/.test(id))return Promise.resolve([]);
 if(metadataCache.has(id))return metadataCache.get(id);
 const request=(async()=>{const response=await fetch(`https://data.rcsb.org/rest/v1/core/entry/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`PDB lookup failed (HTTP ${response.status})`);const data=await response.json();const ids=data?.rcsb_entry_container_identifiers?.emdb_ids;if(ids!=null&&!Array.isArray(ids))throw Error('Unexpected PDB EMDB metadata');return [...new Set((ids||[]).map(value=>String(value).toUpperCase()).filter(value=>/^EMD-\d+$/.test(value)))].map(id=>({id,primary:false}));})();
 metadataCache.set(id,request);request.catch(()=>{if(metadataCache.get(id)===request)metadataCache.delete(id);});return request;
}
function mergeEntries(fileEntries,apiEntries){const result=[],byId=new Map();for(const item of [...fileEntries,...apiEntries]){const id=String(item?.id||'').toUpperCase();if(!/^EMD-\d+$/.test(id))continue;if(byId.has(id)){if(item.primary)byId.get(id).primary=true;}else{const entry={id,primary:!!item.primary};result.push(entry);byId.set(id,entry);}}return result.sort((a,b)=>Number(b.primary)-Number(a.primary));}
root.EMData={entries,parse,position,geometry,subdivideSurface,subdividedMapSurface,volumeAtlas,densityHistogram,bezierPoint,curveValue,curveTextureData,defaultCurve,defaultShadowCurve,moveCurvePoint,stagedPlacement,pdbId,lookupEntry,mergeEntries};if(typeof module!=='undefined')module.exports=root.EMData;
})(typeof window==='undefined'?globalThis:window);
(function(root){
'use strict';
const E=root.EMData;
E.createController=function({host,toggleHost,getScene,getOffset,getSources,redraw,openSettings}){
 const wrap=document.createElement('div');wrap.className='em-controls';wrap.hidden=true;wrap.innerHTML='<h3>EM data</h3><p class="em-empty-notice" data-empty-notice role="status" hidden>No associated EMDB entries</p><div class="em-row"><div class="em-menu-wrap"><button type="button" class="em-menu-trigger" data-entries aria-haspopup="true" aria-expanded="false">EMDB entry <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div class="em-menu" data-menu role="group" aria-label="EMDB entries" hidden></div></div><span>Visualisation method</span><div class="em-menu-wrap"><select data-method data-animation-key="emVisualizationMethod" aria-label="Visualisation method" hidden><option value="surface">Surface</option><option value="cloud" selected>Cloud</option></select><button type="button" class="em-menu-trigger" data-method-trigger aria-haspopup="true" aria-expanded="false"><span data-method-label>Cloud</span> <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div class="em-menu" data-method-menu role="group" aria-label="Visualisation method options" hidden><button type="button" data-method-surface aria-pressed="false">Surface</button><button type="button" data-method-cloud aria-pressed="true">Cloud</button></div></div></div><div class="em-colour"><label>Colour <span class="em-colour-swatch" data-colour-swatch><input data-colour type="color" value="#b0b0b0" aria-label="EM data colour"></span></label><button type="button" data-colour-reset title="Reset colour" aria-label="Reset colour"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button><button type="button" data-reset aria-label="Reset curve" title="Reset curve"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Curve</button></div><div data-surface hidden><div class="em-slider-row"><label>Density threshold <input class="em-number" data-threshold-value type="number" step="any" aria-label="Density threshold value"><input data-threshold data-animation-key="emDensityThreshold" type="range" min="0" max="1000" value="500" title="Threshold in map-density units; the range includes the full map values"></label><button class="em-slider-reset" type="button" data-threshold-reset aria-label="Reset density threshold" title="Reset density threshold"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button></div><div class="em-slider-row"><label>Surface opacity <input class="em-number" data-opacity-value type="number" min="0" max="100" step="1" value="40" aria-label="Surface opacity percent">%<input data-opacity data-animation-key="emSurfaceOpacity" type="range" min="0" max="100" value="40"></label><button class="em-slider-reset" type="button" data-opacity-reset aria-label="Reset surface opacity" title="Reset surface opacity"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button></div><label class="em-shadow-switch"><input data-surface-shadows type="checkbox" role="switch"> <span>Shadows</span></label></div><div data-cloud><div class="em-plot-row"><div class="em-curve-title">Cloud density</div><div class="em-plot-content"><canvas data-curve width="300" height="150" tabindex="0" aria-label="Cloud density curve. Drag control points horizontally or vertically; arrow keys move the selected point, and Page Up or Page Down selects another."></canvas><div class="em-axis">Map density (mean → mean + 6σ, capped at max)</div></div></div><div class="em-shadow-controls"><label class="em-shadow-switch"><input data-shadows type="checkbox" role="switch"> <span>Cloud shadows</span></label><button type="button" class="em-menu-trigger" data-shadow-trigger aria-expanded="false" hidden>Shadows curve <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><button type="button" class="em-slider-reset" data-shadow-reset aria-label="Reset shadows curve" title="Reset shadows curve" hidden><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button></div><div data-shadow-plot hidden><div class="em-plot-row"><div class="em-curve-title">Shade</div><div class="em-plot-content"><canvas data-shadow-curve width="300" height="150" tabindex="0" aria-label="Shadow shade curve. Drag control points; arrow keys move the selected point, and Page Up or Page Down selects another."></canvas><div class="em-axis">Above density sum (minimum → maximum)</div></div></div></div></div><p data-lookup-status role="status"></p><div class="em-loading" data-loading hidden><strong data-loading-label>Loading EM data…</strong><progress data-progress aria-label="EM data loading progress" max="1"></progress><span data-progress-detail></span></div><p data-em-status role="status"></p>';
 host.append(wrap);const q=s=>wrap.querySelector(s),button=document.createElement('button');button.type='button';button.className='edit-visibility-toggle em-toggle';button.append(document.createTextNode('EM data '));const eye=document.createElement('i');eye.className='fa-solid fa-eye-slash';eye.setAttribute('aria-hidden','true');button.append(eye);button.setAttribute('aria-pressed','false');button.title='Show EM data';toggleHost.append(button);
 let enabled=false,records=[],key='',generation=0,objects=[],thresholdInitialized=false,thresholdDefault='500',curve=E.defaultCurve(),selected=2,timer=null,histograms=[],thresholdMap=null,typedThreshold=null,shadowHistograms=[],shadowCurve=E.defaultShadowCurve(),shadowSelected=2;const cache=new Map(),metadata=new Map();
 const setStatus=s=>{q('[data-em-status]').textContent=s;};
 function progress(state){const box=q('[data-loading]'),bar=q('[data-progress]');box.hidden=!state;if(!state)return;q('[data-loading-label]').textContent=state.label||'Loading EM data…';q('[data-progress-detail]').textContent=state.detail||'';if(Number.isFinite(state.fraction))bar.value=Math.max(0,Math.min(1,state.fraction));else bar.removeAttribute('value');}
 const nextPaint=()=>new Promise(resolve=>setTimeout(resolve,0));
 function clear(){for(const o of objects){o.parent?.remove(o);if(o.userData.emVolume){const m=o.userData.emVolume;m.geometry.dispose();m.material.uniforms.volume.value.dispose();m.material.uniforms.transferTexture.value.dispose();m.material.uniforms.shadowTexture.value.dispose();m.material.dispose();}else if(o.userData.emSurface){const surface=o.userData.emSurface;surface.geometry.dispose();surface.depth.material.dispose();surface.colour.material.dispose();}else{o.geometry.dispose();o.material.dispose();}}objects=[];}
 function createVolume(map){
  const atlas=E.volumeAtlas(map),texture=new THREE.DataTexture(atlas.data,atlas.width,atlas.height,THREE.RGBAFormat,THREE.UnsignedByteType);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  const transferTexture=new THREE.DataTexture(E.curveTextureData(curve),256,1,THREE.RGBAFormat,THREE.UnsignedByteType);transferTexture.minFilter=THREE.LinearFilter;transferTexture.magFilter=THREE.LinearFilter;transferTexture.generateMipmaps=false;transferTexture.needsUpdate=true;
  shadowHistograms.push(atlas.shadowHistogram);plotShadow();
  const shadowTexture=new THREE.DataTexture(E.curveTextureData(shadowCurve),256,1,THREE.RGBAFormat,THREE.UnsignedByteType);shadowTexture.minFilter=THREE.LinearFilter;shadowTexture.magFilter=THREE.LinearFilter;shadowTexture.generateMipmaps=false;shadowTexture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,side:THREE.BackSide,uniforms:{volume:{value:texture},atlasSize:{value:new THREE.Vector2(atlas.width,atlas.height)},gridSize:{value:new THREE.Vector3(...atlas.dims)},columns:{value:atlas.columns},cloudColor:{value:new THREE.Color(q('[data-colour]').value)},transferTexture:{value:transferTexture},shadowTexture:{value:shadowTexture},eyeLocal:{value:new THREE.Vector3()},viewLocal:{value:new THREE.Vector3()},isOrtho:{value:0},shadows:{value:q('[data-shadows]').checked?1:0}},
   vertexShader:`varying vec3 localPosition; void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`precision highp float;
    uniform sampler2D volume;uniform vec2 atlasSize;uniform vec3 gridSize;uniform float columns;uniform vec3 cloudColor;uniform sampler2D transferTexture;uniform sampler2D shadowTexture;uniform vec3 eyeLocal;uniform vec3 viewLocal;uniform float isOrtho;uniform float shadows;varying vec3 localPosition;
    vec2 sliceAt(vec2 p,float z){float tx=mod(z,columns),ty=floor(z/columns);vec2 uv=(vec2(tx,ty)*gridSize.xy+clamp(p,0.0,1.0)*(gridSize.xy-1.0)+0.5)/atlasSize;return texture2D(volume,uv).rg;}
    vec2 densityAt(vec3 p){p=clamp(p,0.0,1.0);float z=p.z*(gridSize.z-1.0),i=floor(z);return mix(sliceAt(p.xy,i),sliceAt(p.xy,min(i+1.0,gridSize.z-1.0)),fract(z));}
    float transfer(float d){return texture2D(transferTexture,vec2((clamp(d,0.0,1.0)*255.0+0.5)/256.0,0.5)).r;}
    void main(){vec3 direction=isOrtho>0.5?normalize(viewLocal):normalize(localPosition-eyeLocal);vec3 origin=isOrtho>0.5?localPosition-direction*3.0:eyeLocal;vec3 invDir=1.0/(direction+vec3(0.000001));vec3 a=(-0.5-origin)*invDir,b=(0.5-origin)*invDir;vec3 lo=min(a,b),hi=max(a,b);float start=max(max(lo.x,lo.y),max(lo.z,0.0)),end=min(min(hi.x,hi.y),hi.z);if(end<=start)discard;
     float stepSize=(end-start)/64.0;float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);vec4 accum=vec4(0.0);
     for(int i=0;i<64;i++){vec3 p=origin+direction*(start+(float(i)+jitter)*stepSize)+0.5;vec2 sampleValue=densityAt(p);float amount=transfer(sampleValue.r);if(amount>0.001){float shade=mix(1.0,mix(0.025,1.45,texture2D(shadowTexture,vec2((sampleValue.g*255.0+0.5)/256.0,0.5)).r),shadows);float alpha=1.0-exp(-amount*stepSize*10.0);accum.rgb+=(1.0-accum.a)*alpha*shade*cloudColor;accum.a+=(1.0-accum.a)*alpha;if(accum.a>0.98)break;}}
     if(accum.a<0.003)discard;gl_FragColor=vec4(accum.rgb/accum.a,accum.a);
    }`});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material),group=new THREE.Group(),size=map.dims.map((n,i)=>(n-1)*map.spacing[map.axes[i]-1]),centre=E.position(map,...map.dims.map(n=>(n-1)/2)),m=new THREE.Matrix4(),basis=[0,0,0,0,0,0,0,0,0];for(let i=0;i<3;i++)basis[(map.axes[i]-1)*3+i]=size[i];
  m.set(basis[0],basis[1],basis[2],centre[0],basis[3],basis[4],basis[5],centre[1],basis[6],basis[7],basis[8],centre[2],0,0,0,1);mesh.matrix.copy(m);mesh.matrixAutoUpdate=false;mesh.renderOrder=300000;
  const inverse=new THREE.Matrix4(),direction=new THREE.Vector3();mesh.onBeforeRender=(renderer,scene,camera)=>{inverse.copy(mesh.matrixWorld).invert();material.uniforms.eyeLocal.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);camera.getWorldDirection(direction);material.uniforms.viewLocal.value.copy(direction).transformDirection(inverse);material.uniforms.isOrtho.value=camera.isOrthographicCamera?1:0;};
  group.add(mesh);group.userData.emVolume=mesh;return group;
 }
 function createSurface(surface,map){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(surface.positions,3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
  // Populate the nearest visible depth first, then shade only those fragments.
  // Both passes run after model geometry, preserving the model behind opacity.
  const depthMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:true,colorWrite:false});
  const colourMaterial=new THREE.MeshPhongMaterial({color:q('[data-colour]').value,transparent:true,opacity:Number(q('[data-opacity]').value)/100,depthTest:true,depthWrite:false,depthFunc:THREE.EqualDepth,side:THREE.DoubleSide,shininess:12,specular:0x101214});
  const depth=new THREE.Mesh(geometry,depthMaterial),colour=new THREE.Mesh(geometry,colourMaterial),group=new THREE.Group();depth.renderOrder=200000;colour.renderOrder=200001;group.add(depth,colour);group.userData.emSurface={geometry,depth,colour,map};group.visible=colourMaterial.opacity>0;setSurfaceShadows(group,q('[data-surface-shadows]').checked);return group;
 }

 // Sample the same cumulative +Y density used by cloud shadows at surface vertices.
 function setSurfaceShadows(object,enabled){
  const surface=object.userData.emSurface,geometry=surface.geometry,material=surface.colour.material;
  if(enabled&&!geometry.getAttribute('color')){
   const map=surface.map,atlas=E.volumeAtlas(map),positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3),[nx,ny,nz]=atlas.dims;
   for(let i=0;i<positions.count;i++){
    const point=[positions.getX(i),positions.getY(i),positions.getZ(i)],coord=map.axes.map((axis,j)=>Math.max(0,Math.min(atlas.dims[j]-1,Math.round(((point[axis-1]-map.origin[axis-1])/map.spacing[axis-1]-map.starts[j])*(atlas.dims[j]-1)/(map.dims[j]-1)))));
    const [x,y,z]=coord,index=4*((Math.floor(z/atlas.columns)*ny+y)*atlas.width+(z%atlas.columns)*nx+x),shade=1-.85*atlas.data[index+1]/255;
    colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;
   }
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  }
  material.vertexColors=enabled;material.needsUpdate=true;
 }

 function placeObject(object){
  const offset=object.userData.emOffset||getOffset(),placement=object.userData.emPlacement,translation=placement?.translation||[0,0,0];
  object.position.set(translation[0]-offset.x,translation[1]-offset.y,translation[2]-offset.z);
  if(placement&&object.userData.emAppliedPlacement!==placement){const r=placement.rotation,matrix=new THREE.Matrix4().set(r[0][0],r[0][1],r[0][2],0,r[1][0],r[1][1],r[1][2],0,r[2][0],r[2][1],r[2][2],0,0,0,0,1);object.quaternion.setFromRotationMatrix(matrix);object.userData.emAppliedPlacement=placement;}
 }

 function updateCloudCurve(){for(const object of objects){const uniforms=object.userData.emVolume?.material.uniforms;if(uniforms){const texture=uniforms.transferTexture.value;texture.image.data.set(E.curveTextureData(curve));texture.needsUpdate=true;}}redraw();}

 function updateMenu(){const menu=q('[data-menu]');menu.replaceChildren();if(!records.length){menu.textContent='No associated EMDB entries';return;}for(const rec of records){const label=document.createElement('label'),input=document.createElement('input');label.className='nucleic-guide-switch';input.type='checkbox';input.setAttribute('role','switch');input.checked=rec.visible;input.addEventListener('change',()=>{rec.visible=input.checked;update();});label.append(input,document.createTextNode(` ${rec.source}: ${rec.id}${rec.primary?' (associated)':''}`));menu.append(label);}}
 function sync(){
  const sources=getSources()||[],next=[],activeIds=new Set();
  for(const source of sources){
   const fileEntries=source.entries||(source.format==='mmcif'&&source.text?E.entries(source.text):[]);
   const fromFile=source.text?E.pdbId(source.text):null;
   const candidate=fromFile||String(source.pdbId||'').toUpperCase();
   const pdb=/^(?:[0-9][A-Z0-9]{3}|PDB_[A-Z0-9]{8})$/.test(candidate)?candidate:null;
   if(pdb){activeIds.add(pdb);if(!metadata.has(pdb)){metadata.set(pdb,{state:'loading',entries:[]});E.lookupEntry(pdb).then(entries=>{metadata.set(pdb,{state:'ready',entries});sync();}).catch(error=>{metadata.set(pdb,{state:'failed',entries:[],error});sync();});}}
   const api=pdb?metadata.get(pdb)?.entries||[]:[];
   for(const item of E.mergeEntries(fileEntries,api))next.push({...item,source:source.name||source.pdbId||pdb||'Structure',offset:source.offset||null,placement:source.placement||null});
  }
  const loading=[...activeIds].filter(id=>metadata.get(id)?.state==='loading'),failed=[...activeIds].filter(id=>metadata.get(id)?.state==='failed');
  q('[data-lookup-status]').textContent=loading.length?`Checking PDB entries: ${loading.join(', ')}…`:failed.length?`PDB lookup unavailable for ${failed.join(', ')}. Showing entries available in the structure file; turn EM data off and on to retry.`:'';
  wrap.setAttribute('data-em-empty',String(next.length===0));q('[data-empty-notice]').hidden=next.length>0||loading.length>0||failed.length>0;
  const nextKey=JSON.stringify(next);if(nextKey===key)return;key=nextKey;generation++;clear();thresholdInitialized=false;const previous=new Map(records.map(x=>[x.source+'|'+x.id,x.visible]));records=next.map((x,i)=>({...x,visible:previous.has(x.source+'|'+x.id)?previous.get(x.source+'|'+x.id):previous.size===0&&i===0}));if(records.length&&!records.some(x=>x.visible)&&!records.some(x=>previous.has(x.source+'|'+x.id)))records[0].visible=true;updateMenu();if(enabled)update();
 }
 async function load(id,onProgress){
  let item=cache.get(id);
  if(!item){
   item={listeners:new Set(),last:null};const publish=state=>{item.last=state;for(const listener of item.listeners)listener(state);};
   const number=id.slice(4),url=`https://ftp.ebi.ac.uk/pub/databases/emdb/structures/${id}/map/emd_${number}.map.gz`;
   item.promise=(async()=>{
    publish({label:`Loading EM data… ${id}`,detail:'Connecting…'});
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`HTTP ${response.status}`);
    if(typeof DecompressionStream==='undefined'||!response.body)throw Error('This browser cannot decompress EMDB maps');
    const length=Number(response.headers.get('content-length')),total=Number.isFinite(length)&&length>0&&!response.headers.get('content-encoding')?length:null;let received=0;
    const monitor=new TransformStream({transform(chunk,controller){received+=chunk.byteLength;publish({label:`Loading EM data… ${id}`,fraction:total&&received<=total?received/total:undefined,detail:total&&received<=total?`${Math.round(received/total*100)}% downloaded`:`${(received/1048576).toFixed(1)} MB downloaded`});controller.enqueue(chunk);}});
    const buffer=await new Response(response.body.pipeThrough(monitor).pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    publish({label:`Loading EM data… ${id}`,detail:'Preparing map…'});await nextPaint();const map=E.parse(buffer);item.ready=true;return map;
   })();cache.set(id,item);item.promise.catch(()=>{if(cache.get(id)===item)cache.delete(id);});
  }
  item.listeners.add(onProgress);if(item.last)onProgress(item.last);
  try{return await item.promise;}finally{item.listeners.delete(onProgress);}
 }
 async function update({thresholdChange=false}={}){const current=++generation;clear();histograms=[];shadowHistograms=[];plot();plotShadow();progress(null);redraw();if(!enabled)return;const selectedRecords=records.filter(x=>x.visible);if(!selectedRecords.length){setStatus(records.length?'Select an EMDB entry.':'');return;}setStatus('');const failures=[];for(const rec of selectedRecords){try{const showLoadProgress=!thresholdChange||!cache.get(rec.id)?.ready;const map=await load(rec.id,state=>{if(current===generation&&enabled&&showLoadProgress)progress(state);});if(current!==generation)return;if(thresholdChange)progress(null);else progress({label:`Loading EM data… ${rec.id}`,detail:'Preparing visualisation…'});await nextPaint();if(current!==generation)return;if(!thresholdInitialized){thresholdDefault=String(Math.max(0,Math.min(1000,Math.round(1000*(map.mean+map.sigma-map.min)/(map.max-map.min||1)))));q('[data-threshold]').value=thresholdDefault;thresholdInitialized=true;}thresholdMap=map;const normalized=Number(q('[data-threshold]').value)/1000,threshold=typedThreshold===null?map.min+(map.max-map.min)*normalized:Math.max(map.min,Math.min(map.max,typedThreshold));const method=q('[data-method]').value;let object;if(method==='surface'){const surface=E.subdividedMapSurface(map,threshold);object=createSurface(surface,map);}else{object=createVolume(map);map.emDensityHistogram??=E.densityHistogram(map);histograms.push(map.emDensityHistogram);plot();}if(current!==generation)return;object.userData.emOffset=rec.offset;object.userData.emPlacement=rec.placement;placeObject(object);getScene()?.add(object);objects.push(object);q('[data-threshold-value]').value=Number(threshold.toPrecision(6));q('[data-threshold-value]').min=map.min;q('[data-threshold-value]').max=map.max;}catch(error){failures.push(`${rec.id}: ${error.name==='TimeoutError'?'download timed out':error.message}`);}}if(current!==generation)return;progress(null);setStatus(failures.length?`Could not load ${failures.join('; ')}.`:'');redraw();}
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>update({thresholdChange:true}),120);}
 function plotCurve(c,curve,histograms){
  const ctx=c.getContext('2d'),w=c.width,h=c.height,left=8,top=8,width=w-16,height=h-16,light=!!document.body?.classList.contains('light-mode');ctx.clearRect(0,0,w,h);ctx.fillStyle=light?'#f8fafc':'#0f172a';ctx.fillRect(0,0,w,h);
  if(histograms.length){const bins=histograms[0].length,totals=new Float64Array(bins);for(const values of histograms)for(let i=0;i<bins;i++)totals[i]+=values[i];const max=Math.max(...totals);if(max>0){ctx.fillStyle=light?'rgba(71,85,105,.26)':'rgba(148,163,184,.32)';for(let i=0;i<bins;i++){const bar=height*totals[i]/max;ctx.fillRect(left+i*width/bins,top+height-bar,Math.max(1,width/bins),bar);}}}
  ctx.strokeStyle=light?'#cbd5e1':'#334155';for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(left+i*width/4,top);ctx.lineTo(left+i*width/4,top+height);ctx.moveTo(left,top+i*height/4);ctx.lineTo(left+width,top+i*height/4);ctx.stroke();}
  ctx.strokeStyle='rgba(14,165,233,.5)';ctx.lineWidth=1;ctx.setLineDash?.([3,3]);ctx.beginPath();curve.forEach((p,i)=>{const x=left+p.x*width,y=top+(1-p.y)*height;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash?.([]);ctx.strokeStyle='#0ea5e9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,top+(1-curve[0].y)*height);for(let i=0;i<=100;i++){const p=E.bezierPoint(curve,i/100);ctx.lineTo(left+p.x*width,top+(1-p.y)*height);}ctx.lineTo(left+width,top+(1-curve[curve.length-1].y)*height);ctx.stroke();curve.forEach((p,i)=>{ctx.beginPath();ctx.fillStyle='#0ea5e9';ctx.arc(left+p.x*width,top+(1-p.y)*height,5,0,Math.PI*2);ctx.fill();});
 }
 function plot(){plotCurve(q('[data-curve]'),curve,histograms);}
 function plotShadow(){plotCurve(q('[data-shadow-curve]'),shadowCurve,shadowHistograms);}
 const canvas=q('[data-curve]');
 function pointFromEvent(e){const r=canvas.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*canvas.width-8)/(canvas.width-16),y=1-((e.clientY-r.top)/r.height*canvas.height-8)/(canvas.height-16);return {x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};}
 function movePointer(e){const point=pointFromEvent(e);E.moveCurvePoint(curve,selected,point.x,point.y);plot();updateCloudCurve();}
 canvas.addEventListener('pointerdown',e=>{const point=pointFromEvent(e);let distance=Infinity;curve.forEach((p,i)=>{const d=((p.x-point.x)*(canvas.width-16))**2+((p.y-point.y)*(canvas.height-16))**2;if(d<distance){distance=d;selected=i;}});canvas.setPointerCapture(e.pointerId);movePointer(e);});
 canvas.addEventListener('pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))movePointer(e);});
 canvas.addEventListener('keydown',e=>{if(e.key==='PageUp')selected=Math.max(0,selected-1);else if(e.key==='PageDown')selected=Math.min(curve.length-1,selected+1);else{const p=curve[selected];if(e.key==='ArrowLeft')E.moveCurvePoint(curve,selected,p.x-.02,p.y);else if(e.key==='ArrowRight')E.moveCurvePoint(curve,selected,p.x+.02,p.y);else if(e.key==='ArrowUp')E.moveCurvePoint(curve,selected,p.x,p.y+.05);else if(e.key==='ArrowDown')E.moveCurvePoint(curve,selected,p.x,p.y-.05);else return;}e.preventDefault();plot();updateCloudCurve();});
 const shadowCanvas=q('[data-shadow-curve]');
 function updateShadowCurve(){for(const object of objects){const texture=object.userData.emVolume?.material.uniforms.shadowTexture.value;if(texture){texture.image.data.set(E.curveTextureData(shadowCurve));texture.needsUpdate=true;}}redraw();}
 function moveShadowPointer(e){const r=shadowCanvas.getBoundingClientRect(),x=Math.max(0,Math.min(1,((e.clientX-r.left)/r.width*shadowCanvas.width-8)/(shadowCanvas.width-16))),y=Math.max(0,Math.min(1,1-((e.clientY-r.top)/r.height*shadowCanvas.height-8)/(shadowCanvas.height-16)));E.moveCurvePoint(shadowCurve,shadowSelected,x,y);plotShadow();updateShadowCurve();}
 shadowCanvas.addEventListener('pointerdown',e=>{const r=shadowCanvas.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*shadowCanvas.width-8)/(shadowCanvas.width-16),y=1-((e.clientY-r.top)/r.height*shadowCanvas.height-8)/(shadowCanvas.height-16);let distance=Infinity;shadowCurve.forEach((p,i)=>{const d=((p.x-x)*(shadowCanvas.width-16))**2+((p.y-y)*(shadowCanvas.height-16))**2;if(d<distance){distance=d;shadowSelected=i;}});shadowCanvas.setPointerCapture(e.pointerId);moveShadowPointer(e);});
 shadowCanvas.addEventListener('pointermove',e=>{if(shadowCanvas.hasPointerCapture(e.pointerId))moveShadowPointer(e);});
 shadowCanvas.addEventListener('keydown',e=>{if(e.key==='PageUp')shadowSelected=Math.max(0,shadowSelected-1);else if(e.key==='PageDown')shadowSelected=Math.min(shadowCurve.length-1,shadowSelected+1);else{const p=shadowCurve[shadowSelected];if(e.key==='ArrowLeft')E.moveCurvePoint(shadowCurve,shadowSelected,p.x-.02,p.y);else if(e.key==='ArrowRight')E.moveCurvePoint(shadowCurve,shadowSelected,p.x+.02,p.y);else if(e.key==='ArrowUp')E.moveCurvePoint(shadowCurve,shadowSelected,p.x,p.y+.05);else if(e.key==='ArrowDown')E.moveCurvePoint(shadowCurve,shadowSelected,p.x,p.y-.05);else return;}e.preventDefault();plotShadow();updateShadowCurve();});
 q('[data-shadow-reset]').addEventListener('click',()=>{shadowCurve=E.defaultShadowCurve();shadowSelected=2;plotShadow();updateShadowCurve();});
 q('[data-shadow-trigger]').addEventListener('click',()=>{const panel=q('[data-shadow-plot]'),open=panel.hidden;panel.hidden=!open;q('[data-shadow-trigger]').setAttribute('aria-expanded',String(open));if(open)plotShadow();});
 q('[data-surface-shadows]').addEventListener('change',()=>{for(const object of objects)if(object.userData.emSurface)setSurfaceShadows(object,q('[data-surface-shadows]').checked);redraw();});
 q('[data-shadows]').addEventListener('change',()=>{const checked=q('[data-shadows]').checked;q('[data-shadow-trigger]').hidden=!checked;q('[data-shadow-reset]').hidden=!checked;if(!checked){q('[data-shadow-plot]').hidden=true;q('[data-shadow-trigger]').setAttribute('aria-expanded','false');}for(const object of objects){const uniforms=object.userData.emVolume?.material.uniforms;if(uniforms)uniforms.shadows.value=q('[data-shadows]').checked?1:0;}redraw();});
 q('[data-reset]').addEventListener('click',()=>{curve=E.defaultCurve();plot();updateCloudCurve();});

 button.addEventListener('click',()=>{enabled=!enabled;button.setAttribute('aria-pressed',String(enabled));button.title=`${enabled?'Hide':'Show'} EM data`;eye.className=`fa-solid ${enabled?'fa-eye':'fa-eye-slash'}`;wrap.hidden=!enabled;if(enabled){for(const [id,state] of metadata)if(state.state==='failed')metadata.delete(id);openSettings?.();requestAnimationFrame(()=>{if(enabled)wrap.scrollIntoView({behavior:'smooth',block:'start'});});sync();}update();});const menuPairs=[['[data-entries]','[data-menu]'],['[data-method-trigger]','[data-method-menu]']];
 function closeMenus(except){for(const [triggerSelector,menuSelector] of menuPairs){const trigger=q(triggerSelector),menu=q(menuSelector);if(menu===except)continue;menu.hidden=true;trigger.setAttribute('aria-expanded','false');}}
 for(const [triggerSelector,menuSelector] of menuPairs){const trigger=q(triggerSelector),menu=q(menuSelector);trigger.addEventListener('click',()=>{const opening=menu.hidden;closeMenus();menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));});}
 const outside=event=>{if(!wrap.contains(event.target))closeMenus();},escape=event=>{if(event.key==='Escape'){const open=menuPairs.find(([,menu])=>!q(menu).hidden);if(open){closeMenus();q(open[0]).focus();}}};document.addEventListener('click',outside);document.addEventListener('keydown',escape);
 for(const value of ['surface','cloud'])q(`[data-method-${value}]`).addEventListener('click',()=>{const select=q('[data-method]');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));closeMenus();q('[data-method-trigger]').focus();});
 q('[data-method]').addEventListener('change',()=>{const cloud=q('[data-method]').value==='cloud';q('[data-method-label]').textContent=cloud?'Cloud':'Surface';for(const value of ['surface','cloud'])q(`[data-method-${value}]`).setAttribute('aria-pressed',String(q('[data-method]').value===value));q('[data-cloud]').hidden=!cloud;q('[data-surface]').hidden=cloud;q('[data-reset]').hidden=!cloud;update();});q('[data-colour-reset]').addEventListener('click',()=>{const input=q('[data-colour]');input.value='#b0b0b0';input.dispatchEvent(new Event('input',{bubbles:true}));});q('[data-colour]').addEventListener('input',()=>{const color=q('[data-colour]').value;q('[data-colour-swatch]').style.backgroundColor=color;for(const object of objects){const material=object.userData.emVolume?.material||object.userData.emSurface?.colour.material||object.material;if(material.uniforms?.cloudColor)material.uniforms.cloudColor.value.set(color);else material.color?.set(color);}redraw();});q('[data-threshold-reset]').addEventListener('click',()=>{const input=q('[data-threshold]');input.value=thresholdDefault;input.dispatchEvent(new Event('input',{bubbles:true}));});q('[data-opacity-reset]').addEventListener('click',()=>{const input=q('[data-opacity]');input.value='40';input.dispatchEvent(new Event('input',{bubbles:true}));});q('[data-threshold]').addEventListener('input',()=>{typedThreshold=null;if(thresholdMap){const map=thresholdMap,value=map.min+(map.max-map.min)*Number(q('[data-threshold]').value)/1000;q('[data-threshold-value]').value=Number(value.toPrecision(6));}schedule();});q('[data-threshold-value]').addEventListener('change',()=>{if(!thresholdMap)return;const input=q('[data-threshold-value]'),value=Number(input.value),map=thresholdMap;if(input.value===''||!Number.isFinite(value))return;const clamped=Math.max(map.min,Math.min(map.max,value));input.value=clamped;typedThreshold=clamped;q('[data-threshold]').value=Math.round(1000*(clamped-map.min)/(map.max-map.min||1));schedule();});q('[data-opacity-value]').addEventListener('change',()=>{const input=q('[data-opacity-value]'),value=Number(input.value);if(input.value===''||!Number.isFinite(value)){input.value=q('[data-opacity]').value;return;}q('[data-opacity]').value=Math.max(0,Math.min(100,value));q('[data-opacity]').dispatchEvent(new Event('input',{bubbles:true}));});q('[data-opacity]').addEventListener('input',()=>{q('[data-opacity-value]').value=q('[data-opacity]').value;for(const o of objects){const surface=o.userData.emSurface;if(surface){surface.colour.material.opacity=Number(q('[data-opacity]').value)/100;o.visible=surface.colour.material.opacity>0;}}redraw();});plot();const themeObserver=typeof MutationObserver!=='undefined'&&document.body?new MutationObserver(()=>{plot();plotShadow();}):null;themeObserver?.observe(document.body,{attributes:true,attributeFilter:['class']});sync();return {button,sync,offset(){for(const object of objects)placeObject(object);},dispose(){generation++;clearTimeout(timer);themeObserver?.disconnect();document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);clear();wrap.remove();button.remove();}};
};
})(typeof window==='undefined'?globalThis:window);


