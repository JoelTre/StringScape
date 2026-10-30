// Procedural nucleic-acid extensions. Generated geometry stays outside the simulation.
let nucleicExtensionState=null;
function nucleicResidueKind(atom){
    const name=(atom?.resName||'').toUpperCase();
    if(/^D[ACGTIU]$/.test(name)||name==='THY')return 'DNA';
    if((atom?.sourceAtoms||[]).some(a=>/^O2['*]$/.test(a.atomName||''))||['U','URA','URI'].includes(name))return 'RNA';
    return null;
}
function detectNucleicExtensionGroups(nodes,pairs){
    const chains=new Map();
    nodes.forEach((node,i)=>{
        // Reference-only nucleic acids are retained in physicsNodes; atoms2 carries
        // their deposited coordinates even when no AlphaFold counterpart exists.
        if(node.res.entityType!=='nucleotide'||node.idx2==null)return;
        if(!chains.has(node.blockIdx))chains.set(node.blockIdx,[]);chains.get(node.blockIdx).push(i);
    });
    // Isolated nucleotides (including ATP/ADP ligands) are not extendable strands.
    for(const [id,indices] of chains)if(indices.length<2)chains.delete(id);
    const contacts=new Map(),detectedPairs=pairs.slice();
    for(const {i,j} of pairs){
        const a=nodes[i]?.blockIdx,b=nodes[j]?.blockIdx;
        if(a===b||!chains.has(a)||!chains.has(b))continue;
        const key=[a,b].sort((x,y)=>x-y).join(':');contacts.set(key,(contacts.get(key)||0)+1);
    }
    // Coarse phosphate-only inputs lack the base atoms needed by the H-bond
    // detector. Require a run of complementary, antiparallel nearby residues.
    const ids=[...chains.keys()],complementary=new Set(['AT','TA','AU','UA','GC','CG','GU','UG']);
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
        const key=[ids[a],ids[b]].sort((x,y)=>x-y).join(':');if((contacts.get(key)||0)>=2)continue;
        const left=chains.get(ids[a]),right=chains.get(ids[b]);if(Math.min(left.length,right.length)<3)continue;
        const coarse=indices=>indices.some(i=>!nodes[i].res.atoms2[nodes[i].idx2].sourceAtoms?.some(atom=>/^N[1-9]$/.test(atom.atomName||'')));
        if(!coarse(left)&&!coarse(right))continue;
        const used=new Set(),matches=[];
        for(let i=0;i<left.length;i++){
            const p=nodes[left[i]],letter=p.res.atoms2[p.idx2].singleChar;let best=-1,distance=625;
            for(let j=0;j<right.length;j++){
                if(used.has(j))continue;const q=nodes[right[j]];
                if(!complementary.has(letter+q.res.atoms2[q.idx2].singleChar))continue;
                const d=(p.x-q.x)**2+(p.y-q.y)**2+(p.z-q.z)**2;
                if(d>=36&&d<distance){distance=d;best=j;}
            }
            if(best>=0){used.add(best);matches.push({i,j:best});}
        }
        const ordered=matches.slice(1).filter((pair,i)=>pair.j<matches[i].j).length;
        if(matches.length>=Math.max(3,Math.ceil(Math.min(left.length,right.length)*.5))&&ordered>=Math.ceil((matches.length-1)*.7)){contacts.set(key,matches.length);for(const pair of matches)detectedPairs.push({i:left[pair.i],j:right[pair.j]});}
    }
    const matched=new Set(),groups=[];
    const candidates=[...contacts].sort((a,b)=>b[1]-a[1]);
    for(const [key,count] of candidates){
        const ids=key.split(':').map(Number);
        if(count<2||ids.some(id=>matched.has(id)))continue;
        ids.forEach(id=>matched.add(id));groups.push({blocks:ids,paired:true});
    }
    for(const id of chains.keys())if(!matched.has(id))groups.push({blocks:[id],paired:false});
    return groups.map(group=>{
        const indices=group.blocks.flatMap(id=>chains.get(id)),kinds=new Set(indices.map(i=>nucleicResidueKind(nodes[i].res.atoms2[nodes[i].idx2])).filter(Boolean));
        const kind=kinds.size===1?[...kinds][0]:null;
        const letters=group.blocks.map(id=>nodes[chains.get(id)[0]].res.c1||nodes[chains.get(id)[0]].res.c2||String(id));
        return {...group,pairs:detectedPairs.filter(pair=>indices.includes(pair.i)&&indices.includes(pair.j)),chains:group.blocks.map(id=>chains.get(id)),kind,animationKey:`nucleic:${JSON.stringify([...letters].sort())}`,key:group.blocks.join(':'),label:`${group.paired?'Double':'Single'}-stranded ${kind||'DNA/RNA'} (${letters.join(', ')})`,mode:`${kind||'DNA'}:${group.paired?2:1}`,start:0,end:0,wiggle:0.6,guide:false,guideUserSet:false,status:''};
    });
}
// Read current controls for every AI request; generated ends are visual geometry.
function getNucleicAiContext(){
    const state=nucleicExtensionState;
    if(!state||state.nodes!==physicsNodes)return {available:false};
    const strands=state.groups.map(group=>{
        const [chemistry,strandCount]=group.mode.split(':');
        return {
            chains:group.chains.map(indices=>{const node=state.nodes[indices[0]];return node.res.c1||node.res.c2||String(node.blockIdx);}),
            detectedChemistry:group.kind||'unknown DNA/RNA',
            detectedStrandCount:group.chains.length,
            originalResidueCounts:group.chains.map(indices=>indices.length),
            extended:group.start>0||group.end>0,
            extensions:{firstEnd:group.start,lastEnd:group.end,units:Number(strandCount)===2?'base pairs':'nucleotides',generatedChemistry:chemistry,generatedStrandCount:Number(strandCount)}
        };
    });
    return {available:true,containsNucleicAcidStrands:strands.length>0,
        containsDNA:strands.some(s=>s.detectedChemistry==='DNA'),
        containsRNA:strands.some(s=>s.detectedChemistry==='RNA'),
        hasAmbiguousChemistry:strands.some(s=>s.detectedChemistry==='unknown DNA/RNA'),
        anyEndsExtended:strands.some(s=>s.extended),strands,
        interpretation:'Detected strands exclude isolated nucleotide ligands such as ATP/ADP. Unknown chemistry is not evidence of absence. Extension lengths describe current procedural visual additions, not deposited residues or experimentally determined structure.'};
}
function disposeNucleicExtensionGeometry(){
    const state=nucleicExtensionState;if(!state?.object)return;
    state.lifecycle.cancelled=true;physicsScene?.remove(state.object);
    state.object.traverse(item=>{item.geometry?.dispose();if(Array.isArray(item.material))item.material.forEach(m=>m.dispose());else item.material?.dispose();});
    state.object=null;
}
function resetNucleicExtensions(){
    disposeNucleicEndGlow();disposeNucleicExtensionGeometry();nucleicExtensionState?.controlsController?.abort();for(const menu of nucleicExtensionState?.menus||[])menu.remove();nucleicExtensionState=null;
    const host=document.getElementById('nucleicExtensionControls');if(host){host.replaceChildren();host.classList.add('hidden');}
    const toggle=document.getElementById('toggleNucleotideCurves');if(toggle){toggle.classList.add('hidden');toggle.onclick=null;}
}
function initializeNucleicExtensions(){
    resetNucleicExtensions();
    const groups=detectNucleicExtensionGroups(physicsNodes,physicsBasePairs);
    nucleicExtensionState={nodes:physicsNodes,groups,object:null,lifecycle:{cancelled:false},signature:null,lastUpdate:-Infinity,dirty:true,endPositions:new Map(),hoveredEnd:null,focusedEnd:null,curvesVisible:false,curvesUserSet:false,controlsController:new AbortController(),menus:[]};
    const toggle=document.getElementById('toggleNucleotideCurves');
    if(toggle){
        updatePhysicsToggleButton('toggleNucleotideCurves',false);toggle.classList.toggle('hidden',!groups.length);
        toggle.onclick=()=>{const state=nucleicExtensionState;if(!state)return;state.curvesUserSet=true;state.curvesVisible=!state.curvesVisible;if(!state.object)updateNucleicExtensions(true);updatePhysicsToggleButton('toggleNucleotideCurves',state.curvesVisible);
            state.object?.traverse(item=>{if(item.userData.nucleicGuide)item.visible=state.curvesVisible;});
            if(physicsRenderer&&physicsScene&&physicsCamera)physicsRenderer.render(physicsScene,physicsCamera);
        };
    }
    const host=document.getElementById('nucleicExtensionControls');if(!host)return;
    host.classList.toggle('hidden',!groups.length);
    if(groups.length){const heading=document.createElement('span');heading.className='text-slate-400';heading.textContent='Length per end in nucleotides (single strand) or base pairs (double strand)';host.append(heading);}
    for(const group of groups){
        const row=document.createElement('div');row.className='flex flex-wrap items-center gap-2';
        const name=document.createElement('span');name.textContent=group.label;row.append(name);
        const mode=document.createElement('select');mode.className='hidden';mode.dataset.animationKey=`${group.animationKey}:mode`;mode.setAttribute('aria-label',`Generated strand type for ${group.label}`);
        for(const kind of ['DNA','RNA'])for(const strands of [1,2]){const option=document.createElement('option');option.value=`${kind}:${strands}`;option.textContent=`${strands===1?'Single':'Double'}-stranded ${kind}`;mode.append(option);}
        mode.value=group.mode;mode.title=group.kind?'Choose the generated strand type':'DNA/RNA chemistry is ambiguous in this input; choose the generated strand type';
        mode.addEventListener('change',()=>{group.mode=mode.value;changed();});row.append(mode,createNucleicTypeMenu(mode,group.label,nucleicExtensionState));
        function changed(){nucleicExtensionState.dirty=true;updateNucleicExtensions(true);}
        for(const [key,label] of [['start','First end'],['end','Last end']]){
            const wrapper=document.createElement('label');wrapper.className='inline-flex items-center gap-1';wrapper.append(document.createTextNode(label+' '));
            const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.dataset.nucleicExtension=key;input.value='0';input.style.touchAction='none';input.setAttribute('aria-label',`${label} extension length for ${group.label}`);input.title='Type 0-300, or drag up/right to increase';
            const target={group,end:key};
            input.addEventListener('pointerenter',()=>{nucleicExtensionState.hoveredEnd=target;updateNucleicEndGlow();});
            input.addEventListener('pointerleave',()=>{nucleicExtensionState.hoveredEnd=null;updateNucleicEndGlow();});
            input.addEventListener('focus',()=>{nucleicExtensionState.focusedEnd=target;updateNucleicEndGlow();});
            input.addEventListener('blur',()=>{nucleicExtensionState.focusedEnd=null;updateNucleicEndGlow();});
            initializeNucleicLengthInput(input,()=>group[key],value=>{setNucleicExtensionLength(group,key,value,nucleicExtensionState);changed();});wrapper.append(input,document.createTextNode(' nt / bp'));row.append(wrapper);
        }
        const wave=document.createElement('label');wave.className='inline-flex items-center gap-1';wave.textContent='Wiggle ';
        const slider=document.createElement('input');slider.type='range';slider.dataset.animationKey=`${group.animationKey}:wiggle`;slider.min='0';slider.max='1.5';slider.step='.1';slider.value=String(group.wiggle);slider.setAttribute('aria-label',`Guide wiggle for ${group.label}`);slider.style.width='5rem';slider.addEventListener('input',()=>{group.wiggle=Number(slider.value);changed();});wave.append(slider);row.append(wave);
        const guide=document.createElement('label');guide.className='nucleic-guide-switch';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.setAttribute('role','switch');checkbox.setAttribute('aria-label',`Show guide curves for ${group.label}`);checkbox.checked=group.guide;group.guideCheckbox=checkbox;checkbox.addEventListener('change',()=>{group.guideUserSet=true;group.guide=checkbox.checked;changed();});guide.append(document.createTextNode('Show guide curves'),checkbox);row.append(guide);
        const status=document.createElement('span');status.className='text-slate-400';status.setAttribute('role','status');group.statusElement=status;row.append(status);host.append(row);
    }
}
// Spatial hash keeps path searches local even for large homology models.
function nucleicObstacleGrid(points,cell=16){
    const grid=new Map(),key=(x,y,z)=>`${x}:${y}:${z}`;
    for(const point of points){const k=key(Math.floor(point.x/cell),Math.floor(point.y/cell),Math.floor(point.z/cell));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(point);}
    return {clear(point,radius,ignore){
        const cx=Math.floor(point.x/cell),cy=Math.floor(point.y/cell),cz=Math.floor(point.z/cell),range=Math.ceil(radius/cell);
        for(let x=cx-range;x<=cx+range;x++)for(let y=cy-range;y<=cy+range;y++)for(let z=cz-range;z<=cz+range;z++)for(const other of grid.get(key(x,y,z))||[]){
            if(ignore?.has(other.nodeIndex))continue;
            if((point.x-other.x)**2+(point.y-other.y)**2+(point.z-other.z)**2<radius*radius)return false;
        }
        return true;
    }};
}
function nucleicExtensionPath(origin,direction,count,step,radius,wiggle,obstacles,ignore){
    const V=THREE.Vector3,axis=direction.clone().normalize(),points=[origin.clone()];let tangent=axis.clone();
    let side=new V(0,0,1);if(Math.abs(side.dot(axis))>.9)side.set(0,1,0);side.addScaledVector(axis,-side.dot(axis)).normalize();
    const up=new V().crossVectors(axis,side).normalize();
    for(let i=1;i<=count;i++){
        const last=points[points.length-1];let best=null,bestScore=Infinity;
        const preferred=tangent.clone().multiplyScalar(.65).addScaledVector(axis,.35).addScaledVector(side,wiggle*.10*Math.sin(i*.21)).addScaledVector(up,wiggle*.07*Math.cos(i*.17)).normalize();
        // Small turns first; the wider cone is used only when the straight route is blocked.
        for(const bend of [0,.25,.5,.8,1.2])for(let spoke=0;spoke<(bend?16:1);spoke++){
            const angle=spoke*Math.PI/8;
            const normal=side.clone().addScaledVector(tangent,-side.dot(tangent));if(normal.lengthSq()<1e-8)normal.copy(up).addScaledVector(tangent,-up.dot(tangent));normal.normalize();
            const binormal=new V().crossVectors(tangent,normal).normalize();
            const nextDirection=preferred.clone().addScaledVector(normal,bend*Math.cos(angle)).addScaledVector(binormal,bend*Math.sin(angle)).normalize();
            if(nextDirection.dot(tangent)<.45)continue;
            const next=last.clone().addScaledVector(nextDirection,step);
            let clear=true;
            for(let k=1;k<=4;k++)if(!obstacles.clear(last.clone().lerp(next,k/4),radius,ignore)){clear=false;break;}
            if(!clear)continue;
            // Prefer the original heading and smooth turns; look ahead before entering a pocket.
            const look=next.clone().addScaledVector(nextDirection,step*3);
            const score=(1-nextDirection.dot(axis))*2+(1-nextDirection.dot(tangent))*3+(obstacles.clear(look,radius,ignore)?0:2)+bend*.02;
            if(score<bestScore){bestScore=score;best={next,direction:nextDirection};}
        }
        if(!best)break;
        points.push(best.next);tangent=best.direction;
    }
    return points;
}
function nucleicModelGuidePoints(group){
    const primary=group.chains[0],V=THREE.Vector3;
    if(!group.paired)return primary.map(i=>new V(physicsNodes[i].x,physicsNodes[i].y,physicsNodes[i].z));
    const centers=primary.map(i=>{const pair=group.pairs.find(p=>(p.i===i&&group.chains[1].includes(p.j))||(p.j===i&&group.chains[1].includes(p.i)));if(!pair)return null;
        const a=physicsNodes[i],b=physicsNodes[pair.i===i?pair.j:pair.i];return new V(a.x+b.x,a.y+b.y,a.z+b.z).multiplyScalar(.5);});
    const known=centers.flatMap((p,i)=>p?[i]:[]);if(!known.length)return primary.map(i=>new V(physicsNodes[i].x,physicsNodes[i].y,physicsNodes[i].z));
    const first=known[0],last=known[known.length-1];
    for(let i=first+1;i<last;i++)if(!centers[i]){const lo=known.filter(k=>k<i).at(-1),hi=known.find(k=>k>i);centers[i]=centers[lo].clone().lerp(centers[hi],(i-lo)/(hi-lo));}
    const before=known[Math.min(3,known.length-1)],after=known[Math.max(0,known.length-4)];
    const startStep=before===first?new V(0,0,3.4):centers[before].clone().sub(centers[first]).multiplyScalar(1/(before-first));
    const endStep=after===last?startStep.clone():centers[last].clone().sub(centers[after]).multiplyScalar(1/(last-after));
    // Unpaired tails continue the duplex axis rather than switching to a phosphate trace.
    for(let i=0;i<first;i++)centers[i]=centers[first].clone().addScaledVector(startStep,i-first);
    for(let i=last+1;i<centers.length;i++)centers[i]=centers[last].clone().addScaledVector(endStep,i-last);
    return centers;
}
function nucleicEndFrame(group,end,guidePoints=nucleicModelGuidePoints(group)){
    const primary=group.chains[0],first=end==='start',index=first?0:primary.length-1,nodeIndex=primary[index],node=physicsNodes[nodeIndex];
    const point=new THREE.Vector3(node.x,node.y,node.z),origin=guidePoints[index].clone();
    const inside=first?Math.min(3,primary.length-1):Math.max(0,primary.length-4);
    const direction=origin.clone().sub(guidePoints[inside]);if(direction.lengthSq()<1e-8)direction.set(0,0,1);direction.normalize();
    let partner=null,radial;
    if(group.paired){
        const pair=group.pairs.find(p=>(p.i===nodeIndex&&group.chains[1].includes(p.j))||(p.j===nodeIndex&&group.chains[1].includes(p.i)));
        if(pair)partner=pair.i===nodeIndex?pair.j:pair.i;
        radial=point.clone().sub(origin).addScaledVector(direction,-point.clone().sub(origin).dot(direction));
    }else{
        radial=new THREE.Vector3(1,0,0);if(Math.abs(direction.x)>.9)radial.set(0,1,0);radial.addScaledVector(direction,-radial.dot(direction)).normalize().multiplyScalar(6);origin.sub(radial);
    }
    if(radial.lengthSq()<1e-8){radial.set(1,0,0);if(Math.abs(direction.x)>.9)radial.set(0,1,0);radial.addScaledVector(direction,-radial.dot(direction)).normalize().multiplyScalar(9);}
    return {origin,direction,radial,nodeIndex,partner};
}
function nucleicExtensionLetter(letter,kind,complement=false){
    letter=(letter||'A').toUpperCase();if(!'ACGTU'.includes(letter))letter='A';
    if(kind==='RNA'&&letter==='T')letter='U';if(kind==='DNA'&&letter==='U')letter='T';
    return complement?({A:kind==='RNA'?'U':'T',T:'A',U:'A',C:'G',G:'C'})[letter]:letter;
}
// Reuse deposited nucleotide shapes when available. Fallbacks are illustrative
// heavy-atom scaffolds, rendered by exactly the same model representation code.
function nucleicTemplateForLetter(letter,kind,group){
    for(const i of group.chains.flat()){
        const node=physicsNodes[i],atom=node.res.atoms2[node.idx2];
        if(atom.singleChar!==letter||nucleicResidueKind(atom)!==kind||!atom.sourceAtoms?.length)continue;
        const base=nucleotideBaseCenter(atom);if(!base)continue;
        const inward=new THREE.Vector3(base.x-atom.x,base.y-atom.y,base.z-atom.z).normalize();
        let axis=new THREE.Vector3();
        for(let j=1;j<base.atoms.length-1;j++){
            const a=base.atoms[0],b=base.atoms[j],d=base.atoms[j+1];
            const cross=new THREE.Vector3().crossVectors(new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),new THREE.Vector3(d.x-a.x,d.y-a.y,d.z-a.z));if(cross.lengthSq()>axis.lengthSq())axis=cross;
        }
        if(axis.lengthSq()<1e-8){axis.set(0,0,1);if(Math.abs(axis.dot(inward))>.9)axis.set(0,1,0);axis.addScaledVector(inward,-axis.dot(inward));}axis.normalize();
        const radial=inward.clone().addScaledVector(axis,-inward.dot(axis)).normalize(),across=new THREE.Vector3().crossVectors(axis,radial).normalize().multiplyScalar(-1);
        const sourceAtoms=atom.sourceAtoms.map(a=>{const v=new THREE.Vector3(a.x-atom.x,a.y-atom.y,a.z-atom.z);return {...a,x:-v.dot(radial),y:v.dot(across),z:v.dot(axis)};});
        return {...atom,x:0,y:0,z:0,sourceAtoms};
    }
    const sourceAtoms=[],add=(atomName,element,x,y,z)=>sourceAtoms.push({atomName,element,x,y,z});
    add('P','P',0,0,0);add('OP1','O',.3,1.4,0);add('OP2','O',1.2,-.7,0);
    add("O5'",'O',-1.4,-.3,0);add("C5'",'C',-2.3,.5,.8);add("C4'",'C',-3.5,.1,.2);
    add("O4'",'O',-4.1,1.3,.2);add("C1'",'C',-5.4,1,.3);add("C2'",'C',-5.4,-.4,.8);
    add("C3'",'C',-4,-1,.4);add("O3'",'O',-3.7,-2.3,.6);if(kind==='RNA')add("O2'",'O',-6.5,-1,.4);
    const purine=letter==='A'||letter==='G',ring=purine?['N9','C8','N7','C5','C4']:['N1','C2','N3','C4','C5','C6'];
    for(let i=0;i<ring.length;i++){const angle=2*Math.PI*i/ring.length;add(ring[i],ring[i][0],-7.6+1.15*Math.cos(angle),1+1.15*Math.sin(angle),.3);}
    if(purine){for(const [name,x,y] of [['N3',-8.2,-.9],['C2',-9.5,-.7],['N1',-10,0.6],['C6',-9.1,1.6]])add(name,name[0],x,y,.3);add(letter==='A'?'N6':'O6',letter==='A'?'N':'O',-9.2,2.9,.3);if(letter==='G')add('N2','N',-10.3,-1.8,.3);}
    else {add('O2','O',-8.1,3.2,.3);add(letter==='C'?'N4':'O4',letter==='C'?'N':'O',-9.9,1,.3);if(letter==='T')add('C7','C',-9.2,-1.1,.3);}
    return {x:0,y:0,z:0,sourceAtoms,singleChar:letter,resName:kind==='DNA'?'D'+letter:letter};
}
function nucleicDuplexRadius(templates,sourceRadius){
    // Canonical bases face inward (-X). Keep their facing heavy-atom edges apart.
    const reach=templates.map(template=>Math.max(0,...template.sourceAtoms.map(a=>template.x-a.x)));
    return Math.max(sourceRadius,...reach.map(value=>value+1.4));
}
function nucleicGeneratedResidue(point,template,tangent,outward,kind,index){
    const radial=outward.clone().normalize(),across=new THREE.Vector3().crossVectors(tangent,radial).normalize();
    const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(radial,across,tangent));
    const sourceAtoms=(template.sourceAtoms||[]).filter(atom=>kind==='RNA'||!/^O2['*]$/.test(atom.atomName||'')).map(atom=>{
        const p=new THREE.Vector3(atom.x-template.x,atom.y-template.y,atom.z-template.z).applyQuaternion(rotation).add(point);
        return {...atom,x:p.x,y:p.y,z:p.z};
    });
    return {x:point.x,y:point.y,z:point.z,entityType:'nucleotide',secondaryType:'coil',singleChar:template.singleChar||'N',resName:template.resName,resSeq:index,sourceAtoms};
}
function updateNucleicExtensions(force=false){
    const state=nucleicExtensionState;if(!state||state.nodes!==physicsNodes||!physicsScene)return;
    updateNucleicEndGlow();
    if(state.object)state.object.visible=homologyStructureVisible;
    if(!state.groups.some(group=>group.start||group.end||group.guide)){state.endPositions.clear();updateNucleicEndGlow();if(state.object)disposeNucleicExtensionGeometry();for(const group of state.groups)if(group.statusElement)group.statusElement.textContent='';return;}
    const now=performance.now();if(!force&&!state.dirty&&now-state.lastUpdate<600)return;state.lastUpdate=now;
    const signature=JSON.stringify([physicsRepresentation,physicsColorMode,viewerSizes.physics,state.groups.map(g=>[g.mode,g.start,g.end,g.wiggle,g.guide]),physicsNodes.map(n=>[n.x,n.y,n.z,isNodeVisibleInPhysics(n)])]);
    if(!state.dirty&&state.signature===signature)return;state.signature=signature;state.dirty=false;
    state.endPositions.clear();
    disposeNucleicExtensionGeometry();state.lifecycle={cancelled:false};const lifecycle=state.lifecycle;
    const object=new THREE.Group();state.object=object;object.visible=homologyStructureVisible;physicsScene.add(object);
    const entries=simulationAtomEntries(),coordinates=simulationAtomCoordinates(entries,true);
    const obstacles=nucleicObstacleGrid(coordinates.map((p,i)=>({...p,nodeIndex:entries[i].nodeIndex})));
    const render=()=>{if(!lifecycle.cancelled&&physicsRenderer)physicsRenderer.render(physicsScene,physicsCamera);};
    for(const group of state.groups){
        const strands=Number(group.mode.split(':')[1]);
        const chemistry=group.mode.split(':')[0],counts=[];
        const modelGuide=nucleicModelGuidePoints(group),guideEnds={};
        for(const end of ['start','end']){
            const requested=group[end];if(!requested&&!group.guide)continue;
            const endpoint=group.chains[0][end==='start'?0:group.chains[0].length-1];
            if(!isNodeVisibleInPhysics(physicsNodes[endpoint]))continue;
            const frame=nucleicEndFrame(group,end,modelGuide),indices=group.chains.flat();
            const ignore=new Set(indices.filter(i=>frame.origin.distanceToSquared(physicsNodes[i])<35*35));
            const step=chemistry==='RNA'?2.8:3.4,radius=nucleicObstacleClearance(frame.radial.length());
            const path=nucleicExtensionPath(frame.origin,frame.direction,requested||12,step,radius,group.wiggle,obstacles,ignore);
            if(group.guide)guideEnds[end]=path;
            if(!requested)continue;
            counts.push(`${end==='start'?'First':'Last'}: ${path.length-1}/${requested}`);
            if(path.length<2)continue;
            const phaseStep=(chemistry==='RNA'?.57:.60)*(end==='start'?-1:1),backbones=[[],[]],colors=[[],[]];
            let side=frame.radial.clone().addScaledVector(frame.direction,-frame.radial.dot(frame.direction));if(side.lengthSq()<1e-6)side.set(1,0,0).addScaledVector(frame.direction,-frame.direction.x);side.normalize();
            let radialSize=frame.radial.length();const startPoints=[];
            for(let strand=0;strand<strands;strand++){
                const sourceIndex=strand===1?(frame.partner??group.chains[1]?.[0]??frame.nodeIndex):frame.nodeIndex;
                const primary=physicsNodes[frame.nodeIndex],source=primary.res.atoms2[primary.idx2];
                const letter=nucleicExtensionLetter(source.singleChar,chemistry,strand===1);
                const template=nucleicTemplateForLetter(letter,chemistry,group);
                startPoints.push({sourceIndex,template});
            }
            if(strands===2)radialSize=nucleicDuplexRadius(startPoints.map(p=>p.template),radialSize);
            for(let i=0;i<path.length;i++){
                const tangent=path[Math.min(path.length-1,i+1)].clone().sub(path[Math.max(0,i-1)]).normalize();
                side.addScaledVector(tangent,-side.dot(tangent)).normalize();const normal=new THREE.Vector3().crossVectors(tangent,side).normalize();
                for(let strand=0;strand<strands;strand++){
                    const angle=i*phaseStep+strand*Math.PI,point=path[i].clone().addScaledVector(side,Math.cos(angle)*radialSize).addScaledVector(normal,Math.sin(angle)*radialSize);
                    const {sourceIndex,template}=startPoints[strand],color=new THREE.Color('#94a3b8');instancedNodeMesh?.getColorAt(sourceIndex,color);
                    const outward=point.clone().sub(path[i]).normalize();
                    const residue=nucleicGeneratedResidue(point,template,strand===1?tangent.clone().negate():tangent,outward,chemistry,i);
                    if(i===0&&(strand===0||frame.partner!=null)){const anchor=physicsNodes[sourceIndex],dx=anchor.x-residue.x,dy=anchor.y-residue.y,dz=anchor.z-residue.z;for(const a of residue.sourceAtoms){a.x+=dx;a.y+=dy;a.z+=dz;}residue.x=anchor.x;residue.y=anchor.y;residue.z=anchor.z;}
                    backbones[strand].push(residue);colors[strand].push(color);
                }
            }
            for(let strand=0;strand<strands;strand++){
                const source=startPoints[strand].sourceIndex;if(!isNodeVisibleInPhysics(physicsNodes[source]))continue;
                addStagedDraftGeometry(object,strand===1?backbones[strand].slice().reverse():backbones[strand],strand===1?colors[strand].slice().reverse():colors[strand],lifecycle,render);
            }
            state.endPositions.set(group.key+':'+end,backbones.slice(0,strands).map(points=>points.at(-1)));
            if(strands===2&&startPoints.every(({sourceIndex})=>isNodeVisibleInPhysics(physicsNodes[sourceIndex]))){
                const positions=[];for(let i=1;i<path.length;i++){const a=backbones[0][i],b=backbones[1][i];positions.push(a.x,a.y,a.z,b.x,b.y,b.z);}
                const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));object.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x8de8f4,transparent:true,opacity:.82,depthWrite:false})));
            }

        }
        if(group.guide){
            const before=(guideEnds.start||[]).slice(1).reverse(),after=(guideEnds.end||[]).slice(1);
            const points=before.concat(modelGuide,after);
            if(group.chains[0].some(i=>isNodeVisibleInPhysics(physicsNodes[i])))addNucleicGuideCurve(object,points,state.curvesVisible);
        }
        updateNucleicEndGlow();
        group.statusElement.textContent=counts.join(' Â· ')+(counts.some(text=>{const [a,b]=text.split(': ')[1].split('/').map(Number);return a<b;})?' (stopped at obstacle)':'');
    }
}
// Mesh tubes have consistent visible thickness; native WebGL lines are often
// only one pixel wide. Draw guides over the model so embedded axes stay visible.
function addNucleicGuideCurve(object,points,visible){
    if(points.length<2)return;
    const distinct=points.filter((p,i)=>!i||p.distanceToSquared(points[i-1])>1e-8);if(distinct.length<2)return;
    const path=new THREE.CatmullRomCurve3(distinct,false,'centripetal');
    const curve=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(8,(distinct.length-1)*6),.24,6,false),new THREE.MeshBasicMaterial({color:0x67e8f9,transparent:true,opacity:.65,depthTest:false,depthWrite:false}));
    curve.userData.nucleicGuide=true;curve.visible=visible;curve.renderOrder=10000;object.add(curve);
}
function createNucleicTypeMenu(select,label,state){
    const trigger=document.createElement('button');trigger.type='button';trigger.className='nucleic-type-trigger';trigger.title=select.title;trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',`Generated strand type for ${label}`);
    const caption=document.createElement('span'),chevron=document.createElement('i');chevron.className='fa-solid fa-chevron-down';chevron.setAttribute('aria-hidden','true');trigger.append(caption,chevron);
    const menu=document.createElement('div');menu.id=`nucleicTypeMenu-${label.replace(/[^a-zA-Z0-9]/g,'')}`;menu.className='nucleic-type-menu hidden';menu.setAttribute('role','group');menu.setAttribute('aria-label',`Strand options for ${label}`);trigger.setAttribute('aria-controls',menu.id);
    const close=()=>{menu.classList.add('hidden');trigger.setAttribute('aria-expanded','false');};
    const sync=()=>{caption.textContent=select.selectedOptions[0]?.textContent||'';for(const button of menu.children)button.setAttribute('aria-pressed',String(button.dataset.value===select.value));};
    for(const option of select.options){const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.textContent=option.textContent;
        button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change'));sync();close();trigger.focus();});menu.append(button);}
    document.body.append(menu);state.menus.push(menu);sync();select.addEventListener('change',sync);
    const place=()=>{const rect=trigger.getBoundingClientRect();menu.style.minWidth=rect.width+'px';menu.style.maxHeight=Math.max(120,window.innerHeight-16)+'px';
        menu.style.left=`${window.scrollX+Math.max(8,Math.min(rect.left,window.innerWidth-menu.offsetWidth-8))}px`;
        menu.style.top=`${window.scrollY+Math.max(8,Math.min(rect.bottom+6,window.innerHeight-menu.offsetHeight-8))}px`;};
    trigger.addEventListener('click',()=>{const opening=menu.classList.contains('hidden');for(const other of state.menus)if(other!==menu)other.classList.add('hidden');for(const button of document.querySelectorAll('.nucleic-type-trigger'))button.setAttribute('aria-expanded','false');menu.classList.toggle('hidden',!opening);trigger.setAttribute('aria-expanded',String(opening));if(opening)place();});
    trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();menu.classList.remove('hidden');trigger.setAttribute('aria-expanded','true');place();(event.key==='ArrowDown'?menu.firstElementChild:menu.lastElementChild)?.focus();}});
    menu.addEventListener('keydown',event=>{const buttons=[...menu.children],index=buttons.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();}else if(event.key==='Tab')close();});
    const options={signal:state.controlsController.signal};
    document.addEventListener('pointerdown',event=>{if(!trigger.contains(event.target)&&!menu.contains(event.target))close();},options);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();},options);
    window.addEventListener('resize',close,options);document.addEventListener('scroll',event=>{if(!menu.contains(event.target))close();},{...options,capture:true});
    return trigger;
}
function setNucleicExtensionLength(group,key,value,state){
    group[key]=value;

}
function initializeNucleicLengthInput(input,getValue,setValue){
    const apply=value=>{if(!Number.isFinite(value))return;const units=Math.max(0,Math.min(300,Math.round(value)));if(units!==getValue())setValue(units);};
    input.addEventListener('input',()=>{if(input.value.trim())apply(Number(input.value));});
    input.addEventListener('change',()=>{if(input.value.trim())apply(Number(input.value));input.value=String(getValue());});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.dispatchEvent(new Event('change'));input.blur();}});
    let drag=null;
    input.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,start:getValue(),moved:false};input.setPointerCapture(event.pointerId);});
    input.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;drag.moved=true;
        const value=Math.max(0,Math.min(300,Math.round(drag.start+(dx-dy)*.5)));input.value=String(value);apply(value);event.preventDefault();});
    const finish=event=>{if(!drag)return;if(drag.moved)input.value=String(getValue());drag=null;if(input.hasPointerCapture?.(event.pointerId))input.releasePointerCapture(event.pointerId);};
    input.addEventListener('pointerup',finish);input.addEventListener('pointercancel',finish);input.addEventListener('lostpointercapture',()=>{drag=null;});
}
// A narrower central corridor permits small peripheral contacts near bound DNA/RNA.
function nucleicObstacleClearance(radialSize){return Math.max(2.5,radialSize*.45);}

function disposeNucleicEndGlow(){
    const state=nucleicExtensionState;if(!state?.endGlow)return;
    physicsScene?.remove(state.endGlow);
    state.endGlow.traverse(item=>{item.material?.dispose();});state.endGlowTexture?.dispose();state.endGlow=null;state.endGlowTexture=null;
}
function updateNucleicEndGlow(){
    const state=nucleicExtensionState;if(!state||!physicsScene)return;
    const target=state.hoveredEnd||state.focusedEnd;
    if(!target||!homologyStructureVisible||state.nodes!==physicsNodes){if(state.endGlow)state.endGlow.visible=false;return;}
    const {group,end}=target,frame=nucleicEndFrame(group,end);
    if(!isNodeVisibleInPhysics(physicsNodes[frame.nodeIndex])){if(state.endGlow)state.endGlow.visible=false;return;}
    const terminal=state.endPositions.get(group.key+':'+end),molecular=['ball-stick','surface'].includes(physicsRepresentation);
    let points;
    if(terminal?.length){
        points=molecular?terminal.flatMap(residue=>residue.sourceAtoms?.length?residue.sourceAtoms:[residue]):terminal;
    }else{
        const indices=[frame.nodeIndex,frame.partner].filter(i=>i!=null&&isNodeVisibleInPhysics(physicsNodes[i]));
        if(molecular){
            const entries=indices.flatMap(nodeIndex=>{const node=physicsNodes[nodeIndex],residue=node.res.atoms2[node.idx2];return (residue.sourceAtoms?.length?residue.sourceAtoms:[residue]).map(source=>({nodeIndex,source}));});
            points=simulationAtomCoordinates(entries,true);
        }else points=indices.map(i=>physicsNodes[i]);
    }
    // One compact halo per displayed atom makes the nucleotide itself glow.
    const size=molecular?Math.max(3.5,Math.min(7,viewerSizes.physics.atom*2.5)):Math.max(3.5,viewerSizes.physics.residue*3.5);
    if(!state.endGlow){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d');
        const gradient=context.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,35,35,0.9)');gradient.addColorStop(.3,'rgba(255,35,35,0.55)');gradient.addColorStop(1,'rgba(255,35,35,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
        state.endGlowTexture=new THREE.CanvasTexture(canvas);state.endGlow=new THREE.Group();physicsScene.add(state.endGlow);
    }
    while(state.endGlow.children.length<points.length){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:state.endGlowTexture,transparent:true,depthTest:false,depthWrite:false}));sprite.scale.set(size,size,1);sprite.renderOrder=10001;state.endGlow.add(sprite);}
    state.endGlow.visible=true;state.endGlow.children.forEach((sprite,i)=>{sprite.visible=i<points.length;if(sprite.visible){sprite.position.set(points[i].x,points[i].y,points[i].z);sprite.scale.set(size,size,1);}});
}
