'use strict';
// Runs in the modeller's same-origin frame and reuses its parser and scoring code.
function benchmarkResidueKey(chain,atom){return JSON.stringify([chain,atom.resSeq,atom.sourceAtoms?.[0]?.insertionCode||'']);}
function benchmarkParse(text){return /^\s*data_/i.test(text)?parseMmCifCalpha(text,true):parsePDBCalpha(text,true);}
function benchmarkPrepareReference({text,distance,seed}){
    const parsed=benchmarkParse(text),nodes=[],atoms=[],chainResidues=new Map(),blocks=new Map();
    for(const [chain,residues] of Object.entries(parsed.chains))for(const residue of residues){
        const type=residue.entityType||'protein',water=type==='other'&&/^(HOH|WAT|H2O|DOD)$/i.test(residue.resName);
        if(!blocks.has(chain))blocks.set(chain,blocks.size);
        if(type==='protein'&&!chainResidues.has(chain))chainResidues.set(chain,[]);
        const position=type==='protein'?chainResidues.get(chain).length:nodes.length;
        const index=nodes.length;nodes.push({block:blocks.get(chain),type,position,x:residue.x,y:residue.y,z:residue.z,water,chain,residue});
        if(type==='protein')chainResidues.get(chain).push(index);
        for(const atom of residue.sourceAtoms||[])if(!water&&!['H','D'].includes(String(atom.element||'').toUpperCase()))atoms.push({node:index,x:atom.x,y:atom.y,z:atom.z});
    }
    if(!chainResidues.size)throw Error('Reference contains no protein Cα residues.');
    const patches=detectBindingPatches(nodes,atoms),selected=new Set();
    for(const patch of patches)for(const [a,b] of patch.edges){if(nodes[a].type==='protein')selected.add(a);if(nodes[b].type==='protein')selected.add(b);}
    const fallback=selected.size===0;let state=seed>>>0;const random=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
    if(fallback)for(const indices of chainResidues.values()){const size=Math.min(10,indices.length),start=Math.floor(random()*(indices.length-size+1));for(const index of indices.slice(start,start+size))selected.add(index);}
    const keep=new Set(selected),n=Math.max(0,Math.floor(Number(distance)||0));
    for(const indices of chainResidues.values())indices.forEach((index,i)=>{if(selected.has(index))for(let j=Math.max(0,i-n);j<=Math.min(indices.length-1,i+n);j++)keep.add(indices[j]);});
    const fields=['group_PDB','id','type_symbol','label_atom_id','label_alt_id','label_comp_id','label_asym_id','auth_seq_id','pdbx_PDB_ins_code','Cartn_x','Cartn_y','Cartn_z','occupancy','B_iso_or_equiv','pdbx_PDB_model_num'];
    const q=value=>{const s=String(value??'?');return /^[A-Za-z0-9_.+\-]+$/.test(s)?s:`'${s.replace(/'/g,'')}'`;};
    const lines=['data_benchmark','#','loop_',...fields.map(f=>`_atom_site.${f}`)];let serial=0;
    for(let i=0;i<nodes.length;i++){const {chain,residue,type}=nodes[i];if(type==='protein'&&!keep.has(i))continue;for(const atom of residue.sourceAtoms||[])lines.push([atom.groupPdb||'ATOM',++serial,atom.element||'C',q(atom.atomName),'.',q(atom.resName),q(chain),atom.resSeq,q(atom.insertionCode||'?'),atom.x,atom.y,atom.z,atom.occupancy??1,atom.bFactor??0,1].join(' '));}
    const preserved=[...keep].map(i=>benchmarkResidueKey(nodes[i].chain,nodes[i].residue));
    const aliases={};
    if(/^\s*data_/i.test(text)){
        const tokens=cifTokens(text);let next=tokens.next();
        while(!next.done){if(next.value!=='loop_'){next=tokens.next();continue;}const fields=[];next=tokens.next();while(!next.done&&next.value.startsWith('_')){fields.push(next.value);next=tokens.next();}if(!fields[0]?.startsWith('_atom_site.'))continue;const label=fields.indexOf('_atom_site.label_asym_id'),auth=fields.indexOf('_atom_site.auth_asym_id');while(!next.done&&!/^(?:_|loop_|data_|save_|stop_)/.test(next.value)){const row=[];for(let j=0;j<fields.length&&!next.done;j++){row.push(next.value);next=tokens.next();}if(row.length!==fields.length)break;if(label>=0&&auth>=0&&row[label]&&row[auth])aliases[row[label]]=row[auth];}break;}
    }
    return {aliases,masked:lines.join('\n')+'\n#\n',preserved,fallback,proteinResidues:[...chainResidues.values()].reduce((a,b)=>a+b.length,0),kept:keep.size,chains:[...chainResidues.keys()]};
}
function benchmarkCompareFullReference(text,preserved){
    const parsed=benchmarkParse(text),kept=new Set(preserved),scores=calculateModelConfidence(),paeScores=calculateResiduePae(),rows=[],matchedNodes=new Set(),matchedRows=new Map(),metricChains=[];
    const predictionPositions=new Map(),ordinals=new Map();physicsNodes.forEach((node,index)=>{const block=node.blockIdx,ordinal=(ordinals.get(block)||0)+1;ordinals.set(block,ordinal);predictionPositions.set(index,{chain:node.res.c1||node.res.c2||'A',residue:ordinal});});
    const entries=simulationAtomEntries(),coordinates=simulationAtomCoordinates(entries,false),predictedAtoms=new Map();
    for(let i=0;i<entries.length;i++){const entry=entries[i],name=String(entry.source?.atomName||'').toUpperCase();if(!['N','CA','C'].includes(name))continue;if(!predictedAtoms.has(entry.nodeIndex))predictedAtoms.set(entry.nodeIndex,{});const p=coordinates[i];if(p&&[p.x,p.y,p.z].every(Number.isFinite))predictedAtoms.get(entry.nodeIndex)[name]={x:p.x+physicsCenterOffset.cx,y:p.y+physicsCenterOffset.cy,z:p.z+physicsCenterOffset.cz};}
    const groups=new Map();physicsNodes.forEach((node,index)=>{if(node.res.entityType!=='protein'||!node.res.c1||node.idx2===null)return;const key=`${node.blockIdx}\0${node.res.c1}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({node,index});});
    for(const [chain,reference] of Object.entries(parsed.chains)){
        if(reference[0]?.entityType!=='protein')continue;
        const candidates=[...groups.values()].filter(g=>g[0].node.res.c1===chain);
        // A reference chain must map to exactly one model block; ambiguous matches are left unmatched.
        const group=candidates.length===1?candidates[0]:null;
        const byIndex=new Map(group?.map(item=>[item.node.idx2,item])||[]),target=group?.[0]?.node.res.atoms2;
        const alignment=target?.length?referenceAlignment(reference,target):null;
        const lookup=new Map();for(const pair of alignment?.alignedPairs||[])if(pair.idx1!==null&&pair.idx2!==null&&reference[pair.idx1]?.singleChar===target[pair.idx2]?.singleChar&&byIndex.has(pair.idx2))lookup.set(pair.idx1,byIndex.get(pair.idx2));
        const metricChain=[];metricChains.push(metricChain);
        reference.forEach((atom,i)=>{const item=lookup.get(i),node=item?.node,af=node&&validationAtom(node,'af'),annotation=af&&uniProtAnnotationForAtom(af),position=Number(af?.afResSeq??af?.resSeq);let ordered=null;
            if(annotation&&Number.isInteger(position))ordered=!annotation.features.some(f=>f.type==='Region'&&String(f.description||'').trim().toLowerCase()==='disordered'&&position>=f.start&&position<=f.end);
            const xyz=node?[node.x+physicsCenterOffset.cx,node.y+physicsCenterOffset.cy,node.z+physicsCenterOffset.cz]:null;
            const d=xyz?Math.hypot(xyz[0]-atom.x,xyz[1]-atom.y,xyz[2]-atom.z):null;
            if(item)matchedNodes.add(item.index);
            const referenceBackbone={};for(const source of atom.sourceAtoms||[])if(['N','CA','C'].includes(source.atomName))referenceBackbone[source.atomName]={x:source.x,y:source.y,z:source.z};
            const metrics={reference:referenceBackbone,predicted:item?(predictedAtoms.get(item.index)||{}):{}};metricChain.push(metrics);
            rows.push({metrics,accession:af?.sourcePdbId||null,plddt:af?.plddt,pae:item?paeScores[item.index]:null,predictionPosition:item?predictionPositions.get(item.index):null,chain,residue:`${atom.resName} ${atom.resSeq}${atom.sourceAtoms?.[0]?.insertionCode||''}`,distance:d,confidence:item?scores.scores[item.index]:null,aligned:node?Boolean(node.usedInAlignment):null,ordered,kept:kept.has(benchmarkResidueKey(chain,atom)),locked:node?Boolean(node.referenceLockTarget):null});
            if(item)matchedRows.set(item.index,rows[rows.length-1]);
        });
    }
    const predictionRows=physicsNodes.flatMap((node,index)=>{
        if(node.res.entityType!=='protein'||node.idx2===null)return [];
        const atom=validationAtom(node,'af'),annotation=atom&&uniProtAnnotationForAtom(atom),position=Number(atom?.afResSeq??atom?.resSeq),reference=matchedRows.get(index);let ordered=null;
        if(annotation&&Number.isInteger(position))ordered=!annotation.features.some(feature=>feature.type==='Region'&&String(feature.description||'').trim().toLowerCase()==='disordered'&&position>=feature.start&&position<=feature.end);
        return [{predictionPosition:predictionPositions.get(index),accession:atom?.sourcePdbId||null,plddt:atom?.plddt,pae:paeScores[index],confidence:scores.scores[index],aligned:Boolean(node.usedInAlignment),locked:Boolean(node.referenceLockTarget),ordered,distance:reference?.distance??null}];
    });
    const localMetrics=benchmarkBackboneMetrics(metricChains);
    for(const row of rows){const m=row.metrics;Object.assign(row,{phiDifference:m.phiDifference,psiDifference:m.psiDifference,torsionDifference:m.torsionDifference,lddt:m.lddt,lddtEligible:m.lddtEligible,lddtCompared:m.lddtCompared,lddtMissing:m.lddtMissing});delete row.metrics;}
    const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
    const measured=rows.filter(r=>Number.isFinite(r.distance)),removed=measured.filter(r=>!r.kept),rmsd=values=>values.length?Math.sqrt(mean(values.map(r=>r.distance*r.distance))):null;
    const unaligned=scores.unalignedIndices,ordered=physicsNodes.map((node,i)=>{if(!unaligned.has(i)||!Number.isFinite(scores.scores[i]))return null;const a=validationAtom(node,'af'),ann=uniProtAnnotationForAtom(a),pos=Number(a?.afResSeq??a?.resSeq);if(!ann||!Number.isInteger(pos))return undefined;return ann.features.some(f=>f.type==='Region'&&String(f.description||'').trim().toLowerCase()==='disordered'&&pos>=f.start&&pos<=f.end)?null:scores.scores[i];});
    const coverage=(()=>{const groups=new Map();for(const [chain,atoms] of Object.entries(modelData2.chains))if(atoms[0]?.entityType==='protein')groups.set(chain,{length:atoms.length,covered:new Set()});for(const r of alignmentResults){if(r.entityType!=='protein'||r.referenceOnly||!r.c2)continue;if(!groups.has(r.c2))groups.set(r.c2,{length:r.atoms2.length,covered:new Set()});for(const pair of r.alignedPairs)if(pair.idx1!==null&&pair.idx2!==null)groups.get(r.c2).covered.add(pair.idx2);}const all=[...groups.values()],total=all.reduce((s,g)=>s+g.length,0);return total?100*all.reduce((s,g)=>s+g.covered.size,0)/total:null;})();
    return {rows,predictionRows,localMetrics,rmsd:rmsd(measured),removedRmsd:rmsd(removed),maxKeptDisplacement:measured.some(r=>r.kept)?Math.max(...measured.filter(r=>r.kept).map(r=>r.distance)):null,compared:measured.length,total:rows.length,unmatched:rows.length-measured.length,coverage,membrane:validationMembraneDetectionConfidence(),overall:scores.overall,unaligned:scores.unalignedOverall,ordered:ordered.includes(undefined)?null:mean(ordered.filter(Number.isFinite)),unmatchedPrediction:physicsNodes.filter((n,i)=>n.res.entityType==='protein'&&!matchedNodes.has(i)).length};
}
