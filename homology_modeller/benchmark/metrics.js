'use strict';
// Reference and predicted backbone coordinates are grouped by the original chain.
function benchmarkDihedral(a,b,c,d){
    if(!a||!b||!c||!d)return null;
    const v=(p,q)=>[q.x-p.x,q.y-p.y,q.z-p.z],cross=(u,w)=>[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],dot=(u,w)=>u[0]*w[0]+u[1]*w[1]+u[2]*w[2];
    const u=v(a,b),w=v(b,c),t=v(c,d),n1=cross(u,w),n2=cross(w,t),length=Math.hypot(...w);
    if(length<1e-8||Math.hypot(...n1)<1e-8||Math.hypot(...n2)<1e-8)return null;
    return Math.atan2(dot(cross(n1,n2),w)/length,dot(n1,n2))*180/Math.PI;
}
function benchmarkBackboneMetrics(chains){
    const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z):Infinity;
    const diff=(a,b)=>a===null||b===null?null:Math.abs(((a-b+540)%360)-180);
    const residues=[];
    for(const chain of chains){
        for(let i=0;i<chain.length;i++){
            const r=chain[i],prev=chain[i-1],next=chain[i+1],ref=r.reference||{},pred=r.predicted||{};
            // A peptide bond must exist in both structures; never bridge gaps or chains.
            const before=prev&&distance(prev.reference?.C,ref.N)<=2&&distance(prev.predicted?.C,pred.N)<=2;
            const after=next&&distance(ref.C,next.reference?.N)<=2&&distance(pred.C,next.predicted?.N)<=2;
            r.phiDifference=before?diff(benchmarkDihedral(prev.reference.C,ref.N,ref.CA,ref.C),benchmarkDihedral(prev.predicted.C,pred.N,pred.CA,pred.C)):null;
            r.psiDifference=after?diff(benchmarkDihedral(ref.N,ref.CA,ref.C,next.reference.N),benchmarkDihedral(pred.N,pred.CA,pred.C,next.predicted.N)):null;
            const angles=[r.phiDifference,r.psiDifference].filter(Number.isFinite);r.torsionDifference=angles.length?angles.reduce((a,b)=>a+b,0)/angles.length:null;
            r.lddtEligible=0;r.lddtCompared=0;r.lddtMissing=0;r.lddtPasses=0;r.lddt=null;residues.push(r);
        }
    }
    const grid=new Map(),cell=15,key=(x,y,z)=>`${x},${y},${z}`;let eligiblePairs=0,comparedPairs=0,passes=0;
    for(const r of residues){const ca=r.reference?.CA;if(!ca)continue;const x=Math.floor(ca.x/cell),y=Math.floor(ca.y/cell),z=Math.floor(ca.z/cell);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const other of grid.get(key(x+dx,y+dy,z+dz))||[]){const refDistance=distance(ca,other.reference.CA);if(refDistance>=15)continue;eligiblePairs++;r.lddtEligible++;other.lddtEligible++;
            if(!r.predicted?.CA||!other.predicted?.CA){r.lddtMissing++;other.lddtMissing++;continue;}
            const error=Math.abs(distance(r.predicted.CA,other.predicted.CA)-refDistance),passed=[.5,1,2,4].filter(threshold=>error<threshold).length;comparedPairs++;passes+=passed;r.lddtCompared++;other.lddtCompared++;r.lddtPasses+=passed;other.lddtPasses+=passed;
        }
        const cellKey=key(x,y,z);if(!grid.has(cellKey))grid.set(cellKey,[]);grid.get(cellKey).push(r);
    }
    for(const r of residues)r.lddt=r.lddtCompared?r.lddtPasses/(4*r.lddtCompared):null;
    const torsions=residues.map(r=>r.torsionDifference).filter(Number.isFinite);
    return {lddt:comparedPairs?passes/(4*comparedPairs):null,eligiblePairs,comparedPairs,missingPairs:eligiblePairs-comparedPairs,torsionDifference:torsions.length?torsions.reduce((a,b)=>a+b,0)/torsions.length:null};
}
if(typeof module!=='undefined')module.exports={benchmarkDihedral,benchmarkBackboneMetrics};
