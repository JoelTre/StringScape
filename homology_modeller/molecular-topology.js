// Pure numerical topology kernel. Inputs/outputs cross workers as typed columns.
(function(){
 function buildMolecularBonds(input){
  const {xyz,nodeIndices,block,residue,type,sequence,names,nameCodes,radii}=input;
  const count=nodeIndices.length,grid=new Map(),special=new Map();let used=0,capacity=Math.max(16,count*2),pairs=new Uint32Array(capacity*2);
  // A padded integer cell address avoids allocating 27 string keys per atom.
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity,minBlock=Infinity,maxBlock=-Infinity;
  for(let i=0;i<count;i++){const k=i*3,x=Math.floor(xyz[k]/3),y=Math.floor(xyz[k+1]/3),z=Math.floor(xyz[k+2]/3);if(Number.isFinite(x+y+z)){minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);}const b=block[nodeIndices[i]];minBlock=Math.min(minBlock,b);maxBlock=Math.max(maxBlock,b);}
  const sx=maxX-minX+3,sy=maxY-minY+3,sz=maxZ-minZ+3,stride=sy*sz,numeric=Number.isSafeInteger((maxBlock-minBlock+1)*sx*sy*sz);
  const address=(b,x,y,z)=>numeric?((b-minBlock)*sx+x-minX+1)*stride+(y-minY+1)*sz+z-minZ+1:`${b}:${x}:${y}:${z}`;
  const append=(a,b)=>{if(used===capacity){capacity*=2;const next=new Uint32Array(capacity*2);next.set(pairs);pairs=next;}pairs[used*2]=a;pairs[used++*2+1]=b;};
  const code=name=>names.indexOf(name),C=code('C'),N=code('N'),SG=code('SG');
  for(let i=0;i<count;i++){
   const n=nodeIndices[i],k=i*3,x=Math.floor(xyz[k]/3),y=Math.floor(xyz[k+1]/3),z=Math.floor(xyz[k+2]/3),name=nameCodes[i];
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
    for(const j of grid.get(address(block[n],x+dx,y+dy,z+dz))||[]){
     const m=nodeIndices[j],other=nameCodes[j];
     if(n!==m&&!(Math.abs(residue[n]-residue[m])===1&&((name===C&&other===N)||(name===N&&other===C)))&&!(name===SG&&other===SG)&&!(type[n]===2&&type[m]===2))continue;
     const q=j*3,distance=Math.hypot(xyz[k]-xyz[q],xyz[k+1]-xyz[q+1],xyz[k+2]-xyz[q+2]);
     if(distance>.4&&distance<=radii[i]+radii[j]+.4)append(j,i);
    }
   }
   const key=address(block[n],x,y,z);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
   if(sequence[n]||type[n]===1){let atoms=special.get(n);if(!atoms)special.set(n,atoms={});atoms[names[name].replace('*',"'")]=i;}
  }
  // Preserve synthetic peptide and nucleotide O3'-P topology independently of geometry.
  const byResidue=new Map();for(const [n,atoms] of special)if(sequence[n])byResidue.set(`${block[n]}:${residue[n]}`,atoms);
  const existing=new Set();if(byResidue.size)for(let i=0;i<used;i++){const a=pairs[i*2],b=pairs[i*2+1];existing.add(Math.min(a,b)*count+Math.max(a,b));}
  for(const [n,atoms] of special){
   if(sequence[n]){const a=atoms.C,b=byResidue.get(`${block[n]}:${residue[n]+1}`)?.N;if(a!==undefined&&b!==undefined){const key=Math.min(a,b)*count+Math.max(a,b);if(!existing.has(key)){append(a,b);existing.add(key);}}}
   if(type[n]===1&&type[n+1]===1&&block[n]===block[n+1]){const a=atoms["O3'"],b=special.get(n+1)?.P;if(a!==undefined&&b!==undefined)append(a,b);}
  }
  return {values:pairs.slice(0,used*2)};
 }
 globalThis.MolecularTopology={buildBonds:buildMolecularBonds};
})();
