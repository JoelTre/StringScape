// Explicit bindings: uploaded sessions never supply executable code.
const sessionBindings={
helicalSymmetryGroups:{get:()=>helicalSymmetryGroups,set:v=>{helicalSymmetryGroups=v;}},
nucleicExtensionState:{get:()=>nucleicExtensionState,set:v=>{nucleicExtensionState=v;}},
physicsMaterialSettings:{get:()=>physicsMaterialSettings,set:v=>Object.assign(physicsMaterialSettings,v)},
physicsMaterialOverrides:{get:()=>physicsMaterialOverrides,set:v=>{physicsMaterialOverrides.clear();for(const x of v)physicsMaterialOverrides.add(x);}},
modelData1:{get:()=>modelData1,set:v=>{modelData1=v;}},
modelData2:{get:()=>modelData2,set:v=>{modelData2=v;}},
uniProtAnnotations:{get:()=>uniProtAnnotations,set:v=>{uniProtAnnotations=v;}},
uniProtUnavailable:{get:()=>uniProtUnavailable,set:v=>{uniProtUnavailable=v;}},
referenceFiles:{get:()=>referenceFiles,set:v=>{referenceFiles=v;}},
referenceAssembly:{get:()=>referenceAssembly,set:v=>{referenceAssembly=v;}},
referenceInfluences:{get:()=>referenceInfluences,set:v=>{referenceInfluences=v;}},
alignmentResults:{get:()=>alignmentResults,set:v=>{alignmentResults=v;}},
selectionMode:{get:()=>selectionMode,set:v=>{selectionMode=v;}},
linkedSelection:{get:()=>linkedSelection,set:v=>{linkedSelection=v;}},
additionalSelections:{get:()=>additionalSelections,set:v=>{additionalSelections=v;}},
selectedGlowIndices:{get:()=>selectedGlowIndices,set:v=>{selectedGlowIndices=v;}},
selectedResiduesVisible:{get:()=>selectedResiduesVisible,set:v=>{selectedResiduesVisible=v;}},
unselectedResiduesVisible:{get:()=>unselectedResiduesVisible,set:v=>{unselectedResiduesVisible=v;}},
selectionGlowVisible:{get:()=>selectionGlowVisible,set:v=>{selectionGlowVisible=v;}},
crossLinkEvidence:{get:()=>crossLinkEvidence,set:v=>{crossLinkEvidence=v;}},
distanceEvidence:{get:()=>distanceEvidence,set:v=>{distanceEvidence=v;}},
resolvedCrossLinks:{get:()=>resolvedCrossLinks,set:v=>{resolvedCrossLinks=v;}},
selectedPairKey:{get:()=>selectedPairKey,set:v=>{selectedPairKey=v;}},
diffMatrixMode:{get:()=>diffMatrixMode,set:v=>{diffMatrixMode=v;}},
morphMatrixBlocks:{get:()=>morphMatrixBlocks,set:v=>{morphMatrixBlocks=v;}},
morphMatrixPositions:{get:()=>morphMatrixPositions,set:v=>{morphMatrixPositions=v;}},
physicsPositions:{get:()=>physicsPositions,set:v=>{physicsPositions=v;}},
morphMatrixSize:{get:()=>morphMatrixSize,set:v=>{morphMatrixSize=v;}},
model1Influence:{get:()=>model1Influence,set:v=>{model1Influence=v;}},
model2Influence:{get:()=>model2Influence,set:v=>{model2Influence=v;}},
paeSpringInfluence:{get:()=>paeSpringInfluence,set:v=>{paeSpringInfluence=v;}},
plddtSpringInfluence:{get:()=>plddtSpringInfluence,set:v=>{plddtSpringInfluence=v;}},
morphAlpha:{get:()=>morphAlpha,set:v=>{morphAlpha=v;}},
showSpringCutoff:{get:()=>showSpringCutoff,set:v=>{showSpringCutoff=v;}},
physicsRunning:{get:()=>physicsRunning,set:v=>{physicsRunning=v;}},
physicsNodes:{get:()=>physicsNodes,set:v=>{physicsNodes=v;}},
physicsSprings:{get:()=>physicsSprings,set:v=>{physicsSprings=v;}},
physicsOcclusionFactors:{get:()=>physicsOcclusionFactors,set:v=>{physicsOcclusionFactors=v;}},
physicsBasePairs:{get:()=>physicsBasePairs,set:v=>{physicsBasePairs=v;}},
springStiffnessVal:{get:()=>springStiffnessVal,set:v=>{springStiffnessVal=v;}},
angularRestraintInfluence:{get:()=>angularRestraintInfluence,set:v=>{angularRestraintInfluence=v;}},
localGeometryRestraints:{get:()=>localGeometryRestraints,set:v=>{localGeometryRestraints=v;}},
mobilityVal:{get:()=>mobilityVal,set:v=>{mobilityVal=v;}},
springCutoffVal:{get:()=>springCutoffVal,set:v=>{springCutoffVal=v;}},
lockAlignedResiduesDistance:{get:()=>lockAlignedResiduesDistance,set:v=>{lockAlignedResiduesDistance=v;}},
rigidBodySimulation:{get:()=>rigidBodySimulation,set:v=>{rigidBodySimulation=v;}},
physicsOriginColorMode:{get:()=>physicsOriginColorMode,set:v=>{physicsOriginColorMode=v;}},
physicsColorMode:{get:()=>physicsColorMode,set:v=>{physicsColorMode=v;}},
rotationalSymmetryScores:{get:()=>rotationalSymmetryScores,set:v=>{rotationalSymmetryScores=v;}},
rotationalSymmetryAxes:{get:()=>rotationalSymmetryAxes,set:v=>{rotationalSymmetryAxes=v;}},
rotationalSymmetryGroups:{get:()=>rotationalSymmetryGroups,set:v=>{rotationalSymmetryGroups=v;}},
rotationalAxesVisible:{get:()=>rotationalAxesVisible,set:v=>{rotationalAxesVisible=v;}},
equivalentProteinShapeScores:{get:()=>equivalentProteinShapeScores,set:v=>{equivalentProteinShapeScores=v;}},
simulationPhase:{get:()=>simulationPhase,set:v=>{simulationPhase=v;}},
phase1AlignmentMetrics:{get:()=>phase1AlignmentMetrics,set:v=>{phase1AlignmentMetrics=v;}},
physicsGraphNormalized:{get:()=>physicsGraphNormalized,set:v=>{physicsGraphNormalized=v;}},
physicsGraphLogScale:{get:()=>physicsGraphLogScale,set:v=>{physicsGraphLogScale=v;}},
morphColorMode:{get:()=>morphColorMode,set:v=>{morphColorMode=v;}},
stericClashRadius:{get:()=>stericClashRadius,set:v=>{stericClashRadius=v;}},
camTheta:{get:()=>camTheta,set:v=>{camTheta=v;}},
camPhi:{get:()=>camPhi,set:v=>{camPhi=v;}},
camRadius:{get:()=>camRadius,set:v=>{camRadius=v;}},
camTarget:{get:()=>camTarget,set:v=>{camTarget=v;}},
chainVisibility:{get:()=>chainVisibility,set:v=>{chainVisibility=v;}},
showModel1Overlay:{get:()=>showModel1Overlay,set:v=>{showModel1Overlay=v;}},
referenceOverlayVisibility:{get:()=>referenceOverlayVisibility,set:v=>{referenceOverlayVisibility=v;}},
homologyStructureVisible:{get:()=>homologyStructureVisible,set:v=>{homologyStructureVisible=v;}},
alignedResiduesVisible:{get:()=>alignedResiduesVisible,set:v=>{alignedResiduesVisible=v;}},
unalignedResiduesVisible:{get:()=>unalignedResiduesVisible,set:v=>{unalignedResiduesVisible=v;}},
bindingSiteResiduesVisible:{get:()=>bindingSiteResiduesVisible,set:v=>{bindingSiteResiduesVisible=v;}},
nonBindingSiteResiduesVisible:{get:()=>nonBindingSiteResiduesVisible,set:v=>{nonBindingSiteResiduesVisible=v;}},
nonProteinAtomsVisible:{get:()=>nonProteinAtomsVisible,set:v=>{nonProteinAtomsVisible=v;}},
physicsPulsePaused:{get:()=>physicsPulsePaused,set:v=>{physicsPulsePaused=v;}},
referenceColorMode:{get:()=>referenceColorMode,set:v=>{referenceColorMode=v;}},
physicsCenterOffset:{get:()=>physicsCenterOffset,set:v=>{physicsCenterOffset=v;}},
scale1:{get:()=>scale1,set:v=>{scale1=v;}},
offX1:{get:()=>offX1,set:v=>{offX1=v;}},
offY1:{get:()=>offY1,set:v=>{offY1=v;}},
scale2:{get:()=>scale2,set:v=>{scale2=v;}},
offX2:{get:()=>offX2,set:v=>{offX2=v;}},
offY2:{get:()=>offY2,set:v=>{offY2=v;}},
diffScale:{get:()=>diffScale,set:v=>{diffScale=v;}},
diffOffX:{get:()=>diffOffX,set:v=>{diffOffX=v;}},
diffOffY:{get:()=>diffOffY,set:v=>{diffOffY=v;}},
morphScale:{get:()=>morphScale,set:v=>{morphScale=v;}},
morphOffX:{get:()=>morphOffX,set:v=>{morphOffX=v;}},
morphOffY:{get:()=>morphOffY,set:v=>{morphOffY=v;}},
currentPalette:{get:()=>currentPalette,set:v=>{currentPalette=v;}},
alignmentGapOpen:{get:()=>alignmentGapOpen,set:v=>{alignmentGapOpen=v;}},
alignmentGapExtend:{get:()=>alignmentGapExtend,set:v=>{alignmentGapExtend=v;}},
alignmentMode:{get:()=>alignmentMode,set:v=>{alignmentMode=v;}},
referenceConformationPlan:{get:()=>referenceConformationPlan,set:v=>{referenceConformationPlan=v;}},
referenceSearchResults:{get:()=>referenceSearchResults,set:v=>{referenceSearchResults=v;}},
referenceSearchHistory:{get:()=>referenceSearchHistory,set:v=>{referenceSearchHistory=v;}},
referenceSearchSequences:{get:()=>referenceSearchSequences,set:v=>{referenceSearchSequences=v;}},
referenceSearchQuery:{get:()=>referenceSearchQuery,set:v=>{referenceSearchQuery=v;}},
referenceSearchSessionId:{get:()=>referenceSearchSessionId,set:v=>{referenceSearchSessionId=v;}},
completedReferenceSearchKey:{get:()=>completedReferenceSearchKey,set:v=>{completedReferenceSearchKey=v;}},
alphaFoldMolstarFiles:{get:()=>alphaFoldMolstarFiles,set:v=>{alphaFoldMolstarFiles=v;}},
preferredNames:{get:()=>preferredNames,set:v=>{preferredNames=v;}},
preferredNamesState:{get:()=>preferredNamesState,set:v=>{preferredNamesState=v;}},
stringMatchReview:{get:()=>stringMatchReview,set:v=>{stringMatchReview=v;}},
proteinSliced:{get:()=>proteinSliced,set:v=>{proteinSliced=v;}},
proteinSliceAngle:{get:()=>proteinSliceAngle,set:v=>{proteinSliceAngle=v;}},
proteinSliceTilt:{get:()=>proteinSliceTilt,set:v=>{proteinSliceTilt=v;}},
proteinSliceAxisAzimuth:{get:()=>proteinSliceAxisAzimuth,set:v=>{proteinSliceAxisAzimuth=v;}},
proteinSlicePercent:{get:()=>proteinSlicePercent,set:v=>{proteinSlicePercent=v;}},
selectedResidueLabelsVisible:{get:()=>selectedResidueLabelsVisible,set:v=>{selectedResidueLabelsVisible=v;}},
physicsBackgroundHidden:{get:()=>physicsBackgroundHidden,set:v=>{physicsBackgroundHidden=v;}},
groupNeighbourDistance:{get:()=>groupNeighbourDistance,set:v=>{groupNeighbourDistance=v;}},
groupMaxResidueSpeed:{get:()=>groupMaxResidueSpeed,set:v=>{groupMaxResidueSpeed=v;}},
groupMaxWaitingTime:{get:()=>groupMaxWaitingTime,set:v=>{groupMaxWaitingTime=v;}},
groupMaxSimulationResidues:{get:()=>groupMaxSimulationResidues,set:v=>{groupMaxSimulationResidues=v;}},
groupSimulation:{get:()=>groupSimulation,set:v=>{groupSimulation=v;}},
showSprings:{get:()=>showSprings,set:v=>{showSprings=v;}},
showSpringHistogram:{get:()=>showSpringHistogram,set:v=>{showSpringHistogram=v;}},
springHistogramWidth:{get:()=>springHistogramWidth,set:v=>{springHistogramWidth=v;}},
springColorMode:{get:()=>springColorMode,set:v=>{springColorMode=v;}},
inferredMembrane:{get:()=>inferredMembrane,set:v=>{inferredMembrane=v;}},
secondMembrane:{get:()=>secondMembrane,set:v=>{secondMembrane=v;}},
membraneLabelSuffix:{get:()=>membraneLabelSuffix,set:v=>{membraneLabelSuffix=v;}},
membraneVisible:{get:()=>membraneVisible,set:v=>{membraneVisible=v;}},
membraneLabelsVisible:{get:()=>membraneLabelsVisible,set:v=>{membraneLabelsVisible=v;}},
membraneSideNames:{get:()=>membraneSideNames,set:v=>{membraneSideNames=v;}},
membraneSliced:{get:()=>membraneSliced,set:v=>{membraneSliced=v;}},
membraneSliceAngle:{get:()=>membraneSliceAngle,set:v=>{membraneSliceAngle=v;}},
membraneSlicePercent:{get:()=>membraneSlicePercent,set:v=>{membraneSlicePercent=v;}},
membraneSizeScale:{get:()=>membraneSizeScale,set:v=>{membraneSizeScale=v;}},
lipidsVisible:{get:()=>lipidsVisible,set:v=>{lipidsVisible=v;}},
membraneDetectionStats:{get:()=>membraneDetectionStats,set:v=>{membraneDetectionStats=v;}},
membranePresenceMode:{get:()=>membranePresenceMode,set:v=>{membranePresenceMode=v;}},
atomSizeByElement:{get:()=>atomSizeByElement,set:v=>{atomSizeByElement=v;}},
modelBuildStartedAt:{get:()=>modelBuildStartedAt,set:v=>{modelBuildStartedAt=v;}},
modelBuildCompleted:{get:()=>modelBuildCompleted,set:v=>{modelBuildCompleted=v;}},
modelBuildInputKey:{get:()=>modelBuildInputKey,set:v=>{modelBuildInputKey=v;}},
completedModelInputKey:{get:()=>completedModelInputKey,set:v=>{completedModelInputKey=v;}},
chainMappingReport:{get:()=>chainMappingReport,set:v=>{chainMappingReport=v;}},
siftsReferenceKey:{get:()=>siftsReferenceKey,set:v=>{siftsReferenceKey=v;}},
alphaFoldBeforeSiftsLookup:{get:()=>alphaFoldBeforeSiftsLookup,set:v=>{alphaFoldBeforeSiftsLookup=v;}},
currentReferenceFile:{get:()=>currentReferenceFile,set:v=>{currentReferenceFile=v;}},
homologyViewerMode:{get:()=>homologyViewerMode,set:v=>{homologyViewerMode=v;}},
originPDBVisible:{get:()=>originPDBVisible,set:v=>{originPDBVisible=v;}},
originReferenceVisibility:{get:()=>originReferenceVisibility,set:v=>{originReferenceVisibility=v;}},
originAFVisible:{get:()=>originAFVisible,set:v=>{originAFVisible=v;}},
physicsDifferenceMode:{get:()=>physicsDifferenceMode,set:v=>{physicsDifferenceMode=v;}},
patternExtensionUnits:{get:()=>patternExtensionUnits,set:v=>{patternExtensionUnits=v;}},
detectedExtensionPatterns:{get:()=>detectedExtensionPatterns,set:v=>{detectedExtensionPatterns=v;}},
patternVarianceScores:{get:()=>patternVarianceScores,set:v=>{patternVarianceScores=v;}},
patternMarkersVisible:{get:()=>patternMarkersVisible,set:v=>{patternMarkersVisible=v;}},
keyframeDifferenceNormalized:{get:()=>keyframeDifferenceNormalized,set:v=>{keyframeDifferenceNormalized=v;}},
residueSpeedNormalized:{get:()=>residueSpeedNormalized,set:v=>{residueSpeedNormalized=v;}},
sequenceChainFilter:{get:()=>sequenceChainFilter,set:v=>{sequenceChainFilter=v;}},
physicsRepresentation:{get:()=>physicsRepresentation,set:v=>{physicsRepresentation=v;}},
sideChainJiggleEnabled:{get:()=>sideChainJiggleEnabled,set:v=>{sideChainJiggleEnabled=v;}},
sideChainJiggleSpeed:{get:()=>sideChainJiggleSpeed,set:v=>{sideChainJiggleSpeed=v;}},
simulationAutoRendered:{get:()=>simulationAutoRendered,set:v=>{simulationAutoRendered=v;}},
referenceComparisonVisibility:{get:()=>referenceComparisonVisibility,set:v=>{referenceComparisonVisibility=v;}},
animationFrames:{get:()=>animationFrames,set:v=>{animationFrames=v;}},
animationSelected:{get:()=>animationSelected,set:v=>{animationSelected=v;}},
animationLoop:{get:()=>animationLoop,set:v=>{animationLoop=v;}},
animationLibrary:{get:()=>animationLibrary,set:v=>{animationLibrary=v;}},
animationActiveId:{get:()=>animationActiveId,set:v=>{animationActiveId=v;}},
animationTitle:{get:()=>animationTitle,set:v=>{animationTitle=v;}},
animationSyncKeys:{get:()=>animationSyncKeys,set:v=>{animationSyncKeys=v;}},
animationInterpolation:{get:()=>animationInterpolation,set:v=>{animationInterpolation=v;}},
animationAutoSpinDismissed:{get:()=>animationAutoSpinDismissed,set:v=>{animationAutoSpinDismissed=v;}},
animationAtomOffsets:{get:()=>animationAtomOffsets,set:v=>{animationAtomOffsets=v;}},
animationModelStorageKey:{get:()=>animationModelStorageKey,set:v=>{animationModelStorageKey=v;}},
multiReferenceBuild:{get:()=>multiReferenceBuild,set:v=>{multiReferenceBuild=v;}},
activeConformationGroup:{get:()=>activeConformationGroup,set:v=>{activeConformationGroup=v;}},
conformationNodePresence:{get:()=>conformationNodePresence,set:v=>{conformationNodePresence=v;}},
editedChainMatches:{get:()=>editedChainMatches,set:v=>{if(editedChainMatches instanceof Map){editedChainMatches.clear();for(const [k,x] of v)editedChainMatches.set(k,x);}else Object.assign(editedChainMatches,v);}},
automaticChainMatches:{get:()=>automaticChainMatches,set:v=>{if(automaticChainMatches instanceof Map){automaticChainMatches.clear();for(const [k,x] of v)automaticChainMatches.set(k,x);}else Object.assign(automaticChainMatches,v);}},
topologicalDomainColors:{get:()=>topologicalDomainColors,set:v=>{if(topologicalDomainColors instanceof Map){topologicalDomainColors.clear();for(const [k,x] of v)topologicalDomainColors.set(k,x);}else Object.assign(topologicalDomainColors,v);}},
physicsGraphHistory:{get:()=>physicsGraphHistory,set:v=>{if(physicsGraphHistory instanceof Map){physicsGraphHistory.clear();for(const [k,x] of v)physicsGraphHistory.set(k,x);}else Object.assign(physicsGraphHistory,v);}},
singleChainRotations:{get:()=>singleChainRotations,set:v=>{if(singleChainRotations instanceof Map){singleChainRotations.clear();for(const [k,x] of v)singleChainRotations.set(k,x);}else Object.assign(singleChainRotations,v);}},
viewerSizes:{get:()=>viewerSizes,set:v=>{if(viewerSizes instanceof Map){viewerSizes.clear();for(const [k,x] of v)viewerSizes.set(k,x);}else Object.assign(viewerSizes,v);}},
validationState:{get:()=>validationState,set:v=>{if(validationState instanceof Map){validationState.clear();for(const [k,x] of v)validationState.set(k,x);}else Object.assign(validationState,v);}},
stagedReferenceWeights:{get:()=>stagedReferenceWeights,set:v=>{if(stagedReferenceWeights instanceof Map){stagedReferenceWeights.clear();for(const [k,x] of v)stagedReferenceWeights.set(k,x);}else Object.assign(stagedReferenceWeights,v);}},
patternExtensionCounts:{get:()=>patternExtensionCounts,set:v=>{if(patternExtensionCounts instanceof Map){patternExtensionCounts.clear();for(const [k,x] of v)patternExtensionCounts.set(k,x);}else Object.assign(patternExtensionCounts,v);}},
};
// Graph encoding preserves shared residue objects, cycles, Maps and typed matrices.
function encodeSessionGraph(root,binaryFiles=null){
    const seen=new Map(),records=[];
    function encode(value){
        if(typeof value==='number'&&!Number.isFinite(value))return {number:String(value)};
        if(value===null||typeof value!=='object')return typeof value==='function'||typeof value==='undefined'?null:value;
        if(value instanceof Node||value instanceof Worker||value instanceof AbortController||value.isObject3D||value.isBufferGeometry||value.isMaterial)return null;
        if(seen.has(value))return {ref:seen.get(value)};
        const id=records.length;seen.set(value,id);records.push(null);
        let record;
        const memoryView=MemoryData.descriptor(value);
        if(memoryView)record={type:'MemoryView',descriptor:encode(memoryView)};
        else if(value instanceof Map)record={type:'Map',data:[...value].map(([k,v])=>[encode(k),encode(v)])};
        else if(value instanceof Set)record={type:'Set',data:[...value].map(encode)};
        else if(ArrayBuffer.isView(value))record=binaryFiles?{type:'TypedView',constructor:value.constructor.name,buffer:encode(value.buffer),offset:value.byteOffset,length:value.length}:{type:value.constructor.name,data:Array.from(value,encode)};
        else if(value instanceof ArrayBuffer){if(binaryFiles){const name='buffer-'+Object.keys(binaryFiles).length+'.bin';binaryFiles[name]=new Uint8Array(value);record={type:'Binary',name,length:value.byteLength};}else record={type:'Uint8Array',data:Array.from(new Uint8Array(value))};}
        else if(Array.isArray(value))record={type:'ArrayValues',data:value.map(encode)};
        else if(value instanceof Date)record={type:'Date',data:value.toISOString()};
        else if(value.isVector3||value.isQuaternion||value.isColor)record={type:value.isVector3?'Vector3':value.isQuaternion?'Quaternion':'Color',data:Object.entries(value).map(([k,v])=>[k,encode(v)])};
        else record={type:Array.isArray(value)?'Array':'Object',data:Object.entries(value).filter(([k])=>!['__proto__','constructor','prototype','normalColorMenuNodes','cancelNetwork'].includes(k)).map(([k,v])=>[k,encode(k==='matrixCache'?new Map():v)])};
        records[id]=record;return {ref:id};
    }
    return {root:encode(root),records};
}
function decodeSessionGraph(graph,binaryFiles={}){
    if(!graph||!Array.isArray(graph.records))throw Error('Invalid session data.');
    const types={Float32Array,Float64Array,Int32Array,Uint32Array,Int16Array,Uint16Array,Int8Array,Uint8Array,Uint8ClampedArray};
    const objects=graph.records.map(r=>{
        if(r.type==='Binary'){const data=binaryFiles[r.name];if(!(data instanceof Uint8Array)||data.byteLength!==r.length)throw Error('Missing session buffer: '+r.name);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}
        if(r.type==='TypedView')return null;
        if(r.type==='MemoryView')return {};
        if(r.type==='Map')return new Map();if(r.type==='Set')return new Set();
        if(r.type==='Array'||r.type==='ArrayValues')return [];if(r.type==='Object')return r.data.some(([k,v])=>k==='packed'&&v===true)?physicsSpringNetworkView({}):{};
        if(r.type==='Date')return new Date(r.data);
        if(['Vector3','Quaternion','Color'].includes(r.type))return new THREE[r.type]();
        if(types[r.type])return new types[r.type](r.data.length);
        throw Error('Unsupported session data type.');
    });
    graph.records.forEach((r,i)=>{if(r.type==='TypedView'){const Type=types[r.constructor],buffer=objects[r.buffer?.ref];if(!Type||!(buffer instanceof ArrayBuffer)||!Number.isSafeInteger(r.length)||r.length<0)throw Error('Invalid typed session buffer');objects[i]=new Type(buffer,r.offset,r.length);}});
    function decode(v){if(v&&typeof v==='object'){if(Object.hasOwn(v,'ref')){if(!Number.isInteger(v.ref)||!objects[v.ref])throw Error('Invalid session reference.');return objects[v.ref];}if(Object.hasOwn(v,'number'))return Number(v.number);throw Error('Invalid session value.');}return v;}
    graph.records.forEach((r,i)=>{if(['Binary','TypedView','MemoryView'].includes(r.type))return;const target=objects[i];if(target instanceof Map)r.data.forEach(([k,v])=>target.set(decode(k),decode(v)));else if(target instanceof Set)r.data.forEach(v=>target.add(decode(v)));else if(r.type==='ArrayValues')r.data.forEach((v,j)=>target[j]=decode(v));else if(ArrayBuffer.isView(target))r.data.forEach((v,j)=>target[j]=decode(v));else if(!(target instanceof Date))r.data.forEach(([k,v])=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe session key.');target[k]=decode(v);});});
    graph.records.forEach((r,i)=>{if(r.type==='MemoryView')Object.assign(objects[i],decode(r.descriptor));});
    return MemoryData.wire(decode(graph.root),true);
}
// Standard uncompressed ZIP: readable without a network dependency.
function sessionZip(files){
    const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;
    const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
    for(const [name,text] of (files[Symbol.iterator]?files:Object.entries(files))){
        const n=encoder.encode(name),data=typeof text==='string'?encoder.encode(text):text;
        if(!(data instanceof Uint8Array))throw Error('Invalid session entry');
        if(n.length>65535||directory.length>=65535||offset+30+n.length+data.length>0xffffffff)throw Error('Session exceeds ZIP32 limits; save to a local folder instead.');
        const sum=crc(data),header=new Uint8Array(30+n.length),v=new DataView(header.buffer);
        v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);header.set(n,30);parts.push(header,data);
        const central=new Uint8Array(46+n.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,sum,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,n.length,true);c.setUint32(42,offset,true);central.set(n,46);directory.push(central);offset+=header.length+data.length;
    }
    const size=directory.reduce((n,b)=>n+b.length,0);if(offset+size+22>0xffffffff)throw Error('Session exceeds ZIP32 limits; save to a local folder instead.');
    const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,directory.length,true);e.setUint16(10,directory.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
    return new Blob([...parts,...directory,end],{type:'application/zip'});
}
async function readSessionFile(file){
    const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder();
    if(view.byteLength>=4&&view.getUint32(0,true)===0x04034b50){
        let offset=0,session=null;const binaryFiles={};
        while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
            const flags=view.getUint16(offset+6,true),method=view.getUint16(offset+8,true),size=view.getUint32(offset+18,true),length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+length+extra;
            if(flags&8||method!==0||start+size>bytes.length)throw Error('Upload an original StringScape session ZIP.');
            const name=decoder.decode(bytes.subarray(offset+30,offset+30+length));
            if(name==='session.json')session=JSON.parse(decoder.decode(bytes.subarray(start,start+size)));
            else if(/^buffer-\d+\.bin$/.test(name))binaryFiles[name]=bytes.subarray(start,start+size);
            offset=start+size;
        }
        if(!session)throw Error('No session.json found in this archive.');
        session.binaryFiles=binaryFiles;return session;
    }
    return JSON.parse(decoder.decode(bytes));
}

function sessionDom(){
    return [...document.querySelectorAll('[id]')].filter(e=>!e.closest('#sessionPanel,#modellerAiDialog')&&!e.id.startsWith('modellerAi')&&!['SCRIPT','STYLE','CANVAS','INPUT'].includes(e.tagName)||e.tagName==='INPUT'&&e.id&&!e.closest('#modellerAiDialog')&&!['file','password'].includes(e.type)).map(e=>({id:e.id,hidden:e.hidden,open:e.tagName==='DETAILS'?e.open:undefined,classes:e.getAttribute('class'),style:e.getAttribute('style'),value:('value'in e&&!['file','password'].includes(e.type))?e.value:undefined,checked:e.checked,text:e.children.length===0&&!['INPUT','SCRIPT','STYLE','CANVAS'].includes(e.tagName)?e.textContent:undefined,pressed:e.getAttribute('aria-pressed')}));
}
async function sessionCapture(){
    const state={},binaryFiles={};for(const [key,binding] of Object.entries(sessionBindings))state[key]=binding.get();
    // Derived validation and distance/render caches are rebuilt after loading.
    state.validationState={...validationState,pairs:[],byPair:new Map(),nodeColors:null,matrixOverviews:new Map(),selected:null};
    state.modelData1={...modelData1,matrixCache:new Map()};state.modelData2={...modelData2,matrixCache:new Map()};
    // File handles, provider credentials and GPU resources are deliberately not portable.
    const uploads={};for(const [slot,upload] of Object.entries(uploadedStructureFiles)){uploads[slot]=upload?{...upload,file:null,files:await Promise.all(upload.files.map(async file=>({name:file.name,type:file.type,text:await file.text()})))}:null;}
    const stringFiles={};for(const [key,file] of Object.entries(selectedStringFiles))stringFiles[key]=file?{name:file.name,type:file.type,text:await file.text()}:null;
    return {binaryFiles,uploads,stringFiles,lightMode:document.body.classList.contains('light-mode'),timeline:encodeSessionGraph(globalThis.BuildTimeline?.state||{},binaryFiles),format:'StringScape session',version:2,savedAt:new Date().toISOString(),graph:encodeSessionGraph(state,binaryFiles),camera:physicsCamera?{position:physicsCamera.position.toArray(),quaternion:physicsCamera.quaternion.toArray(),up:physicsCamera.up.toArray(),zoom:physicsCamera.zoom,orthographic:!!physicsCamera.isOrthographicCamera}:null,dom:sessionDom(),scroll:[scrollX,scrollY]};
}
function* sessionModelFiles(){
    const final=generateSimulationMmCifString();if(final)yield ['final-model.cif',final];
    for(const [index,draft] of (multiReferenceBuild?.drafts||[]).entries()){
        const v=draft.viewState;if(!v)continue;
        const original={physicsNodes,physicsPositions,morphMatrixBlocks,physicsCenterOffset,modelData1,modelData2};let cif;
        try{
            physicsNodes=v.nodes;physicsPositions=v.positions;morphMatrixBlocks=v.blocks;physicsCenterOffset=v.offset;modelData1=v.modelData1;modelData2=v.modelData2;
            cif=generateSimulationMmCifString(null);
        }finally{({physicsNodes,physicsPositions,morphMatrixBlocks,physicsCenterOffset,modelData1,modelData2}=original);}
        if(cif)yield [`draft-${index+1}-${String(draft.id).replace(/[^a-z0-9_-]+/gi,'-')}.cif`,cif];
    }
}

async function restoreSession(session){
    if(session.format!=='StringScape session'||![1,2].includes(session.version)||!Array.isArray(session.dom))throw Error('This is not a supported StringScape session.');
    const state=decodeSessionGraph(session.graph,session.binaryFiles);
    if(!state||!Array.isArray(state.physicsNodes)||!state.modelData1||!state.modelData2)throw Error('The session is incomplete.');
    if(modelLoading||multiReferenceBuild?.busy)throw Error('Wait for the current model calculation to finish before loading.');
    for(const [slot,upload] of Object.entries(session.uploads||{})){if(!['reference','alphaFold'].includes(slot))continue;if(!upload){uploadedStructureFiles[slot]=null;continue;}const files=upload.files.map(f=>new File([f.text],f.name,{type:f.type}));uploadedStructureFiles[slot]={...upload,files,file:files[0]};}
    for(const [key,file] of Object.entries(session.stringFiles||{}))if(['sequence','aliases'].includes(key))selectedStringFiles[key]=file?new File([file.text],file.name,{type:file.type}):null;
    stopAnimation();resetNucleicExtensions();disposePhysicsSimulationWorker();cancelPendingSimulationRender();disposeStagedPreview();
    modelBuildAbortController?.abort();modelBuildGeneration++;readyModelGeneration=modelBuildGeneration;
    disposeAtomRepresentation();disposeCartoonRepresentation();disposeBasePairLines();disposeMembrane();disposePatternExtensions();disposePatternMarkers();
    if(rotationalSymmetryAxes){physicsScene.remove(rotationalSymmetryAxes);rotationalSymmetryAxes.traverse(o=>{o.dispose?.();o.geometry?.dispose();o.material?.dispose();});rotationalSymmetryAxes=null;}
    if(model1OverlayGroup){physicsScene.remove(model1OverlayGroup);disposeModel1Overlay(model1OverlayGroup);model1OverlayGroup=null;}
    if(selectionGlowMesh){physicsScene.remove(selectionGlowMesh);selectionGlowMesh.dispose?.();selectionGlowMesh.geometry.dispose();selectionGlowMesh.material.dispose();selectionGlowMesh=null;}
    if(springDisplay){physicsScene.remove(springDisplay);springDisplay.dispose?.();springDisplay.geometry.dispose();springDisplay.material.dispose();springDisplay=null;}
    for(const [key,binding] of Object.entries(sessionBindings))if(Object.hasOwn(state,key))binding.set(state[key]);
    if(physicsSprings.packed)physicsSprings=physicsSpringNetworkView(physicsSprings);
    for(const draft of multiReferenceBuild?.drafts||[])if(draft.viewState?.springs?.packed)draft.viewState.springs=physicsSpringNetworkView(draft.viewState.springs);
    physicsRunning=false;animationPlaying=false;animationPreparing=false;validationState.paeLoading=false;validationState.qmeanBusy=false;
    if(multiReferenceBuild){multiReferenceBuild.generation=modelBuildGeneration;multiReferenceBuild.busy=false;}
    for(const item of session.dom){
        const e=document.getElementById(item.id);if(!e||e.closest('#sessionPanel,#modellerAiDialog')||e.id.startsWith('modellerAi')||['SCRIPT','STYLE','IFRAME','LINK'].includes(e.tagName))continue;
        e.hidden=!!item.hidden;if(e.tagName==='DETAILS'&&item.open!==undefined)e.open=item.open;if(item.classes!==null)e.setAttribute('class',item.classes);
        // Restore styles from the local app only; imported CSS can initiate network requests.
        if(item.style&&!/url\s*\(|@import|expression/i.test(item.style))e.setAttribute('style',item.style);
        if(item.value!==undefined&&e.type!=='file'&&e.type!=='password')e.value=item.value;
        if(item.checked!==undefined)e.checked=item.checked;if(item.text!==undefined&&e.children.length===0)e.textContent=item.text;
        if(item.pressed!==null)e.setAttribute('aria-pressed',item.pressed);
    }
    if(instancedNodeMesh){physicsScene.remove(instancedNodeMesh);instancedNodeMesh.dispose?.();instancedNodeMesh.geometry.dispose();instancedNodeMesh.material.dispose();instancedNodeMesh=null;}
    while(backboneLinesGroup.children.length){const child=backboneLinesGroup.children[0];backboneLinesGroup.remove(child);child.dispose?.();child.geometry?.dispose();child.material?.dispose();}
    if(physicsNodes.length){
        instancedNodeMesh=createMolecularInstances(physicsNodes.length,.85,false,{shininess:50});physicsScene.add(instancedNodeMesh);
        addPhysicsPulse(instancedNodeMesh,physicsNodes.flatMap(node=>isModel2Only(node)?[1,1]:[0,0]),false,physicsNodes.map((_,i)=>i));
        selectionGlowMesh=createMolecularInstances(0,1,false,{dynamic:true,glow:true,color:0xffef59,opacity:.38});selectionGlowMesh.count=0;selectionGlowMesh.frustumCulled=false;selectionGlowMesh.renderOrder=15;physicsScene.add(selectionGlowMesh);refreshSelectedGlowIndices();
        createBackboneLineObjects();createBasePairLines();buildLocalGeometryRestraints();updateSpringDisplay();
        const savedNucleic=nucleicExtensionState;nucleicExtensionState=null;initializeNucleicExtensions();if(savedNucleic&&nucleicExtensionState){nucleicExtensionState.groups=savedNucleic.groups;nucleicExtensionState.curvesVisible=savedNucleic.curvesVisible;nucleicExtensionState.curvesUserSet=savedNucleic.curvesUserSet;nucleicExtensionState.dirty=true;}
        updatePhysicsNodeColors();setPhysicsRepresentation(physicsRepresentation);syncVisualPhysicsMeshes();updatePhysicsSequences();renderPhysicsChainToggles();
    }
    const savedChains=[modelData1.currentChain,modelData2.currentChain];populateChainSelectors();[modelData1.currentChain,modelData2.currentChain]=savedChains;document.getElementById('PDBChainSelect').value=savedChains[0];document.getElementById('AFChainSelect').value=savedChains[1];renderChainLegends();renderReferenceInfluenceControls();renderStagedBuildControls();renderAnimationSelector();renderAnimationTimeline();renderValidationReport(true);
    drawIndividualMatrices();drawDifferenceMatrix();drawMorphMatrix();
    if(inferredMembrane)renderMembraneGeometry(inferredMembrane);renderSecondMembrane(performance.now());
    if(multiReferenceBuild?.view&&!stagedLiveView())selectStagedModel(multiReferenceBuild.view);
    setLightMode(!!session.lightMode);renderReferenceSearchResults();renderAboutProteinComplex();renderChainMappingReport();renderReferenceComparison();if(stringMatchReview?.response)renderStringMatchResults(stringMatchReview.response.matches);
    if(session.timeline&&globalThis.BuildTimeline){Object.assign(BuildTimeline.state,decodeSessionGraph(session.timeline,session.binaryFiles));BuildTimeline.render();}
    physicsRunning=state.physicsRunning;physicsMeshesDirty=true;matrixDataVersion++;for(const cache of Object.values(offscreenCaches)){cache.dirty=true;cache.overviewKey=null;cache.viewportKey=null;}updateBuildButtonState();
    if(!document.getElementById('detailsPanels').classList.contains('hidden'))await ensureDetailMolstarStructures();
    if(simulationAutoRendered&&physicsNodes.length)await renderCurrentSimulation();
    if(session.camera&&physicsCamera){if(!!physicsCamera.isOrthographicCamera!==!!session.camera.orthographic)togglePhysicsProjection();physicsCamera.position.fromArray(session.camera.position);physicsCamera.quaternion.fromArray(session.camera.quaternion);physicsCamera.up.fromArray(session.camera.up);physicsCamera.zoom=session.camera.zoom;physicsCamera.updateProjectionMatrix();}

    // Convert legacy projection pan to a physical translation at the saved focus depth.
    if(state.physicsPanOffset&&physicsRenderer&&physicsCamera){
        const canvas=physicsRenderer.domElement;
        panPhysicsCamera(-(Number(state.physicsPanOffset.x)||0)*canvas.clientWidth,-(Number(state.physicsPanOffset.y)||0)*canvas.clientHeight);
    }
    window.scrollTo(...(session.scroll||[0,0]));
}
(function initializeSessions(){
    const el=id=>document.getElementById('session'+id);let folder=null,busy=false;
    const status=text=>el('Status').textContent=text;
    async function run(task){if(busy)return;busy=true;try{await task();}catch(error){if(error.name!=='AbortError')status(error.message);}finally{busy=false;el('Save').disabled=!folder;}}
    async function list(){el('List').replaceChildren();for await(const [name,handle] of folder.entries()){
        if(handle.kind!=='directory')continue;
        try{await handle.getFileHandle('session.json');}catch{continue;}
        const button=document.createElement('button');button.type='button';button.className='model-download-button';button.textContent='Open '+name;
        button.addEventListener('click',()=>run(async()=>{const file=await (await handle.getFileHandle('session.json')).getFile();const session=JSON.parse(await file.text());session.binaryFiles={};for(const record of [...session.graph.records,...(session.timeline?.records||[])])if(record.type==='Binary'&&/^buffer-\d+\.bin$/.test(record.name))session.binaryFiles[record.name]=new Uint8Array(await (await (await handle.getFileHandle(record.name)).getFile()).arrayBuffer());await restoreSession(session);status('Session opened: '+name);}));el('List').append(button);
    }}
    el('Folder').addEventListener('click',()=>run(async()=>{
        if(!window.showDirectoryPicker){status('Folder connection requires a browser supporting local folder access (such as Chrome or Edge). Download and upload are available.');return;}
        folder=await window.showDirectoryPicker({mode:'readwrite'});el('Folder').textContent='Connected: '+folder.name;status('Folder connected.');await list();
    }));
    const bundle=async()=>{const {binaryFiles,...session}=await sessionCapture(),files=(function*(){yield ['session.json',JSON.stringify(session)];yield* Object.entries(binaryFiles);yield* sessionModelFiles();})(),label=(modelData1.pdbId||document.getElementById('referenceSearchInput').value||'empty-session').replace(/[^a-z0-9_-]+/gi,'-').slice(0,65),name=`StringScape_Homology_modeller-${label}-${new Date().toISOString().replace(/[:.]/g,'-')}`;return {files,name};};
    el('Save').addEventListener('click',()=>run(async()=>{if(!folder)return;const {files,name}=await bundle(),directory=await folder.getDirectoryHandle(name,{create:true});for(const [filename,data] of files){const writable=await (await directory.getFileHandle(filename,{create:true})).createWritable();try{await writable.write(data);await writable.close();}catch(error){await writable.abort();throw error;}}status('Session saved: '+name);await list();}));
    el('Download').addEventListener('click',()=>run(async()=>{const {files,name}=await bundle(),url=URL.createObjectURL(sessionZip(files)),a=document.createElement('a');a.href=url;a.download=name+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Session downloaded with model mmCIF files.');}));
    el('Upload').addEventListener('click',()=>el('File').click());el('File').addEventListener('change',()=>run(async()=>{const file=el('File').files[0];el('File').value='';if(!file)return;await restoreSession(await readSessionFile(file));status('Session opened: '+file.name);}));
})();
