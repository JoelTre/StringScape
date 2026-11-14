'use strict';
// Features use prediction-side positions and alignment only, never the hidden reference.
function benchmarkFeatures(nodes, atomFor, referenceFor, matrices, strainPairs, clashes){
    const result=Array(nodes.length).fill(null), groups=new Map();
    nodes.forEach((node,index)=>{if(node.res.entityType!=='protein'||node.idx2===null)return;const atom=atomFor(node),pos=Number(atom?.afResSeq??atom?.resSeq);if(!Number.isInteger(pos))return;const key=JSON.stringify([node.blockIdx,atom?.fileIndex,atom?.groupKey]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({node,index,atom,pos,ref:referenceFor(node)});});
    const strain=nodes.map(()=>[]);for(const p of strainPairs||[]){if(Number.isFinite(p.strain)){strain[p.i]?.push(Math.abs(p.strain));strain[p.j]?.push(Math.abs(p.strain));}}
    const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
    const directional=(a,b)=>{if(!a||!b||a.fileIndex!==b.fileIndex||a.groupKey!==b.groupKey)return null;const m=matrices.get(a.fileIndex),i=Number(a.afResSeq??a.resSeq)-1,j=Number(b.afResSeq??b.resSeq)-1;if(!m||!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>=m.size||j>=m.size)return null;const value=m.values[i*m.size+j];return Number.isFinite(value)&&value>=0?value:null;};
    for(const entries of groups.values()){
        entries.sort((a,b)=>a.pos-b.pos);const anchors=entries.filter(e=>e.node.usedInAlignment&&e.ref);
        for(const e of entries){
            const left=anchors.filter(a=>a.pos<e.pos).at(-1),right=anchors.find(a=>a.pos>e.pos),self=anchors.includes(e),dl=self?0:left?e.pos-left.pos:null,dr=self?0:right?right.pos-e.pos:null;
            const gap=self?0:left&&right?right.pos-left.pos-1:left?entries.at(-1).pos-left.pos:right?right.pos-entries[0].pos:entries.at(-1).pos-entries[0].pos+1;
            const pairs=anchors.filter(a=>a!==e).map(a=>({position:a.pos,residueToAnchor:directional(e.atom,a.atom),anchorToResidue:directional(a.atom,e.atom)}));
            const vals=key=>pairs.map(p=>p[key]).filter(Number.isFinite),nearest=(a,key)=>a?directional(key==='out'?e.atom:a.atom,key==='out'?a.atom:e.atom):null;
            const aa=e.atom?.singleChar,ref=e.ref?.singleChar;
            const distance=(a,b)=>a&&b&&[a.node.x,a.node.y,a.node.z,b.node.x,b.node.y,b.node.z].every(Number.isFinite)?Math.hypot(a.node.x-b.node.x,a.node.y-b.node.y,a.node.z-b.node.z):null;
            const anchorSpan=distance(left,right),capacity=left&&right?(gap+1)*3.8:null;
            const previous=entries.find(x=>x.pos===e.pos-1),next=entries.find(x=>x.pos===e.pos+1);
            result[e.index]={block:e.node.blockIdx,afPosition:e.pos,afChain:e.atom?.groupKey??null,referenceChain:e.node.res.c1??null,referencePosition:e.ref?.resSeq??null,referenceInsertion:e.ref?.sourceAtoms?.[0]?.insertionCode??'',alignmentIdentity:e.node.res.identity??null,alignmentSimilarity:e.node.res.similarity??null,polymerSequenceAlignment:e.node.res.polymerSequenceAlignment??null,alignmentEvidence:self?(aa&&ref?(aa.toUpperCase()===ref.toUpperCase()?'exact':'substitution'):'unknown'):'unaligned',leftDistance:dl,rightDistance:dr,nearestDistance:dl===null?dr:dr===null?dl:Math.min(dl,dr),gapLength:gap,gapType:self?'aligned':left&&right?'internal':left?'C-terminal':right?'N-terminal':'no anchor',anchorCount:anchors.length,anchorSpan,anchorCapacity:capacity,anchorReachRatio:capacity&&anchorSpan!==null?anchorSpan/capacity:null,previousCaDistance:distance(e,previous),nextCaDistance:distance(e,next),paeOutMean:mean(vals('residueToAnchor')),paeInMean:mean(vals('anchorToResidue')),paeOutCount:vals('residueToAnchor').length,paeInCount:vals('anchorToResidue').length,paeLeftOut:nearest(left,'out'),paeLeftIn:nearest(left,'in'),paeRightOut:nearest(right,'out'),paeRightIn:nearest(right,'in'),anchorPairs:pairs,secondary:e.atom?.secondaryType??null,clash:clashes?.[e.index]??null,strain:mean(strain[e.index]),strainCount:strain[e.index].length};
        }
    }
    return result;
}
if(typeof module!=='undefined')module.exports={benchmarkFeatures};
// Run-5 exploratory fits. Missing or unsupported inputs are deliberately unscored.
function run5Confidence(f,plddt,wholePae){
    const empty={local:null,placement2:null,placement5:null,model:null};
    if(!f||f.gapType==='aligned'||!['internal','N-terminal','C-terminal'].includes(f.gapType)||![plddt,wholePae,f.nearestDistance,f.gapLength,f.paeOutMean,f.paeInMean,f.clash,f.anchorCount].every(Number.isFinite)||plddt<0||plddt>100||wholePae<0||f.anchorCount<=0)return empty;
    const cap=(x,max)=>Math.max(0,Math.min(max,x)),sig=x=>1/(1+Math.exp(-x));
    const p=cap(plddt/100,1),n=Math.log1p(cap(f.nearestDistance,1000)/100),g=Math.log1p(cap(f.gapLength,1500)/100),w=cap(wholePae,40)/10,o=cap(f.paeOutMean,40)/10,i=cap(f.paeInMean,40)/10,c=cap(f.clash,1),a=cap(f.anchorCount,500)/100,I=+(f.gapType==='internal'),N=+(f.gapType==='N-terminal'),C=+(f.gapType==='C-terminal');
    const local=cap(.26307+.74748*p+.06646*n-.02966*g-.00023*I-.00756*N+.00779*C+.01023*w-.01794*o-.08322*i-.14674*c-.00608*a,1);
    const z=-.34459+3.16581*p-.01946*n-.00001*g+.05690*I-.23824*N+.18134*C+.24264*w-1.39938*o-2.48512*i+.11038*c+.57810*a;
    const placement2=sig(z),placement5=sig(z+1.96074);
    const q=sig(-.85142+4.69579*p+.75707*n+.20472*g+.11413*I-.42183*N+.30770*C+.03904*w-.95667*o-.95048*i-.72048*c+.10585*a);
    return {local,placement2,placement5,model:placement5*q};
}
if(typeof module!=='undefined')module.exports={benchmarkFeatures,run5Confidence};
