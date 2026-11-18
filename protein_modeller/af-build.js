/* Source-aware AlphaFold fragment assembly primitives. Coordinates are not mutated. */
(function(root){
'use strict';
function point(p,fit){const {R,t}=fit;return {x:R[0][0]*p.x+R[0][1]*p.y+R[0][2]*p.z+t[0],y:R[1][0]*p.x+R[1][1]*p.y+R[1][2]*p.z+t[1],z:R[2][0]*p.x+R[2][1]*p.y+R[2][2]*p.z+t[2]};}
function direction(a,b){const x=a.x-b.x,y=a.y-b.y,z=a.z-b.z,n=Math.hypot(x,y,z);return n>1e-8?{x:x/n,y:y/n,z:z/n}:{x:1,y:0,z:0};}
function transformAtom(atom,fit){return {...atom,...point(atom,fit),sourceAtoms:(atom.sourceAtoms||[]).map(a=>({...a,...point(a,fit)}))};}
/** Validate a reported one-based UniProt range without rejecting minor substitutions.
 * Indels need an explicit alignment and must not silently shift coordinates.
 */
function mapReportedRange(sequence,fragmentSequence,start,end){
 if(typeof sequence!=='string'||typeof fragmentSequence!=='string'||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>sequence.length)throw Error('Invalid reported UniProt range.');
 if(fragmentSequence.length!==end-start+1)throw Error('Fragment length does not match its reported range; alignment is required.');
 const substitutions=[];for(let i=0;i<fragmentSequence.length;i++)if(sequence[start-1+i].toUpperCase()!==fragmentSequence[i].toUpperCase())substitutions.push({position:start+i,uniprot:sequence[start-1+i],alphaFold:fragmentSequence[i]});
 if(substitutions.length>Math.max(2,Math.floor(fragmentSequence.length*.1)))throw Error('Fragment sequence differs substantially from its reported UniProt range.');
 return {start,end,substitutions};
}
/** Fragments have a one-based start and residues in UniProt order. fit maps Q onto P. */
function assemble(sequence,fragments,fit,options={}){
 if(typeof sequence!=='string'||typeof fit!=='function')throw Error('Sequence and rigid fitting function are required.');
 const positions=Array(sequence.length).fill(null),reports=[];
 const ordered=fragments.map((f,i)=>({...f,order:i})).sort((a,b)=>a.start-b.start||b.residues.length-a.residues.length||a.order-b.order);
 for(const fragment of ordered){
  if(!Number.isInteger(fragment.start)||fragment.start<1||!Array.isArray(fragment.residues)||fragment.start+fragment.residues.length-1>sequence.length)throw Error('Fragment range is outside the UniProt sequence.');
  const shared=[];fragment.residues.forEach((atom,i)=>{const existing=positions[fragment.start-1+i];if(existing?.placed)shared.push([existing.atom,atom]);});
  let transform=null,rmsd=null;
  if(shared.length>=3){transform=fit(shared.map(p=>p[0]),shared.map(p=>p[1]));rmsd=Math.sqrt(shared.reduce((sum,[a,b])=>{const q=point(b,transform);return sum+(a.x-q.x)**2+(a.y-q.y)**2+(a.z-q.z)**2;},0)/shared.length);}
  let placement=transform?'overlap':null;
  if(!transform && options.reference){
   const pairs=[];fragment.residues.forEach((atom,i)=>{const reference=options.reference[fragment.start-1+i];if(reference)pairs.push([reference,atom]);});
   if(pairs.length>=3){transform=fit(pairs.map(p=>p[0]),pairs.map(p=>p[1]));placement='reference';}
  }
  // Translation is an initial scaffold only; it carries no inter-fragment confidence.
  if(!transform && reports.length && options.scaffold){
   let anchor=-1;for(let i=fragment.start-2;i>=0;i--)if(positions[i]?.placed){anchor=i;break;}
   if(anchor>=0){const a=positions[anchor].atom,b=fragment.residues[0],previous=positions[anchor-1]?.placed?positions[anchor-1].atom:null,d=previous?direction(a,previous):{x:1,y:0,z:0},distance=(fragment.start-1-anchor)*3.8;transform={R:[[1,0,0],[0,1,0],[0,0,1]],t:[a.x+d.x*distance-b.x,a.y+d.y*distance-b.y,a.z+d.z*distance-b.z]};placement='scaffold';}
  }
  if(!reports.length&&!placement)placement='origin';
  let added=0;
  fragment.residues.forEach((atom,i)=>{const index=fragment.start-1+i;if(positions[index])return;positions[index]={atom:transform?transformAtom(atom,transform):{...atom,sourceAtoms:(atom.sourceAtoms||[]).map(a=>({...a}))},source:fragment.id,sourceIndex:i,placed:!!transform||reports.length===0};added++;});
  reports.push({id:fragment.id,start:fragment.start,end:fragment.start+fragment.residues.length-1,overlap:shared.length,rmsd,added,placed:!!placement,placement});
 }
 if(options.makeSequenceAtom){
  for(let i=0;i<positions.length;){if(positions[i]){i++;continue;}const start=i;while(i<positions.length&&!positions[i])i++;const left=positions[start-1],right=positions[i];
   for(let j=start;j<i;j++){let xyz=null,method=null;const reference=options.reference?.[j];if(reference){xyz={x:reference.x,y:reference.y,z:reference.z};method='reference';}else if(left?.placed&&right?.placed){const f=(j-start+1)/(i-start+1);xyz={x:left.atom.x+(right.atom.x-left.atom.x)*f,y:left.atom.y+(right.atom.y-left.atom.y)*f,z:left.atom.z+(right.atom.z-left.atom.z)*f};method='scaffold';}else if(left?.placed||right?.placed){const terminal=left?.placed?left:right,neighbour=left?.placed?positions[start-2]:positions[i+1],d=neighbour?.placed?direction(terminal.atom,neighbour.atom):{x:left?.placed?1:-1,y:0,z:0},steps=left?.placed?j-start+1:i-j;xyz={x:terminal.atom.x+d.x*3.8*steps,y:terminal.atom.y+d.y*3.8*steps,z:terminal.atom.z+d.z*3.8*steps};method='terminal scaffold';}if(xyz)positions[j]={atom:options.makeSequenceAtom(sequence[j],j,xyz),source:null,sourceIndex:null,placed:true,sequenceOnly:true,placement:method};}
  }
 }
 return {sequence,positions,reports};
}
const api={assemble,mapReportedRange};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AlphaFoldBuild=api;
})(globalThis);
