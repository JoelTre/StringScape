// Independent single-reference drafts, followed by a weighted consensus build.
let multiReferenceBuild=null;
let stagedPreview=null;
const stagedReferenceWeights=new Map();

function alignDraftAssembly(assembly){
    const identity={R:[[1,0,0],[0,1,0],[0,0,1]],t:[0,0,0],tmScore:1,rmsd:0,numEquiv:0};
    const fits=assembly.structures.map(()=>null);fits[0]=identity;
    const pending=new Set(assembly.structures.map((_,i)=>i).slice(1));
    while(pending.size){
        let best=null,maxPairs=0,maxTM=0;
        for(const moving of pending)for(let anchor=0;anchor<fits.length;anchor++){
            if(!fits[anchor])continue;
            const targetGroups=assembly.groups.filter(group=>group.entries.get(anchor)?.entityType!=='other'&&group.entries.has(anchor));
            const alignmentCache=new Map();
            const pairsFor=(group,entry)=>{
                const a=group.entries.get(anchor),key=`${group.key}\u0000${entry.chain}`;
                if(!alignmentCache.has(key))alignmentCache.set(key,(referenceAlignment(a.atoms,entry.atoms)?.alignedPairs||[]).filter(pair=>pair.idx1!==null&&pair.idx2!==null));
                return alignmentCache.get(key);
            };
            const pointsFor=matches=>{
                const P=[],Q=[];
                for(const [group,entry] of matches){const a=group.entries.get(anchor);for(const pair of pairsFor(group,entry)){P.push(referenceTransformPoint(a.atoms[pair.idx1],fits[anchor]));Q.push(entry.atoms[pair.idx2]);}}
                return {P,Q};
            };
            const initial=targetGroups.filter(group=>group.entries.has(moving)).map(group=>[group,group.entries.get(moving)]);
            const initialPoints=pointsFor(initial);maxPairs=Math.max(maxPairs,initialPoints.P.length);
            if(initialPoints.P.length<3)continue;
            const origin=initialPoints.P[0],u=initialPoints.P.find(p=>dist3d(p,origin)>1);
            if(!u||!initialPoints.P.some(p=>Math.hypot((u.y-origin.y)*(p.z-origin.z)-(u.z-origin.z)*(p.y-origin.y),(u.z-origin.z)*(p.x-origin.x)-(u.x-origin.x)*(p.z-origin.z),(u.x-origin.x)*(p.y-origin.y)-(u.y-origin.y)*(p.x-origin.x))>.01))continue;
            const seeds=[superposeWeightedIterative(initialPoints.P,initialPoints.Q)],stride=Math.max(1,Math.ceil(initial.length/(initial.length>100?4:16)));
            for(let i=0;i<initial.length;i+=stride){const {P,Q}=pointsFor([initial[i]]);if(P.length>=3)seeds.push(superposeWeightedIterative(P,Q));}
            for(const type of new Set(targetGroups.map(group=>group.type))){
                const target=targetGroups.find(group=>group.type===type),incoming=assembly.structures[moving].entries.filter(entry=>entry.type===type&&entry.entityType!=='other');
                const step=Math.max(1,Math.ceil(incoming.length/(targetGroups.length>100?2:16)));
                for(let i=0;i<incoming.length;i+=step){const {P,Q}=pointsFor([[target,incoming[i]]]);if(P.length>=3)seeds.push(superposeWeightedIterative(P,Q));}
            }
            for(const seed of seeds){
                let fit=seed,matches=initial;
                for(let round=0;round<3;round++){
                    matches=[];
                    for(const type of new Set(targetGroups.map(group=>group.type))){
                        const targets=targetGroups.filter(group=>group.type===type),incoming=assembly.structures[moving].entries.filter(entry=>entry.type===type&&entry.entityType!=='other');
                        if(!targets.length||!incoming.length)continue;
                        const costs=incoming.map(entry=>targets.map(group=>{
                            const a=referenceTransformPoint(group.entries.get(anchor).center,fits[anchor]),b=referenceTransformPoint(entry.center,fit);
                            return (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
                        }));
                        for(const [i,j] of referenceAssign(costs))matches.push([targets[j],incoming[i]]);
                    }
                    const {P,Q}=pointsFor(matches);maxPairs=Math.max(maxPairs,P.length);if(P.length<3)break;
                    const d0=Math.max(.5,1.24*Math.cbrt(Math.max(16,P.length)-15)-1.8),d0Sq=d0*d0;
                    let candidate={...fit,...scoreFitUnderTransform(P,Q,fit.R,fit.t,d0Sq),numEquiv:P.length};
                    for(let iteration=0;iteration<12;iteration++){
                        const weights=P.map((point,i)=>{const q=referenceTransformPoint(Q[i],candidate),sq=(point.x-q.x)**2+(point.y-q.y)**2+(point.z-q.z)**2;return 1/(1+sq/d0Sq)**2;});
                        const next=hornQuaternionSuperposition(P,Q,weights),metrics=scoreFitUnderTransform(P,Q,next.R,next.t,d0Sq);
                        if(metrics.tmScore<=candidate.tmScore+1e-8)break;
                        candidate={...next,...metrics,numEquiv:P.length};
                    }
                    fit=candidate;maxTM=Math.max(maxTM,fit.tmScore);
                    if(fit.tmScore>=.35&&(!best||fit.tmScore*P.length>best.score))best={moving,fit,score:fit.tmScore*P.length,matches:matches.slice()};
                }
            }
        }
        if(!best)throw new Error(`The draft homology models have no reliable structural overlap connecting them. They cannot be merged safely. Inspect the completed drafts or choose overlapping references. (Largest overlap: ${maxPairs} residues; best TM-score: ${maxTM.toFixed(3)}.)`);
        const types=new Set(best.matches.map(([group])=>group.type)),oldGroups=new Map();
        for(const group of assembly.groups){const entry=group.entries.get(best.moving);if(entry&&types.has(group.type)){oldGroups.set(entry,group);group.entries.delete(best.moving);}}
        const assigned=new Set();for(const [group,entry] of best.matches){group.entries.set(best.moving,entry);assigned.add(entry);}
        for(const [entry,oldGroup] of oldGroups){
            if(assigned.has(entry))continue;
            if(!oldGroup.entries.has(best.moving)){oldGroup.entries.set(best.moving,entry);continue;}
            let key=`${entry.chain}@draft${best.moving+1}`;while(assembly.groups.some(group=>group.key===key))key+='+';
            assembly.groups.push({key,type:entry.type,index:assembly.groups.length,entries:new Map([[best.moving,entry]])});
        }
        fits[best.moving]=best.fit;pending.delete(best.moving);
    }
    assembly.groups=assembly.groups.filter(group=>group.entries.size);assembly.fits=fits;
    assembly.structures.forEach((structure,index)=>{
        for(const entry of structure.entries){
            entry.alignedAtoms=entry.atoms.map(atom=>({...atom,...referenceTransformPoint(atom,fits[index]),sourceAtoms:(atom.sourceAtoms||[]).map(source=>({...source,...referenceTransformPoint(source,fits[index])}))}));
            entry.alignedCenter=referenceTransformPoint(entry.center,fits[index]);
        }
    });
    // Ligands, ions and waters must also coincide after the final draft-derived fit.
    for(const group of [...assembly.groups]){
        if(group.entries.values().next().value.entityType!=='other')continue;
        for(const [index,entry] of [...group.entries]){
            if(index===Math.min(...group.entries.keys()))continue;
            const others=[...group.entries].filter(([i])=>i!==index).map(([,e])=>e);
            if(others.some(other=>dist3d(entry.alignedCenter,other.alignedCenter)<=4))continue;
            group.entries.delete(index);let key=`${entry.chain}@draft${index+1}`;while(assembly.groups.some(g=>g.key===key))key+='+';
            assembly.groups.push({key,type:entry.type,index:assembly.groups.length,entries:new Map([[index,entry]])});
        }
    }
    assembly.chains={};assembly.residueMaps=new Map();
    for(const group of assembly.groups){
        const representative=group.entries.get(0)||group.entries.values().next().value;assembly.chains[group.key]=representative.alignedAtoms;
        for(const [index,entry] of group.entries){
            const pairs=entry.entityType==='other'?nonPolymerPairs(representative.atoms,entry.atoms):referenceAlignment(representative.atoms,entry.atoms)?.alignedPairs||[];
            assembly.residueMaps.set(`${group.key}\u0000${index}`,{entry,map:new Map(pairs.filter(pair=>pair.idx1!==null&&pair.idx2!==null).map(pair=>[pair.idx1,pair.idx2]))});
        }
    }
    return assembly;
}

function mergeDraftModels(assembly,drafts,weights){
    const chains={},nodeMaps=drafts.map(()=>new Map()),nodeInfo=[],springs=new Map();
    const weighted=(items,value)=>{const total=items.reduce((sum,item)=>sum+Math.max(0,weights[item.draft]??1),0);return items.reduce((sum,item)=>sum+(total?Math.max(0,weights[item.draft]??1):1)*value(item),0)/(total||items.length);};
    for(const group of assembly.groups){
        let columns=[];
        for(const [draft,entry] of group.entries){
            const incoming=entry.alignedAtoms;
            if(!columns.length){columns=incoming.map(atom=>[{draft,atom}]);continue;}
            const representative=columns.map(column=>column[0].atom);
            let pairs;
            if(entry.entityType==='other'){
                pairs=nonPolymerPairs(representative,incoming);const used=new Set(pairs.map(pair=>pair.idx2));
                incoming.forEach((_,idx2)=>{if(!used.has(idx2))pairs.push({idx1:null,idx2});});
            }else pairs=referenceAlignment(representative,incoming)?.alignedPairs;
            if(!pairs)throw new Error(`Unable to merge the sequence of draft chain ${entry.chain}.`);
            columns=pairs.map(pair=>[...(pair.idx1===null?[]:columns[pair.idx1]),...(pair.idx2===null?[]:[{draft,atom:incoming[pair.idx2]}])]);
        }
        const atoms=columns.map((items,index)=>{
            const exemplar=items.reduce((a,b)=>(weights[b.draft]??1)>(weights[a.draft]??1)?b:a).atom;
            const point={x:weighted(items,item=>item.atom.x),y:weighted(items,item=>item.atom.y),z:weighted(items,item=>item.atom.z)};
            const atom={...exemplar,...point,chainId:group.key,groupKey:group.key,resSeq:index+1,
                afResSeq:exemplar.afResSeq??exemplar.resSeq,fileIndex:exemplar.afFileIndex??exemplar.fileIndex,
                sourcePdbId:exemplar.afSourcePdbId??exemplar.sourcePdbId,sourceAtoms:(exemplar.sourceAtoms||[]).map(source=>({...source,x:source.x+point.x-exemplar.x,y:source.y+point.y-exemplar.y,z:source.z+point.z-exemplar.z})),
                draftOrigins:items.map(item=>({draft:item.draft,resSeq:item.atom.resSeq,node:item.atom.draftNodeIndex})),mergedNodeIndex:nodeInfo.length};
            items.forEach(item=>nodeMaps[item.draft].set(item.atom.draftNodeIndex,atom.mergedNodeIndex));
            nodeInfo.push({chain:group.key,atom});return atom;
        });
        chains[group.key]=atoms;
    }
    drafts.forEach((draft,index)=>{
        for(const spring of draft.springTargets){
            const a=nodeMaps[index].get(spring.i),b=nodeMaps[index].get(spring.j);
            if(a===undefined||b===undefined||a===b)continue;
            const i=Math.min(a,b),j=Math.max(a,b),key=`${i}:${j}`;
            if(!springs.has(key))springs.set(key,{i,j,items:[],isBasePair:false});
            const pair=springs.get(key);pair.items.push({draft:index,spring});pair.isBasePair||=spring.isBasePair;
        }
    });
    // A sequence union can introduce adjacent pairs absent from every source.
    for(const atoms of Object.values(chains))for(let k=0;k<atoms.length-1;k++){
        if(atoms[k].entityType==='other')continue;
        const i=atoms[k].mergedNodeIndex,j=atoms[k+1].mergedNodeIndex,key=`${i}:${j}`;
        if(!springs.has(key))springs.set(key,{i,j,items:[],isBasePair:false});
    }
    const mergedSprings=[...springs.values()].sort((a,b)=>a.i-b.i||a.j-b.j).map(pair=>{
        const a=nodeInfo[pair.i],b=nodeInfo[pair.j],sameChain=a.chain===b.chain;
        const backbone=sameChain&&pair.j===pair.i+1&&a.atom.entityType!=='other';
        const target=pair.items.length?weighted(pair.items,item=>item.spring.target):a.atom.entityType==='nucleotide'?7:3.8;
        const weight=pair.items.length?weighted(pair.items,item=>item.spring.weight):1;
        return {i:pair.i,j:pair.j,d1:target,d2:null,sameChain,isBackbone:backbone,isBasePair:pair.isBasePair,
            springType:'PDB_only',mergedTarget:target,mergedWeight:weight};
    });
    return {chains,springs:mergedSprings,nodeMaps};
}

function beginStagedBuild(files,alphaFiles,generation){
    const oldWeights=new Map(referenceFiles.map((file,i)=>[file.pdbId,referenceInfluences[i]??1]));
    multiReferenceBuild={files,alphaFiles,generation,weights:files.map(file=>stagedReferenceWeights.get(file.pdbId)??oldWeights.get(file.pdbId)??1),
        drafts:[],kind:'draft',index:0,current:'draft:0',view:'draft:0',follow:true,busy:false,done:false,
        assembly:null,merged:null,alignedMode:'reference',visible:new Map(),links:true};
    renderStagedBuildControls();
}
function clearStagedBuild(){
    if(multiReferenceBuild){multiReferenceBuild.cancelled=true;multiReferenceBuild.cancelNetwork?.();if(multiReferenceBuild.normalColorMenuNodes)document.getElementById('physicsColorMenu')?.replaceChildren(...multiReferenceBuild.normalColorMenuNodes);if(multiReferenceBuild.normalColorOptions){const select=document.getElementById('physicsColorSelect');select.replaceChildren();for(const option of multiReferenceBuild.normalColorOptions)select.add(new Option(option.label,option.value));}}
    multiReferenceBuild=null;disposeStagedPreview();
    document.getElementById('stagedModelButtons')?.classList.add('hidden');
    document.getElementById('stagedModelComparisons')?.classList.add('hidden');
    document.getElementById('stagedStructureToggles')?.classList.add('hidden');
    const original=document.getElementById('referenceComparison');
    for(const [id,title] of [['draftCentreDistanceCard','Reference chain-centre distances'],['draftEquivalentChainsCard','Equivalent reference chains']]){
        const card=document.getElementById(id);if(card){card.querySelector('h2').textContent=title;original?.prepend(card);}
    }
    document.getElementById('physics3dCanvas')?.classList.remove('hidden');
    document.getElementById('stagedPreviewHost')?.classList.add('hidden');
}
function renderStagedReferenceControls(){
    const state=multiReferenceBuild,host=document.getElementById('referenceInfluenceControls');if(!state||!host)return;
    host.querySelector('label')?.classList.add('hidden');host.querySelectorAll('.extra-reference-slider').forEach(el=>el.remove());
    state.files.forEach((file,index)=>{
        const label=document.createElement('label');label.className='extra-reference-slider block text-xs mt-2 text-violet-300';
        const span=document.createElement('span');span.textContent=`${file.pdbId} influence on its draft and the weighted merge: ${Math.round(state.weights[index]*100)}%`;
        const input=document.createElement('input');input.type='range';input.min=0;input.max=1;input.step=.01;input.value=state.weights[index];input.className='w-full';
        input.addEventListener('input',()=>{state.weights[index]=Number(input.value);stagedReferenceWeights.set(file.pdbId,state.weights[index]);span.textContent=`${file.pdbId} influence on its draft and the weighted merge: ${Math.round(state.weights[index]*100)}%`;
            if(state.kind==='draft'&&state.index===index&&!state.busy){model1Influence=state.weights[index];referenceInfluences=[model1Influence];updateReferenceCoordinateLockTargets();applyReferenceCoordinateLocks();}
        });label.append(span,input);host.append(label);
    });
}
function renderStagedBuildControls(){
    const state=multiReferenceBuild,host=document.getElementById('stagedModelButtons');if(!host)return;
    host.classList.toggle('hidden',!state);if(!state)return;host.replaceChildren();
    const choices=state.files.map((file,index)=>({id:`draft:${index}`,label:`Draft ${index+1} · ${file.pdbId}`,built:Boolean(state.drafts[index])}));
    choices.push({id:'aligned',label:'Aligned draft models',built:Boolean(state.assembly)},{id:'combined',label:'Combined model',built:state.done});
    for(const choice of choices){
        const building=choice.id===state.current&&!state.done&&!state.failed,enabled=choice.built||building;
        const button=document.createElement('button');button.type='button';button.disabled=!enabled;
        button.className=enabled?'px-3 py-2 rounded-lg text-xs text-white bg-violet-700 border border-violet-400':'px-3 py-2 rounded-lg text-xs text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed';
        button.setAttribute('aria-pressed',String(state.view===choice.id));
        if(building){const icon=document.createElement('i');icon.className='fa-solid fa-circle-notch fa-spin mr-2';icon.setAttribute('aria-hidden','true');button.append(icon);}
        button.append(document.createTextNode(choice.label));button.addEventListener('click',()=>{state.follow=choice.id===state.current;selectStagedModel(choice.id);});host.append(button);
    }
}
function stagedLiveView(){return !multiReferenceBuild||multiReferenceBuild.view===multiReferenceBuild.current&&multiReferenceBuild.current!=='aligned'&&!multiReferenceBuild.busy;}
function selectStagedModel(id){
    const state=multiReferenceBuild;if(!state)return;
    state.view=id;renderStagedBuildControls();
    const select=document.getElementById('physicsColorSelect');
    if(!state.normalColorOptions)state.normalColorOptions=[...select.options].map(option=>({value:option.value,label:option.textContent}));
    if(id==='aligned'){
        if(!state.normalColorMenuNodes)state.normalColorMenuNodes=[...document.getElementById('physicsColorMenu').childNodes];
        select.replaceChildren();
        for(const [value,label] of [['reference','Draft model ID'],['chain','Chains'],['protein','Protein ID'],['equivalent','Equivalent chains'],['aligned','Aligned residues'],['distance','Distance difference']])select.add(new Option(label,value));
        select.value=state.alignedMode;physicsColorMode=state.alignedMode;syncPhysicsColorMenu();
    }else{
        if(state.normalColorMenuNodes){document.getElementById('physicsColorMenu').replaceChildren(...state.normalColorMenuNodes);state.normalColorMenuNodes=null;}
        const oldValue=select.value;select.replaceChildren();for(const option of state.normalColorOptions)select.add(new Option(option.label,option.value));
        physicsColorMode=state.normalColorOptions.some(option=>option.value===oldValue)?oldValue:'chain';select.value=physicsColorMode;syncPhysicsColorMenu();
    }
    document.getElementById('physics3dCanvas').classList.toggle('hidden',!stagedLiveView());
    document.getElementById('stagedPreviewHost').classList.toggle('hidden',stagedLiveView());
    document.getElementById('stagedStructureToggles').classList.toggle('hidden',id!=='aligned');
    if(stagedLiveView()){disposeStagedPreview();setPhysicsColorMode(state.done?'chain':'residue-speed');}
    else renderStagedPreview();
}
function failStagedBuild(error,state=multiReferenceBuild){
    if(!state||state.cancelled||error.name==='AbortError'||state!==multiReferenceBuild||state.generation!==modelBuildGeneration)return;
    state.failed=true;state.busy=false;physicsRunning=false;modelLoading=false;
    document.getElementById('groupSimulationStatus').textContent=error.message;
    document.getElementById('modelBuildTime').textContent='Combined model build stopped';renderStagedBuildControls();showError(error.message);
}
function buildStagedFullNetwork(input,state){
    return new Promise((resolve,reject)=>{
        const url=URL.createObjectURL(new Blob([physicsSimulationWorkerSource()],{type:'application/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
        const finish=(error,packed)=>{worker.terminate();state.cancelNetwork=null;error?reject(error):resolve(packed);};
        state.cancelNetwork=()=>finish(new DOMException('Build cancelled','AbortError'));
        worker.onerror=event=>finish(new Error(event.message));worker.onmessage=({data})=>{if(data.error)finish(new Error(data.error));else if(data.command==='springsBuilt')finish(null,data.packed);};
        worker.postMessage({command:'buildSprings',input,revision:1,cutoff:springCutoffVal,influences:referenceInfluences.slice()});
    });
}
async function captureStagedDraft(state){
    const entries=simulationAtomEntries(),coordinates=simulationAtomCoordinates(entries,false),fullAtoms=physicsNodes.map(()=>[]);
    entries.forEach((entry,index)=>fullAtoms[entry.nodeIndex].push({...entry.source,...coordinates[index]}));
    const chains={};
    physicsNodes.forEach((node,index)=>{
        const original=node.res.atoms2[node.idx2]||node.res.atoms1[node.idx1],chain=node.res.c1;
        if(!chains[chain])chains[chain]=[];
        chains[chain].push({...original,x:node.x,y:node.y,z:node.z,sourceAtoms:fullAtoms[index],draftNodeIndex:index,
            afResSeq:original.resSeq,afFileIndex:original.fileIndex,afSourcePdbId:original.sourcePdbId});
    });
    const viewState={nodes:physicsNodes,blocks:morphMatrixBlocks,springs:physicsSprings,positions:physicsPositions,offset:{...physicsCenterOffset},
        referenceFiles:referenceFiles.slice(),referenceInfluences:referenceInfluences.slice(),model1Influence,model2Influence,referenceAssembly,modelData1:{...modelData1,matrixCache:new Map()},modelData2:{...modelData2,matrixCache:new Map()}};
    const input=physicsSpringInputSnapshot();input.nodes.forEach(node=>{node.locked=false;});
    const packed=await buildStagedFullNetwork(input,state);
    if(state!==multiReferenceBuild||state.generation!==modelBuildGeneration)throw new DOMException('Build cancelled','AbortError');
    updatePhysicsSpringConfidence(packed,input,validationState.pae);
    const scratch={referenceValues:new Array(packed.referenceCount||0)},springTargets=[];
    for(let index=0;index<packed.length;index++){
        const spring=physicsWorkerSpringAt(packed,index,scratch);spring.afConfidenceRevision=springPaeRevision;
        const active=getActiveSpring(spring);if(active)springTargets.push({i:spring.i,j:spring.j,target:active.targetRestLen,weight:active.weight,isBackbone:spring.isBackbone,isBasePair:spring.isBasePair});
    }
    return {id:`Draft ${state.index+1} · ${state.files[state.index].pdbId}`,chains,springTargets,viewState};
}
async function startStagedDraft(index,state){
    if(state!==multiReferenceBuild||state.generation!==modelBuildGeneration)return;
    state.index=index;state.kind='draft';state.current=`draft:${index}`;state.busy=true;
    if(state.follow)state.view=state.current;renderStagedBuildControls();
    modelLoading=true;physicsRunning=false;referenceAssembly=null;referenceFiles=[state.files[index]];currentReferenceFile=referenceFiles[0];
    model1Influence=state.weights[index];referenceInfluences=[model1Influence];
    modelData1.pdbId=referenceFiles[0].pdbId;document.getElementById('PDBTitle').textContent=modelData1.pdbId;modelData1.chains=referenceFiles[0].parsed.chains;modelData1.caAtoms=referenceFiles[0].parsed.allAtoms;
    modelData1.matrixCache.clear();modelData2.matrixCache.clear();selectedPairKey=null;editedChainMatches.clear();
    populateChainSelectors();
    if(!await computeAllChainAlignments()||state!==multiReferenceBuild)return;
    initPhysicsSimulation();resetPhysicsGraphHistory();renderChainLegends();resetCanvasViews();drawIndividualMatrices();drawDifferenceMatrix();drawMorphMatrix();
    modelLoading=false;state.busy=false;readyModelGeneration=state.generation;hidePhysicsViewerLoading();
    if(state.follow)selectStagedModel(state.current);else selectStagedModel(state.view);
}
async function advanceStagedBuild(){
    const state=multiReferenceBuild;if(!state||state.busy||state.kind!=='draft')return;
    state.busy=true;physicsRunning=false;renderStagedBuildControls();
    const draft=await captureStagedDraft(state);state.drafts.push(draft);
    if(state!==multiReferenceBuild||state.generation!==modelBuildGeneration)return;
    if(state.index+1<state.files.length){await startStagedDraft(state.index+1,state);return;}
    state.kind='aligned';state.current='aligned';if(state.follow)state.view='aligned';renderStagedBuildControls();
    document.getElementById('groupSimulationStatus').textContent='TM-aligning completed draft homology models…';
    const id=++modellingCalculationVersion;
    const output=await runModellingWorker({id,operation:'drafts',settings:{mode:alignmentMode,gapOpen:alignmentGapOpen,gapExtend:alignmentGapExtend},
        files:state.drafts.map(draft=>({pdbId:draft.id,parsed:{chains:draft.chains}}))});
    if(state!==multiReferenceBuild||state.generation!==modelBuildGeneration)return;
    state.assembly=output.assembly;renderStagedComparisonTables();selectStagedModel(state.view);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    state.merged=mergeDraftModels(state.assembly,state.drafts,state.weights);
    await startCombinedStagedModel(state);
}
async function startCombinedStagedModel(state){
    if(state!==multiReferenceBuild||state.generation!==modelBuildGeneration)return;
    state.kind='combined';state.current='combined';if(state.follow)state.view='combined';state.busy=true;modelLoading=true;
    referenceAssembly=null;referenceFiles=state.files;referenceInfluences=state.weights.slice();
    const chains=state.merged.chains;modelData1.chains=chains;modelData1.caAtoms=Object.values(chains).flat();modelData1.pdbId='Merged draft model';
    modelData2.chains=chains;modelData2.caAtoms=modelData1.caAtoms;modelData1.matrixCache.clear();modelData2.matrixCache.clear();
    const identity={R:[[1,0,0],[0,1,0],[0,0,1]],t:[0,0,0],tmScore:1,rmsd:0,numEquiv:0};
    alignmentResults=Object.entries(chains).map(([chain,atoms])=>({c1:chain,c2:chain,atoms1:atoms,atoms2:atoms,entityType:atoms[0]?.entityType||'protein',
        referenceOnly:false,seq1:atoms.map(atom=>atom.singleChar||'X').join(''),seq2:atoms.map(atom=>atom.singleChar||'X').join(''),align1:atoms.map(atom=>atom.singleChar||'X').join(''),align2:atoms.map(atom=>atom.singleChar||'X').join(''),map1To2:new Map(atoms.map((_,i)=>[i,i])),map2To1:new Map(atoms.map((_,i)=>[i,i])),isEquivalent:true,score:0,alignedPairs:atoms.map((_,index)=>({idx1:index,idx2:index})),modellingFit:{...identity,numEquiv:atoms.length},
        initialCoordinates:new Float64Array(atoms.flatMap(atom=>[atom.x,atom.y,atom.z])),identity:100,similarity:100,
        tmMetrics:{tmScore:1,rmsd:0,averageDistance:0},alignmentDistances:{byModel:[atoms.map(()=>0),atoms.map(()=>0)],columns:atoms.map(()=>0)}}));
    buildMorphMatrixBlocks();selectedPairKey=null;initPhysicsSimulation();resetPhysicsGraphHistory();
    populateChainSelectors();renderAlignmentTable();renderChainLegends();resetCanvasViews();drawIndividualMatrices();drawDifferenceMatrix();drawMorphMatrix();
    state.busy=false;modelLoading=false;readyModelGeneration=state.generation;hidePhysicsViewerLoading();
    selectStagedModel(state.view);renderStagedBuildControls();
}
function installStagedMergedSprings(){
    const state=ensurePhysicsSimulationWorker(),build=multiReferenceBuild;
    if(state.stagedMerged===build.merged)return;
    state.stagedMerged=build.merged;state.springInput=physicsSpringInputSnapshot();state.springInput.nodes.forEach(node=>{node.locked=false;});state.inputSent=true;
    state.buildCutoff=springCutoffVal;state.buildRevision=(state.buildRevision||0)+1;state.buildPending=true;
    const packed=packPhysicsWorkerSprings(build.merged.springs);packed.packed=true;packed.cutoff=springCutoffVal;packed.nodeCount=physicsNodes.length;
    state.worker.postMessage({command:'installSprings',revision:state.buildRevision,packed,input:state.springInput,influences:referenceInfluences.slice()});
}
function renderStagedComparisonTables(){
    const state=multiReferenceBuild,previous=referenceAssembly;
    try{referenceAssembly=state.assembly;renderReferenceComparison();}finally{referenceAssembly=previous;}
    const host=document.getElementById('stagedModelComparisons');host.classList.remove('hidden');
    for(const [id,title] of [['draftCentreDistanceCard','Chain-centre distances of aligned draft homology models'],['draftEquivalentChainsCard','Equivalent homology model chains']]){
        const card=document.getElementById(id);card.querySelector('h2').textContent=title;host.append(card);
    }
    document.getElementById('referenceComparison').classList.add('hidden');
}

function stagedSnapshotColors(draft){
    const saved={modelData1,modelData2,physicsNodes,physicsSprings,morphMatrixBlocks,physicsPositions,physicsCenterOffset,referenceFiles,referenceInfluences,referenceAssembly,model1Influence,model2Influence,groupSimulation,instancedNodeMesh,backboneChains,physicsDifferenceMode,physicsOriginColorMode};
    const cache={pairs:validationState.pairs,byPair:validationState.byPair,nodeColors:validationState.nodeColors};
    const colors=draft.viewState.nodes.map(()=>new THREE.Color('#94a3b8'));
    try{
        modelData1=draft.viewState.modelData1;modelData2=draft.viewState.modelData2;
        physicsNodes=draft.viewState.nodes;physicsSprings=draft.viewState.springs;morphMatrixBlocks=draft.viewState.blocks;physicsPositions=draft.viewState.positions;
        physicsCenterOffset=draft.viewState.offset;referenceFiles=draft.viewState.referenceFiles;referenceInfluences=draft.viewState.referenceInfluences;
        referenceAssembly=draft.viewState.referenceAssembly;model1Influence=draft.viewState.model1Influence;model2Influence=draft.viewState.model2Influence;
        groupSimulation={complete:true};backboneChains=[];physicsDifferenceMode=physicsColorMode==='difference';physicsOriginColorMode=physicsColorMode==='origin';
        instancedNodeMesh={instanceColor:{},setColorAt(index,color){colors[index].copy(color);},getColorAt(index,color){color.copy(colors[index]);}};
        if(['constraint-confidence','spring-strain','model-confidence','alpha-pae'].includes(physicsColorMode))calculateValidationPairs();
        updatePhysicsNodeColors();
    }finally{
        ({modelData1,modelData2,physicsNodes,physicsSprings,morphMatrixBlocks,physicsPositions,physicsCenterOffset,referenceFiles,referenceInfluences,referenceAssembly,model1Influence,model2Influence,groupSimulation,instancedNodeMesh,backboneChains,physicsDifferenceMode,physicsOriginColorMode}=saved);
        Object.assign(validationState,cache);updatePhysicsSequences();
    }
    return colors;
}
function disposeStagedPreview(){
    if(!stagedPreview)return;stagedPreview.observer.disconnect();
    stagedPreview.scene.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material?.dispose();});
    stagedPreview.renderer.dispose();stagedPreview.renderer.forceContextLoss();stagedPreview=null;document.getElementById('stagedPreviewHost')?.replaceChildren();
}
function renderStagedPreview(){
    const state=multiReferenceBuild,host=document.getElementById('stagedPreviewHost');disposeStagedPreview();if(!state||!host||stagedLiveView())return;
    host.classList.remove('hidden');
    const aligned=state.view==='aligned',draft=aligned?null:state.drafts[Number(state.view.split(':')[1])];
    if(aligned&&!state.assembly||!aligned&&!draft){host.textContent=aligned?'Aligning completed draft models…':'Preparing draft model…';return;}
    const structures=aligned?state.assembly.structures:[{file:{pdbId:draft.id},entries:Object.entries(draft.chains).map(([chain,atoms])=>({chain,alignedAtoms:atoms,alignedCenter:referenceCenter(atoms)}))}];
    const palette=draft?stagedSnapshotColors(draft):null;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));host.append(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color(document.body.classList.contains('light-mode')?'#ffffff':'#020617');
    scene.add(new THREE.AmbientLight(0xffffff,.8));const light=new THREE.DirectionalLight(0xffffff,1);light.position.set(30,50,100);scene.add(light);
    const pivot=new THREE.Group(),root=new THREE.Group();pivot.add(root);scene.add(pivot);
    const atoms=structures.flatMap(structure=>structure.entries.flatMap(entry=>entry.alignedAtoms));
    const box=new THREE.Box3().setFromPoints(atoms.map(atom=>new THREE.Vector3(atom.x,atom.y,atom.z))),center=box.getCenter(new THREE.Vector3()),radius=Math.max(15,box.getSize(new THREE.Vector3()).length());root.position.copy(center).multiplyScalar(-1);
    const camera=new THREE.PerspectiveCamera(45,1,.1,Math.max(10000,radius*20));camera.position.set(0,0,radius*1.2);camera.lookAt(0,0,0);
    const groups=new Map();if(aligned)state.assembly.groups.forEach((group,index)=>{for(const entry of group.entries.values())groups.set(entry,{group,index});});
    const toggles=document.getElementById('stagedStructureToggles');toggles.replaceChildren();toggles.classList.toggle('hidden',!aligned);
    const render=()=>renderer.render(scene,camera),makeToggle=(label,key,object)=>{
        object.visible=state.visible.get(key)!==false;const button=document.createElement('button');button.type='button';button.className='px-3 py-1 rounded border border-slate-600 text-xs';button.textContent=label;button.setAttribute('aria-pressed',String(object.visible));
        button.addEventListener('click',()=>{object.visible=!object.visible;state.visible.set(key,object.visible);button.setAttribute('aria-pressed',String(object.visible));render();});toggles.append(button);
    };
    const colorsForEntry=(entry,s)=>{
        const equivalence=groups.get(entry),mode=state.alignedMode;
        const mapping=aligned?state.assembly.residueMaps.get(`${equivalence.group.key}\u0000${s}`):null;
        const canonicalByIndex=new Map(mapping?[...mapping.map].map(([canonical,index])=>[index,canonical]):[]);
        return entry.alignedAtoms.map((atom,index)=>{
            if(!aligned)return palette[atom.draftNodeIndex]||new THREE.Color('#94a3b8');
            if(mode==='reference')return new THREE.Color(referenceColor(s));
            if(mode==='chain')return new THREE.Color(getChainColor(`${s}:${entry.chain}`,structures.flatMap((structure,i)=>structure.entries.map(e=>`${i}:${e.chain}`))));
            if(mode==='protein')return new THREE.Color(proteinTypeColor(entry.type));
            if(mode==='equivalent')return new THREE.Color(proteinTypeColor(equivalence.index));
            const canonical=canonicalByIndex.get(index);
            const others=[...equivalence.group.entries].filter(([i])=>i!==s).map(([i,e])=>{
                const m=state.assembly.residueMaps.get(`${equivalence.group.key}\u0000${i}`),other=m?.map.get(canonical);return other===undefined?null:e.alignedAtoms[other];
            }).filter(Boolean);
            return new THREE.Color(mode==='aligned'?(others.length?'#ef4444':'#64748b'):others.length?alignmentDistanceColor(others.reduce((sum,other)=>sum+dist3d(atom,other),0)/others.length):'#64748b');
        });
    };
    structures.forEach((structure,s)=>{
        const object=new THREE.Group();root.add(object);if(aligned)makeToggle(structure.file.pdbId,`draft:${s}`,object);
        for(const entry of structure.entries){
            const points=entry.alignedAtoms,colors=colorsForEntry(entry,s),positions=[],rgb=[];
            points.forEach((atom,index)=>{const sources=!aligned&&physicsRepresentation==='ball-stick'&&atom.sourceAtoms?.length?atom.sourceAtoms:[atom];
                for(const source of sources){positions.push(source.x,source.y,source.z);rgb.push(colors[index].r,colors[index].g,colors[index].b);}});
            const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
            object.add(new THREE.Points(geometry,new THREE.PointsMaterial({vertexColors:true,size:aligned?1.4:.8,sizeAttenuation:true})));
            if(points[0]?.entityType!=='other'){
                const trace=new THREE.BufferGeometry();trace.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(atom=>[atom.x,atom.y,atom.z]),3));trace.setAttribute('color',new THREE.Float32BufferAttribute(colors.flatMap(color=>[color.r,color.g,color.b]),3));
                object.add(new THREE.Line(trace,new THREE.LineBasicMaterial({vertexColors:true})));
            }
        }
    });
    if(aligned){
        const lines=new THREE.Group();root.add(lines);
        for(const group of state.assembly.groups){const entries=[...group.entries.values()];for(let i=1;i<entries.length;i++){
            const geometry=new THREE.BufferGeometry().setFromPoints([entries[0].alignedCenter,entries[i].alignedCenter].map(p=>new THREE.Vector3(p.x,p.y,p.z)));
            lines.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#cbd5e1',transparent:true,opacity:.6})));
        }}makeToggle('Lines between centres of equivalent entities','links',lines);
    }
    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';camera.aspect=width/height;camera.updateProjectionMatrix();render();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let drag=null;const canvas=renderer.domElement;canvas.addEventListener('contextmenu',event=>event.preventDefault());
    canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,button:event.button};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
        if(drag.button===2||event.shiftKey){pivot.position.x+=dx*radius/host.clientWidth;pivot.position.y-=dy*radius/host.clientWidth;}
        else{pivot.rotation.y+=dx*.008;pivot.rotation.x+=dy*.008;}render();});
    canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
    canvas.addEventListener('wheel',event=>{event.preventDefault();camera.position.z=Math.max(radius*.1,Math.min(radius*6,camera.position.z*Math.exp(event.deltaY*.001)));render();},{passive:false});
    stagedPreview={scene,renderer,observer};
    document.getElementById('physicsColourKey').textContent=aligned?'Draft models are TM-aligned in a shared coordinate frame. Toggle individual drafts or equivalent-entity centre lines above.':'Completed draft snapshot. The current build continues in the background.';
}
