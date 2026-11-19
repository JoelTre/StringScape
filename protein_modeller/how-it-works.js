(() => {
    const common = [
        ['Perform sequence alignment to determine equivalent residues', 'The app reads the reference chains, identifies corresponding target proteins and aligns their sequences. Matching residues provide the correspondence used to place the target structures.'],
        ['Align AlphaFold models onto the reference', 'The AlphaFold structure is fitted to matching reference residues. Around unaligned stretches, nearby residues are grouped and fitted locally; groups can include more than one chain. Move the slider to see a schematic local fit.'],
        ['Run the spring-based draft simulation', 'The app builds a spring-based representation from reference and predicted geometry, applies reference locks where appropriate, and runs a simulation to bring the model towards compatible geometry.'],
        ['Inspect and evaluate the model', 'Explore the model, sequence coverage and build statistics. The result is a model: missing regions, uncertain predictions and clashes should be assessed before drawing biological conclusions.']
    ];
    const scenarios = [
        {name:'One PDB ID (filling in the gaps)', intro:'Follow an illustrative complex with two proteins: one reference PDB supplies their experimental arrangement, and a separate AlphaFold model supplies each protein’s predicted structure.', steps:[
            ['Load the reference and target', 'The app fetches the reference PDB, uses SIFTS to identify UniProt proteins when mappings are available, then retrieves their AlphaFold Database models. This example has two chains and two predicted structures; the shapes are illustrative.'],
            common[0],
            ['Identify residues missing from the reference', 'Compare the aligned sequences with the reference sequence (only including residues in the PDB structure) to identify gaps.'],
            ['Align AlphaFold models onto the reference', 'Each AlphaFold protein is fitted onto its corresponding reference chain using equivalent residues, placing both proteins in the reference complex’s coordinate frame.'],
            ['Align AlphaFold chunks around gaps', 'The app groups unaligned stretches with nearby residues, then locally fits each group using its aligned reference residues. Nearby groups may merge; settings control padding and cross-chain fitting.'],
            ['Lock aligned residues to the reference', 'For a draft using a prediction sourced from the reference, aligned residues are locked to reference coordinates. Other sources can leave aligned residues near gaps unlocked, according to the selected distance setting.'],
            ['Project steric clashes', 'Before simulation, clash projection moves eligible residues to reduce overlaps while respecting the available constraints. Some clashes can remain when constraints prevent a resolution.'],
            ['Optional: run the spring-based draft simulation', 'If run, the simulation relaxes the model under spring constraints derived from reference and predicted geometry. Spring colours below illustrate changing strain, not the app’s actual spring-colour scale.'],
            ['Final Model', 'The model is then complete!'],
            ['Inspect and evaluate the model', 'Explore residue confidence, sequence coverage and structural issues. Confidence scores are based on preliminary benchmark results, not a measured accuracy; some residues have no score.']]},
        {name:'One PDB ID, with STRING files from another species (homology modelling)', intro:'Use the experimental structure of a protein complex in one species to model the same protein complex in another species', steps:[['Load the reference', 'The PDB supplies the experimental arrangement of the reference complex.'], ['Review protein matches', 'The app scores candidates using identifiers, names and sequence alignment, and presents matches for review. Verified identifiers are used to find target structures where available; unresolved matches may need attention.'], common[0], common[1], ['Relax the homology model', 'Draft locking depends on the source of the prediction. For a different species, aligned residues near unaligned regions can move while more distant aligned residues remain locked according to the chosen settings. Springs guide the draft towards compatible geometry.'], common[3]]},
        {name:'Two PDB IDs, same conformation', intro:'Combine complementary evidence from two references assigned to the same conformational group.', steps:[['Load and group the references', 'Both PDBs are assigned to the same conformational group. The app matches their protein chains to target proteins and compares their sequence coverage.'], common[0], ['Build and align reference-guided drafts', 'Each reference guides a draft model. Shared matched residues allow the drafts to be brought into a common frame; each reference can contribute evidence where it has coverage.'], common[1], ['Combine the drafts and relax the model', 'The app combines aligned drafts into a staged model and uses their geometric constraints in the simulation. Residues in the combined model are unlocked, allowing the structure to relax.'], common[3]]},
        {name:'Two PDB IDs, different conformations', intro:'Keep distinct reference states in separate conformational groups so the model can represent each state.', steps:[['Assign conformational groups', 'Place the two PDBs in different conformational groups. The grouping describes which reference structures represent the same state.'], common[0], ['Build a reference-guided draft for each state', 'Each reference guides its own draft, with target proteins fitted to the corresponding observed arrangement. Local fitting handles regions around gaps.'], common[1], ['Combine drafts while retaining each state', 'The app combines the aligned drafts while retaining group-specific coordinates and presence information. You can select a conformational group in the viewer.'], ['Explore the transition', 'A conformational-change animation can interpolate between the modelled states. This is a visual interpolation, not evidence that the intermediate structures or motion were experimentally observed.'], common[3]]},
        {name:'Two PDB IDs with no structural overlap, same conformation', intro:'When references cover separate parts of a complex, the app attempts to connect them through a shared predicted protein.', steps:[['Identify disconnected references', 'Both references are assigned to the same conformational group. The app checks whether their matched target residues provide enough overlap to connect their reference groups.'], ['Find an AlphaFold-mediated bridge', 'If groups are disconnected, the app searches for a suitable AlphaFold-mediated bridge between compatible target proteins. A predicted structure spanning the covered regions can supply the missing spatial relationship.'], ['Place the bridge and verify connectivity', 'The app tries a candidate placement, creates a merged reference and checks whether it actually connects the previously disconnected groups. This is conditional on the available matches and geometry.'], common[1], ['Build a draft from the connected references', 'A successful merged reference guides the draft and subsequent combined model. If no reliable bridge connects all groups, the app warns that the references could not all be connected; a complete placement is not guaranteed.'], common[2], common[3]]}
    ];
    // The STRING walkthrough shares the same build diagrams after target matching.
    const singlePdbSteps=scenarios[0].steps;
    scenarios[1].steps=[scenarios[1].steps[0],scenarios[1].steps[1],common[0],singlePdbSteps[3],singlePdbSteps[4],
        ['Lock aligned residues to the reference', 'For a prediction from another species, aligned residues farther than the selected distance from an unaligned region are locked to the reference during the draft; aligned residues near a gap are not locked to can move in subsequent steps.'],
        singlePdbSteps[6],singlePdbSteps[7],singlePdbSteps[8],singlePdbSteps[9]];
    scenarios[2].steps=[
        ['Group the references', 'Assign both reference PDBs to the same conformational group because they represent the same state.'],
        singlePdbSteps[0],common[0],singlePdbSteps[3],singlePdbSteps[4],singlePdbSteps[5],singlePdbSteps[6],singlePdbSteps[7],
        ['Align draft models', 'Bring the reference-guided drafts into a common frame using matching structures and residues where sufficient overlap is available.'],
        ['Merge equivalent chains between drafts', 'The app identifies corresponding chains across aligned drafts and combines their contributions into the staged model.'],
        singlePdbSteps[8],
        ['Inspect and evaluate the model', 'For each residue in the combined model, the app transfers available confidence scores from its contributing reference-guided drafts. Each score is averaged using the corresponding reference weights.']
    ];
    const multiInspect=['Inspect and evaluate the model', 'For each residue in the combined model, the app transfers available confidence scores from its contributing reference-guided drafts. Each score is averaged using the corresponding reference weights.'];
    scenarios[3].steps=[
        ['Group the references', 'Assign the two reference PDBs to different conformational groups so that their distinct states are retained.'],
        singlePdbSteps[0],common[0],singlePdbSteps[3],singlePdbSteps[4],singlePdbSteps[5],singlePdbSteps[6],singlePdbSteps[7],
        ['Align draft models', 'Bring the reference-guided drafts into a common frame where sufficient corresponding structure is available. Alignment does not merge the two conformational states.'],
        ['Combine drafts while retaining each state', 'The combined model retains group-specific coordinates and presence information. Coordinates come from a state; they are not averaged across different conformations.'],
        ['Final model with two conformations', 'The model retains the two conformational groups so that each state can be selected in the viewer.'],
        ['Inspect and evaluate the model', 'The displayed confidence scores follow the active conformational group. For each residue and score, the app uses the available values from the draft origins associated with that state, combining them with reference weights when more than one is available.']
    ];
    scenarios[4].steps=[
        ['Group the references', 'Assign both reference PDBs to the same conformational group because they represent the same state.'],
        ['Load the reference and target', 'The app loads the reference PDB and obtains the corresponding AlphaFold protein model. In this example, reference A covers only the portion before the gap.'],common[0],
        ['Identify disconnected references', 'The app checks the matched target residues to determine whether the reference groups are connected by structural overlap. In this scenario they are disconnected.'],
        ['Find an AlphaFold-mediated bridge', 'The app can use a compatible predicted target protein to connect the reference groups: it fits the prediction to one reference and places the other reference using the prediction. It checks the resulting connection and warns if no reliable bridge can be found.'],
        singlePdbSteps[3],singlePdbSteps[4],singlePdbSteps[5],singlePdbSteps[6],singlePdbSteps[7],
        ['Final Model', 'If a reliable bridge is available, the merged reference contributes to the model. If the references could not be connected, inspect the warning and do not assume that their relative placement is established.'],multiInspect
    ];
    const stringDiagramSteps={'Perform sequence alignment to determine equivalent residues':1,'Align AlphaFold models onto the reference':3,'Align AlphaFold chunks around gaps':4,'Lock aligned residues to the reference':5,'Project steric clashes':6,'Optional: run the spring-based draft simulation':7,'Final Model':8,'Inspect and evaluate the model':9};
    // These deliberately simplified diagrams illustrate decisions and transformations,
    // not actual structures, alignment scores, or simulation trajectories.
    function createStepVisual(name, scenario, index) {
        const visual=document.createElement('div');visual.className='how-step-visual';
        const stage=document.createElement('div');stage.className='how-visual-stage';
        const label=document.createElement('label');label.className='how-visual-control';
        const labelText=document.createElement('span');labelText.textContent='Move through this step';
        const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value='0';slider.setAttribute('aria-label',`${name}: illustration progress`);
        const rail=document.createElement('span');rail.className='how-slider-wrap';const hint=document.createElement('i');hint.className='fa-solid fa-arrow-right how-slider-hint';hint.setAttribute('aria-hidden','true');rail.append(slider,hint);label.append(labelText,rail);const caption=document.createElement('p');caption.className='how-visual-caption';
        visual.append(stage,label,caption);
        const text=(x,y,value,color='#cbd5e1')=>`<text x="${x}" y="${y}" fill="${color}" font-size="13" font-family="sans-serif">${value}</text>`;
        const pill=(x,y,w,fill,title)=>`<rect x="${x}" y="${y}" width="${w}" height="34" rx="8" fill="${fill}"/>${text(x+10,y+22,title,'#fff')}`;
        const arrow=(x1,y1,x2,y2,opacity=1)=>`<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#94a3b8" stroke-width="2" opacity="${opacity}" marker-end="url(#how-arrow-${scenario}-${index})"/>`;
        function update(){
            const t=Number(slider.value)/100, on=t>=.5;let art='',message='';
            if(name.includes('sequence alignment')||name.includes('Compare target and reference sequences')){
                const seq1=['M','K','A','L','G','V','T','R'],seq2=['M','K','S','L','–','V','T','R'];
                art=text(8,42,'Reference')+text(8,96,'Target');
                seq1.forEach((aa,i)=>{const x=95+i*48;art+=`<rect x="${x}" y="20" width="36" height="30" rx="5" fill="#2eccbf"/>${text(x+12,41,aa,'#fff')}`;art+=`<rect x="${x+(1-t)*15}" y="75" width="36" height="30" rx="5" fill="${aa===seq2[i]?'#60a5fa':'#475569'}"/>${text(x+12+(1-t)*15,96,seq2[i],'#fff')}`;if(aa===seq2[i])art+=`<path d="M${x+18} 52 V73" stroke="#2eccbf" stroke-width="2" opacity="${t}"/>`;});
                message=on?'Corresponding residues are linked; substitutions and gaps remain visible.':'Reference and target sequences are compared residue by residue.';
            } else if(name.includes('missing from the reference')){
                art=text(12,41,'Reference')+text(12,99,'Prediction')+`<rect x="95" y="24" width="110" height="22" rx="11" fill="#2eccbf"/><rect x="300" y="24" width="160" height="22" rx="11" fill="#2eccbf"/><path d="M205 35 H300" stroke="#2eccbf" stroke-width="3" stroke-dasharray="7 6"/><rect x="95" y="82" width="365" height="22" rx="11" fill="#60a5fa"/><rect x="205" y="82" width="95" height="22" rx="11" fill="#fbbf24" opacity="${t}"/>`;
                message=on?'The highlighted predicted residues correspond to the missing reference region.':'The reference has a gap; the prediction includes a continuous region.';
            } else if(name==='Align AlphaFold models onto the reference'){
                const dx=(1-t)*60,dy=(1-t)*-24;
                art=`<path d="M70 95 C120 15 175 20 220 74 M340 74 C385 20 440 15 490 95" fill="none" stroke="#2eccbf" stroke-width="17" stroke-linecap="round"/><path d="M220 74 C255 115 305 115 340 74" fill="none" stroke="#2eccbf" stroke-width="3" stroke-dasharray="7 7"/><g transform="translate(${dx} ${dy})"><path d="M70 95 C120 15 175 20 220 74 C255 115 305 115 340 74 C385 20 440 15 490 95" fill="none" stroke="#60a5fa" stroke-width="10" stroke-linecap="round"/></g>`+text(15,145,'Reference', '#2eccbf')+text(125,145,'AlphaFold', '#60a5fa');
                message=on?'Matched regions approach the reference; the prediction spans the gap.':'The predicted region starts offset from the reference.';
            } else if(name.includes('simulation')||name.includes('relax')){
                const points=[[100,80],[190,40],[270,100],[360,45],[450,85]], dest=[[100,75],[185,65],[275,75],[365,65],[450,75]];const pt=points.map((p,i)=>[p[0]+(dest[i][0]-p[0])*t,p[1]+(dest[i][1]-p[1])*t]);
                for(let i=0;i<pt.length-1;i++)art+=`<line x1="${pt[i][0]}" y1="${pt[i][1]}" x2="${pt[i+1][0]}" y2="${pt[i+1][1]}" stroke="#60a5fa" stroke-width="3" stroke-dasharray="5 4"/>`;
                pt.forEach((p,i)=>art+=`<circle cx="${p[0]}" cy="${p[1]}" r="12" fill="${i===0?'#2eccbf':'#60a5fa'}"/>`);
                art+=text(15,145,'Nodes = residues  ·  dashed lines = schematic springs');message=on?'The draft moves towards compatible spring geometry; locks depend on settings and source.':'Reference and predicted geometry provide constraints for relaxation.';
            } else if(name.includes('Inspect')){
                art=text(15,32,'Example sequence coverage')+`<rect x="15" y="48" width="450" height="24" rx="6" fill="#334155"/><rect x="15" y="48" width="${100+350*t}" height="24" rx="6" fill="#2eccbf"/>`+text(15,110,on?'Review coverage, gaps and clashes':'Reveal an illustrative coverage bar');
                message=on?'Use the viewer, build statistics and validation tools to assess the model.':'A finished model still needs inspection; this bar is illustrative, not a score.';
            } else if(scenario===4 && ['Identify disconnected references','Find an AlphaFold-mediated bridge'].includes(name)){
                const phase=name==='Identify disconnected references'?'disconnected':'candidate';
                art=window.renderBridgeDiagram(phase,t);
                message=phase==='disconnected'?(on?'Both chunks map to different regions of the predicted chain, but do not directly overlap each other.':'Move the slider to reveal how each reference chunk maps to the predicted chain.'):
                    (t<.5?'The predicted chain is fitted to reference A.':'Reference B is placed using the fitted prediction. A connection is accepted only if the app verifies it.');
            } else if(scenario===3 && ['Combine drafts while retaining each state','Explore the transition','Final model with two conformations'].includes(name)){
                art=text(175,24,name==='Explore the transition'?'Illustrative interpolation between states':'Conformational state A ↔ B')+window.renderConformationComplex(t);
                message=name==='Explore the transition'?'This visual interpolation does not establish experimentally observed intermediates or motion.':'The two groups retain separate coordinates; move the slider to inspect the illustrative states.';
            } else if(name.includes('bridge')||name.includes('disconnected')||name.includes('connected references')){
                art=pill(30,35,140,'#2eccbf','Reference A')+pill(390,35,140,'#2eccbf','Reference B');
                art+=`<path d="M100 105 C200 ${120-60*t} 350 ${120-60*t} 460 105" stroke="#60a5fa" stroke-width="10" stroke-linecap="round" fill="none" opacity="${.2+.8*t}"/>`+text(155,145,'Predicted protein: candidate bridge','#60a5fa');
                message=on?'A candidate may connect the references if placement and connectivity checks succeed.':'The reference groups lack direct overlap; a suitable predicted bridge is needed.';
            } else if(name.includes('transition')||name.includes('retaining each state')){
                const h=85-40*t;art=`<path d="M90 105 Q170 ${h} 260 95 T440 105" fill="none" stroke="#60a5fa" stroke-width="13" stroke-linecap="round"/>`+text(75,145,'State A')+text(390,145,'State B')+`<circle cx="${90+350*t}" cy="140" r="5" fill="#2eccbf"/>`;
                message=on?'The viewer can show the other group; interpolated motion is only illustrative.':'Each conformational group retains its own modelled state.';
            } else if(name==='Group the references'){
                art=pill(40,20,140,'#164c59','Reference A')+pill(40,105,140,'#24517d','Reference B');
                if(scenario===3){
                    art+=`<path d="M180 37 H${180+180*t} M180 122 H${180+180*t}" fill="none" stroke="#2eccbf" stroke-width="3" stroke-linecap="round"/>`;
                    art+=`<g opacity="${Math.max(0,(t-.55)/.45)}">`+pill(370,20,160,'#075985','Conformation A')+pill(370,105,160,'#075985','Conformation B')+'</g>';
                    message=on?'The references remain in separate conformational groups.':'Move the slider to assign each reference to its own group.';
                } else {
                    art+=`<path d="M180 37 H230 V122 H180 M230 80 H${230+140*t}" fill="none" stroke="#2eccbf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="${t}"/>`;
                    art+=`<g opacity="${Math.max(0,(t-.55)/.45)}">`+pill(380,63,155,'#075985','Same conformation')+'</g>';
                    message=on?'Both references are assigned to the same conformational group.':'Move the slider to group the two references.';
                }
            } else if(name==='Align draft models'){
                art=`<text x="280" y="24" text-anchor="middle" fill="#cbd5e1" font-size="13" font-family="sans-serif">Draft A and draft B</text>`+window.renderDraftComplexes('align',t,scenario===3);
                message=on?'The draft models have been brought into a common frame.':'Shared structure guides the alignment of the two drafts.';
            } else if(name==='Merge equivalent chains between drafts'){
                art=`<text x="280" y="24" text-anchor="middle" fill="#cbd5e1" font-size="13" font-family="sans-serif">Superimposed drafts</text>`+window.renderDraftComplexes('merge',t);
                message=on?'Corresponding chains contribute to the combined model.':'The aligned drafts contain chains that can correspond to each other.';
            } else if(name.includes('group')||name.includes('draft')){
                const separate=scenario===3, x=on?(separate?330:260):360;
                art=pill(35,30,140,'#2eccbf','Reference A')+pill(35,95,140,'#60a5fa','Reference B')+arrow(180,47,x-8,47,t)+arrow(180,112,x-8,separate?112:75,t)+pill(x,30,165,'#60a5fa',separate?'State A draft':'Combined draft');
                if(separate)art+=pill(x,95,165,'#60a5fa','State B draft');
                message=on?(separate?'Separate groups preserve the distinct reference states.':'References in the same group contribute compatible draft information.'):'References are assigned to groups and guide their respective drafts.';
            } else if(name.includes('Review protein matches')){
                const reference=['M','K','L','E','A','V','T','E'];
                const candidates=[['M','K','I','E','G','A','V','T'],['M','R','L','D','G','S','V','T'],['M','K','L','Q','A','A','I','S'],['V','K','F','E','G','T','L','T'],['M','R','V','D','S','A','I','G']];
                art=text(22,24,'Reference sequence')+text(330,17,'Candidate target sequences');
                reference.forEach((residue,i)=>{const x=20+i*23;art+=`<rect x="${x}" y="69" width="20" height="24" rx="4" fill="#164c59"/>${text(x+6,86,residue,'#fff')}`;});
                // Align each illustrative candidate before colouring equal residues.
                const align=(first,second)=>{const rows=first.length+1,cols=second.length+1,score=Array.from({length:rows},()=>Array(cols).fill(0));
                    for(let i=1;i<rows;i++)score[i][0]=-2*i;for(let j=1;j<cols;j++)score[0][j]=-2*j;
                    for(let i=1;i<rows;i++)for(let j=1;j<cols;j++)score[i][j]=Math.max(score[i-1][j-1]+(first[i-1]===second[j-1]?3:-1),score[i-1][j]-2,score[i][j-1]-2);
                    const pairs=[];let i=first.length,j=second.length;while(i||j){if(i&&j&&score[i][j]===score[i-1][j-1]+(first[i-1]===second[j-1]?3:-1)){pairs.push([first[--i],second[--j]]);}else if(i&&score[i][j]===score[i-1][j]-2){pairs.push([first[--i],'–']);}else{pairs.push(['–',second[--j]]);}}return pairs.reverse();};
                candidates.forEach((sequence,row)=>{const y=24+row*26,selected=row===0&&on,alignment=align(reference,sequence);
                    art+=`<path d="M205 81 C245 81 275 ${y+11} 320 ${y+11}" fill="none" stroke="${selected?'#2eccbf':'#64748b'}" stroke-width="${selected?2:1}" opacity="${.3+.7*t}"/>`;
                    if(selected)art+=`<rect x="323" y="${y-3}" width="${Math.max(207,alignment.length*20+29)}" height="25" rx="5" fill="none" stroke="#2eccbf" stroke-width="2"/>`;
                    alignment.forEach(([ref,residue],i)=>{const x=328+i*20,match=residue!=='–'&&residue===ref,fill='#334155',letter=match?`rgb(${Math.round(203-107*t)},${Math.round(213-48*t)},${Math.round(225+25*t)})`:'#cbd5e1';art+=`<rect x="${x}" y="${y}" width="18" height="20" rx="3" fill="${fill}"/>${text(x+5,y+15,residue,letter)}`;});
                    if(selected)art+=text(333+alignment.length*20,y+15,'✓','#2eccbf');
                });
                message=on?'The first candidate is selected in this example after comparing the aligned sequences and other matching evidence.':'The reference sequence is compared with five illustrative candidate sequences; each row shows aligned positions.';
            } else {
                art=pill(20,40,165,'#2eccbf','Reference PDB')+pill(330,40,185,'#60a5fa',scenario===1?'STRING target':'Target prediction')+arrow(190,57,320,57,t)+text(130,120,on?'Inputs ready for matching':'Choose the required inputs');
                message=on?'The selected inputs provide reference geometry and target protein information.':'The build starts with a reference and matching target information.';
            }
            stage.innerHTML=`<svg viewBox="${scenario===4 && (name==='Identify disconnected references'||name==='Find an AlphaFold-mediated bridge') ? '0 0 560 180' : '0 0 560 160'}" role="img" aria-label="${name}: illustrative schematic"><defs><marker id="how-arrow-${scenario}-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#94a3b8"/></marker></defs>${art}</svg>`;
            slider.style.setProperty('--how-fill-end',`calc(${t*100}% + ${19-38*t}px)`);hint.hidden=t!==0;caption.textContent=message;
        }
        slider.addEventListener('input',update);update();return visual;
    }
    window.createHowItWorksPage = () => {
        const page=document.createElement('article'); page.className='how-works';
        page.innerHTML=`<header class="how-hero"><h1>How this app works</h1><p>StringScape Protein Modeller combines reference structures from the Protein Data Bank with predicted protein structures to build a model of a complex. It matches sequences, places predicted structures against the references, and optionally uses a spring-based simulation to relax the resulting model. Choose a scenario below to follow the process, from inputs to the result.</p></header><div class="how-picker"><span id="howScenarioLabel" class="how-picker-label">Explore a build scenario</span><div class="how-select-wrap"><button type="button" class="how-scenario-trigger" aria-labelledby="howScenarioLabel howScenarioValue" aria-haspopup="true" aria-expanded="false" aria-controls="howScenarioMenu"><span id="howScenarioValue"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div id="howScenarioMenu" class="how-scenario-menu" role="group" aria-label="Build scenarios" hidden></div></div></div><div class="how-article" aria-live="polite"></div>`;
        const trigger=page.querySelector('.how-scenario-trigger'), menu=page.querySelector('.how-scenario-menu'), value=page.querySelector('#howScenarioValue'), article=page.querySelector('.how-article');
        let selected=0;
        function setMenu(open){menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));}
        scenarios.forEach((scenario,index)=>{const button=document.createElement('button');button.type='button';button.textContent=scenario.name;button.addEventListener('click',()=>{selected=index;setMenu(false);render();trigger.focus();});menu.append(button);});
        trigger.addEventListener('click',()=>setMenu(menu.hidden));
        page.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){setMenu(false);trigger.focus();}});
        document.addEventListener('click',event=>{if(!page.contains(event.target)||!event.target.closest('.how-select-wrap'))setMenu(false);});
        function render(){
            const scenario=scenarios[selected];value.textContent=scenario.name;menu.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===selected)));
            article.replaceChildren();
            const heading=document.createElement('div');heading.className='how-scenario-heading';
            const title=document.createElement('h2');title.textContent=scenario.name;
            const intro=document.createElement('p');intro.textContent=scenario.intro;heading.append(title,intro);article.append(heading);
            const steps=document.createElement('div');steps.className='how-steps';
            scenario.steps.forEach(([name,description],index)=>{
                if((selected===2||selected===3)&&index===1 || selected===4&&index===5){const note=document.createElement('aside');note.className='how-draft-note';note.textContent=selected===4?'If a reliable bridge is found, the merged reference is used to build a draft model. If not, the app warns that the reference groups could not all be connected.':'A separate draft model is then built using each reference.';steps.append(note);}
                const step=document.createElement('section');step.className='how-step';
                const number=document.createElement('span');number.className='how-step-number';number.textContent=String(index+1);
                const body=document.createElement('div');body.className='how-step-body';
                const h=document.createElement('h3');h.textContent=name;
                const p=document.createElement('p');p.textContent=description;
                body.append(h,p,selected===0 ? window.createGapStepVisual(name,index) : selected===1 && index===0 ? window.createGapStepVisual(name,0,true) : (selected>=1 && selected<=4) && name==='Load the reference and target' ? window.createGapStepVisual(name,0,false,false,selected===4) : (selected>=1 && selected<=4) && Object.hasOwn(stringDiagramSteps,name) ? window.createGapStepVisual(name,stringDiagramSteps[name],false,name==='Inspect and evaluate the model' && selected>=2 && selected<=4 ? (selected===3?'different':true) : false,selected===4) : createStepVisual(name,selected,index));step.append(number,body);steps.append(step);
            });article.append(steps);

        }
        render();
        return page;
    };
})();
