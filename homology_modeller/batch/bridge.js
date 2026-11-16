'use strict';
// This script runs in the same document as the modeller, with access to its session API.
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
  const simulated=document.getElementById('autoRunBuildSimulation').checked;
  await stage('Capturing model image');
  if(simulated || !window.getModelOverviewSnapshot())captureModelOverviewSnapshot();
  const image=window.getModelOverviewSnapshot()||null;
  await stage(options.saveFullSession?'Capturing full modeller session':'Capturing 3D viewer snapshot');
  const session=await sessionCapture({viewOnly:!options.saveFullSession});
  await stage('Exporting model structure');
  return {session,image,scores,residues,model:generateSimulationMmCifString(),settings:Object.fromEntries([...document.querySelectorAll('#buildSettingsContent input[id],#buildSettingsContent select[id]')].map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]))};
 },
 async restore(session){await restoreSession(session);window.appNavigate(3);window.dispatchEvent(new Event('resize'));}
};
