'use strict';
// This script runs in the same document as the modeller, with access to its session API.
function batchProteinSources(nodes,files,getAtom){
 const chains=new Map();
 for(const node of nodes){
  if(node.res.entityType!=='protein')continue;
  const key=node.blockIdx??node.res.c1??node.res.c2,atom=getAtom(node,'af')||node.res.atoms2?.[0]||null;
  let chain=chains.get(key);if(!chain){chain={chain:node.res.c1||node.res.c2||null,block:node.blockIdx??null,sources:[]};chains.set(key,chain);}
  const file=atom&&(files[atom.fileIndex]||files.find(item=>item.pdbId===atom.sourcePdbId));
  const type=atom?.sequenceOnly?'UniProt sequence':file?.alphaFoldCoordinates===true?'AlphaFold':file?.alphaFoldCoordinates===false?'Other structure':node.res.referenceOnly?'Reference only':'Unknown';
  const accession=atom?.sourcePdbId||null,reason=atom?.sequenceFallbackReason||file?.fallbackReason||null;
  if(!chain.sources.some(source=>source.type===type&&source.accession===accession&&source.reason===reason))chain.sources.push({type,accession,reason});
 }
 const result=[...chains.values()];
 return {chains:result,hasChainWithoutAlphaFold:result.some(chain=>!chain.sources.some(source=>source.type==='AlphaFold')&&chain.sources.every(source=>source.type!=='Unknown')),hasUnknownSource:result.some(chain=>chain.sources.some(source=>source.type==='Unknown'))};
}
window.batchBridge={
 setTheme(light){setLightMode(light);},
 settingsSnapshot(){return Object.fromEntries([...document.querySelectorAll("#buildSettingsContent input[id],#buildSettingsContent select[id]")].map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]));},
 applySettings(settings){for(const [id,value] of Object.entries(settings)){const e=document.getElementById(id);if(!e)continue;if(e.type==='checkbox')e.checked=value;else e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}},
 speciesSnapshot(){
  const value=document.getElementById('stringSpeciesSearch').value,species=selectedModellingSpecies();
  if(value.trim()&&!species)throw Error('Select a species from the species menu or clear the species field.');
  if(document.getElementById('stringFilesStatus').textContent.startsWith('Fetching genome and proteome'))throw Error('Wait for the species files to finish downloading before starting the batch.');
  if(Boolean(selectedStringFiles.sequence)!==Boolean(selectedStringFiles.aliases))throw Error('Select both STRING sequences and aliases files before starting the batch.');
  return {value,species,sequence:selectedStringFiles.sequence,aliases:selectedStringFiles.aliases};
 },
 applySpecies(snapshot){
  modelFilesController?.abort();modelFilesController=null;cancelStringMatching();
  const input=document.getElementById('stringSpeciesSearch');input.value=snapshot.value;
  if(snapshot.species)speciesChoices.set(snapshot.value,snapshot.species);
  currentSpeciesTaxon=snapshot.species?.taxon||null;
  selectedStringFiles.sequence=snapshot.sequence;selectedStringFiles.aliases=snapshot.aliases;
  loadPreferredNames();updateReferenceSpeciesGuidance();updateFindMatchesReady();
 },
 async run(row,onStage=()=>{},options={}){
  const stage=async name=>{onStage(name);await new Promise(resolve=>setTimeout(resolve,0));};
  await stage('Preparing modeller inputs');
  const put=(id,value)=>{const e=document.getElementById(id);e.value=value||'';e.dispatchEvent(new Event('input',{bubbles:true}));};
  if(modelLoading||referenceSearchLoading||siftsLookupLoading)throw Error('The modeller is busy.');
  if(modelBuildStartedAt!==null&&!modelBuildCompleted)cancelModelBuild();
  clearUploadedStructure('reference');clearUploadedStructure('alphaFold');
  put('referenceSearchInput',row['What do you want a model of?']);put('pdbInput1',row['Reference PDB IDs']);put('pdbInput2',row['AlphaFold IDs, UniProt IDs, or PDB IDs']);
  if(row['Reference PDB IDs']?.trim())completedReferenceSearchKey=currentReferenceSearchKey();
  const generation=modelBuildGeneration,started=Date.now();document.getElementById('dualPdbForm').requestSubmit();
  let seen=false,idleSince=null,lastStage='';
  while(Date.now()-started<1800000){
   await new Promise(r=>setTimeout(r,500));
   seen ||= modelBuildGeneration!==generation;
   const currentStage=referenceSearchLoading?'Searching for reference structures':siftsLookupLoading?'Loading target identifiers':stringMatchingLoading?'Matching STRING proteins':modelLoading?'Loading structures and building model':physicsRunning?'Running simulation':seen?'Preparing model':'Starting modeller';
   if(currentStage!==lastStage){lastStage=currentStage;onStage(currentStage);}
   if(seen && !modelLoading && readyModelGeneration===modelBuildGeneration && (modelBuildCompleted || (preSimulationAnalysisGeneration===modelBuildGeneration && (!multiReferenceBuild || (multiReferenceBuild.done && !multiReferenceBuild.busy)))))break;
   const busy=modelLoading||referenceSearchLoading||siftsLookupLoading||stringMatchingLoading;
   if(!busy && (!seen||modelBuildStartedAt===null)){idleSince ||= Date.now();if(Date.now()-idleSince>10000)throw Error(document.getElementById('errorMessage')?.textContent||document.getElementById('referenceSequenceSearchStatus')?.textContent||document.getElementById('fetchSiftsStatus')?.textContent||'The modeller could not start this build.');}else idleSince=null;
  }
  if(!seen||readyModelGeneration!==modelBuildGeneration||(!modelBuildCompleted&&preSimulationAnalysisGeneration!==modelBuildGeneration))throw Error('Build did not complete within 30 minutes.');
  await stage('Waiting for model analyses and annotations');
  const readyDeadline=Date.now()+60000;while(!window.getComplexAiState().ready && Date.now()<readyDeadline)await new Promise(r=>setTimeout(r,250));
  await stage('Loading AlphaFold prediction errors');
  await Promise.race([loadValidationPae(),new Promise(r=>setTimeout(r,15000))]);
  await stage('Calculating confidence scores');
  const confidence=calculateModelConfidence(),fields={model:confidence.scores,local:confidence.local,placement2:confidence.placement2,placement5:confidence.placement5};
  const sums=new Float64Array(physicsNodes.length),counts=new Uint32Array(physicsNodes.length);
  for(const pair of computeValidationPairs().pairs)if(Number.isFinite(pair.confidence))for(const i of [pair.i,pair.j]){sums[i]+=pair.confidence;counts[i]++;}
  fields.constraint=physicsNodes.map((node,i)=>node.res.entityType!=='protein'?null:node.referenceLockTarget?1:counts[i]?sums[i]/counts[i]:null);
  const mean=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null;};
  const scores=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{values:v.filter(Number.isFinite),mean:k==='model'?confidence.overall:mean(v)}]));
  const residuePae=calculateResiduePae();
  const residues=physicsNodes.flatMap((node,index)=>{if(node.res.entityType!=='protein')return [];const af=validationAtom(node,'af'),ref=validationAtom(node,'reference');return [{index,chain:node.res.c1||node.res.c2||null,referenceResidue:ref?.resSeq??null,referenceInsertion:ref?.sourceAtoms?.[0]?.insertionCode||'',predictionAccession:af?.sourcePdbId||null,predictionChain:af?.groupKey??af?.chainId??null,predictionResidue:af?.afResSeq??af?.resSeq??null,aminoAcid:(af||ref)?.singleChar||null,aligned:Boolean(node.usedInAlignment),locked:Boolean(node.referenceLockTarget),plddt:Number.isFinite(af?.plddt)?af.plddt:null,pae:Number.isFinite(residuePae[index])?residuePae[index]:null,...Object.fromEntries(Object.entries(fields).map(([key,values])=>[key,Number.isFinite(values[index])?values[index]:null]))}];});
  const mode=options.saveMode||'most',minimal=mode==='minimal';
  let bonds=null,atomKeys=null,membrane=null;
  if(minimal){
   await stage('Preparing minimal model topology');
   const entries=simulationAtomEntries(),byNode=new Map();atomKeys=[];let block=-1,number=0,previous=-1;
   for(const entry of entries){const node=physicsNodes[entry.nodeIndex];if(node.blockIdx!==block){block=node.blockIdx;number=0;}if(entry.nodeIndex!==previous&&(node.res.entityType!=='other'||number===0))number++;previous=entry.nodeIndex;const chain=node.res.c1||node.res.c2||'A';const seq=node.res.entityType==='other'?(node.res.atoms1[node.idx1]?.resSeq||number):number;if(!byNode.has(entry.nodeIndex))byNode.set(entry.nodeIndex,{modelChain:chain,modelResidue:seq});atomKeys.push([chain,seq,entry.source.atomName,entry.source.element||'C']);}
   for(const residue of residues)Object.assign(residue,byNode.get(residue.index)||{});
   bonds=MolecularTopology.buildBonds(molecularBondInput(entries)).values;
   membrane={geometry:simulationMembraneSnapshot(),confidence:validationMembraneDetectionConfidence(),sides:{...membraneSideNames},visible:membraneVisible};
  }
  const simulated=document.getElementById('autoRunBuildSimulation').checked;
  await stage('Capturing model image');
  const oldImageInfo=window.getModelOverviewSnapshotInfo?.();
  if(simulated || !window.getModelOverviewSnapshot() || oldImageInfo?.transparentBackground!==true || !(oldImageInfo?.pixelsPerAngstrom>0) || (inferredMembrane&&!Number.isFinite(oldImageInfo?.membranes?.[0])) || (secondMembrane&&!Number.isFinite(oldImageInfo?.membranes?.[1])))captureModelOverviewSnapshot({transparent:true});
  const image=window.getModelOverviewSnapshot()||null,imageInfo=window.getModelOverviewSnapshotInfo?.()||null;
  let session=null;if(!minimal){await stage(mode==='full'?'Capturing full modeller session':'Capturing 3D viewer snapshot');session=await sessionCapture({viewOnly:mode!=='full'});}
  await stage('Exporting model structure');
  return {session,image,imageInfo,scores,proteinSources:batchProteinSources(physicsNodes,alphaFoldMolstarFiles,validationAtom),residues:minimal?residues.map(({modelChain,modelResidue,model,local,placement2,placement5,constraint,pae,plddt})=>({modelChain,modelResidue,model,local,placement2,placement5,constraint,pae,plddt})):residues,bonds,atomKeys,membrane,model:generateSimulationMmCifString(),settings:Object.fromEntries([...document.querySelectorAll('#buildSettingsContent input[id],#buildSettingsContent select[id]')].map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]))};
 },
 async restore(session){window.batchMinimalBondData=null;await restoreSession(session);window.appNavigate(3);window.dispatchEvent(new Event('resize'));},
 async restoreMinimal(model,result,bondData){
  if(modelLoading)throw Error('The viewer is still loading a model.');
  window.batchMinimalBondData=null;
  document.getElementById('autoRunBuildSimulation').checked=false;document.getElementById('useReferencesDirectly').checked=true;
  const file=new File([model],'batch-minimal-model.cif',{type:'chemical/x-mmcif'});assignStructureFiles('reference',[file]);clearUploadedStructure('alphaFold');
  const generation=modelBuildGeneration;await loadModelPair(file.name,'');
  const deadline=Date.now()+120000;while(Date.now()<deadline&&(modelLoading||readyModelGeneration!==modelBuildGeneration||multiReferenceBuild?.busy))await new Promise(resolve=>setTimeout(resolve,100));
  if(modelBuildGeneration===generation||modelLoading||readyModelGeneration!==modelBuildGeneration||!physicsNodes.length)throw Error('Could not load the minimal model into the 3D viewer.');
  const lookup=new Map();for(const row of result.residues||[]){const key=JSON.stringify([String(row.modelChain),String(row.modelResidue)]);if(lookup.has(key))lookup.set(key,null);else lookup.set(key,row);}
  const fields={scores:[],local:[],placement2:[],placement5:[]},pae=[],constraint=[];
  physicsNodes.forEach((node,i)=>{const atom=validationAtom(node,'af')||validationAtom(node,'reference'),key=JSON.stringify([String(node.res.c1||node.res.c2||'A'),String(atom?.resSeq)]),row=lookup.get(key);for(const [field,name] of [['scores','model'],['local','local'],['placement2','placement2'],['placement5','placement5']])fields[field][i]=Number.isFinite(row?.[name])?row[name]:null;pae[i]=Number.isFinite(row?.pae)?row.pae:null;constraint[i]=Number.isFinite(row?.constraint)?row.constraint:null;if(atom&&Number.isFinite(row?.plddt))atom.plddt=row.plddt;node.referenceLockTarget=null;});
  const values=fields.scores.filter(Number.isFinite),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const confidence={...fields,overall:result.scores?.model?.mean??mean(values),overallIncludingLocked:mean(values),unalignedOverall:mean(values),unalignedIndices:new Set(),locked:0,aligned:0,total:physicsNodes.length,scored:values.length,partial:0,simulated:false};
  validationState.pae.clear();validationState.omittedPaeFileIndices=[];window.batchViewOnlySession=true;
  validationState.compactResidueData={nodes:physicsNodes,pae,confidence,pairMeans:{constraint,strain:[]},activeConformationGroup,stericClashRadius,rigidBodySimulation,simulationStarted:window.getComplexAiState().simulationStarted,runtimeLockRevision:physicsLockTargetRevision};
  residuePaeCache=null;modelConfidenceCache=null;
  const geometry=result.membrane?.geometry;if(geometry){const convert=g=>g?{...g,center:g.center.map((v,i)=>v-[physicsCenterOffset.cx,physicsCenterOffset.cy,physicsCenterOffset.cz][i])}:null;inferredMembrane=convert(geometry);secondMembrane=convert(geometry.secondGeometry);completeMembraneMembers(inferredMembrane,physicsNodes);membraneSideNames={...result.membrane.sides};membraneVisible=Boolean(result.membrane.visible);if(secondMembrane)completeMembraneMembers(secondMembrane,physicsNodes);renderMembraneGeometry(inferredMembrane);renderSecondMembrane(performance.now());}
  window.batchMinimalBondData={atomKeys:result.atomKeys||[],pairs:new Uint32Array(bondData)};
  window.appNavigate(3);updatePhysicsNodeColors();window.dispatchEvent(new Event('resize'));
 }

};
