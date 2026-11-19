(() => {
    const cyan='#2eccbf', blue='#60a5fa', muted='#8fa8bd', white='#e8f3fa', gold='#fbbf24';
    const txt=(x,y,s,color=white,size=13,anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="system-ui,sans-serif" text-anchor="${anchor}">${s}</text>`;
    const rect=(x,y,w,h,fill,rx=7,opacity=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}"/>`;
    const line=(x1,y1,x2,y2,color=muted,width=2,opacity=1)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
    const structure=(x,y,color,scale=1,opacity=1)=>`<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}"><path d="M0 38 C12 6 34 7 39 27 S58 51 68 25 S94 6 101 29 S118 53 132 30" fill="none" stroke="#071a2c" stroke-width="15" stroke-linecap="round"/><path d="M0 38 C12 6 34 7 39 27 S58 51 68 25 S94 6 101 29 S118 53 132 30" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/></g>`;
    // One shared pair of folded backbone paths represents both the PDB
    // chains and their predictions; only the PDB's first chain has a gap.
    const firstPart='M38 102 C29 95 31 82 42 81 C53 80 54 94 45 95 C37 97 40 85 48 85 C59 85 57 101 68 103 C77 105 80 92 73 89 C67 86 61 92 65 97 C68 102 76 104 81 99 C89 91 84 81 94 80';
    const gapPart='C100 77 106 79 110 83';
    const lastPart='C116 89 111 95 105 97 C98 99 91 93 99 88 C108 83 119 93 116 103 C112 111 104 115 96 115 C87 115 83 119 79 123 C76 125 73 124 70 121';
    const second='M39 141 C31 132 37 121 47 123 C57 125 54 139 46 139 C38 139 41 129 49 130 C58 131 59 145 69 147 C80 150 85 141 78 136 C71 131 64 137 69 142 C75 149 89 143 90 133 C91 125 84 121 92 119 C101 117 110 121 107 130 C104 139 94 141 96 149 C98 159 113 157 117 146 C120 137 113 131 108 133';
    // Predicted folds resemble, but do not exactly reproduce, the reference.
    const predictedFirst='M38 102 C23 100 30 77 43 82 C60 87 51 100 42 96 C36 92 43 80 50 87 C63 91 57 105 70 102 C82 98 80 87 71 86 C63 83 59 94 65 100 C71 106 79 104 84 98 C92 90 87 80 96 77';
    const predictedLast='C119 87 114 98 107 100 C98 103 89 95 101 89 C112 83 124 96 117 106 C111 114 103 119 94 116 C84 113 80 121 77 124 C74 126 71 125 69 122';
    const predictedGap='C102 74 108 77 112 81';
    const fittedFirst=predictedFirst.replace(/96 77$/, '94 80');
    const predictedSecond='M39 141 C30 133 38 120 48 124 C58 128 54 140 46 138 C39 136 42 129 50 131 C60 134 60 146 70 148 C81 151 87 141 79 135 C72 130 65 138 70 143 C77 150 91 143 91 133 C91 124 85 120 93 118 C102 116 111 123 107 131 C102 140 95 142 97 150 C100 160 113 156 116 145 C119 137 112 130 108 133';
    const domain=(d,color)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    // The paired paths have the same commands and can be interpolated point by point.
    const blendPath=(from,to,t)=>{const values=to.match(/-?\d+(?:\.\d+)?/g).map(Number);let i=0;return from.replace(/-?\d+(?:\.\d+)?/g,n=>String(Number(n)+(values[i++]-Number(n))*t));};
    // Shared two-chain shapes for the multi-reference draft diagrams.
    window.renderDraftComplexes=(phase,t,different=false)=>{
        let aFirst=firstPart,aLast=lastPart,aSecond=second,bFirst=fittedFirst,bLast=predictedLast,bSecond=predictedSecond;
        if(phase==='merge'){
            aFirst=blendPath(firstPart,fittedFirst,.5*t);bFirst=blendPath(fittedFirst,firstPart,.5*t);
            aLast=blendPath(lastPart,predictedLast,.5*t);bLast=blendPath(predictedLast,lastPart,.5*t);
            aSecond=blendPath(second,predictedSecond,.5*t);bSecond=blendPath(predictedSecond,second,.5*t);
        }
        const drawComplex=(first,last,other,opacity,angle=0)=>`<g opacity="${opacity}">`+domain(first+gapPart+last,cyan)+`<g transform="rotate(${angle} 80 130)">`+domain(other,blue)+'</g></g>';
        const separation=phase==='align'?170*(1-t):0,xA=172-separation/2,xB=xA+separation;
        return `<g transform="translate(${xA} -65) scale(1.35)">${drawComplex(aFirst,aLast,aSecond,.48)}</g><g transform="translate(${xB} -65) scale(1.35)">${drawComplex(bFirst,bLast,bSecond,.95,different?14:0)}</g>`;
    };
    // Illustrative states share a topology, but retain distinct coordinates.
    window.renderConformationComplex=t=>{
        const first=blendPath(firstPart,fittedFirst,t),last=blendPath(lastPart,predictedLast,t),other=blendPath(second,predictedSecond,t);
        return `<g transform="translate(180 -65) scale(1.35)">`+domain(first+gapPart+last,cyan)+`<g transform="rotate(${14*t} 80 130)">`+domain(other,blue)+'</g></g>';
    };
    window.renderBridgeDiagram=(phase,t)=>{
        // The fragments and prediction reuse the same paths as the single-PDB walkthrough.
        const scale=1.2, ax=55, bx=300, startX=185, top=-55, startY=-5;
        const refA=`<g class="bridge-reference-a" transform="translate(${ax} ${top}) scale(${scale})">`+domain(firstPart,cyan)+'</g>';
        const refB=(x,y,rotation=0)=>`<g class="bridge-reference-b" transform="translate(${x} ${y}) scale(${scale}) rotate(${rotation} 110 96)">`+domain('M110 83 '+lastPart,cyan)+'</g>';
        const prediction=(x,y,rotation=0)=>`<g class="bridge-prediction" transform="translate(${x} ${y}) scale(${scale}) rotate(${rotation} 80 105)">`+domain(predictedFirst+predictedGap+predictedLast,blue)+'</g>';
        const labels=txt(110,19,'Reference A',cyan,11,'middle')+txt(435,19,'Reference B',cyan,11,'middle');
        if(phase==='disconnected'){
            const links=`<g opacity="${t}"><path d="M126 69 L258 119 M166 52 L295 101 M432 45 L317 98 M410 81 L306 128" fill="none" stroke="${muted}" stroke-width="1.5" stroke-dasharray="4 4"/></g>`;
            return labels+refA+refB(bx,top)+prediction(startX,startY)+links+txt(280,159,'AlphaFold chain',blue,11,'middle');
        }
        const fit=Math.min(1,t*2),place=Math.max(0,(t-.5)*2),px=startX+(ax-startX)*fit,py=startY+(top-startY)*fit,bPosition=bx+(ax-bx)*place;
        return labels+prediction(px,py,18*(1-fit))+refA+refB(bPosition,top,-18*(1-place))+txt(280,165,t<.5?'Fit the AlphaFold chain to A':'Place reference B using the prediction',muted,11,'middle');
    };
    function draw(index,t){
        let a='', caption='',on=t>=.5;
        if(index===0){
            const mapped=Math.max(0,Math.min(1,(t-.15)/.38)), fetched=Math.max(0,Math.min(1,(t-.56)/.38));
            const arrow=(x1,x2,y,opacity)=>`<g opacity="${opacity}"><path d="M${x1} ${y} H${x2} M${x2-7} ${y-5} L${x2} ${y} L${x2-7} ${y+5}" fill="none" stroke="${muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
            a=`<defs><filter id="sifts-soften"><feComponentTransfer><feFuncR type="gamma" amplitude="1" exponent=".58" offset="0"/><feFuncG type="gamma" amplitude="1" exponent=".58" offset="0"/><feFuncB type="gamma" amplitude="1" exponent=".58" offset="0"/></feComponentTransfer></filter></defs><image href="RCSB_PDB_demo/media/asset-16.png" x="12" y="11" width="132" height="27" preserveAspectRatio="xMidYMid meet"/>`;
            const heading=(x,label)=>`<text x="${x}" y="62" fill="${white}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing=".3" text-anchor="middle">${label}</text>`;
            a+=heading(77,'Reference PDB');
            a+=domain(firstPart,cyan)+domain('M110 83 '+lastPart,cyan)+`<path d="M94 80 ${gapPart}" fill="none" stroke="${muted}" stroke-width="2" stroke-dasharray="3 4"/>`+domain(second,blue);
            a+=`<svg x="214" y="10" width="128" height="25" viewBox="56 168 2060 356" preserveAspectRatio="xMidYMid meet"><image href="how-assets/pdbe-sifts-transparent.png" filter="url(#sifts-soften)" x="0" y="0" width="2172" height="724"/></svg>`+heading(278,'PDB → UniProt');
            a+=arrow(135,206,95,.3+.7*mapped)+arrow(135,206,142,.3+.7*mapped);
            a+=`<g opacity="${.18+.82*mapped}">`+rect(215,78,126,33,'#164c59')+txt(278,99,'Protein A · UniProt',white,10,'middle')+rect(215,125,126,33,'#24517d')+txt(278,146,'Protein B · UniProt',white,10,'middle')+'</g>';
            a+=arrow(350,400,95,.3+.7*fetched)+arrow(350,400,142,.3+.7*fetched)+`<image href="how-assets/deepmind-logo.webp" x="400" y="7" width="130" height="25" preserveAspectRatio="xMidYMid meet"/>`+heading(465,'AlphaFold Structures');
            a+=`<g opacity="${.12+.88*fetched}" transform="translate(365 3) rotate(25 78 100)">`+domain(predictedFirst+predictedGap+predictedLast,cyan)+'</g>';
            a+=`<g opacity="${.12+.88*fetched}" transform="translate(430 10) rotate(-22 78 140)">`+domain(predictedSecond,blue)+'</g>';
            caption=t<.2?'The reference complex is fetched from the PDB; a dashed segment marks missing coordinates.':t<.6?'SIFTS maps reference chains to UniProt proteins where mappings are available.':'The identified proteins are used to obtain their matching AlphaFold Database structures, when available.';
        } else if(index===1){
            const ref=['M','K','L','E','A','V','T'],target=['M','K','I','E','G','A','V','T'];
            a=txt(20,54,'Reference',white,12)+txt(20,126,'Target',white,12);
            ref.forEach((residue,i)=>{const alignedIndex=i>=4?i+1:i,x=110+(i+(alignedIndex-i)*t)*53;a+=rect(x,28,42,38,'#164c59')+txt(x+21,53,residue,white,17,'middle');});
            target.forEach((residue,i)=>{const x=110+i*53,hasReference=i!==4;a+=rect(x,100,42,38,'#24517d')+txt(x+21,125,residue,white,17,'middle');if(hasReference)a+=line(x+21,69,x+21,96,cyan,2,t);});
            a+=`<g opacity="${t}">`+txt(110+4*53+21,53,'–',muted,18,'middle')+txt(205,168,'Similar (L / I)',blue,11)+txt(110+4*53+21,168,'Alignment gap',muted,11,'middle')+'</g>';
            caption=on?'The alignment inserts a gap in the displayed reference sequence; L and I are a similar substitution.':'Both input sequences start without a gap character; alignment introduces gaps when needed.';
        } else if(index===2){
            a=txt(20,42,'Observed PDB',white,12)+txt(20,106,'AlphaFold',white,12)+rect(145,25,130,26,cyan,13)+rect(365,25,150,26,cyan,13)+`<path d="M275 38 H365" stroke="${muted}" stroke-width="3" stroke-dasharray="6 6"/>`+rect(145,89,370,26,blue,13)+rect(275,89,90,26,gold,0,t)+line(275,56,275,85,muted,1)+line(365,56,365,85,muted,1)+txt(320,151,on?'Predicted gap region':'Missing coordinates',on?gold:muted,12,'middle');
            caption=on?'The highlighted target residues supply candidate coordinates for the missing region.':'A dashed span marks residues without observed coordinates in the reference.';
        } else if(index===3){
            a=txt(116,50,'Reference complex',muted,12,'middle')+txt(408,50,'Predictions fit to each chain',muted,12,'middle');
            a+=`<g transform="translate(40 0)" opacity=".55">`+domain(firstPart,cyan)+domain('M110 83 '+lastPart,cyan)+`<path d="M94 80 ${gapPart}" fill="none" stroke="${muted}" stroke-width="2" stroke-dasharray="3 4"/>`+domain(second,blue)+'</g>';
            const distance=1-t;
            a+=`<g transform="translate(${40+280*distance} ${-7*distance}) rotate(${25*distance} 78 100)">`+domain(predictedFirst+predictedGap+predictedLast,cyan)+'</g>';
            a+=`<g transform="translate(${40+345*distance} ${10*distance}) rotate(${-22*distance} 78 140)">`+domain(predictedSecond,blue)+'</g>';
            caption=on?'Each prediction is fitted to its corresponding chain in the reference complex.':'The two predictions begin outside the reference frame in this schematic.';
        } else if(index===4){
            const fittedAnchor=blendPath(predictedFirst,fittedFirst,t),gapCurve=blendPath('M96 77 '+predictedGap,'M94 80 '+gapPart,t);
            const endX=112-2*t,endY=81+2*t;
            a=txt(278,35,'Reference chain',cyan,6,'middle')+txt(351,35,'AlphaFold chain',cyan,6,'middle');
            a+=`<g transform="translate(135 -92) scale(1.8)">`+`<g opacity=".55">`+domain(firstPart,cyan)+domain('M110 83 '+lastPart,cyan)+'</g>'+`<path d="M94 80 ${gapPart}" fill="none" stroke="${muted}" stroke-width="2" stroke-dasharray="3 4"/>`;
            a+=domain(fittedAnchor,cyan)+domain(`M${endX} ${endY} `+predictedLast,cyan)+domain(gapCurve,gold)+'</g>';
            caption=on?'The gap-centred chunk is fitted using aligned residues around the missing reference region.':'The overlaid prediction starts with its gap region slightly offset from the reference.';
        } else if(index===5){
            const lockedFirst=blendPath(fittedFirst,firstPart,t),lockedLast=blendPath(predictedLast,lastPart,t);
            a=txt(195,26,'Reference chain',cyan,15,'middle')+txt(365,26,'AlphaFold chain',cyan,15,'middle');
            a+=`<g transform="translate(135 -92) scale(1.8)">`+`<g opacity=".55">`+domain(firstPart,cyan)+domain('M110 83 '+lastPart,cyan)+'</g>'+`<path d="M94 80 ${gapPart}" fill="none" stroke="${muted}" stroke-width="2" stroke-dasharray="3 4"/>`;
            a+=domain(lockedFirst,cyan)+domain('M110 83 '+lockedLast,cyan)+domain('M94 80 '+gapPart,gold)+'</g>';
            caption=on?'Eligible aligned residues now match and are locked to the reference coordinates; the yellow gap remains unlocked.':'The fitted AlphaFold chain starts in the same position as the completed chunk alignment.';
        } else if(index===6){
            const dx=29*t,left=240-dx,right=280+dx;
            a=`<circle cx="${left}" cy="91" r="38" fill="none" stroke="${cyan}" stroke-width="2" stroke-dasharray="5 4" opacity=".9"/><circle cx="${right}" cy="91" r="38" fill="none" stroke="${blue}" stroke-width="2" stroke-dasharray="5 4" opacity=".9"/><circle cx="${left}" cy="91" r="13" fill="${cyan}"/><circle cx="${right}" cy="91" r="13" fill="${blue}"/><path d="M${left+4} 91 H${right-4} M${left+10} 85 L${left+4} 91 L${left+10} 97 M${right-10} 85 L${right-4} 91 L${right-10} 97" fill="none" stroke="${white}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`+txt(260,165,on?'Separation increased':'Overlap / steric clash',white,12,'middle');
            caption=on?'Eligible residues move apart; constrained or locked residues can leave unresolved clashes.':'The circles illustrate the clash distance threshold; overlapping residues are projected apart.';
        } else if(index===7){
            const relaxedFirst=blendPath(firstPart,fittedFirst,t*.25),relaxedLast=blendPath(lastPart,predictedLast,t*.25),relaxedSecond=blendPath(second,predictedSecond,t*.35);
            a=txt(195,26,'Protein A',cyan,12,'middle')+txt(365,26,'Protein B',blue,12,'middle');
            a+=`<g transform="translate(135 -92) scale(1.8)"><g class="how-simulation-springs"></g><g class="how-simulation-chains">`;
            a+=domain(relaxedFirst,cyan)+domain('M110 83 '+relaxedLast,cyan)+domain('M94 80 '+gapPart,gold)+domain(relaxedSecond,blue)+'</g></g>';
            caption=on?'The curves move slightly as the spring network relaxes; the springs shown are illustrative.':'The first chain starts from the locked geometry, with a second chain and springs linking nearby parts.';
        } else if(index===8){
            const finalFirst=blendPath(firstPart,fittedFirst,.25),finalLast=blendPath(lastPart,predictedLast,.25),finalSecond=blendPath(second,predictedSecond,.35);
            a=`<g transform="translate(135 -92) scale(1.8)">`+domain(finalFirst,cyan)+domain('M110 83 '+finalLast,cyan)+`<g opacity="${t}">`+domain('M94 80 '+gapPart,cyan)+'</g>'+domain(finalSecond,blue)+'</g>';
            caption=on?'The gap is now filled in based on the AlphaFold prediction.':'The final model contains both protein chains; move the slider to reveal the predicted gap region.';
        } else {
            a=txt(20,27,'INPUTS',muted,11)+txt(230,27,'SOURCE-SPECIFIC RULES',muted,11)+txt(440,27,'OUTPUTS',muted,11);
            ['pLDDT + PAE','Gap + anchors','Clashes'].forEach((v,i)=>{a+=rect(15,42+i*37,150,28,'#164c59')+txt(25,61+i*37,v,white,11);});
            a+=line(170,92,216,92,muted,2,t)+rect(220,62,155,60,'#24517d',8,.35+.65*t)+txt(297,87,'Exploratory fits',white,11,'middle')+txt(297,105,'(when available)',white,10,'middle')+line(380,92,416,92,muted,2,t);
            ['Local','Placement 2 Å','Placement 5 Å','Model'].forEach((v,i)=>{a+=rect(420,35+i*34,120,25,'#24517d',6,.25+.75*t)+txt(430,52+i*34,v,white,11);});
            caption=on?'Predicted gaps use source-specific fits when required inputs exist. Locked residues use a separate convention; unavailable inputs or simulation can leave scores unavailable.':'For predicted gaps, pLDDT, PAE, gap and anchor features, and clash information contribute to exploratory estimates.';
        }
        return {svg:`<svg viewBox="${index===4?'255 25 125 100':'0 0 560 195'}" role="img" aria-label="Illustration of ${['loading two proteins','sequence alignment','missing residues','whole protein fitting','local chunk fitting','reference locking','clash projection','spring relaxation','final model','confidence calculation'][index]}">${a}</svg>`,caption};
    }
    window.createGapStepVisual=(name,index,referenceOnly=false,multiReference=false,singleChain=false)=>{
        if(index===9){
            const container=document.createElement('div');container.className='how-inspect';
            const model=document.createElement('div');model.className='how-step-visual';
            const stage=document.createElement('div');stage.className='how-visual-stage';
            const first=blendPath(firstPart,fittedFirst,.25),last=blendPath(lastPart,predictedLast,.25),other=blendPath(second,predictedSecond,.35);
            stage.innerHTML=`<svg viewBox="0 0 560 195" role="img" aria-label="Illustrative final model coloured grey, with its predicted gap coloured blue to yellow"><defs><linearGradient id="how-confidence-gap-gradient" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#facc15"/></linearGradient></defs><g transform="translate(135 -92) scale(1.8)">${domain('M94 80 '+gapPart,'url(#how-confidence-gap-gradient)')}${domain(first,'#94a3b8')}${domain('M110 83 '+last,'#94a3b8')}${domain(other,'#94a3b8')}</g></svg>`;
            model.append(stage);const toggle=document.createElement('button');toggle.type='button';toggle.className='how-equations-toggle';toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span>Show equations</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
            let equations=null;toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';if(open&&!equations){equations=window.createConfidenceVisual(multiReference);container.append(equations);}if(equations)equations.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.querySelector('span').textContent=open?'Hide equations':'Show equations';});
            container.append(model);
            if(multiReference){const explanation=document.createElement('p');explanation.className='how-multi-confidence-note';explanation.textContent=multiReference==='different'?'The app calculates scores for each draft and maps them to the combined model. For the active conformational group, it uses the recorded draft origins from that group’s pose where available; otherwise it falls back to the combined residue’s origins. Each score uses only finite values and non-negative reference weights. Multiple available values are weighted together; if all weights are zero, they are averaged equally. A score remains unavailable if no contributing draft has a value.':'Scores are calculated separately in each draft, then transferred to matching combined-model residues using their recorded draft origins. For each score, available draft values are averaged with non-negative reference weights. If all available weights are zero, they are averaged equally; if no value is available, that score remains unavailable. The active conformational group determines which origins are used.';container.append(explanation);}
            container.append(toggle);return container;
        }
        const visual=document.createElement('div');visual.className='how-step-visual';
        const stage=document.createElement('div');stage.className='how-visual-stage';
        const label=document.createElement('label');label.className='how-visual-control';
        const title=document.createElement('span');title.textContent='Move through this step';
        const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.value=referenceOnly?'100':'0';input.setAttribute('aria-label',`${name}: illustration progress`);
        const caption=document.createElement('p');caption.className='how-visual-caption';const rail=document.createElement('span');rail.className='how-slider-wrap';const arrow=document.createElement('i');arrow.className='fa-solid fa-arrow-right how-slider-hint';arrow.setAttribute('aria-hidden','true');rail.append(input,arrow);label.append(title,rail);if(referenceOnly)visual.append(stage,caption);else visual.append(stage,label,caption);
        if(index===9){const note=document.createElement('p');note.className='how-confidence-note';note.textContent='For AlphaFold gaps: local structure, placement within 2 Å, placement within 5 Å, and model confidence are distinct exploratory estimates. Sequence-only residues use a different fit. Locked residues use a reference-lock convention; placement is assigned 1. Combined-model values may be transferred from drafts.';visual.append(note);}
        let springLinks=null;
        function drawSprings(progress){
            const svg=stage.querySelector('svg'), springLayer=svg.querySelector('.how-simulation-springs'), paths=[...svg.querySelectorAll('.how-simulation-chains path')];
            if(!springLayer)return;
            const lengths=paths.map(path=>path.getTotalLength());
            if(!springLinks){
                const points=[];
                paths.forEach((path,chain)=>{const length=lengths[chain],count=Math.max(4,Math.ceil(length/10));for(let i=0;i<=count;i++){const fraction=i/count,point=path.getPointAtLength(length*fraction);points.push({x:point.x,y:point.y,chain,index:i,fraction});}});
                const candidates=[];
                for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
                    const a=points[i],b=points[j];if(a.chain===b.chain&&Math.abs(a.index-b.index)<3)continue;
                    const distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance>=6&&distance<=16)candidates.push({a,b,distance});
                }
                candidates.sort((a,b)=>a.distance-b.distance);
                const chosen=[];springLinks=[];
                for(const edge of candidates){if(chosen.some(p=>Math.hypot(p.x-edge.a.x,p.y-edge.a.y)<4&&Math.hypot(p.u-edge.b.x,p.v-edge.b.y)<4))continue;
                    chosen.push({x:edge.a.x,y:edge.a.y,u:edge.b.x,v:edge.b.y});springLinks.push({a:{chain:edge.a.chain,fraction:edge.a.fraction},b:{chain:edge.b.chain,fraction:edge.b.fraction}});if(springLinks.length>=35)break;
                }
            }
            for(const link of springLinks){
                const a=paths[link.a.chain].getPointAtLength(lengths[link.a.chain]*link.a.fraction),b=paths[link.b.chain].getPointAtLength(lengths[link.b.chain]*link.b.fraction);
                const spring=document.createElementNS('http://www.w3.org/2000/svg','line');
                for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:`rgb(${Math.round(245-180*progress)},${Math.round(125+70*progress)},${Math.round(80+90*progress)})`,'stroke-width':'.85',opacity:'.8'}))spring.setAttribute(key,String(value));
                springLayer.append(spring);
            }
        }
        function applySingleChain(){
            const svg=stage.querySelector('svg');if(!svg)return;
            if(index===0){
                svg.querySelectorAll('path').forEach(path=>{const d=path.getAttribute('d')||'';if(d==='M110 83 '+lastPart||d==='M94 80 '+gapPart||d===second||d.startsWith('M135 142 ')||d.startsWith('M350 142 '))path.remove();});
                svg.querySelector('g[transform="translate(430 10) rotate(-22 78 140)"]')?.remove();
                svg.querySelector('rect[x="215"][y="125"]')?.remove();
                svg.querySelectorAll('text').forEach(text=>{if(text.textContent==='Protein B · UniProt')text.remove();});
            } else if(index===3){
                svg.querySelectorAll('path').forEach(path=>{const d=path.getAttribute('d');if(d===second||d===predictedSecond)path.remove();});
            } else if(index===7){
                svg.querySelector('.how-simulation-chains')?.lastElementChild?.remove();
            } else if(index===8){
                svg.querySelectorAll(`path[stroke="${blue}"]`).forEach(path=>path.remove());
            }
        }
        const update=()=>{const n=Number(input.value),result=draw(index,n/100);stage.innerHTML=referenceOnly ? `<svg viewBox="0 0 165 170" role="img" aria-label="Illustration of the reference PDB complex"><g opacity="${.4+.6*n/100}"><image href="RCSB_PDB_demo/media/asset-16.png" x="12" y="11" width="132" height="27" preserveAspectRatio="xMidYMid meet"/>${txt(77,62,'Reference PDB',white,11,'middle')}${domain(firstPart,cyan)}${domain('M110 83 '+lastPart,cyan)}<path d="M94 80 ${gapPart}" fill="none" stroke="${muted}" stroke-width="2" stroke-dasharray="3 4"/>${domain(second,blue)}</g></svg>` : result.svg;if(singleChain)applySingleChain();if(index===7)drawSprings(n/100);caption.textContent=singleChain&&index===0?'Reference A contains the portion before the gap; the corresponding predicted chain is retrieved.':singleChain&&index===8?(n>=50?'The predicted gap region is now visible in cyan.':'Move the slider to reveal the predicted gap region.'):referenceOnly ? 'The reference complex is fetched from the PDB; a dashed segment marks missing coordinates.' : result.caption;input.style.setProperty('--how-fill-end',`calc(${n}% + ${19-0.38*n}px)`);arrow.hidden=n!==0;};input.addEventListener('input',update);update();return visual;
    };
})();

