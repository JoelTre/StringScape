/* Genome diagrams use 1-based inclusive NCBI coordinates throughout. */
(function () {
    'use strict';
    const packages = new Map(), panes = new Map();
    let bridge, controller, chromosomeVersion=0, chromosomeCache;
    const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
    const svgEl = (tag, attrs = {}, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text != null) e.textContent = text; return e; };
    const number = n => n.toLocaleString();
    let lastStatus = '';
    function status(text) { lastStatus=text;document.querySelectorAll('#genome-status, .genome-fetch-status').forEach(e=>e.textContent=text); }
    function syncFetchButtons(busy) { document.querySelectorAll('#fetch-genome, .genome-inline-fetch').forEach(b=>b.disabled=busy); }
    function selectedKeys(taxId, selectionRows=bridge?.selection() || []) {
        const rows = selectionRows.filter(row => {
            const nodeTaxId = String(row[0]).match(/^(\d+)\./)?.[1];
            return !taxId || !nodeTaxId || String(taxId) === nodeTaxId;
        });
        return new Set(rows.flat(2).flatMap(GenomeData.keys));
    }
    function importFile(file) {
        return new Promise((resolve, reject) => {
            const worker = new Worker('genome-worker.js');
            worker.onmessage = ({ data }) => { worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.assemblies); };
            worker.onerror = () => { worker.terminate(); reject(new Error('Genome import failed. The file may exceed available browser memory.')); };
            worker.postMessage(file);
        });
    }
    async function add(file) {
        status(`Processing ${file.name}…`);
        try {
            const assemblies = await importFile(file);
            packages.set(file.name, { file, assemblies });chromosomeVersion++;chromosomeCache=null;
            const counts = assemblies.reduce((r, a) => [r[0] + a.chromosomes.length, r[1] + a.genes.length], [0, 0]);
            const summary = `${file.name}\n${counts[0]} sequences · ${number(counts[1])} genes\n` + assemblies.map(a => `${a.accession}: ${a.reports[0]?.organism?.organismName || ''}`).join('\n');
            status(`${counts[0]} sequences · ${number(counts[1])} genes loaded.`); render();bridge?.genomeChanged?.(); return summary;
        } catch (error) { status(error.message); throw error; }
    }
    let contextSignature = '';
    function updateContext() {
        if (!bridge?.context) return;
        const context = bridge.context(), select = document.getElementById('genome-organism');
        const signature = JSON.stringify([context.taxa, context.selectedTaxa]);
        if (signature !== contextSignature) {
            const previous = select.value;
            select.replaceChildren();
            const automatic = el('option', context.taxa.length > 1 && context.selectedTaxa.length !== 1 ? 'Choose organism' : 'Automatic from app data'); automatic.value = ''; select.append(automatic);
            context.taxa.forEach(taxon => { const option = el('option', `Taxon ${taxon}`); option.value = taxon; select.append(option); });
            if (context.selectedTaxa.length === 1) select.value = context.selectedTaxa[0];
            else if (context.taxa.includes(previous)) select.value = previous;
            select.hidden = context.taxa.length < 2;
            document.getElementById('genome-organism-label').hidden = select.hidden;
            contextSignature = signature;
            const taxon = select.value || (context.selectedTaxa.length === 1 ? context.selectedTaxa[0] : context.taxa.length === 1 ? context.taxa[0] : '');
            document.getElementById('genome-source').textContent = taxon ? `Assembly will be detected for taxon ${taxon} using app data and NCBI.` : context.genes.length ? 'Assembly will be detected from the existing NCBI Gene links.' : context.taxa.length > 1 ? 'Choose an organism or select proteins from one organism.' : 'Assembly will be detected from app data.';
        }
        return context;
    }
    async function ncbiReport(kind, identifier, reference) {
        const baseQuery = 'filters.has_annotation=true&filters.assembly_version=current&filters.exclude_paired_reports=true&page_size=100';
        const path = kind === 'gene' ? `gene/id/${identifier}/dataset_report?page_size=5` : kind === 'assembly' ? `genome/accession/${identifier}/dataset_report?${baseQuery}` : `genome/taxon/${identifier}/dataset_report?${baseQuery}&${reference ? 'filters.reference_only=true' : 'tax_exact_match=true'}`;
        let response;
        try { response = await fetch(`https://api.ncbi.nlm.nih.gov/datasets/v2/${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } }); }
        catch (error) {
            if (error.name === 'AbortError') throw error;
            response = await fetch(`/api/ncbi/report/${kind}/${identifier}${kind === 'taxon' ? `?reference=${reference ? 'true' : 'false'}` : ''}`, { signal: controller.signal });
        }
        if (!response.ok) throw new Error(`NCBI assembly lookup failed (HTTP ${response.status}). Try again or enter an assembly accession.`);
        return response.json();
    }
    async function resolveAssembly(taxonOverride='') {
        const context = updateContext(), selectedTaxon = document.getElementById('genome-organism').value;
        const taxon = taxonOverride || selectedTaxon || (context.selectedTaxa.length === 1 ? context.selectedTaxa[0] : context.taxa.length === 1 ? context.taxa[0] : '');
        if (!taxon && context.taxa.length > 1) throw new Error('Choose an organism in the Genome section, or select proteins from one organism.');
        const geneIds = context.genes.filter(g => !taxon || !g.taxId || g.taxId === taxon).map(g => g.geneId);
        status('Finding the NCBI assembly from app data…');
        const resolved = await GenomeResolver.resolve({ taxId: taxon, geneIds }, ncbiReport);
        document.getElementById('genome-source').textContent = `${resolved.organism || `Taxon ${resolved.taxId}`} · ${resolved.accession} · detected from ${resolved.source}`;
        return resolved.accession;
    }
    function availability(){
        const tracks=new Map(),assemblies=new Set();
        for(const pkg of packages.values())for(const a of pkg.assemblies)for(const c of a.chromosomes){assemblies.add(a.accession);const key=a.accession+':'+c.id,prior=tracks.get(key);tracks.set(key,{length:Math.max(prior?.length||0,c.length),genes:Math.max(prior?.genes||0,c.genes.length)});}
        const loaded=tracks.size>0;
        return {genome_loaded:loaded,genome_fetched:loaded,genome_status:controller?'fetching':loaded?'loaded':'not_loaded',genome_fetch_in_progress:!!controller,genome_package_count:packages.size,genome_assembly_count:assemblies.size,genome_chromosome_count:tracks.size,genome_gene_count:[...tracks.values()].reduce((n,c)=>n+c.genes,0),genome_message:controller?lastStatus:loaded?'Genome data is loaded.':'Genome has not been fetched or loaded. Use Fetch_genome to download it.'};
    }
    function summary(options={}){
        const info=availability(),limit=Number.isFinite(Number(options.limit))?Math.max(1,Math.min(100,Math.floor(Number(options.limit)))):30,offset=Number.isFinite(Number(options.offset))?Math.max(0,Math.floor(Number(options.offset))):0;
        const state=chromosomeState(),tracks=[...state.tracks.values()],assemblies=new Map();
        const chromosomes=tracks.map(({a,c})=>{
            const organism=a.reports[0]?.organism||{},taxId=organism.taxId||organism.tax_id||a.taxId||null,name=organism.organismName||organism.organism_name||null;
            if(!assemblies.has(a.accession))assemblies.set(a.accession,{assembly_accession:a.accession,taxon_id:taxId,organism:name,chromosome_count:0,gene_count:0,total_length_bp:0});
            const row=assemblies.get(a.accession);row.chromosome_count++;row.gene_count+=c.genes.length;row.total_length_bp+=c.length;
            return {assembly_accession:a.accession,chromosome:c.name,sequence_accession:c.id,length_bp:c.length,topology:c.topology||'unknown',gene_count:c.genes.length,has_genomic_sequence:!!c.sequence,has_gene_annotations:c.genes.length>0};
        });
        const selected=(bridge?.selection?.()||[]).map(row=>row[0]);
        return {status:info.genome_loaded?'success':'warning',...info,message:info.genome_message,files:[...packages].map(([filename,pkg])=>({filename,source:pkg.source||'uploaded',downloaded_at:pkg.downloadedAt||null})),assemblies:[...assemblies.values()],total_sequence_length_bp:tracks.reduce((n,{c})=>n+c.length,0),sequences_with_genomic_data:tracks.filter(({c})=>c.sequence).length,sequences_with_gene_annotations:tracks.filter(({c})=>c.genes.length).length,matched_selected_protein_count:selected.filter(id=>state.assignments.has(id)).length,chromosomes:chromosomes.slice(offset,offset+limit),total_chromosomes:chromosomes.length,limit,offset,next_offset:offset+limit<chromosomes.length?offset+limit:null};
    }
    async function fetchGenome(options={}) {
        if(controller)return {status:'warning',message:'A genome download is already in progress.',...availability()};
        const fail=message=>{status(message);return {status:'error',message,...availability()};};
        const taxId=String(options.tax_id??'').trim();if(taxId&&!/^\d+$/.test(taxId))return fail('tax_id must be an NCBI taxonomy ID.');
        let accession=String(options.assembly_accession??(taxId?'':document.getElementById('genome-accession').value)).trim().toUpperCase();
        if(accession&&!/^GC[AF]_\d{9}\.\d+$/.test(accession))return fail('Enter a versioned assembly accession, for example GCF_000005845.2.');
        if(options.chromosomes!==undefined&&!Array.isArray(options.chromosomes))return fail('chromosomes must be an array of chromosome names.');
        const chromosomes=(options.chromosomes??document.getElementById('genome-chromosomes').value.split(',')).map(s=>String(s).trim()).filter(Boolean);
        if(chromosomes.length>64||chromosomes.some(c=>!/^[-a-z0-9_.]{1,40}$/i.test(c)))return fail('Enter chromosome names separated by commas, for example X,Y,MT.');
        const query=chromosomes.map(c=>`&chromosomes=${encodeURIComponent(c)}`).join(''),cancel=document.getElementById('cancel-genome');
        syncFetchButtons(true);cancel.hidden=false;controller=new AbortController();let result;
        try {
            if(!accession)accession=await resolveAssembly(taxId);
            else document.getElementById('genome-source').textContent=`Using assembly override ${accession}.`;
            status(`Downloading ${accession}: genome, GFF3 annotations and sequence report…`);
            const endpoint=`https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/${accession}/download?include_annotation_type=GENOME_FASTA&include_annotation_type=GENOME_GFF&include_annotation_type=SEQUENCE_REPORT&hydrated=FULLY_HYDRATED${query}`;
            let response;
            try {response=await fetch(endpoint,{signal:controller.signal,headers:{Accept:'application/zip'}});}
            catch(error){if(error.name==='AbortError')throw error;response=await fetch(`/api/ncbi/genome/${accession}?${query.slice(1)}`,{signal:controller.signal});}
            if(!response.ok)throw Error(`NCBI download failed (HTTP ${response.status}). Check the accession and try again.`);
            const reader=response.body.getReader(),chunks=[];let size=0;
            while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>GenomeData.LIMIT){await reader.cancel();throw Error('Download exceeds the 512 MiB browser limit. Upload a smaller assembly or chromosome subset.');}chunks.push(value);status(`Downloading ${accession} · ${(size/1048576).toFixed(1)} MiB…`);}
            cancel.hidden=true;const filename=`${accession}_genome.zip`;
            await bridge.upload([new File(chunks,filename,{type:'application/zip'})],{actor:options.actor==='AI'?'AI':'Human'});
            const pkg=packages.get(filename);if(!pkg?.assemblies.some(a=>a.chromosomes.length))throw Error('The downloaded package did not contain genomic sequences or annotations.');
            pkg.source='ncbi_download';pkg.downloadedAt=new Date().toISOString();
            result={status:'success',message:`${accession} downloaded, added to uploaded files, and processed.`,assembly_accession:accession,filename,requested_chromosomes:chromosomes};
        }catch(error){const message=error.name==='AbortError'?'Genome download cancelled.':error.message;status(message);result={status:error.name==='AbortError'?'warning':'error',message,...(error.name==='AbortError'?{cancelled:true}:{})};}
        finally{syncFetchButtons(false);cancel.hidden=true;controller=null;}
        return {...result,...availability(),...(result.status==='success'?{summary:summary()}:{} )};
    }
    let catalogStamp, proteinIndexReady=false, proteinIndex = new Map(), tooltip, tooltipTimer, tooltipHideTimer, tooltipAnchor={x:0,y:0}, tooltipSource;
    function invalidateProteins() { catalogStamp = null; proteinIndex.clear();proteinIndexReady=false;chromosomeCache=null; }
    function proteinMatches(gene,taxId) {
        const stamp = bridge?.catalogStamp?.();
        if (stamp !== catalogStamp || !proteinIndexReady) {
            catalogStamp = stamp; proteinIndexReady=true;proteinIndex = new Map();
            for (const record of bridge?.catalog?.() || []) {
                for (const [values,score] of [[record.identifiers,3],[[record.preferred],1]]) for (const key of values.flatMap(GenomeData.keys)) {
                    if (!proteinIndex.has(key)) proteinIndex.set(key,[]);
                    proteinIndex.get(key).push({record,score});
                }
            }
        }
        const hits = new Map();
        for(const key of gene.identifiers) for(const hit of proteinIndex.get(key) || []) {
            if(taxId && hit.record.taxId && String(taxId)!==hit.record.taxId)continue;
            if(!hits.has(hit.record.id)||hits.get(hit.record.id).score<hit.score)hits.set(hit.record.id,hit);
        }
        const best = Math.max(0,...Array.from(hits.values(),h=>h.score));
        return Array.from(hits.values()).filter(h=>h.score===best).map(h=>h.record);
    }
    function chromosomeState(){
        const stamp=String(bridge?.catalogStamp?.())+':'+chromosomeVersion;
        if(chromosomeCache?.stamp===stamp)return chromosomeCache;
        const tracks=new Map(),names=new Map(),sets=new Map(),features=new Map(),regions=new Map();
        for(const pkg of packages.values())for(const a of pkg.assemblies)for(const c of a.chromosomes){
            const key=a.accession+':'+c.id,prior=tracks.get(key);
            tracks.set(key,{a:prior?{...prior.a,...a,reports:a.reports.length?a.reports:prior.a.reports}:a,c:prior?{...prior.c,...c,length:Math.max(prior.c.length,c.length),sequence:c.sequence||prior.c.sequence,genes:c.genes.length?c.genes:prior.c.genes}:c});
            if(!names.has(c.name))names.set(c.name,new Set());names.get(c.name).add(key);
        }
        for(const {a,c} of tracks.values()){
            const label=names.get(c.name).size>1?`${c.name} · ${a.accession} · ${c.id}`:c.name;
            regions.set(label,{name:label,length:c.length});
            for(const gene of c.genes)for(const record of proteinMatches(gene,a.reports[0]?.organism?.taxId||a.taxId))for(const id of new Set([record.id,record.nodeId])){
                if(!sets.has(id))sets.set(id,new Set());sets.get(id).add(label);
                if(!features.has(id))features.set(id,new Map());features.get(id).set(a.accession+':'+c.id+':'+gene.id,{gene,chromosome:c,label});
            }
        }
        const assignments=new Map(Array.from(sets,([id,labels])=>[id,[...labels].sort().join('; ')]));
        const categories=[...new Set(assignments.values())].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        chromosomeCache={stamp,tracks,loaded:tracks.size>0,assignments,features,regions,metrics:new Map(),categoryIndexes:new Map(categories.map((label,i)=>[label,i]))};return chromosomeCache;
    }
    function geneMetrics(id){
        const state=chromosomeState();if(state.metrics.has(id))return state.metrics.get(id);
        const records=[...(state.features.get(id)?.values()||[])],strands=[...new Set(records.map(r=>r.gene.strand).filter(s=>s==='+'||s==='-'))];
        const result={strand:strands.length>1?'Mixed strands':strands[0]==='+'?'Positive (+)':strands[0]==='-'?'Negative (−)':'Unmapped',gene_exon_count:null,gc_content:null,gene_id:null,gene_length:null,genomic_position:null,chromosome:null};
        if(records.length===1){
            const {gene,chromosome,label}=records[0];result.chromosome=label;result.genomic_position=gene.start;result.gene_length=gene.end-gene.start+1;
            result.gene_id=(gene.attrs?.Dbxref||'').split(',').find(value=>/^GeneID:/i.test(value))?.replace(/^GeneID:/i,'')||gene.attrs?.locus_tag||gene.id||null;
            const counts=(gene.transcripts||[]).map(t=>{const ranges=t.exons?.length?t.exons:t.cds;return ranges?.length?new Set(ranges.map(r=>r.start+':'+r.end)).size:null;}).filter(n=>n!=null);
            if(counts.length)result.gene_exon_count=Math.max(...counts);
        }
        let gcComputed=false,gcValue=null;
        Object.defineProperty(result,'gc_content',{enumerable:true,get(){if(!gcComputed){gcComputed=true;if(records.length===1){const {gene,chromosome}=records[0];gcValue=gene.gcContent!==undefined?gene.gcContent:GenomeData.gcContent(chromosome.sequence,gene.start,gene.end);}}return gcValue;}});
        state.metrics.set(id,result);return result;
    }
    function proteinForGene(gene,taxId) {
        const matches = proteinMatches(gene,taxId),selected = new Set((bridge?.selection?.()||[]).map(row=>row[0]));
        const record = matches.find(r=>selected.has(r.id)||selected.has(r.nodeId)) || matches[0];
        return record ? bridge.protein(record.id) : null;
    }
    function hideTooltip() { clearTimeout(tooltipTimer); if(tooltip)tooltip.hidden=true; }
    function placeTooltip(x,y) {
        if(!tooltip||tooltip.hidden)return;
        tooltipAnchor={x,y};
        const rect=tooltip.getBoundingClientRect(),gap=16;
        const left=x+gap+rect.width<=innerWidth-12?x+gap:x-gap-rect.width;
        const top=y+gap+rect.height<=innerHeight-12?y+gap:y-gap-rect.height;
        tooltip.style.left=`${Math.max(12,Math.min(innerWidth-rect.width-12,left))}px`;
        tooltip.style.top=`${Math.max(12,Math.min(innerHeight-rect.height-12,top))}px`;
    }
    function showGeneTooltip(gene,taxId,x,y) {
        const protein=proteinForGene(gene,taxId),product=gene.transcripts?.flatMap(t=>t.cds||[]).find(r=>r.attrs?.product)?.attrs.product || '';
        if(!tooltip){tooltip=el('div',null,'genome-gene-tooltip');tooltip.id='genome-gene-tooltip';tooltip.setAttribute('role','tooltip');document.body.append(tooltip);tooltip.onpointerenter=()=>clearTimeout(tooltipHideTimer);tooltip.onpointerleave=hideTooltip;tooltip.addEventListener('toggle',()=>placeTooltip(tooltipAnchor.x,tooltipAnchor.y),true);}
        const heading=el('div',null,'genome-tooltip-heading'),view=el('button',null,'genome-view-gene'),icon=el('i');icon.className='fa-solid fa-dna';icon.setAttribute('aria-hidden','true');view.type='button';view.append(icon,document.createTextNode(' View Gene'));
        view.onclick=()=>{const state=Array.from(panes.values()).find(p=>p.host===tooltipSource?.closest('.genome-view'));if(!state)return;hideTooltip();const record=proteinMatches(gene,taxId).find(r=>r.id===protein?.id),selectedIds=new Set((bridge?.selection?.()||[]).map(r=>r[0]));if(record&&!selectedIds.has(record.id)&&!selectedIds.has(record.nodeId))bridge?.select([record.id],true,gene.name);state.level='Genes';state.scrollGene=gene.id;state.page=0;state.host.querySelectorAll('.genome-toggle button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent==='Genes')));renderPane(state,true);};
        heading.append(el('div',gene.name,'genome-tooltip-gene'),view);tooltip.replaceChildren(heading,el('div',protein?.name||product||'Protein name unavailable','genome-tooltip-protein'));
        const start=gene.originalStart||gene.start,end=gene.originalEnd||gene.end,grid=el('dl',null,'genome-tooltip-grid');
        for(const [label,value] of [['Protein name',protein?.preferred||'Unavailable'],['Protein ID',protein?.id||'No matching app protein'],['Gene length',`${number(end-start+1)} nt`],['Protein length',protein?.length?`${number(protein.length)} aa`:'Unavailable'],['Gene start',number(start)],['Gene end',number(end)],['Strand',gene.strand==='-'?'Negative (−)':gene.strand==='+'?'Positive (+)':'Unknown']])grid.append(el('dt',label),el('dd',value));
        tooltip.append(grid);
        const roles=GenomeAnnotations.classify(protein?.enrichment||[],[protein?.annotation,product].filter(Boolean).join(' '));
        const badges=el('div',null,'genome-role-badges');for(const role of roles)badges.append(el('span',role.label+(role.confidence==='related'?' · related evidence':''),'genome-role-badge '+role.confidence));tooltip.append(badges);
        if(roles.length){const details=el('details',null,'genome-tooltip-evidence');details.append(el('summary','Role evidence'));const list=el('ul');for(const role of roles)for(const evidence of role.evidence.slice(0,4))list.append(el('li',`${role.label}: ${evidence.description} (${evidence.category}${evidence.term?' · '+evidence.term:''})`));details.append(list);tooltip.append(details);}
        else tooltip.append(el('p','No specific role evidence is available in the loaded annotations.'));
        const sentences=GenomeAnnotations.sentences(protein?.annotation||'');if(sentences.length){tooltip.append(el('h4','Quote from protein annotation'));for(const text of sentences)tooltip.append(el('p',text,'genome-tooltip-quote'));}
        tooltip.append(el('div','Click to select · Shift-click to add to selection','genome-tooltip-hint'));tooltip.hidden=false;placeTooltip(x,y);
    }
    function bindGene(node,gene,taxId) {
        node.classList.add('genome-gene-hit');node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',`Select gene ${gene.name}`);node.dataset.geneId=gene.id||gene.name;
        const activate=event=>{event.stopPropagation();hideTooltip();const matches=proteinMatches(gene,taxId);bridge?.select(matches.map(r=>r.id),event.shiftKey,gene.name);};
        node.addEventListener('mousedown',event=>{event.preventDefault();window.getSelection()?.removeAllRanges();});
        node.addEventListener('dragstart',event=>event.preventDefault());
        node.addEventListener('click',activate);
        node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(event);}});
        let hoverPoint;
        node.addEventListener('pointerenter',event=>{clearTimeout(tooltipHideTimer);clearTimeout(tooltipTimer);hoverPoint={x:event.clientX,y:event.clientY};tooltipTimer=setTimeout(()=>{if(node.isConnected){tooltipSource=node;showGeneTooltip(gene,taxId,hoverPoint.x,hoverPoint.y);}},330);});
        node.addEventListener('pointermove',event=>{hoverPoint={x:event.clientX,y:event.clientY};});
        node.addEventListener('pointerleave',()=>{clearTimeout(tooltipTimer);tooltipHideTimer=setTimeout(hideTooltip,700);});
        node.addEventListener('focus',()=>{const r=node.getBoundingClientRect();tooltipTimer=setTimeout(()=>{tooltipSource=node;showGeneTooltip(gene,taxId,r.right,r.top);},330);});
        node.addEventListener('blur',event=>{if(!tooltip?.contains(event.relatedTarget))hideTooltip();});
        return node;
    }
    function enableGenomeZoom(card,svg,state,key,horizontal=false) {
        const box=svg.viewBox.baseVal,base={x:0,y:0,width:box.width,height:box.height};
        const zoom=state.zooms.get(key)||{...base,scale:1};state.zooms.set(key,zoom);
        const wrapper=svg.parentElement;wrapper.classList.add('genome-zoom-viewport');
        const reset=el('button',null,'genome-reset-zoom'),icon=el('i');icon.className='fa-solid fa-rotate-left';icon.setAttribute('aria-hidden','true');reset.append(icon,document.createTextNode(' zoom'));reset.setAttribute('aria-label','Reset zoom');wrapper.append(reset);
        const apply=()=>{if(horizontal){svg.redrawLinear?.(zoom.x/base.width,zoom.width/base.width);svg.setAttribute('viewBox',`0 0 ${base.width} ${base.height}`);}else svg.setAttribute('viewBox',`${zoom.x} ${zoom.y} ${zoom.width} ${zoom.height}`);reset.hidden=zoom.scale<=1.001;};
        reset.onclick=()=>{Object.assign(zoom,base,{scale:1});hideTooltip();apply();};apply();
        svg.addEventListener('wheel',event=>{
            if(!event.ctrlKey)return;
            event.preventDefault();event.stopPropagation();hideTooltip();
            const matrix=svg.getScreenCTM();if(!matrix)return;
            const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
            const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?svg.clientHeight:1),scale=Math.max(1,Math.min(horizontal?Math.min(64,svg.genomeSpan||64):64,zoom.scale*Math.exp(-delta*.0015)));
            const width=base.width/scale,height=horizontal?base.height:base.height/scale;
            if(horizontal){const fraction=Math.max(0,Math.min(1,(point.x-40)/920));zoom.x+=fraction*(zoom.width-width);zoom.y=0;}else{zoom.x=point.x-(point.x-zoom.x)*width/zoom.width;zoom.y=point.y-(point.y-zoom.y)*height/zoom.height;}
            zoom.x=Math.max(0,Math.min(base.width-width,zoom.x));zoom.y=Math.max(0,Math.min(base.height-height,zoom.y));
            Object.assign(zoom,{width,height,scale});apply();
        },{passive:false});
    }
    function ensurePane(pane) {
        if (panes.has(pane)) return panes.get(pane);
        const host = el('section', null, 'genome-view'); host.id = pane === 'primary' ? 'genome-view' : 'secondary-genome-view'; host.hidden = true;
        host.setAttribute('aria-label', 'Genome view');
        const shell = el('div', null, 'genome-shell'), toolbar = el('div', null, 'genome-toolbar genome-header');
        const focus=el('div',null,'genome-focus-controls');focus.append(el('span','Focus level'));
        toolbar.append(focus);
        const toggle = el('div', null, 'genome-toggle'); toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Focus level');
        const state = { host, level: 'Genome', gap: 10000, page: 0, signature: '', zooms:new Map(), shell };
        for (const level of ['Genome', 'Gene clusters', 'Genes']) {
            const button = el('button', level); button.type = 'button'; button.setAttribute('aria-pressed', String(level === state.level));
            button.onclick = () => { state.level = level; state.page = 0; toggle.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderPane(state, true); };
            toggle.append(button);
        }
        focus.append(toggle); shell.append(toolbar); state.body = el('div'); shell.append(state.body); host.append(shell); document.body.append(host); panes.set(pane, state); return state;
    }
    function setVisible(visible, pane = 'primary') {
        const state = ensurePane(pane); state.host.hidden = !visible;
        if(!visible)hideTooltip();
        document.body.classList.toggle(pane === 'primary' ? 'genome-view-active' : 'secondary-genome-view-active', visible);
        if (visible) renderPane(state, true);
    }
    function card(title, subtitle) { const c = el('article', null, 'genome-card'); c.append(el('h2', title), el('p', subtitle)); return c; }
    function graphic(c, height) { const wrap = el('div', null, 'genome-scroll'), s = svgEl('svg', { viewBox: `0 0 1000 ${height}`, role: 'group' }); s.genomeTax=c.genomeTax;s.setAttribute('aria-label',c.querySelector('h2').textContent); wrap.append(s); c.append(wrap); return s; }
    function tip(node, text) { node.append(svgEl('title', {}, text)); return node; }
    function line(s, x1, y1, x2, y2, extra = {}) { s.append(svgEl('line', { x1, y1, x2, y2, stroke: '#738ca5', 'stroke-width': 2, ...extra })); }
    function label(s, x, y, text, attrs = {}) { const node=svgEl('text', { x, y, fill: 'currentColor', 'font-size': 12, ...attrs }, text); s.append(node);return node; }
    function arrow(s, gene, x, width, y, selected, opacity = 1) {
        const h = 12, w = Math.max(2, width), head = Math.min(7, w / 2), right = gene.strand !== '-';
        const points = right ? `${x},${y-h/2} ${x+w-head},${y-h/2} ${x+w},${y} ${x+w-head},${y+h/2} ${x},${y+h/2}` : `${x+w},${y-h/2} ${x+head},${y-h/2} ${x},${y} ${x+head},${y+h/2} ${x+w},${y+h/2}`;
        s.append(bindGene(svgEl('polygon', { points, fill: selected ? '#facc15' : '#4ca9bb', opacity }),gene,s.genomeTax));
    }
    function linear(c, chromosome, start, end, genes, selected, detailed = false) {
        const lanes = detailed ? 4 : 2, s = graphic(c, detailed ? 180 : 110), fullSpan=Math.max(1,end-start+1);
        function draw(offset=0,fraction=1){
            s.replaceChildren();
            const rangeStart=start+offset*fullSpan,span=Math.max(1,fullSpan*fraction),rangeEnd=rangeStart+span-1,x=pos=>40+(pos-rangeStart)/span*920;
            line(s,40,detailed?45:57.5,960,detailed?45:57.5);
            label(s,40,22,number(Math.round(rangeStart)));label(s,960,22,`${number(Math.round(rangeEnd))} bp`,{'text-anchor':'end'});
            genes.forEach((g,i)=>{
                if(g.end<rangeStart||g.start>rangeEnd)return;
                const isSelected=GenomeData.matches(g,selected),y=detailed?70+(i%lanes)*24:(g.strand==='-'?70:45);
                arrow(s,g,x(Math.max(rangeStart,g.start)),(Math.min(rangeEnd,g.end)-Math.max(rangeStart,g.start)+1)/span*920,y,isSelected,detailed && !isSelected ? .28 : .85);
                if(detailed)bindGene(label(s,x(Math.max(rangeStart,g.start)),y+18,g.name,{opacity:isSelected?1:.45,'font-size':10}),g,s.genomeTax);
            });
            if(!detailed)label(s,40,100,'Ctrl+Scroll to zoom into chromosome');
        }
        s.genomeSpan=fullSpan;s.redrawLinear=draw;draw();
    }
    function circular(c, chromosome, selected) {
        const selectedGenes=chromosome.genes.filter(g=>GenomeData.matches(g,selected)),radius=157,outerRadius=radius+28;
        const positions=selectedGenes.slice(0,24).map(g=>({g,angle:(((g.start+g.end)/2-1)%chromosome.length)/chromosome.length*Math.PI*2-Math.PI/2}));
        const sideCount=Math.max(positions.filter(p=>Math.cos(p.angle)>=0).length,positions.filter(p=>Math.cos(p.angle)<0).length),extra=Math.max(0,outerRadius+Math.max(0,sideCount-1)*2.5+16-207);
        const s = graphic(c,460+extra*2),cx=500,cy=207+extra;
        s.append(svgEl('circle', { cx, cy, r: radius, fill: 'none', stroke: '#53677c', 'stroke-width': 3 }));
        const point = (pos, r) => { const a = (pos - 1) / chromosome.length * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
        const ordered = [...chromosome.genes].sort((a, b) => Number(GenomeData.matches(a, selected)) - Number(GenomeData.matches(b, selected)));
        for (const g of ordered) {
            const r = g.strand === '-' ? radius - 10 : radius + 10, p = point(g.start, r), q = point(g.end + 1, r), match = GenomeData.matches(g, selected);
            const delta = (g.end - g.start + 1) / chromosome.length;
            s.append(bindGene(svgEl('path', { d: `M${p} A${r},${r} 0 ${delta > .5 ? 1 : 0} 1 ${q}`, fill: 'none', stroke: match ? '#facc15' : '#4ca9bb', 'stroke-width': match ? 8 : 5, opacity: match ? 1 : .7 }),g,s.genomeTax));
        }
        for(const right of [false,true]) {
            const side=positions.filter(({angle})=>(Math.cos(angle)>=0)===right).sort((a,b)=>Math.sin(a.angle)-Math.sin(b.angle));
            const radiusRanks=new Map([...side].sort((a,b)=>Math.abs(Math.sin(a.angle))-Math.abs(Math.sin(b.angle))).map((item,i)=>[item.g,i]));
            side.forEach(({g,angle},i)=>{
                const targetY=side.length===1?cy+Math.sin(angle)*120:cy-145+(i+.5)/side.length*290;
                const routeRadius=outerRadius+radiusRanks.get(g)*2.5;
                const targetAngle=right?Math.asin((targetY-cy)/routeRadius):Math.PI-Math.asin((targetY-cy)/routeRadius);
                const sourceAngle=right?angle:angle<0?angle+Math.PI*2:angle;
                const start=[cx+Math.cos(angle)*(radius+16),cy+Math.sin(angle)*(radius+16)];
                const outer=[cx+Math.cos(angle)*routeRadius,cy+Math.sin(angle)*routeRadius];
                const elbow=[cx+Math.cos(targetAngle)*routeRadius,targetY],textX=right?750:250;
                s.append(svgEl('path',{d:`M${start} L${outer} A${routeRadius},${routeRadius} 0 0 ${targetAngle>sourceAngle?1:0} ${elbow} L${textX+(right?-8:8)},${targetY}`,fill:'none',stroke:'#facc15','stroke-width':1,opacity:.75,class:'genome-gene-leader'}));
                bindGene(label(s,textX,targetY+4,g.name,{fill:'#facc15','text-anchor':right?'start':'end'}),g,s.genomeTax);
            });
        }
        label(s, cx, cy - 8, chromosome.name, { 'text-anchor': 'middle', 'font-size': 20 });
        label(s, cx, cy + 18, `${number(chromosome.length)} bp · circular`, { 'text-anchor': 'middle' });
        label(s, cx, 440+extra*2, 'Outer ring: + strand · inner ring: − strand · yellow: matched selection', { 'text-anchor': 'middle' });
        for (let i = 0; i < 4; i++) { const p = point(i / 4 * chromosome.length + 1, radius + 35); label(s, p[0], p[1], number(Math.round(i / 4 * chromosome.length) + 1), { 'text-anchor': 'middle' }); }
    }
    function addPngDownload(cardEl){
        cardEl.classList.add('genome-export-card');const button=el('button',null,'genome-png-download'),icon=el('i');icon.className='fa-solid fa-download';icon.setAttribute('aria-hidden','true');button.type='button';button.append(icon,document.createTextNode(' PNG'));button.setAttribute('aria-label','Download '+cardEl.querySelector('h2').textContent+' as PNG');cardEl.append(button);
        button.onclick=async()=>{
            button.disabled=true;let url;
            try{
                const source=cardEl.querySelector('svg'),clone=source.cloneNode(true),bounds=source.getBoundingClientRect(),width=1400,exportScale=4,height=Math.round(width*bounds.height/Math.max(1,bounds.width));
                clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',width*exportScale);clone.setAttribute('height',height*exportScale);clone.style.color=getComputedStyle(cardEl).color;clone.style.fontFamily=getComputedStyle(source).fontFamily;
                url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const img=new Image();img.src=url;await img.decode();
                const canvas=document.createElement('canvas');canvas.width=width*exportScale;canvas.height=(height+90)*exportScale;const ctx=canvas.getContext('2d');ctx.scale(exportScale,exportScale);ctx.fillStyle=getComputedStyle(cardEl.closest('.genome-view')).backgroundColor;ctx.fillRect(0,0,width,height+90);ctx.fillStyle=getComputedStyle(cardEl).color;ctx.font='600 20px system-ui';ctx.fillText(cardEl.querySelector('h2').textContent,24,30,width-48);ctx.font='13px system-ui';ctx.fillText(cardEl.querySelector('p').textContent,24,56,width-48);ctx.drawImage(img,0,82,width,height);
                const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed.');const downloadUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=downloadUrl;a.download=cardEl.querySelector('h2').textContent.replace(/[^a-z0-9._-]+/gi,'_')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);
            }catch(error){status(error.message);}finally{if(url)URL.revokeObjectURL(url);button.disabled=false;}
        };
    }
    function geneCard(a,chromosome,g) {
        const protein=proteinForGene(g,a.reports[0]?.organism?.taxId||a.taxId);
        const c=card(`${g.name} (codes for ${protein?.preferred||protein?.name||g.name})`,`${a.accession} · ${chromosome.name} · ${number(g.start)}–${number(g.end)} · ${g.strand==='-'?'Negative':'Positive'} strand`);
        c.dataset.geneCard=g.id;c.genomeReady=GenomeSequenceView.mount(c,chromosome,g,protein);
        return c;
    }
    function renderPane(state, force = false) {
        if (state.host.hidden) return;
        const selectionRows=bridge?.selection?.()||[], selectionCache=new Map();
        const selectionFor=taxId=>{const key=String(taxId||'');if(!selectionCache.has(key))selectionCache.set(key,selectedKeys(taxId,selectionRows));return selectionCache.get(key);};
        const selected = selectionFor(), signature = JSON.stringify([...selected]);
        if (!force && signature === state.signature) return;
        state.signature = signature; hideTooltip(); state.body.replaceChildren();
        // Join separately uploaded GFF3 and FASTA tracks by assembly and sequence accession.
        const merged = new Map();
        for (const pkg of packages.values()) for (const a of pkg.assemblies) {
            if (!merged.has(a.accession)) merged.set(a.accession, { ...a, chromosomes: new Map() });
            const assembly = merged.get(a.accession);
            if (a.reports.length) assembly.reports = a.reports;
            for (const c of a.chromosomes) {
                const prior = assembly.chromosomes.get(c.id);
                assembly.chromosomes.set(c.id, prior ? { ...prior, ...c, length: Math.max(prior.length, c.length),
                    topology: c.topology === 'unknown' ? prior.topology : c.topology,
                    sequence: c.sequence || prior.sequence, genes: c.genes.length ? c.genes : prior.genes } : c);
            }
        }
        const tracks = [...merged.values()].flatMap(a => [...a.chromosomes.values()].map(c => ({ a, c })));
        if (!tracks.length) {
            const empty=el('div',null,'genome-empty');
            empty.append(el('p','Fetch Genome below, or open an NCBI genome ZIP containing genomic FASTA and GFF3 annotations.'));
            const fetchButton=el('button','Fetch Genome','genome-inline-fetch');fetchButton.type='button';fetchButton.disabled=!!controller;fetchButton.onclick=fetchGenome;
            const updates=el('p',lastStatus,'genome-fetch-status');updates.setAttribute('role','status');updates.setAttribute('aria-live','polite');
            empty.append(fetchButton,updates);state.body.append(empty);return;
        }
        const matched = tracks.reduce((n, { a, c }) => n + c.genes.filter(g => GenomeData.matches(g, selectionFor(a.reports[0]?.organism?.taxId || a.taxId))).length, 0);
        state.body.append(el('p', `${packages.size} package(s) · ${tracks.length} sequences · ${number(matched)} genes matched to selected nodes. Yellow = selected. Coordinates are 1-based.`, 'genome-summary'));
        if (state.level === 'Gene clusters') {
            const controls = el('div', null, 'genome-toolbar genome-cluster-controls'), label = el('label', 'Maximum gap between selected genes (bp) to count as a gene cluster '), input = el('input'); input.type = 'number'; input.min = '0'; input.max = '10000000'; input.value = state.gap;
            input.onchange = () => { state.gap = Math.max(0, Math.min(10000000, Number(input.value) || 0)); state.page = 0; renderPane(state, true); }; label.append(input); controls.append(label, el('span', '5,000 bp context on either side','genome-cluster-context')); state.body.append(controls);
        }
        const items = [];
        for (const { a, c } of tracks) {
            const selected = selectionFor(a.reports[0]?.organism?.taxId || a.taxId);
            if (state.level === 'Genome') items.push(() => {
                const cardEl = card(c.name, `${a.reports[0]?.organism?.organismName || a.accession} · ${c.id} · ${number(c.length)} bp · ${c.topology === 'unknown' ? 'topology not reported' : c.topology} · ${number(c.genes.length)} genes`);
                cardEl.genomeTax=a.reports[0]?.organism?.taxId||a.taxId;
                if (c.topology === 'circular') circular(cardEl, c, selected); else linear(cardEl, c, 1, c.length, [...c.genes].sort((a, b) => Number(GenomeData.matches(a, selected)) - Number(GenomeData.matches(b, selected))), selected);
                const selectedGenes = c.genes.filter(g => GenomeData.matches(g, selected));
                if (selectedGenes.length) { const names = el('p', `Selected genes: ${selectedGenes.slice(0, 30).map(g => g.name).join(', ')}${selectedGenes.length > 30 ? ` (+${selectedGenes.length - 30} more)` : ''}`); names.className='genome-selected-genes'; cardEl.append(names); }
                enableGenomeZoom(cardEl,cardEl.querySelector('svg'),state,`${a.accession}:${c.id}`,c.topology!=='circular');
                addPngDownload(cardEl);
                if (!c.genes.length) cardEl.append(el('p', 'No gene annotations found for this sequence. Add a package with GFF3 to show genes.'));
                return cardEl;
            });
            else if (state.level === 'Gene clusters') for (const group of GenomeData.clusters(c, selected, state.gap)) items.push(() => {
                const wraps = group.start < 1 || group.end > c.length;
                const cardEl = card(`${c.name} · ${group.selected.map(g => g.name).join(', ')}`, `${a.accession} · ${number(group.start)}–${number(group.end)}${wraps ? ' · wraps across circular origin (extended coordinates)' : ''}`);
                const neighbours = c.genes.flatMap(g => (c.topology === 'circular' ? [-c.length, 0, c.length] : [0]).map(offset => ({ ...g, start: g.start + offset, end: g.end + offset, originalStart: g.start, originalEnd: g.end }))).filter(g => g.end >= group.start && g.start <= group.end).sort((a, b) => a.start - b.start);
                cardEl.genomeTax=a.reports[0]?.organism?.taxId||a.taxId;
                linear(cardEl, c, group.start, group.end, neighbours, selected, true);addPngDownload(cardEl); return cardEl;
            });
            else for (const g of c.genes.filter(g => GenomeData.matches(g, selected))) {if(state.scrollGene===g.id)state.page=Math.floor(items.length/30);items.push(() => geneCard(a, c, g));}
        }
        if (!items.length) state.body.append(el('div', 'No annotated genes match the selected nodes. Select proteins in the network; gene names, locus tags, NCBI IDs and uploaded aliases are used for matching.', 'genome-empty'));
        // Bound SVG work for fragmented assemblies and large selections; every track is reachable.
        const size = 30, pages = Math.ceil(items.length / size); state.page = Math.min(state.page, Math.max(0, pages - 1));
        items.slice(state.page * size, (state.page + 1) * size).forEach(make => state.body.append(make()));
        if(state.scrollGene){const target=Array.from(state.body.querySelectorAll('[data-gene-card]')).find(c=>c.dataset.geneCard===state.scrollGene);state.scrollGene=null;if(target){requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'smooth'}));Promise.all(Array.from(state.body.querySelectorAll('[data-gene-card]'),c=>c.genomeReady)).then(()=>{if(target.isConnected)target.scrollIntoView({block:'start',behavior:'smooth'});});}}
        if (pages > 1) {
            const nav = el('div', null, 'genome-toolbar');
            for (const [text, delta] of [['Previous', -1], ['Next', 1]]) { const button = el('button', text); button.disabled = state.page + delta < 0 || state.page + delta >= pages; button.onclick = () => { state.page += delta; renderPane(state, true); state.host.scrollTop = 0; }; nav.append(button); }
            nav.append(el('span', `Page ${state.page + 1} of ${pages} · ${number(items.length)} diagrams`)); state.body.append(nav);
        }
    }
    function render() { for (const state of panes.values()) renderPane(state, true); }
    window.StringScapeGenome = {
        init(value) {
            bridge = value;
            document.getElementById('fetch-genome').onclick = fetchGenome;
            document.getElementById('cancel-genome').onclick = () => controller?.abort();
            document.getElementById('genome-organism').onchange = () => {
                const taxon = document.getElementById('genome-organism').value;
                document.getElementById('genome-source').textContent = taxon ? `Assembly will be detected for taxon ${taxon}.` : 'Assembly will be detected from selected proteins or loaded app data.';
            };
            updateContext();
            const syncPanels=()=>{
                document.body.classList.toggle('genome-left-minimized',!!document.getElementById('ui-layer')?.classList.contains('minimized'));
                document.body.classList.toggle('genome-right-minimized',!!document.getElementById('right-panel')?.classList.contains('minimized'));
            };
            const observer=new MutationObserver(syncPanels);
            for(const id of ['ui-layer','right-panel'])if(document.getElementById(id))observer.observe(document.getElementById(id),{attributes:true,attributeFilter:['class']});
            syncPanels();
        }, updateContext, invalidateProteins,
        accepts: name => /\.zip$|\.gff3?$|\.fna$/i.test(name) || /(?:genomic|genome).*\.(fna|fa|fasta)$/i.test(name),
        add, availability, summary, fetchGenome, chromosomeState, geneMetrics, has: name => packages.has(name), file: name => packages.get(name)?.file,
        remove(name) { packages.delete(name);chromosomeVersion++;chromosomeCache=null; status(packages.size ? `${packages.size} genome package(s) loaded.` : 'No genome loaded. Fetch an assembly or upload an NCBI genome ZIP.'); render();bridge?.genomeChanged?.(); },
        clear() { packages.clear();chromosomeVersion++;chromosomeCache=null; render();bridge?.genomeChanged?.(); status('No genome loaded.'); }, setVisible, render
    };
})();
