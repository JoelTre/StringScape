(() => {
    try {
    const main = document.querySelector('main');
    const setup = main.firstElementChild;
    const physics = document.getElementById('homologyPhysicsSimulation');
    const viewer = document.getElementById('physicsContainer');
    const pages = Array.from({length: 12}, (_, i) => {
        const page = document.createElement('section');
        page.className = 'app-page';
        page.dataset.page = String(i + 1);
        page.hidden = i !== 0;
        return page;
    });
    const menuItems = [
        [1, 'Home', 'fa-house'], [3, '3D viewer', 'fa-cube'], [4, 'Mol* viewer', 'fa-dna'], [12, 'Model overview', 'fa-file-lines'], [11, 'Model editor', 'fa-pen-to-square'],
        [2, 'Build process', 'fa-list-check'], [5, 'Build stats', 'fa-chart-bar'],
        [6, 'Compare variables', 'fa-chart-line'], [7, 'Connect an AI', 'fa-robot'],
        [8, 'Save and download', 'fa-floppy-disk'], [9, 'Validation report', 'fa-clipboard-check'],
        [10, 'About this app', 'fa-circle-info']
    ];
    const ai = document.getElementById('modellerAiOpen').closest('section');
    const session = document.getElementById('sessionPanel');
    const process = document.getElementById('buildProcessBox');
    const details = document.getElementById('detailsPanels');
    const molstar = document.getElementById('molstar-simulation-container').parentElement.parentElement;
    const download = document.getElementById('downloadMmCifBtn').closest('.bg-slate-900');
    const statsButton = document.getElementById('physicsControlsToggle');
    const stats = document.getElementById('physicsControlsPanel');
    const comparison = document.getElementById('physicsVariableComparison');
    const report = document.getElementById('validationReport');
    pages[0].append(setup);
    pages[1].append(process, details, document.getElementById('stagedModelComparisons'));
    pages[2].append(physics);
    pages[3].append(molstar);
    pages[4].append(statsButton, stats);
    const overview=document.createElement('article'); overview.className='model-overview';
    overview.innerHTML=`<div class="model-overview-heading"><div id="overviewImageSection" hidden><img id="overviewImage" alt="Auto-fitted view of the model before simulation"></div><h1 id="modelOverviewTitle">Model overview</h1></div><div class="model-overview-actions"><button type="button" id="overviewDownloadText" class="model-download-button"><i class="fa-solid fa-download" aria-hidden="true"></i> Text</button><button type="button" id="overviewDownloadHtml" class="model-download-button"><i class="fa-solid fa-download" aria-hidden="true"></i> HTML</button></div><div id="overviewBody"><section class="overview-detail overview-status"><h2><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Build status</h2><div id="overviewStatus"></div></section><section class="overview-detail overview-inputs"><h2><i class="fa-solid fa-sliders" aria-hidden="true"></i> Inputs</h2><div id="overviewInputs"></div></section><section class="overview-detail overview-references"><h2><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Reference structures and draft models</h2><div id="overviewReferences"></div></section><section class="overview-detail overview-composition"><h2><i class="fa-solid fa-cubes" aria-hidden="true"></i> Model composition</h2><div id="overviewComposition"></div></section><section class="overview-detail"><h2><i class="fa-solid fa-dna" aria-hidden="true"></i> DNA and RNA</h2><div id="overviewNucleic"></div></section><section class="overview-detail"><h2><i class="fa-solid fa-circle-nodes" aria-hidden="true"></i> Symmetry and extensions</h2><div id="overviewSymmetry"></div></section><section class="overview-detail"><h2><i class="fa-solid fa-film" aria-hidden="true"></i> Animations</h2><div id="overviewAnimations"></div></section><section class="overview-detail"><h2><i class="fa-solid fa-link" aria-hidden="true"></i> Model chains</h2><div id="overviewChains"></div></section><section class="overview-detail overview-binding"><details id="overviewBindingDisclosure"><summary class="overview-binding-disclosure-heading"><h2><i class="fa-solid fa-handshake" aria-hidden="true"></i> Binding sites</h2><i class="fa-solid fa-chevron-down overview-binding-disclosure-chevron" aria-hidden="true"></i></summary><div id="overviewBindingSummary" class="overview-binding-summary"></div><p class="overview-note">Protein–protein patches use representative residue positions within 8 Å and contain at least three residues. Interfaces involving nucleic acids or ligands use non-hydrogen atom distances within 4.5 Å. Water and procedurally generated membrane lipids are excluded. Missing atomic coordinates can hide contacts. Residue or atom origins indicate reference or target-model support. These contacts are model-derived and do not establish binding experimentally.</p><div id="overviewBindingSites"></div></details></section><section id="overviewAiSection" hidden><h2>AI overview</h2><div id="overviewAi"></div></section><section class="overview-detail"><h2><i class="fa-solid fa-circle-info" aria-hidden="true"></i> UniProt info</h2><div id="overviewUniProt"></div></section></div>`;
    pages[11].append(overview);
    const patterns=stats.querySelector('#buildPatternStats').closest('section');patterns.classList.add('overview-detail');const patternsTitle=patterns.querySelector('#patternsTitle'),patternsHeading=document.createElement('h2'),patternsIcon=document.createElement('i');patternsIcon.className='fa-solid fa-diagram-project';patternsIcon.setAttribute('aria-hidden','true');patternsHeading.id=patternsTitle.id;patternsHeading.append(patternsIcon,document.createTextNode(' Patterns'));patternsTitle.replaceWith(patternsHeading);overview.querySelector('#overviewBody').append(patterns);
    const overviewInputs=overview.querySelector('#overviewInputs'), overviewReferences=overview.querySelector('#overviewReferences'), overviewComposition=overview.querySelector('#overviewComposition');
    const addLine=(host,label,value)=>{const p=document.createElement('p'),strong=document.createElement('strong'),span=document.createElement('span');p.className='overview-detail-row';strong.textContent=label;span.textContent=value||'Not provided';p.append(strong,span);host.append(p);};
    let bindingRenderSerial=0,bindingRenderPromise=Promise.resolve(),bindingCacheGeneration=null,bindingImageRun=Promise.resolve(),bindingImageToken=0,bindingImageJobs=[];const bindingImageCache=new Map(),bindingAnalysisCache=new Map(),openBindingTables=new Set();
    const bindingDisclosure=overview.querySelector('#overviewBindingDisclosure');
    function startBindingImages(){
        const token=++bindingImageToken,jobs=bindingImageJobs;
        if(!bindingDisclosure.open||pages[11].hidden){bindingImageRun=Promise.resolve();return;}
        bindingImageRun=(async()=>{for(const job of jobs){
            if(token!==bindingImageToken||!bindingDisclosure.open||pages[11].hidden)return;
            await new Promise(resolve=>setTimeout(resolve,0));
            if(token!==bindingImageToken||!bindingDisclosure.open||pages[11].hidden)return;
            try{let url=bindingImageCache.get(job.site.imageKey);if(!url){url=window.captureOverviewBindingSite(job.site);bindingImageCache.set(job.site.imageKey,url);}job.image.src=url;job.image.hidden=false;job.download.href=url;job.download.hidden=false;job.status.textContent='Site members: 100% opacity · Other members: 20% opacity. Cropped around this site.';}
            catch(error){console.warn('Binding-site image unavailable:',error);job.status.textContent='Binding-site image could not be generated.';}
        }})();
    }
    bindingDisclosure.addEventListener('toggle',()=>{if(bindingDisclosure.open&&!pages[11].hidden)startBindingImages();else ++bindingImageToken;});
    const composition=items=>items?.length?items.map(item=>`${item.name}: ${item.count} ${item.count===1?'copy':'copies'}`).join('; '):'Not available';
    function renderBindingAnalysis(host,result,proteins){
        host.replaceChildren();const grid=document.createElement('div');grid.className='overview-binding-metrics';host.append(grid);
        const metric=(label,value,explanation)=>{const card=document.createElement('div'),caption=document.createElement('span'),text=document.createElement('strong');card.className='overview-binding-metric';caption.textContent=label;text.textContent=value;card.append(caption,text);if(explanation){const note=document.createElement('small');note.textContent=explanation;card.append(note);}grid.append(card);};
        const [a,b]=result.sideSummaries,short=(side)=>`Chain ${proteins[side].chain}`;
        metric('Site members',`${a.count} / ${b.count}`,`${short(0)} / ${short(1)}; ligand members are atoms, polymer members are residues`);
        metric('Close contact pairs',String(result.contactCount),result.method==='heavy-atom'?'Minimum non-hydrogen atom distance ≤ 4.5 Å':'Representative positions ≤ 8 Å');
        const referenceText=row=>`${row.reference}/${row.count} (${row.count?Math.round(100*row.reference/row.count):0}%${row.unknown?`; ${row.unknown} unknown`:''})`;
        metric('Reference-supported members',`${referenceText(a)} / ${referenceText(b)}`,`${short(0)} / ${short(1)}; member presence, not contact support`);
        const incomplete=[a,b].some(row=>row.atomCount<row.count||row.totalChainAtoms<row.totalChainResidues),atomDataAvailable=a.atomCount>0&&b.atomCount>0;
        metric('Closest atom distance',result.closest===null?(atomDataAvailable?'No pair found within 7 Å':'Unavailable'):`${result.closest.toFixed(2)} Å`,'Between site residues; non-hydrogen atoms');
        metric('Potential clashes',atomDataAvailable?String(result.clashes):'Unavailable','Atom pairs overlapping van der Waals radii by more than 0.4 Å');
        metric('Buried surface area',atomDataAvailable?`${((result.buried[0]+result.buried[1])/2).toFixed(0)} Å²`:'Unavailable',atomDataAvailable?`${short(0)}: ${result.buried[0].toFixed(0)} Å²; ${short(1)}: ${result.buried[1].toFixed(0)} Å². Mean of the two sides.`:'Atomic coordinates unavailable for one or both sides.');
        const confidence=row=>row.meanPlddt===null?'Unavailable':`${row.meanPlddt.toFixed(0)} (${row.plddtCount}/${row.count})`;
        metric('Mean local pLDDT',`${confidence(a)} / ${confidence(b)}`,`${short(0)} / ${short(1)}; available residues only`);
        metric('Potential interactions',atomDataAvailable?`${result.hydrogen.length} / ${result.salt.length}`:'Unavailable','N–O proximity candidates / charged residue-pair candidates');
        const chemistry=document.createElement('p');chemistry.className='overview-note';chemistry.hidden=!result.hasProtein;chemistry.append(document.createTextNode('Protein site residue chemistry: '));Object.entries(result.chemistry).forEach(([key,count],index,items)=>{const label=document.createElement('strong');label.className=`overview-chemistry-label-${key}`;label.textContent=key;chemistry.append(label,document.createTextNode(` ${count}${index<items.length-1?' · ':'.'}`));});host.append(chemistry);const bar=document.createElement('div');bar.className='overview-chemistry-bar';bar.hidden=!result.hasProtein;bar.setAttribute('aria-hidden','true');for(const [type,count] of Object.entries(result.chemistry)){if(!count)continue;const segment=document.createElement('span');segment.className=`overview-chemistry-${type}`;segment.style.flex=String(count);segment.title=`${type}: ${count}`;bar.append(segment);}host.append(bar);
        const agreement=document.createElement('p');agreement.className='overview-note';agreement.textContent=result.method==='heavy-atom'?'Reference contact agreement: atom-level comparison is not available for this interface.':result.agreement.length?'Reference contact agreement (comparable residue pairs, ≤ 8 Å in reference): '+result.agreement.map(row=>`${row.id}: ${row.supported}/${row.comparable}`).join(' · ')+'.':'Reference contact agreement: no comparable mapped residue pairs available.';host.append(agreement);
        const note=document.createElement('p');note.className='overview-note';note.textContent=`Buried area uses a 1.4 Å solvent probe and 96 surface samples per atom, summing selected-site atom losses on each isolated chain; it is a site-local estimate and excludes other chains. ${incomplete?'Some residues lack full atomic coordinates, so atom-based results may be incomplete. ':''}${result.defaultRadiusAtomCount?`${result.defaultRadiusAtomCount} atoms use a default 1.7 Å radius, including elements without a specified radius. `:''}Hydrogen-bond candidates are N–O distance matches without donor/acceptor or angle validation. Salt bridges use charged atom proximity. Local pLDDT does not establish interface accuracy. All values describe the current model and do not prove binding.`;host.append(note);
        const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');details.className='overview-binding-properties';summary.textContent='Interaction and clash details';details.append(summary,body);
        const list=(title,rows)=>{const heading=document.createElement('strong'),p=document.createElement('p');heading.textContent=title;p.textContent=rows.length?rows.map(row=>`${row.first} ↔ ${row.second} (${row.distance.toFixed(2)} Å${title==='Largest clashes'?`, overlap ${row.overlap.toFixed(2)} Å`:''})`).join('; '):'None detected among available site atoms.';body.append(heading,p);};
        if(atomDataAvailable){list('Largest clashes',result.worst);list('Potential hydrogen bonds',result.hydrogen);list('Potential salt bridges',result.salt);}else body.textContent='Atomic coordinates are unavailable for one or both sides.';host.append(details);
    }
    function refreshOverview(){
        const snapshot=window.getModelOverviewSnapshot?.()||'';overview.querySelector('#overviewImageSection').hidden=!snapshot;const image=overview.querySelector('#overviewImage');if(snapshot)image.src=snapshot;else image.removeAttribute('src');
        const title=document.getElementById('complexAiTitle').textContent.trim();
        overview.querySelector('#modelOverviewTitle').textContent=title&&title!=='About this protein complex'?`Model overview: ${title}`:'Model overview';
        overviewInputs.replaceChildren();
        addLine(overviewInputs,'What do you want a model of?',document.getElementById('referenceSearchInput').value);
        addLine(overviewInputs,'Reference PDB IDs',document.getElementById('pdbInput1').value);
        addLine(overviewInputs,'AlphaFold IDs, UniProt IDs, or PDB IDs',document.getElementById('pdbInput2').value);
        const data=window.getModelOverviewData?.()||{references:[],model:[]};
        const context=window.getComplexAiContext?.()||{};
        const status=overview.querySelector('#overviewStatus');status.replaceChildren();addLine(status,'Model',context.built?'Aligned model ready':'Not ready');addLine(status,'Simulation',context.built?(context.simulationStatus||'Unknown'):'Not available');
        overviewReferences.replaceChildren();
        if(!data.references.length)overviewReferences.textContent='Reference structures will appear when available.';
        for(const reference of data.references){const section=document.createElement('div');section.className='model-overview-reference';addLine(section,'PDB',reference.id+(reference.title?` — ${reference.title}`:''));addLine(section,'Conformational group',reference.group);const origin=(context.selectionReasons||[]).find(item=>(item.pdbIds||[]).some(id=>id.toUpperCase()===reference.id.toUpperCase()));const sourceNames={ai:'Selected by AI',manual:'Manually supplied',upload:'Uploaded structure',example:'Built-in example',score:'Selected by search score'};addLine(section,'Reference source',sourceNames[origin?.source]||'Unknown');if(origin?.source==='ai')addLine(section,'AI selection reason',origin.reason||'Not available');addLine(section,'Proteins in PDB',composition(reference.proteins));addLine(section,'Proteins in draft model',reference.draft?composition(reference.draft):'Draft model not available');overviewReferences.append(section);}
        overviewComposition.replaceChildren();
        if(!data.model?.length)overviewComposition.textContent='Not available';
        else for(const item of data.model){const row=document.createElement('div'),name=document.createElement('span'),count=document.createElement('strong');row.className='overview-protein';name.textContent=item.name;count.textContent=`${item.count} ${item.count===1?'copy':'copies'}`;row.append(name,count);overviewComposition.append(row);}
        const nucleic=overview.querySelector('#overviewNucleic');nucleic.replaceChildren();
        const na=context.nucleicAcids;
        if(!na?.available)nucleic.textContent='Nucleic-acid information is not available yet.';
        else if(!na.strands?.length)nucleic.textContent='No DNA or RNA strands detected in the model.';
        else {for(const strand of na.strands){const ext=strand.extensions||{};addLine(nucleic,`${strand.detectedChemistry} · chains ${(strand.chains||[]).join(', ')}`,`${strand.detectedStrandCount} ${strand.detectedStrandCount===1?'strand':'strands'}; original residues per strand: ${(strand.originalResidueCounts||[]).join(', ')}${strand.extended?`; visual extensions: ${ext.firstEnd} at first end, ${ext.lastEnd} at last end (${ext.units}); generated ${ext.generatedChemistry}, ${ext.generatedStrandCount} ${ext.generatedStrandCount===1?'strand':'strands'}`:'; no end extensions'}`);}const note=document.createElement('p');note.className='overview-note';note.textContent='Generated extensions are visual additions, not experimentally determined structure. Isolated nucleotide ligands are not counted as strands.';nucleic.append(note);}
        const symmetry=overview.querySelector('#overviewSymmetry');symmetry.replaceChildren();
        const rotations=context.rotationalSymmetries||[],helices=context.helicalSymmetries||[];
        if(!context.built)symmetry.textContent='Symmetry information is not available yet.';
        else {addLine(symmetry,'Rotational symmetry',rotations.length?`${rotations.length} detected ${rotations.length===1?'group':'groups'}`:'No groups currently detected');addLine(symmetry,'Helical symmetry',helices.length?`${helices.length} detected ${helices.length===1?'group':'groups'}`:'No groups currently detected');for(const extension of context.filamentExtensions||[])addLine(symmetry,extension.label||'Pattern extension',`${extension.units} added ${extension.units===1?'unit':'units'}`);const note=document.createElement('p');note.className='overview-note';note.textContent='Detected symmetry and patterns are model-derived observations, not experimental proof.';symmetry.append(note);}
        const animations=overview.querySelector('#overviewAnimations');animations.replaceChildren();
        if(!context.animations?.length)animations.textContent=context.built?'No animations available.':'Animation information is not available yet.';
        else {for(const animation of context.animations){const description=[`${animation.frames?.length||0} keyframes`,animation.loop?'loops':'does not loop',animation.conformationalChange?'conformational change':null].filter(Boolean).join(' · ');addLine(animations,animation.title||'Untitled animation',description);}const note=document.createElement('p');note.className='overview-note';note.textContent='Animated transitions are visual interpolations and do not establish experimentally observed motion.';animations.append(note);}
        const chains=overview.querySelector('#overviewChains');chains.replaceChildren();
        const chainGroups=window.getAiChainSequences?.({detail:'sequence'})||[];
        if(!chainGroups.length)chains.textContent='Chain details are not available yet.';
        else for(const group of chainGroups){const entry=(context.proteins||[]).find(item=>item.accession===group.accession),details=document.createElement('details'),summary=document.createElement('summary'),sequence=document.createElement('p');details.className='overview-chain';summary.textContent=`${group.chains.map(chain=>`Chain ${chain}`).join(', ')} · ${entry?.uniProt?.name||group.accession||group.type||'Unknown protein'}${group.accession?` (${group.accession})`:''} · ${group.residueCount} residues`;sequence.className='overview-sequence';sequence.textContent=group.sequence||'Sequence not available';details.append(summary,sequence);chains.append(details);}
        const binding=overview.querySelector('#overviewBindingSites');binding.replaceChildren();++bindingImageToken;const renderSerial=++bindingRenderSerial,renderJobs=[];if(bindingCacheGeneration!==context.generation){bindingImageCache.clear();bindingAnalysisCache.clear();openBindingTables.clear();bindingCacheGeneration=context.generation;}
        const bindingData=window.getOverviewBindingSites?.()||{available:false,pairs:[]};
        const summaryHost=overview.querySelector('#overviewBindingSummary');summaryHost.replaceChildren();
        if(!bindingData.available){summaryHost.textContent='Binding-site summary will appear when the model is ready.';}
        else {
            const total=bindingData.pairs.reduce((sum,pair)=>sum+pair.sites.length,0),heading=document.createElement('div'),number=document.createElement('strong'),caption=document.createElement('span');heading.className='overview-binding-summary-total';number.textContent=String(total);caption.textContent=total===1?'binding site detected':'binding sites detected';heading.append(number,caption);summaryHost.append(heading);
            if(total){
                const categories=new Map(),typeName=partner=>partner.type==='protein'?'Protein':partner.type==='nucleotide'?'Nucleic acid':partner.type==='other'?'Ligand':'Other';
                for(const pair of bindingData.pairs){const names=pair.proteins.map(typeName).sort((a,b)=>['Protein','Nucleic acid','Ligand','Other'].indexOf(a)-['Protein','Nucleic acid','Ligand','Other'].indexOf(b)),key=names.join('–');categories.set(key,(categories.get(key)||0)+pair.sites.length);}
                const badges=document.createElement('div');badges.className='overview-binding-summary-categories';for(const [name,count] of categories){const badge=document.createElement('span'),value=document.createElement('strong');value.textContent=String(count);badge.append(value,document.createTextNode(` ${name}`));badges.append(badge);}summaryHost.append(badges);
                const list=document.createElement('ul');list.className='overview-binding-summary-list';for(const pair of bindingData.pairs){const item=document.createElement('li'),name=document.createElement('span'),count=document.createElement('strong');name.textContent=pair.proteins.map(partner=>`${partner.name} (chain ${partner.chain})`).join(' ↔ ');count.textContent=`${pair.sites.length} ${pair.sites.length===1?'site':'sites'}`;item.append(name,count);list.append(item);}summaryHost.append(list);
            }
        }
        if(!bindingData.available)binding.textContent='Binding-site information will appear when the model is ready.';
        else if(!bindingData.pairs.length)binding.textContent='No contact patches detected at the current model coordinates.';
        else for(const pair of bindingData.pairs){
            const card=document.createElement('div'),heading=document.createElement('h3'),count=document.createElement('p');card.className='overview-binding-pair';
            const label=protein=>`${protein.name}${protein.accession&&!protein.name.includes(protein.accession)?` (${protein.accession})`:''} · chain ${protein.chain}`;
            heading.textContent=`${label(pair.proteins[0])} ↔ ${label(pair.proteins[1])}`;count.className='overview-binding-count';count.textContent=`${pair.sites.length} ${pair.sites.length===1?'binding site':'distinct binding sites'} between these chains`;card.append(heading,count);
            pair.sites.forEach((site,index)=>{const details=document.createElement('div'),summary=document.createElement('h4'),table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),header=document.createElement('tr');details.className='overview-binding-site';summary.textContent=`Binding site ${index+1} · ${site.contacts.length} close ${site.contacts.length===1?'pair':'pairs'}`;
                for(const text of [label(pair.proteins[0]),label(pair.proteins[1]),'Distance (Å)']){const th=document.createElement('th');th.scope='col';th.textContent=text;header.append(th);}head.append(header);table.append(head,body);
                const residue=value=>`${value.name} ${value.number}${value.insertionCode}${value.atomName?` (${value.atomName})`:''} — ${value.origin==='reference'?`Present in reference PDB${value.references?.length?`: ${value.references.join(', ')}`:''}`:value.origin==='alphafold'?'AlphaFold / target model only':'Origin unknown'}`;
                for(const contact of site.contacts){const row=document.createElement('tr');for(const text of [residue(contact.first),residue(contact.second),contact.distance.toFixed(1)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}body.append(row);}const image=document.createElement('img'),status=document.createElement('p'),contactDetails=document.createElement('details'),contactSummary=document.createElement('summary');image.className='overview-binding-image';image.alt=`Close-up of binding site ${index+1}, ${label(pair.proteins[0])} on the left and ${label(pair.proteins[1])} on the right`;image.hidden=true;status.className='overview-note';status.textContent='Preparing binding-site image…';contactSummary.append(document.createTextNode('Table '));const chevron=document.createElement('i');chevron.className='fa-solid fa-chevron-down';chevron.setAttribute('aria-hidden','true');contactSummary.append(chevron);const tableKey=`${site.blocks.join(':')}:${site.nodePairs.map(edge=>edge.slice().sort((a,b)=>a-b).join('-')).sort().join(',')}`;contactDetails.open=openBindingTables.has(tableKey);contactDetails.addEventListener('toggle',()=>{if(contactDetails.open)openBindingTables.add(tableKey);else openBindingTables.delete(tableKey);});contactDetails.append(contactSummary,table);const siteHeading=document.createElement('div'),select=document.createElement('button'),selectStatus=document.createElement('span');siteHeading.className='overview-binding-site-heading';select.type='button';select.className='overview-binding-select';select.textContent='Select';select.setAttribute('aria-label',`Select binding site ${index+1} members in the 3D viewer`);selectStatus.className='overview-binding-select-status';selectStatus.setAttribute('role','status');select.addEventListener('click',()=>{try{window.selectOverviewBindingSite(site);navigate(3);}catch(error){selectStatus.textContent=error.message;}});siteHeading.append(summary,select);const imageWrap=document.createElement('div'),download=document.createElement('a');imageWrap.className='overview-binding-image-wrap';download.className='overview-binding-download';download.hidden=true;const filenamePart=value=>String(value||'unknown').normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,48)||'unknown';download.download=`binding-site-${index+1}-${pair.proteins.map(protein=>`${filenamePart(protein.name)}-chain-${filenamePart(protein.chain)}`).join('--')}.png`;download.setAttribute('aria-label',`Download binding site ${index+1} image as PNG`);download.title='Download PNG';const downloadIcon=document.createElement('i');downloadIcon.className='fa-solid fa-download';downloadIcon.setAttribute('aria-hidden','true');download.append(downloadIcon);imageWrap.append(image,download);const analysis=document.createElement('div');analysis.className='overview-binding-analysis';analysis.setAttribute('role','status');analysis.textContent='Calculating interface properties…';details.append(siteHeading,selectStatus,imageWrap,status,analysis,contactDetails);card.append(details);renderJobs.push({site,image,status,download,analysis,proteins:pair.proteins});});binding.append(card);
        }
        bindingImageJobs=renderJobs;startBindingImages();
        bindingRenderPromise=(async()=>{for(const job of renderJobs){
            if(renderSerial!==bindingRenderSerial)return;
            await new Promise(resolve=>setTimeout(resolve,0));
            if(renderSerial!==bindingRenderSerial)return;
            try{let result=bindingAnalysisCache.get(job.site.imageKey);if(!result){result=await window.analyzeOverviewBindingSite(job.site);bindingAnalysisCache.set(job.site.imageKey,result);}if(renderSerial!==bindingRenderSerial)return;renderBindingAnalysis(job.analysis,result,job.proteins);}
            catch(error){if(renderSerial!==bindingRenderSerial)return;console.warn('Binding-site analysis unavailable:',error);job.analysis.textContent='Interface properties could not be calculated.';}
        }})();
        const ai=document.getElementById('complexAiSummary');overview.querySelector('#overviewAiSection').hidden=!ai.textContent.trim();overview.querySelector('#overviewAi').replaceChildren(...Array.from(ai.childNodes,node=>node.cloneNode(true)));
        const source=document.getElementById('aboutProteinComplexContent'),target=overview.querySelector('#overviewUniProt');target.replaceChildren(...Array.from(source.childNodes,node=>node.cloneNode(true)));
    }
    window.addEventListener('model-overview-snapshot',()=>{if(!pages[11].hidden)refreshOverview();});
    overview.querySelector('#overviewUniProt').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const source=document.getElementById('aboutProteinComplexContent');const buttons=[...overview.querySelectorAll('#overviewUniProt button')];source.querySelectorAll('button')[buttons.indexOf(button)]?.click();if(button.dataset.proteinAccession||button.closest('.uniprot-feature-list'))navigate(3);});
    function overviewExportStyles(){
        const rules=[];
        for(const sheet of document.styleSheets){
            // Same-origin app styles can be embedded. External fonts and icons are linked separately.
            try{if(sheet.href&&new URL(sheet.href,document.baseURI).origin!==location.origin)continue;rules.push(...Array.from(sheet.cssRules,rule=>rule.cssText));}
            catch(error){console.warn('Could not include an overview stylesheet:',error);}
        }
        return rules.join('\n').replace(/<\/style/gi,'<\\/style');
    }
    async function downloadOverview(html){
        refreshOverview();await Promise.all([bindingRenderPromise,bindingImageRun]);
        const copy=overview.cloneNode(true);
        copy.querySelector('.model-overview-actions').remove();
        copy.querySelectorAll('.overview-binding-select').forEach(button=>button.remove());
        copy.querySelectorAll('[hidden]').forEach(node=>node.remove());
        let content,type;
        if(html){
            const theme=document.body.classList.contains('light-mode')?' class="light-mode"':'';
            const styles=overviewExportStyles();
            content=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Model overview</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Fira+Code:wght@400;500;600&amp;display=swap"><style>${styles}
                html, body { height:auto !important; min-height:100%; overflow:visible !important; }
                body { margin:0; background:#0c1929; }
                body.light-mode { background:#f8fafc; }
                .overview-export-shell { width:100%; padding:4.5rem 4.2rem 2rem; }
                @media (max-width:768px) { .overview-export-shell { padding:2rem 1rem; } }
            </style></head><body${theme}><main class="overview-export-shell">${copy.outerHTML}</main></body></html>`;
            type='text/html';
        }else{
            const details=[...overview.querySelectorAll('details')],openStates=details.map(item=>item.open);
            details.forEach(item=>item.open=true);content=overview.innerText;details.forEach((item,index)=>item.open=openStates[index]);type='text/plain';
        }
        const url=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`model-overview.${html?'html':'txt'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    overview.querySelector('#overviewDownloadText').addEventListener('click',()=>downloadOverview(false));overview.querySelector('#overviewDownloadHtml').addEventListener('click',()=>downloadOverview(true));
    pages[5].append(comparison);
    pages[6].append(ai);
    pages[7].append(session, download);
    pages[8].append(report);
    const editModels = window.createEditModelsPage();
    pages[10].append(editModels.panel);
    pages[9].innerHTML = `<article class="app-about">
        <h1>About StringScape protein modeller</h1>
        <p>StringScape Protein Modeller builds all-atom homology models of protein complexes by aligning AlphaFold models to reference structures from the Protein Data Bank. Models can include DNA, RNA, small molecules, ions and lipid membranes.</p>
        <p>This app was developed by Joel Tregurtha as part of a PhD project at the University of Canterbury, New Zealand, funded by the MacDiarmid Institute.</p>
        <p>This app has been specifically built to be easy to use to democratise access to all-atom homology modelling. We would love your feedback. Contact us below.</p>
        <p>This app is also available as a feature within the main StringScape application (in the Structures view, where all PDB files from a species are displayed and any can be clicked on to build a homology model). This app is open source under an Apache-2.0 licence.</p>
        <p><a class="app-about-contact" href="https://github.com/JoelTre/StringScape/tree/main" target="_blank" rel="noopener noreferrer">View source code <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></p>
        <a class="app-about-contact" href="https://stringscape.net/contact" target="_blank" rel="noopener noreferrer">Contact us <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
        <div class="developer-mode-setting"><label class="nucleic-guide-switch text-sm text-slate-300" for="developerModeToggle">Developer mode <input id="developerModeToggle" type="checkbox" role="switch"></label><p>Show a live model-building log in the 3D viewer.</p></div>
    </article>`;

    const shell = document.createElement('div'); shell.className = 'app-shell';
    const menu = document.createElement('nav'); menu.className = 'app-page-menu'; menu.setAttribute('aria-label', 'App pages');
    const title = document.createElement('h2'); title.textContent = 'Pages'; menu.append(title);
    const layer = document.createElement('div'); layer.className = 'app-page-layer';
    const burger = document.createElement('button'); burger.type = 'button'; burger.className = 'app-menu-toggle'; burger.setAttribute('aria-label', 'Open page menu'); burger.setAttribute('aria-expanded', 'false'); burger.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    const content = document.createElement('div'); content.className = 'app-page-content'; content.append(...pages);
    const topBlur=document.createElement('div'),bottomBlur=document.createElement('div');
    topBlur.className='app-scroll-blur app-scroll-blur-top';bottomBlur.className='app-scroll-blur app-scroll-blur-bottom';
    topBlur.setAttribute('aria-hidden','true');bottomBlur.setAttribute('aria-hidden','true');
    const shadow = document.createElement('div'); shadow.className = 'app-page-shadow'; shadow.setAttribute('aria-hidden', 'true');
    layer.append(shadow, burger, content, topBlur, bottomBlur); shell.append(menu, layer);
    let fadeUpdateFrame=0;
    function updateScrollFades() {
        fadeUpdateFrame=0;
        const maximum=Math.max(0,content.scrollHeight-content.clientHeight);
        layer.classList.toggle('has-scroll-above',content.scrollTop>1);
        layer.classList.toggle('has-scroll-below',maximum-content.scrollTop>1);
    }
    function scheduleScrollFadeUpdate() {
        if(!fadeUpdateFrame)fadeUpdateFrame=requestAnimationFrame(updateScrollFades);
    }
    content.addEventListener('scroll',scheduleScrollFadeUpdate,{passive:true});
    window.addEventListener('resize',scheduleScrollFadeUpdate);
    content.addEventListener('toggle',scheduleScrollFadeUpdate,true);
    if(typeof ResizeObserver!=='undefined') {
        const observer=new ResizeObserver(scheduleScrollFadeUpdate);
        observer.observe(content);pages.forEach(page=>observer.observe(page));
    }
    const viewerBox = document.createElement('div'); viewerBox.className = 'app-physics-viewer'; viewerBox.append(viewer, editModels.viewer);
    main.replaceChildren(shell, viewerBox); main.classList.add('app-workspace');
    const overviewObserver=new MutationObserver(()=>{if(!pages[11].hidden)refreshOverview();});
    for(const id of ['complexAiTitle','complexAiSummary','aboutProteinComplexContent'])overviewObserver.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});
    for(const id of ['referenceSearchInput','pdbInput1','pdbInput2'])document.getElementById(id).addEventListener('input',()=>{if(!pages[11].hidden)refreshOverview();});
    window.DeveloperLog?.mount();
    const mobileSheet=window.createMobilePhysicsSheet({main,layer,burger,viewer:viewerBox,content,heading:document.querySelector('#aboutProteinComplex > h2'),chatInput:document.getElementById('complexAiQuestion')});
    let current = 1, overviewScrollTop = 0;
    document.getElementById('viewerModelOverview').addEventListener('click', () => navigate(12));
    const buttons = menuItems.map(([number, label, icon]) => {
        const button = document.createElement('button'); button.type = 'button';
        button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
        button.addEventListener('click', () => navigate(number)); menu.append(button); return button;
    });
    const mobileThemeToggle = document.createElement('button');
    mobileThemeToggle.type = 'button';
    mobileThemeToggle.className = 'app-mobile-theme-toggle';
    mobileThemeToggle.id = 'mobileThemeToggle';
    mobileThemeToggle.setAttribute('role', 'switch');
    mobileThemeToggle.setAttribute('aria-label', 'Light mode');
    mobileThemeToggle.setAttribute('aria-checked', String(document.body.classList.contains('light-mode')));
    mobileThemeToggle.innerHTML = '<span class="app-mobile-theme-track" aria-hidden="true"><i class="fa-solid fa-moon"></i><i class="fa-solid fa-sun"></i><span></span></span>';
    mobileThemeToggle.addEventListener('click', () => document.getElementById('themeToggle').click());
    menu.append(mobileThemeToggle);
    function setMenu(open) {
        main.classList.toggle('menu-open', open); menu.inert = !open; burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Close page menu' : 'Open page menu');
    }
    function navigate(number) {
        if (number < 1 || number > pages.length) return;
        if(current === 12){overviewScrollTop = content.scrollTop;if(number!==12)++bindingImageToken;}
        current = number;
        if(number === 3) { window.appSetExampleLoading?.(false); window.appSetRecentLoading?.(false); }
        pages.forEach((page, i) => { page.hidden = i !== number - 1; });
        buttons.forEach((button, i) => { if (menuItems[i][0] === number) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
        main.classList.toggle('physics-page', number === 3 || number === 11);
        main.classList.toggle('edit-models-page', number === 11);
        viewer.hidden = number === 11;
        editModels.viewer.hidden = number !== 11;
        if (number === 11) editModels.show();
        if (number === 12) refreshOverview();
        mobileSheet.setPage(number);
        setMenu(false); content.scrollTop = number === 12 ? overviewScrollTop : 0; scheduleScrollFadeUpdate();
        if (number === 2 && details.classList.contains('hidden')) document.getElementById('viewDetailsBtn').click();
        if (number === 5 && stats.classList.contains('hidden')) statsButton.click();
        if (number === 6) comparison.open = true;
        if (number === 9) report.open = true;
        const refreshViewer=()=>{
            window.dispatchEvent(new Event('resize'));
            if(current===3)window.dispatchEvent(new Event('stringscape-physics-page-visible'));
            if(current===4)window.dispatchEvent(new Event('stringscape-molstar-page-visible'));
        };
        requestAnimationFrame(refreshViewer);
        setTimeout(refreshViewer, 350);
    }
    const examplesButton = document.getElementById('exampleModelsButton');
    const examplesMenu = document.getElementById('exampleModelsMenu');
    const exampleLoading=document.createElement('span');exampleLoading.className='example-loading';exampleLoading.setAttribute('role','status');exampleLoading.hidden=true;exampleLoading.textContent='Loading...';examplesButton.after(exampleLoading);
    window.appSetExampleLoading=loading=>{exampleLoading.hidden=!loading;};
    const recentLoading=document.createElement('span');recentLoading.className='example-loading';recentLoading.setAttribute('role','status');recentLoading.hidden=true;recentLoading.textContent='Loading...';document.getElementById('recentModelsButton').after(recentLoading);
    window.appSetRecentLoading=loading=>{recentLoading.hidden=!loading;};
    examplesMenu.addEventListener('click',event=>{if(event.target.closest('button[data-reference]'))window.appSetExampleLoading(true);},true);
    function closeExamples() { examplesMenu.classList.add('hidden'); examplesButton.setAttribute('aria-expanded', 'false'); }
    function placeExamples() {
        const rect = examplesButton.getBoundingClientRect();
        const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 16);
        examplesMenu.style.width = `${width}px`;
        examplesMenu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
        examplesMenu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - examplesMenu.offsetHeight - 8))}px`;
    }
    examplesButton.addEventListener('click', () => {
        const opening = examplesMenu.classList.toggle('hidden') === false;
        examplesButton.setAttribute('aria-expanded', String(opening));
        if (opening) placeExamples();
    });
    examplesMenu.addEventListener('click', event => { if (event.target.closest('button[data-reference]')) closeExamples(); });
    document.addEventListener('click', event => { if (!examplesButton.contains(event.target) && !examplesMenu.contains(event.target)) closeExamples(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !examplesMenu.classList.contains('hidden')) { closeExamples(); examplesButton.focus(); } });
    window.addEventListener('resize', () => { if (!examplesMenu.classList.contains('hidden')) placeExamples(); });
    content.addEventListener('scroll', () => { if (!examplesMenu.classList.contains('hidden')) placeExamples(); });
    burger.addEventListener('click', () => setMenu(!main.classList.contains('menu-open')));
    for (const shiftedUi of [layer, viewerBox]) {
        shiftedUi.addEventListener('click', event => {
            if (!window.matchMedia('(max-width: 768px)').matches || !main.classList.contains('menu-open')) return;
            event.preventDefault();
            event.stopPropagation();
            setMenu(false);
        }, true);
    }
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
    document.addEventListener('click', event => {
        if (event.target.closest('.validation-score-graph')) navigate(5);
        else if (event.target.closest('.validation-color-in-3d, #qmeanKeyUpdate')) navigate(event.target.closest('#qmeanKeyUpdate') ? 9 : 3);
    }, true);
    document.getElementById('jumpToHomologyBtn').addEventListener('click', () => navigate(3));
    window.appNavigate = navigate;
    window.appNavigateWhenSimulationStarts = () => { if (current === 1) navigate(3); };
    navigate(1);
    } finally {
        document.documentElement.classList.remove('app-layout-loading');
    }
})();
