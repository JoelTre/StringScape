// Compact, coordinate-free chain-merging reports and sequence diagrams.
(function(root){
    'use strict';
    const palette=['#38bdf8','#fb923c','#a78bfa','#34d399','#f472b6','#facc15','#22d3ee','#f87171'];
    let datasets=new Map(),annotations=new Map(),selectedChains=new Set(),onSelect=null;
    const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
    function createData(results,{modelChains={},referenceChains={},reference='',accessionForId=id=>id}={}){
        const proteins=new Map();
        const ensure=(modelId,atoms)=>{
            if(proteins.has(modelId))return proteins.get(modelId);
            const accession=accessionForId(atoms[0]?.sourcePdbId||atoms[0]?.afSourcePdbId||modelId)||null;
            const protein={key:modelId,modelId,accession,length:atoms.length,sequence:atoms.map(atom=>atom.singleChar||'X').join(''),groups:[]};proteins.set(modelId,protein);return protein;
        };
        for(const [id,atoms] of Object.entries(modelChains))if(atoms.length&&(atoms[0].entityType||'protein')==='protein')ensure(id,atoms);
        for(const result of results){
            if(result.referenceOnly||!result.c2||(result.entityType||'protein')!=='protein')continue;
            const protein=ensure(result.c2,result.atoms2||modelChains[result.c2]||[]);
            let fragments=result.mergeFragments;
            if(!fragments){
                let offset=0;
                fragments=(result.sourceChains||[result.c1]).map(chainId=>{
                    const length=referenceChains[chainId]?.length??result.atoms1?.length??0;
                    const pairs=result.alignedPairs.filter(p=>p.idx1!==null&&p.idx2!==null&&p.idx1>=offset&&p.idx1<offset+length);
                    offset+=length;
                    const positions=[...new Set(pairs.map(p=>p.idx2+1))].sort((a,b)=>a-b),segments=[];
                    for(const position of positions){const last=segments.at(-1);if(last&&position===last.end+1)last.end=position;else segments.push({start:position,end:position});}
                    return {chainId,referenceLength:length,alignedResidues:pairs.length,targetStart:positions[0]??null,targetEnd:positions.at(-1)??null,segments};
                });
            }
            protein.groups.push({chainId:result.c1,modelId:result.c2,reference,merged:fragments.length>1,
                approximate:!!result.mergeAssignmentApproximate,fragments:fragments.map(f=>({...f})),
                possibleJoins:(result.mergeCandidates||[]).map(({from,to,distance,available,overlap,gapResidues})=>({from,to,distance,available,overlap,gapResidues})),
                selectedJoins:(result.mergeConnections||[]).map(({from,to,distance,available,overlap,gapResidues})=>({from,to,distance,available,overlap,gapResidues}))});
        }
        return {reference,proteins:[...proteins.values()]};
    }
    function snapshot(){return [...datasets.values()];}
    function report(){
        const proteins=new Map();
        for(const dataset of datasets.values())for(const protein of dataset.proteins){
            // Distinct model sequences/lengths retain their own coordinate axes.
            const key=JSON.stringify([protein.accession||protein.key,protein.sequence]);
            if(!proteins.has(key))proteins.set(key,{...protein,modelIds:[],groups:[]});
            const merged=proteins.get(key);
            if(!merged.modelIds.includes(protein.modelId))merged.modelIds.push(protein.modelId);
            merged.groups.push(...protein.groups);
        }
        return {format:'StringScape chain-merging',version:1,coordinates:'1-based inclusive AlphaFold sequence positions',
            policy:{maximumFragments:5,maximumOverlapResidues:3,objective:'Maximise joins, then minimise summed reference endpoint distance',distanceUnits:'angstrom'},
            proteins:[...proteins.values()].map(protein=>({...protein,name:annotations.get(protein.accession)?.name||'Protein',hasMerges:protein.groups.some(g=>g.merged)}))
                .sort((a,b)=>Number(b.hasMerges)-Number(a.hasMerges)||a.name.localeCompare(b.name)||String(a.accession||a.modelId).localeCompare(String(b.accession||b.modelId)))};
    }
    const svgElement=(tag,attributes={},text)=>{
        const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
        for(const [key,value] of Object.entries(attributes))e.setAttribute(key,String(value));
        if(text!==undefined)e.textContent=text;return e;
    };
    function diagram(protein){
        const rows=protein.groups.filter(g=>g.fragments.some(f=>f.targetStart!==null));
        const axisY=28,rowSpacing=22;
        const width=900,height=axisY+rows.length*rowSpacing+18,left=90,right=864,span=right-left;
        const svg=svgElement('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${protein.name}, ${protein.accession||protein.modelId}: reference fragments aligned to ${protein.length} AlphaFold residues`,class:'chain-merging-svg'});
        svg.append(svgElement('title',{},`${protein.name} · ${protein.accession||protein.modelId}`));
        svg.append(svgElement('line',{x1:left,x2:right,y1:axisY,y2:axisY,class:'chain-merging-axis','stroke-width':3}));
        svg.append(svgElement('text',{x:left-12,y:axisY+4,'text-anchor':'end',class:'chain-merging-axis-label'},'AlphaFold'));
        const ticks=[...new Set([1,...[.25,.5,.75].map(f=>Math.round(1+(protein.length-1)*f)),protein.length])];
        for(const tick of ticks){const x=left+(tick-1)/Math.max(1,protein.length-1)*span;
            svg.append(svgElement('line',{x1:x,x2:x,y1:axisY-5,y2:axisY+5,class:'chain-merging-axis'}));
            svg.append(svgElement('text',{x,y:axisY-12,'text-anchor':'middle',class:'chain-merging-tick'},String(tick)));
        }
        let colour=0;
        rows.forEach((group,index)=>{
            const y=axisY+(index+1)*rowSpacing;
            const stroke=group.merged?(palette[colour]||`hsl(${(colour*137.508)%360} 78% 65%)`):'#94a3b8';
            if(group.merged)colour++;
            const lane=svgElement('g',{'data-chain-group':group.chainId,'data-merged':group.merged,class:'chain-merging-lane',role:'button',tabindex:0,'aria-label':`Select chain ${group.chainId} in the 3D viewer`,'aria-pressed':selectedChains.has(group.chainId)});
            if(selectedChains.has(group.chainId))lane.classList?.add('selected');
            const select=event=>{if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;if(event.type==='keydown')event.preventDefault();onSelect?.(group.chainId,!!event.shiftKey);};
            lane.addEventListener('click',select);lane.addEventListener('keydown',select);
            const fragments=group.fragments.filter(f=>f.targetStart!==null).sort((a,b)=>a.targetStart-b.targetStart);
            if(group.merged&&fragments.length>1)lane.append(svgElement('line',{
                x1:left+(fragments[0].targetStart-1)/Math.max(1,protein.length)*span,
                x2:left+fragments.at(-1).targetEnd/Math.max(1,protein.length)*span,
                y1:y,y2:y,stroke,'stroke-width':2,'stroke-dasharray':'4 5',opacity:.5}));
            for(const fragment of fragments){
                const x1=left+(fragment.targetStart-1)/Math.max(1,protein.length)*span,x2=left+fragment.targetEnd/Math.max(1,protein.length)*span;
                const line=svgElement('line',{x1,x2,y1:y,y2:y,stroke,'stroke-width':5,opacity:.5,'data-fragment-gap':fragment.chainId});
                line.append(svgElement('title',{},`${group.reference?group.reference+' · ':''}Chain ${fragment.chainId}: residues ${fragment.targetStart}–${fragment.targetEnd}; ${group.merged?'merged as '+group.chainId:'not merged'}`));
                lane.append(line);
                for(const segment of fragment.segments||[{start:fragment.targetStart,end:fragment.targetEnd}])lane.append(svgElement('line',{x1:left+(segment.start-1)/Math.max(1,protein.length)*span,x2:left+segment.end/Math.max(1,protein.length)*span,y1:y,y2:y,stroke,'stroke-width':5,'data-fragment':fragment.chainId}));
                const label=svgElement('text',{x:(x1+x2)/2,y,'text-anchor':'middle','dominant-baseline':'central',fill:stroke,class:'chain-merging-fragment-label'},String(fragment.chainId).split(':').at(-1).trim());
                label.append(svgElement('title',{},`${group.reference} · Chain ${fragment.chainId}`));lane.append(label);
            }
            svg.append(lane);
        });
        return svg;
    }
    function render(){
        if(typeof document==='undefined')return;
        const host=document.getElementById('chainMergingDiagrams'),button=document.getElementById('chainMergingDownload');
        if(!host||!button)return;
        const data=report();host.replaceChildren();button.disabled=!data.proteins.length;
        const summary=document.getElementById('chainMergingSummary');
        if(summary){summary.replaceChildren();summary.append(element('p','','Reference structures may split one protein into separate chains or fragments. The app joins compatible fragments that align to the same AlphaFold protein so they can be modelled as one chain, while preserving the reference arrangement.'));
            const merges=data.proteins.flatMap(protein=>protein.groups.filter(group=>group.merged).map(group=>({protein,group})));
            if(!merges.length)summary.append(element('p','',data.proteins.length?'No reference chains were merged.':'Build a model to see merged chains.'));
            else {const list=element('ul');for(const {protein,group} of merges)list.append(element('li','',`${protein.name}${protein.accession?' (UniProt '+protein.accession+')':''}: ${group.reference?group.reference+' · ':''}chains ${group.fragments.map(f=>f.chainId).join(' + ')} → ${group.chainId}`));summary.append(list);}}
        if(!data.proteins.length){host.append(element('p','chain-merging-empty','Build a model to see reference fragments aligned to each AlphaFold sequence.'));return;}
        for(const protein of data.proteins){
            const card=element('article','chain-merging-protein');
            card.append(element('h4','',`${protein.name} · ${protein.accession?'UniProt '+protein.accession:protein.modelId+' (UniProt ID unavailable)'}`));
            const fragmentCount=protein.groups.reduce((sum,g)=>sum+g.fragments.length,0),mergedCount=protein.groups.filter(g=>g.merged).length;
            const references=[...new Set(protein.groups.map(g=>g.reference).filter(Boolean))];
            card.append(element('p','chain-merging-caption',`${protein.length} residues · ${fragmentCount} reference fragments · ${mergedCount} merged groups${references.length?' · Reference '+references.join(', '):''}`));
            const viewport=element('div','chain-merging-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Scrollable sequence diagram');viewport.append(diagram(protein));card.append(viewport);
            const unaligned=protein.groups.flatMap(g=>g.fragments.filter(f=>f.targetStart===null).map(f=>f.chainId));
            if(unaligned.length)card.append(element('p','chain-merging-caption',`No aligned sequence positions: ${unaligned.join(', ')}.`));
            if(!fragmentCount)card.append(element('p','chain-merging-caption','No reference fragments align to this AlphaFold chain.'));
            if(protein.groups.some(g=>g.approximate))card.append(element('p','chain-merging-caption','The five-fragment limit required a bounded assignment; the global optimum is not guaranteed.'));
            host.append(card);
        }
    }
    function update(results,context){const data=createData(results,context);datasets.set(data.reference,data);render();}
    function setAnnotations(value){annotations=value;render();}
    function restore(value){datasets=new Map((value||[]).map(data=>[data.reference,data]));render();}
    function clear(){datasets.clear();annotations=new Map();selectedChains.clear();render();}
    function setSelection(chains){selectedChains=new Set(chains);if(typeof document==='undefined')return;document.querySelectorAll?.('.chain-merging-lane').forEach(lane=>{const selected=selectedChains.has(lane.getAttribute('data-chain-group'));lane.classList.toggle('selected',selected);lane.setAttribute('aria-pressed',String(selected));});}
    function setSelectHandler(handler){onSelect=handler;}
    function download(){
        const data=report();if(!data.proteins.length)return;
        const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
        const link=element('a');link.href=url;link.download='stringscape-chain-merging.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    root.ChainMergingReport={createData,update,report,snapshot,restore,setAnnotations,clear,render,download,setSelection,setSelectHandler};
    if(typeof document!=='undefined')document.getElementById('chainMergingDownload')?.addEventListener('click',download);
})(globalThis);
