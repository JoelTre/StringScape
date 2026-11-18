// Geometry-only analysis of a modelled interface. Inputs are plain serializable data.
function analyzeBindingSite(input) {
    const {atoms,residues}=input, radii={C:1.7,N:1.55,O:1.52,S:1.8,P:1.8,SE:1.9,F:1.47,CL:1.75};
    const points=96,probe=1.4,golden=Math.PI*(3-Math.sqrt(5));
    const directions=Array.from({length:points},(_,i)=>{const y=1-2*(i+.5)/points,r=Math.sqrt(1-y*y),a=golden*i;return [Math.cos(a)*r,y,Math.sin(a)*r];});
    const grid=new Map(),cell=7,key=(x,y,z)=>`${x},${y},${z}`;
    for(let i=0;i<atoms.length;i++){const a=atoms[i],k=key(Math.floor(a.x/cell),Math.floor(a.y/cell),Math.floor(a.z/cell));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}
    const nearby=a=>{const result=[],x=Math.floor(a.x/cell),y=Math.floor(a.y/cell),z=Math.floor(a.z/cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)result.push(...(grid.get(key(x+dx,y+dy,z+dz))||[]));return result;};
    const negative={D:['OD1','OD2'],E:['OE1','OE2']},positive={K:['NZ'],R:['NE','NH1','NH2']};
    const charged=(letter,name,type)=>type==='protein'?(negative[letter]?.includes(name)?-1:positive[letter]?.includes(name)?1:0):0;
    let closest=null,clashes=0;const worst=[],hydrogen=[],salt=[],seenH=new Set(),seenS=new Set(),buried=[0,0];
    const label=a=>`${a.residueLabel} ${a.name}`;
    for(let i=0;i<atoms.length;i++){
        const a=atoms[i];if(!a.selected)continue;
        const neighbors=nearby(a),ra=radii[a.element]||1.7,expanded=ra+probe;
        // Estimate the loss of each selected atom's isolated-chain solvent accessible area.
        for(const [ux,uy,uz] of directions){
            const x=a.x+expanded*ux,y=a.y+expanded*uy,z=a.z+expanded*uz;let own=false,other=false;
            for(const j of neighbors){if(j===i)continue;const b=atoms[j],r=(radii[b.element]||1.7)+probe,dx=x-b.x,dy=y-b.y,dz=z-b.z;if(dx*dx+dy*dy+dz*dz<r*r){if(a.side===b.side){own=true;break;}other=true;}}
            if(!own&&other)buried[a.side]+=4*Math.PI*expanded*expanded/points;
        }
        if(a.side!==0)continue;
        for(const j of neighbors){const b=atoms[j];if(b.side!==1||!b.selected)continue;
            const d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(closest===null||d<closest)closest=d;
            const overlap=ra+(radii[b.element]||1.7)-d,detail={first:label(a),second:label(b),distance:d,overlap};
            if(overlap>.4){clashes++;worst.push(detail);}
            if(d>=2.3&&d<=3.5&&((a.element==='N'&&b.element==='O')||(a.element==='O'&&b.element==='N'))){const k=`${a.residueIndex}:${b.residueIndex}`;if(!seenH.has(k)){seenH.add(k);hydrogen.push(detail);}}
            if(d>=2.3&&d<=4&&charged(a.letter,a.name,a.type)*charged(b.letter,b.name,b.type)===-1){const k=`${a.residueIndex}:${b.residueIndex}`;if(!seenS.has(k)){seenS.add(k);salt.push(detail);}}
        }
    }
    worst.sort((a,b)=>b.overlap-a.overlap);
    const chemistry={nonpolar:0,aromatic:0,polar:0,basic:0,acidic:0,other:0};
    for(const r of residues){const aa=r.letter||'';const type='AVILMP'.includes(aa)&&aa?'nonpolar':'FWY'.includes(aa)&&aa?'aromatic':'STNQC'.includes(aa)&&aa?'polar':'KRH'.includes(aa)&&aa?'basic':'DE'.includes(aa)&&aa?'acidic':'other';chemistry[type]++;}
    // The grid guarantees the exact minimum only within one cell width.
    return {buried,closest:closest!==null&&closest<=cell?closest:null,clashes,worst:worst.slice(0,10),hydrogen,salt,chemistry,defaultRadiusAtomCount:atoms.filter(atom=>!radii[atom.element]).length};
}
if(typeof window!=='undefined')window.analyzeBindingSite=analyzeBindingSite;
if(typeof module!=='undefined')module.exports=analyzeBindingSite;
