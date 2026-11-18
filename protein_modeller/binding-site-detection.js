// Detect protein–protein residue patches and atom-based patches involving nucleic acids or ligands.
function detectBindingPatches(nodes,atoms){
    const pairs=new Map();
    const pairFor=(i,j,distance,method)=>{
        const a=nodes[i],b=nodes[j];if(a.block===b.block||a.water||b.water)return;
        const blocks=[a.block,b.block].sort((x,y)=>x-y),key=blocks.join(':');
        if(!pairs.has(key))pairs.set(key,{blocks,method,edges:new Map()});
        const pair=pairs.get(key),edgeKey=i<j?`${i}:${j}`:`${j}:${i}`,previous=pair.edges.get(edgeKey);
        if(!previous||distance<previous[2])pair.edges.set(edgeKey,[i,j,distance]);
    };
    const key=(x,y,z)=>`${x},${y},${z}`,representatives=new Map(),repCell=8;
    for(let i=0;i<nodes.length;i++){
        const a=nodes[i];if(a.type!=='protein'||a.water)continue;
        const x=Math.floor(a.x/repCell),y=Math.floor(a.y/repCell),z=Math.floor(a.z/repCell);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of representatives.get(key(x+dx,y+dy,z+dz))||[]){const b=nodes[j],d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(d<=8)pairFor(i,j,d,'representative');}
        const k=key(x,y,z);if(!representatives.has(k))representatives.set(k,[]);representatives.get(k).push(i);
    }
    const grid=new Map(),cell=4.5;
    for(const a of atoms){
        const node=nodes[a.node];if(!node||node.water)continue;
        const x=Math.floor(a.x/cell),y=Math.floor(a.y/cell),z=Math.floor(a.z/cell);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const b of grid.get(key(x+dx,y+dy,z+dz))||[]){
            const other=nodes[b.node];if(node.block===other.block||(node.type==='protein'&&other.type==='protein'))continue;
            const d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(d<=cell)pairFor(a.node,b.node,d,'heavy-atom');
        }
        const k=key(x,y,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(a);
    }
    const result=[];
    for(const pair of pairs.values()){
        const edges=[...pair.edges.values()],members=[...new Set(edges.flatMap(([i,j])=>[i,j]))];
        const parents=new Map(members.map(i=>[i,i]));
        const root=i=>{while(parents.get(i)!==i){parents.set(i,parents.get(parents.get(i)));i=parents.get(i);}return i;};
        const join=(i,j)=>{i=root(i);j=root(j);if(i!==j)parents.set(j,i);};
        for(const [i,j] of edges)join(i,j);
        // Neighbouring polymer residues connect a patch; all contacted atoms of one ligand belong to the same molecule.
        const byBlock=new Map();for(const i of members){const node=nodes[i];if(!byBlock.has(node.block))byBlock.set(node.block,[]);byBlock.get(node.block).push(i);}
        for(const indices of byBlock.values()){
            indices.sort((i,j)=>nodes[i].position-nodes[j].position);
            for(let k=1;k<indices.length;k++)if(nodes[indices[k]].type==='other'||nodes[indices[k]].position-nodes[indices[k-1]].position<=2)join(indices[k-1],indices[k]);
        }
        const components=new Map();for(const i of members){const id=root(i);if(!components.has(id))components.set(id,[]);components.get(id).push(i);}
        for(const part of components.values()){
            if(pair.method==='representative'&&part.length<3)continue;
            const set=new Set(part),patchEdges=edges.filter(([i,j])=>set.has(i)&&set.has(j));
            result.push({blocks:pair.blocks,method:pair.method,cutoff:pair.method==='representative'?8:4.5,edges:patchEdges});
        }
    }
    return result;
}
if(typeof window!=='undefined')window.detectBindingPatches=detectBindingPatches;
if(typeof module!=='undefined')module.exports=detectBindingPatches;
