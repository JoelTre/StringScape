/* Session state and controls for user-provided expression matrices. */
(() => {
    'use strict';
    const datasets = new Map(), mappingCache = new WeakMap();
    const importedStudies = new Map(), importedStudyButtons = new Map();
    let bridge, current = '', sample = '', condition = '', time = '', mapped = new Map(), range = [0, 1], report = null;
    let rangeKey = '', selectedRange = [0, 1], rangeOpen = false;
    const data = window.StringScapeExpressionData;
    const element = (tag, text, parent) => {
        const el = document.createElement(tag);
        if (text != null) el.textContent = text;
        if (parent) parent.appendChild(el);
        return el;
    };
    function mappingNodes(dataset) {
        const activeIds = new Set(bridge.nodes().map(node => String(node.id)));
        const catalog = new Map();
        for (const entry of bridge.catalog()) {
            if (!activeIds.has(String(entry.nodeId)) || (dataset.taxon && String(entry.taxId) !== String(dataset.taxon))) continue;
            if (!catalog.has(entry.nodeId)) catalog.set(entry.nodeId, {id: entry.nodeId, aliases: []});
            catalog.get(entry.nodeId).aliases.push(...entry.identifiers, entry.preferred);
        }
        return [...catalog.values()];
    }
    function prepare() {
        const dataset = datasets.get(current);
        if (!dataset || !bridge) { mapped = new Map(); report = null; range = [0, 1]; return; }
        const stamp = bridge.catalogStamp?.();
        const cached = mappingCache.get(dataset);
        const result = cached && stamp != null && cached.stamp === stamp ? cached.result : data.mapRecords(dataset, mappingNodes(dataset));
        if (stamp != null && result !== cached?.result) mappingCache.set(dataset,{stamp,result});
        report = result.report;
        mapped = result.values;
        const values = [...mapped.values()].map(values => data.selectedValue(values, dataset.measurements, {sample, condition, time, aggregate: sample ? '' : 'mean'})).filter(Number.isFinite);
        range = values.reduce(([min, max], number) => [Math.min(min, number), Math.max(max, number)], [Infinity, -Infinity]);
        if (!values.length) range = [0, 1];
        const key = JSON.stringify([current, sample, condition, time, ...range]);
        if (key !== rangeKey) { rangeKey = key; selectedRange = [...range]; }
    }
    function value(id) {
        const dataset = datasets.get(current), values = mapped.get(id);
        return dataset && values ? data.selectedValue(values, dataset.measurements, {sample, condition, time, aggregate: sample ? '' : 'mean'}) : null;
    }
    function colour(id) {
        const number = value(id);
        if (!Number.isFinite(number)) return '#73808c';
        const t = range[0] === range[1] ? 0.5 : (number - range[0]) / (range[1] - range[0]);
        return window.d3.interpolateViridis(Math.max(0, Math.min(1, t)));
    }
    function select(parent, label, entries, selected, onChange) {
        const wrap = element('div', null, parent);
        wrap.className = 'expression-legend-field';
        const labelElement = element('label', label, wrap);
        const input = element('select', null, wrap);
        input.id = `expression-key-${label.toLowerCase().replace(/\s+/g, '-')}`;
        input.dataset.menuGroups = 'simple'; labelElement.htmlFor = input.id;
        input.className = 'expression-legend-select';
        for (const [id, name] of entries) { const option = element('option', name, input); option.value = id; }
        input.value = selected;
        input.addEventListener('change', () => onChange(input.value));
        window.enhanceVariableMenu?.(input);
    }
    function renderRange(controls, dataset) {
        const [min, max] = range, span = max-min, fmt = v => Number(v.toPrecision(6));
        const spectrum = element('div', null, controls); spectrum.className = 'gradient-container';
        const bar = element('div', null, spectrum); bar.className = 'gradient-bar';
        bar.style.background = `linear-gradient(to right, ${Array.from({length:11}, (_,i)=>window.d3.interpolateViridis(i/10)).join(',')})`;
        const leftShade = element('div', null, spectrum), rightShade = element('div', null, spectrum);
        leftShade.className = rightShade.className = 'range-overlay'; leftShade.style.left = '0'; rightShade.style.right = '0';
        const handles = ['minimum','maximum'].map(label=>{const h=element('div', null, spectrum); h.className='range-handle'; h.setAttribute('role','slider'); h.tabIndex=0; h.setAttribute('aria-label',`Expression ${label}`); h.setAttribute('aria-orientation','horizontal'); return h;});
        const labels=element('div',null,controls); labels.className='grad-labels'; element('span',String(fmt(min)),labels); element('span',String(fmt(max)),labels);
        const unit=element('p',dataset.measurement || 'Units not supplied',controls); unit.className='expression-range-unit';
        const toggle=element('button',null,controls); toggle.type='button'; toggle.className='select-range-toggle expression-range-toggle'; toggle.appendChild(document.createTextNode('Select range ')); const arrow=element('i',null,toggle); arrow.className='fa-solid fa-chevron-down'; arrow.setAttribute('aria-hidden','true');
        const ui=element('div',null,controls); ui.hidden=!rangeOpen; toggle.setAttribute('aria-expanded',String(rangeOpen));
        toggle.addEventListener('click',()=>{rangeOpen=!rangeOpen;ui.hidden=!rangeOpen;toggle.setAttribute('aria-expanded',String(rangeOpen));});
        const inputs=element('div',null,ui); inputs.className='range-inputs';
        const boxes=['Min','Max'].map((name,i)=>{const wrap=element('div',null,inputs),label=element('label',name,wrap),input=element('input',null,label);input.type='number';input.step='any';input.setAttribute('aria-label',`Expression range ${name.toLowerCase()}`);return input;});
        function sync() {
            const [lo,hi]=selectedRange, p=span ? (lo-min)/span*100 : 0, q=span ? (hi-min)/span*100 : 100;
            handles[0].style.left=p+'%'; handles[1].style.right=(100-q)+'%'; leftShade.style.width=p+'%'; rightShade.style.width=(100-q)+'%';
            handles.forEach((h,i)=>{h.setAttribute('aria-valuemin',String(i ? lo : min));h.setAttribute('aria-valuemax',String(i ? max : hi));h.setAttribute('aria-valuenow',String(selectedRange[i])); boxes[i].value=String(fmt(selectedRange[i]));});
        }
        function setValue(i,v) { if(!Number.isFinite(v)) return; selectedRange[i]=i ? Math.max(selectedRange[0],Math.min(max,v)) : Math.min(selectedRange[1],Math.max(min,v)); sync(); }
        handles.forEach((h,i)=>{
            window.d3.select(h).call(window.d3.drag().container(()=>spectrum).on('start drag',function(event){const rect=bar.getBoundingClientRect(), x=event.sourceEvent.touches?.[0]?.clientX ?? event.sourceEvent.clientX;setValue(i,min+Math.max(0,Math.min(1,(x-rect.left)/Math.max(1,rect.width)))*span);}));
            h.addEventListener('keydown',event=>{const step=span/100 || 1;let v;if(event.key==='ArrowLeft'||event.key==='ArrowDown')v=selectedRange[i]-step;else if(event.key==='ArrowRight'||event.key==='ArrowUp')v=selectedRange[i]+step;else if(event.key==='Home')v=min;else if(event.key==='End')v=max;else return;event.preventDefault();setValue(i,v);});
            boxes[i].addEventListener('change',()=>setValue(i,Number(boxes[i].value)));
        });
        const choose=element('button','Select',ui); choose.type='button'; choose.addEventListener('click',()=>{boxes.forEach((input,i)=>setValue(i,Number(input.value)));bridge.selectRange?.(...selectedRange);});
        sync();
    }
    function renderKey(controls, legend) {
        if (!datasets.size) {
            const box = element('div', null, controls); box.className = 'expression-legend-box';
            box.textContent = 'Fetch expression data in the left panel under Experimental data, or upload your own experimental data there.';
            return;
        }
        const dataset = datasets.get(current);
        renderRange(controls, dataset);
        const box = element('div', null, controls); box.className = 'expression-legend-box';
        select(box, 'Dataset', [...datasets.keys()].map(name => [name, name]), current, next => {
            current = next; sample = datasets.get(current).measurements[0].sample; condition = ''; time = ''; bridge.refresh();
        });
        const unique = key => [...new Set(dataset.measurements.map(m => m[key]).filter(Boolean))];
        const conditions = unique('condition'), times = unique('time');
        const filterChanged = () => { sample = dataset.measurements.find(m => (!condition || m.condition === condition) && (!time || m.time === time))?.sample || ''; bridge.refresh(); };
        if (conditions.length) select(box, 'Condition', [['', 'All conditions'], ...conditions.map(v => [v, v])], condition, next => { condition = next; filterChanged(); });
        if (times.length) select(box, 'Time step', [['', 'All time steps'], ...times.map(v => [v, v])], time, next => { time = next; filterChanged(); });
        const samples = dataset.measurements.filter(m => (!condition || m.condition === condition) && (!time || m.time === time));
        const options = samples.map(m => [m.sample, m.label]);
        // Mean is offered only after restricting every metadata dimension present.
        if (samples.length > 1 && (!conditions.length || condition) && (!times.length || time)) options.unshift(['', 'Mean of matching samples']);
        select(box, 'Sample', options, sample, next => { sample = next; bridge.refresh(); });
        const selected = dataset.measurements.find(m => m.sample === sample);
        if (selected?.characteristics?.length || selected?.source || selected?.description) {
            const details = element('details', null, box); element('summary', 'Sample details', details);
            if (selected.source) element('p', `Source: ${selected.source}`, details);
            if (selected.description) element('p', selected.description, details);
            for (const item of selected.characteristics || []) element('p', item, details);
        }
        if (dataset.url) {
            const link = element('a', dataset.source === 'ProteomicsDB' ? 'View data source ' : 'View study ', box);
            link.className = 'expression-view-study';
            const icon = element('i', null, link); icon.className = 'fa-solid fa-arrow-up-right-from-square'; icon.setAttribute('aria-hidden', 'true');
            link.href = dataset.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        }
        const coverage = Number.isInteger(dataset.measured_gene_count)
            ? `${dataset.measured_gene_count.toLocaleString()} measured genes; percentage of species genes unavailable.`
            : 'Number and percentage of genes covered unavailable for these identifiers.';
        element('p', coverage, box);
        if (dataset.note) element('p', dataset.note, box);
        if (dataset.excluded_features) element('p', `${dataset.excluded_features.toLocaleString()} unannotated or multi-gene features excluded.`, box);
        element('p', `Mapping report: ${report.matched} identifiers matched network nodes; ${report.unmatched.length} unmatched; ${report.ambiguous.length} ambiguous.`, box);
        if (report.unmatched.length || report.ambiguous.length) {
            const details = element('details', null, box);
            element('summary', 'View unmatched and ambiguous identifiers', details);
            if (report.unmatched.length) element('p', `Unmatched: ${report.unmatched.join(', ')}`, details);
            if (report.ambiguous.length) element('p', `Ambiguous: ${report.ambiguous.join(', ')}`, details);
        }
    }
    function add(name, text, prepared) {
        let dataset;
        if (/\.json$/i.test(name)) {
            dataset = prepared?.dataset || JSON.parse(text);
            if (!Array.isArray(dataset.measurements) || !dataset.measurements.length || !Array.isArray(dataset.records) ||
                dataset.measurements.some(m => typeof m.sample !== 'string' || !m.sample) ||
                dataset.records.some(r => typeof r.id !== 'string' || !Array.isArray(r.values) || r.values.length !== dataset.measurements.length || r.values.some(v => v !== null && !Number.isFinite(v)))) throw new Error('Invalid expression dataset.');
            if (dataset.url && !/^https:\/\/(?:www\.ncbi\.nlm\.nih\.gov\/geo\/query\/acc\.cgi\?acc=GSE\d+|www\.ebi\.ac\.uk\/gxa\/(?:sc\/)?experiments\/E-[A-Z0-9]{4}-\d+|gemma\.msl\.ubc\.ca\/expressionExperiment\/showExpressionExperiment\.html\?id=\d+|www\.proteomicsdb\.org\/)$/.test(dataset.url)) dataset.url = '';
        } else dataset = data.parseDelimited(text);
        if (prepared?.mapping && prepared.stamp != null) mappingCache.set(dataset,{stamp:prepared.stamp,result:prepared.mapping});
        datasets.set(name, dataset);
        current = name; sample = dataset.measurements[0].sample; condition = ''; time = '';
        prepare();
    }
    function remove(name) {
        if (!datasets.delete(name)) return;
        for (const [key, importedName] of importedStudies) if (importedName === name) {
            importedStudies.delete(key);
            for (const button of importedStudyButtons.get(key) || []) { button.disabled = false; button.dataset.imported = ''; }
        }
        if (current === name) { current = datasets.keys().next().value || ''; sample = datasets.get(current)?.measurements[0].sample || ''; condition = ''; time = ''; }
        prepare();
        if (bridge) requestAnimationFrame(() => bridge.refresh());
    }
    let searchSequence = 0, supplementaryMenuSequence = 0, keywordSequence = 0, findSequence = 0;
    let filterGroups = [], appliedTerms = [], geoKeywordMatches = new Set();
    function highlightKeywords(card, terms) {
        if (!card.querySelectorAll || !document.createTreeWalker) return;
        card.querySelectorAll('mark.expression-keyword').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
        card.normalize();
        if (!terms.length) return;
        const escaped = [...new Set(terms)].sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = new RegExp(escaped.join('|'), 'gi');
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {acceptNode(node) {
            return node.parentElement?.closest('button, select, option, input, textarea, .expression-card-status') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }});
        const nodes=[]; while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
            const text=node.nodeValue; pattern.lastIndex=0; let match, offset=0, fragment;
            while ((match=pattern.exec(text))) {
                if (!fragment) fragment=document.createDocumentFragment();
                fragment.append(document.createTextNode(text.slice(offset,match.index)));
                const mark=document.createElement('mark'); mark.className='expression-keyword'; mark.textContent=match[0]; fragment.append(mark);
                offset=match.index+match[0].length;
            }
            if (fragment) { fragment.append(document.createTextNode(text.slice(offset))); node.replaceWith(fragment); }
        }
    }
    function applyStudyFilter() {
        const status = document.getElementById('expression-filter-status');
        let otherMatched = 0, otherTotal = 0;
        for (const {group, cards, source, count, initialCount} of filterGroups) {
            let groupMatches = 0;
            for (const card of cards) {
                const content = (card.textContent || '').toLocaleLowerCase();
                const visible = appliedTerms.every(term => content.includes(term)) || (appliedTerms.length > 0 && source?.id === 'geo' && geoKeywordMatches.has(card.dataset.accession));
                card.hidden = !visible; if (visible) groupMatches++;
                highlightKeywords(card, appliedTerms);
            }
            if (source?.id !== 'geo') { otherTotal += cards.length; otherMatched += groupMatches; }
            if (count) count.textContent = appliedTerms.length ? `${groupMatches} matching ${groupMatches === 1 ? 'card' : 'cards'} shown (${cards.length} loaded).` : initialCount;
            group.hidden = cards.length > 0 && groupMatches === 0 && appliedTerms.length > 0;
        }
        if (status) status.textContent = appliedTerms.length && otherTotal ? `Other databases: ${otherMatched} of ${otherTotal} loaded cards match.` : '';
    }
    function showLimitNotices(results) {
        const box = document.getElementById('expression-limit-notices');
        if (!box) return;
        box.replaceChildren();
        for (const {source, payload} of results) {
            if (!payload || Number(payload.total) <= 30) continue;
            const notice = element('p', `${source.label}: Showing ${payload.studies.length} of ${payload.total} matching studies. Use a keyword search to find more relevant studies.`, box);
            notice.className = 'expression-card-status';
        }
    }
    async function findStudies() {
        const sequence = ++findSequence;
        const keyword = (document.getElementById('expression-filter')?.value || '').trim();
        if (!keyword) { appliedTerms = []; await searchStudies(); return; }
        if (!filterGroups.length) {
            await searchStudies();
            if (sequence !== findSequence) return;
        }
        if (sequence === findSequence) await searchKeywords();
    }
    async function searchKeywords() {
        const input = document.getElementById('expression-filter');
        const status = document.getElementById('expression-keyword-status');
        const taxon = document.getElementById('expression-taxon').value;
        const keyword = (input?.value || '').trim();
        const sequence = ++keywordSequence, studiesSequence = searchSequence;
        appliedTerms = keyword.toLocaleLowerCase().split(/\s+/).filter(Boolean); geoKeywordMatches = new Set();
        applyStudyFilter();
        if (!keyword) { if (status) status.textContent = ''; return; }
        if (!taxon) { if (status) status.textContent = 'Load a network with a taxon ID first.'; return; }
        const source = window.StringScapeExpressionSources.searches(taxon).find(item => item.id === 'geo');
        if (!source?.searchKeywords) { if (status) status.textContent = 'GEO keyword search is unavailable.'; return; }
        showLimitNotices([]);
        const searchStatus = document.getElementById('expression-search-status'); if (searchStatus) searchStatus.textContent = '';
        if (status) status.textContent = 'Searching GEO for matching studies…';
        try {
            const payload = await source.searchKeywords(keyword);
            if (sequence !== keywordSequence || studiesSequence !== searchSequence) return;
            let target = filterGroups.find(item => item.source?.id === 'geo');
            if (!target) {
                const results=document.getElementById('expression-results'), group=element('section',null,results); group.className='expression-source';
                const heading=element('div',null,group); heading.className='expression-source-header'; element('h3','NCBI GEO',heading);
                target={group,cards:[],source}; filterGroups.push(target);
            }
            const existing = new Set(target.cards.map(card=>card.dataset.accession));
            geoKeywordMatches = new Set(payload.studies.map(study=>study.accession));
            let added=0;
            for (const study of payload.studies) if (!existing.has(study.accession)) {
                renderStudy(source,study,target.group,taxon,target); existing.add(study.accession); added++;
            }
            applyStudyFilter();
            showLimitNotices([{source,payload}]);
            if (status) {
                const total = Number(payload.total) || 0, returned = payload.studies.length;
                const result = total === 1 ? '1 study matches' : `${total} studies match`;
                const shown = total === 0 ? 'No studies were returned by GEO.' : returned === total ? `All ${returned} returned by GEO ${returned === 1 ? 'is' : 'are'} shown.` : `${returned} of those returned by GEO are shown.`;
                status.textContent = `GEO: ${result} your search. ${shown} ${added} ${added === 1 ? 'new card was' : 'new cards were'} added.`;
            }
        } catch (error) {
            if (sequence === keywordSequence && studiesSequence === searchSequence && status) status.textContent = `GEO keyword search unavailable: ${error.message}`;
        }
    }
    function showSearchSkeletons(results) {
        const loading = element('div', null, results);
        loading.className = 'expression-skeletons';
        loading.setAttribute('aria-hidden', 'true');
        for (let index = 0; index < 3; index++) {
            const card = element('div', null, loading);
            card.className = 'expression-study-card expression-skeleton-card';
            for (const type of ['badge', 'title', 'short', 'line', 'line', 'button']) {
                const bar = element('div', null, card);
                bar.className = `expression-skeleton-bar expression-skeleton-${type}`;
            }
        }
    }
    function clearStudyResults(results) {
        results.querySelectorAll?.('select[data-menu-groups="simple"]').forEach(select => window.disposeVariableMenu?.(select));
        results.replaceChildren();
        filterGroups = []; keywordSequence++; geoKeywordMatches = new Set();
        showLimitNotices([]);
        const keywordStatus = document.getElementById('expression-keyword-status'); if (keywordStatus) keywordStatus.textContent = '';
        const status = document.getElementById('expression-filter-status'); if (status) status.textContent = '';
    }
    async function searchStudies() {
        const taxon = document.getElementById('expression-taxon').value;
        const status = document.getElementById('expression-search-status');
        const results = document.getElementById('expression-results');
        clearStudyResults(results);
        if (!taxon) { status.textContent = 'Load a network with a taxon ID first.'; return; }
        const sequence = ++searchSequence;
        const keywordButton = document.getElementById('expression-filter-search');
        if (keywordButton) keywordButton.disabled = true;
        results.setAttribute('aria-busy', 'true');
        showSearchSkeletons(results);
        status.textContent = 'Searching expression databases…';
        const sources = window.StringScapeExpressionSources.searches(taxon);
        const responses = await Promise.all(sources.map(async source => {
            try {
                const payload = await source.run();
                return {source, payload};
            } catch (error) { return {source, error}; }
        }));
        if (sequence !== searchSequence) return;
        results.replaceChildren();
        results.removeAttribute('aria-busy');
        if (keywordButton) keywordButton.disabled = false;
        status.textContent = 'Search complete.';
        showLimitNotices(responses);
        for (const {source, payload, error} of responses) {
            const group = element('section', null, results); group.className = 'expression-source';
            const filterGroup = {group, cards:[]}; filterGroups.push(filterGroup);
            const groupHeader = element('div', null, group); groupHeader.className = 'expression-source-header';
            element('h3', source.label, groupHeader);
            if (error) { const message = element('p', `Search unavailable: ${error.message}`, group); message.className = 'expression-source-message'; continue; }
            const count = element('p', source.id === 'proteomics' ? `Showing ${payload.studies.length} biological sources${payload.limited ? ' (results limited)' : ''}.` : `Showing ${payload.studies.length} of ${payload.total} studies.`, groupHeader);
            count.className = 'expression-source-count';
            filterGroup.source = source; filterGroup.count = count; filterGroup.initialCount = count.textContent;
            for (const study of payload.studies) renderStudy(source, study, group, taxon, filterGroup);
        }
        applyStudyFilter();
    }
    function importJob(accession, cardStatus) {
        const list = document.getElementById('expression-import-jobs');
        const row = list ? element('div', null, list) : null;
        if (row) row.className = 'expression-import-job';
        const message = row ? element('span', '', row) : null;
        const action = row ? element('button', 'Cancel', row) : null;
        if (action) { action.type='button'; action.setAttribute('aria-label', `Cancel import ${accession}`); }
        let worker, rejectWorker, cancelled=false;
        const set = text => { cardStatus.textContent = text; if (message) message.textContent = text; };
        const dismiss = () => { if (row) row.remove(); };
        if (action) action.addEventListener('click', () => {
            if (action.dataset.done) { dismiss(); return; }
            cancelled = true; worker?.terminate();
            if (rejectWorker) { const reject=rejectWorker; rejectWorker=null; const error=new Error('Import cancelled.'); error.cancelled=true; reject(error); }
        });
        return {
            set, get cancelled() { return cancelled; },
            finishing() { if (action) { action.disabled=true; action.textContent='Finishing…'; } },
            finish(text) { set(text); if (action) { action.disabled=false; action.textContent='Dismiss'; action.dataset.done='1'; action.setAttribute('aria-label', `Dismiss import status ${accession}`); } },
            async run(source, study, taxon, options, metadata) {
                if (cancelled) { const error=new Error('Import cancelled.'); error.cancelled=true; throw error; }
                if (!window.Worker) {
                    if (source === 'upload-excel' || /\.xlsx?$/i.test(options.filename || '')) throw new Error('This browser cannot import Excel files because Web Workers are unavailable.');
                    set('Downloading and processing data…');
                    const matrix=await window.StringScapeExpressionSources.importStudy(source,study,taxon,options);
                    if (cancelled) { const error=new Error('Import cancelled.'); error.cancelled=true; throw error; }
                    Object.assign(matrix, metadata);
                    for (const measure of matrix.measurements) for (const entry of measure.characteristics || []) {
                        const match=entry.match(/^\s*(condition|treatment|time|time point|timepoint)\s*:\s*(.+)$/i);
                        if (match) measure[/^time/i.test(match[1]) ? 'time' : 'condition'] ||= match[2].trim();
                    }
                    return {text:JSON.stringify(matrix)};
                }
                const stamp=bridge.catalogStamp?.();
                const nodesForMapping=mappingNodes({taxon});
                return new Promise((resolve,reject) => {
                    rejectWorker=reject;
                    try { worker = new window.Worker('expression-import-worker.js?v=geo-sample-v2'); }
                    catch (error) { rejectWorker=null; reject(new Error(`Could not start the background importer: ${error.message}`)); return; }
                    worker.onmessage = event => {
                        const data=event.data;
                        if (data.type === 'progress') { set(data.message); return; }
                        if (data.type === 'parse-atlas-config') {
                            const xml=new DOMParser().parseFromString(data.text,'application/xml');
                            worker.postMessage({type:'atlas-config',config:{invalid:!!xml.querySelector('parsererror'),type:xml.documentElement?.getAttribute('experimentType'),labels:[...xml.querySelectorAll('assay_group')].map(x=>[x.getAttribute('id'),x.getAttribute('label')||x.getAttribute('id')])}});
                            return;
                        }
                        worker.terminate(); worker=null; rejectWorker=null;
                        if (data.type === 'result') resolve({text:data.text,dataset:data.dataset,mapping:data.mapping,stamp});
                        else { const error=new Error(data.message || 'Background import failed.'); error.geoFiles=data.geoFiles; error.requiresCellMean=data.requiresCellMean; error.excelChoices=data.excelChoices; error.archiveFiles=data.archiveFiles; reject(error); }
                    };
                    worker.onerror = () => { worker?.terminate(); worker=null; rejectWorker=null; reject(new Error('The background importer could not run.')); };
                    try { worker.postMessage({source,study:{accession:study.accession,import_id:study.import_id},taxon,options,metadata,nodesForMapping}); }
                    catch (error) { worker.terminate(); worker=null; rejectWorker=null; reject(error); }
                });
            }
        };
    }
    function showGeoCorrection(card, source, correction, taxon) {
        if (!/^GSE\d{1,12}$/.test(correction.accession || '') || typeof source.study !== 'function') return;
        const notice=element('div',null,card); notice.className='expression-study-correction';
        const actions=card.querySelector?.('.expression-study-actions'); if (actions) card.insertBefore(notice,actions);
        element('strong','GEO submitter correction',notice);
        element('p',correction.message,notice);
        const button=element('button',`View ${correction.accession} card`,notice); button.type='button';
        const message=element('p','',notice); message.setAttribute('role','status');
        button.addEventListener('click',async()=>{
            button.disabled=true;
            try {
                const sequence=searchSequence;
                let target=filterGroups.find(entry=>entry.source?.id==='geo');
                if (!target) throw new Error('Search GEO studies again before opening the related study.');
                let related=target.cards.find(entry=>entry.dataset.accession===correction.accession);
                if (!related) {
                    message.textContent=`Loading ${correction.accession} from GEO…`;
                    const study=await source.study(correction.accession);
                    if(sequence!==searchSequence) return;
                    target=filterGroups.find(entry=>entry.source?.id==='geo');
                    if(!target) return;
                    related=target.cards.find(entry=>entry.dataset.accession===correction.accession);
                    if(!related){renderStudy(source,study,target.group,taxon,target);related=target.cards[target.cards.length-1];target.initialCount=`${target.cards.length} study cards loaded, including related studies.`;}
                }
                appliedTerms=[]; geoKeywordMatches=new Set(); keywordSequence++;
                const filter=document.getElementById('expression-filter'); if(filter)filter.value='';
                const status=document.getElementById('expression-keyword-status');if(status)status.textContent='';
                showLimitNotices([]); applyStudyFilter();
                target.group.hidden=false; related.hidden=false; related.scrollIntoView?.({behavior:'smooth',block:'center'});
                message.textContent=`Showing ${correction.accession}.`;
            } catch(error) {message.textContent=`Could not load ${correction.accession}: ${error.message}`;}
            finally {button.disabled=false;}
        });
    }
    function renderStudy(source, study, group, taxon, filterGroup) {
    const card = element('article', null, group); card.className = 'expression-study-card'; card.dataset.accession = study.accession; filterGroup.cards.push(card);
    const identity = element('div', null, card); identity.className = 'expression-study-identity';
    const sourceBadge = element('span', source.label, identity); sourceBadge.className = 'expression-study-source';
    const accessionBadge = element('span', study.accession, identity); accessionBadge.className = 'expression-study-accession';
    const title = element('h4', study.title || 'Untitled study', card); title.className = 'expression-study-title';
    if (source.contributors) {
        const contributors = element('p', 'GEO contributors: Loading…', card); contributors.className = 'expression-study-authors';
        const requestDetails = source.details ? source.details(study.accession) : source.contributors(study.accession).then(names=>({contributors:names,corrections:[]}));
        study.contributorsPromise = requestDetails.then(details => {
            const names=details.contributors || []; study.contributors = names;
            contributors.textContent = `GEO contributors: ${names.length ? names.join(', ') : 'Not listed'}`;
            for(const correction of details.corrections || []) showGeoCorrection(card,source,correction,taxon);
            applyStudyFilter();
        }).catch(() => { contributors.textContent = 'GEO contributors: Unavailable'; });
        if (study.authors?.length) { const authors = element('p', `Publication authors: ${study.authors.join(', ')}`, card); authors.className = 'expression-study-authors'; }
    } else {
        const authors = element('p', `Authors: ${study.authors?.length ? study.authors.join(', ') : 'Unavailable'}`, card); authors.className = 'expression-study-authors';
    }
    if (study.description) { const description = element('p', study.description, card); description.className = 'expression-study-description'; }
    const metadata = element('dl', null, card); metadata.className = 'expression-study-metadata';
    for (const [label, value] of [['Species', study.species], ['Technology', study.technology], ['Samples', study.sample_count]]) {
        const field = element('div', null, metadata);
        element('dt', label, field); element('dd', value || 'Unavailable', field);
    }
    const availability = element('p', 'Measurement units and gene coverage may be unavailable until the study is opened or imported.', card); availability.className = 'expression-study-note';
    if (Array.isArray(study.samples) && study.samples.length) {
        const details = element('details', null, card); details.className = 'expression-study-samples'; const summary = element('summary', 'View samples', details); const chevron = element('i', null, summary); chevron.className = 'fa-solid fa-chevron-down'; chevron.setAttribute('aria-hidden', 'true');
        for (const entry of study.samples) element('p', [entry.accession, entry.title].filter(Boolean).join(' · '), details);
    }
    const notes = {
        proteomics: 'These biological-source values aggregate evidence and are not associated with one study.',
        gemma: 'Gemma processed expression; multi-gene probes are excluded and repeated probes are reported as ambiguous.',
        'single-cell': 'Import uses the default clustering and averages normalized expression over all cells in each cluster.',
        bulk: 'Import supports baseline RNA-seq TPM tables where available.'
    };
    if (notes[source.id]) { const note = element('p', notes[source.id], card); note.className = 'expression-study-note'; }
    const actions = element('div', null, card); actions.className = 'expression-study-actions';
    const button = element('button', null, actions); button.type = 'button';
    const icon = element('i', null, button); icon.className = 'fa-solid fa-file-import'; icon.setAttribute('aria-hidden', 'true');
    button.appendChild(document.createTextNode(' Import this data'));
    const link = element('a', 'View study ', actions); link.className = 'expression-view-study'; link.href = study.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const externalIcon = element('i', null, link); externalIcon.className = 'fa-solid fa-arrow-up-right-from-square'; externalIcon.setAttribute('aria-hidden', 'true');
    const cardStatus = element('p', '', card); cardStatus.className = 'expression-card-status'; cardStatus.setAttribute('role', 'status');
    const studyKey = `${source.id}:${study.accession}:${taxon}`;
    let supplementarySelect, cellMeanCheckbox, excelSelect, archiveSelect, autoFilename = '', imported = importedStudies.has(studyKey);
    if (!importedStudyButtons.has(studyKey)) importedStudyButtons.set(studyKey, new Set());
    importedStudyButtons.get(studyKey).add(button);
    if (imported) { button.disabled = true; button.dataset.imported = '1'; cardStatus.textContent = `Imported ${study.accession}.`; }
    else if (source.details && study.contributorsPromise) {
        button.disabled = true; cardStatus.textContent = 'Checking GEO study notices…';
        study.contributorsPromise.finally(()=>{
            if (cardStatus.textContent === 'Checking GEO study notices…') cardStatus.textContent = '';
            if (!importedStudies.has(studyKey)) button.disabled = false;
        });
    }
    button.addEventListener('click', async () => {
        if (!importedStudies.has(studyKey) && button.dataset.imported) button.dataset.imported = '';
        if (supplementarySelect && !supplementarySelect.value) { cardStatus.textContent = 'Choose a supplementary file first.'; return; }
        if (archiveSelect && !archiveSelect.value) { cardStatus.textContent = 'Choose a file from the archive first.'; return; }
        if (excelSelect && !excelSelect.value) { cardStatus.textContent = 'Choose a worksheet and measurement type first.'; return; }
        button.disabled = true;
        const job = importJob(study.accession, cardStatus); job.set(`Importing ${study.accession}…`);
        try {
            let filename = supplementarySelect?.value || autoFilename, prepared;
            const metadata = {title:study.title,description:study.description,species:study.species,authors:study.authors || [],contributors:study.contributors || [],publication_ids:study.publication_ids || [],taxon};
            try {
                prepared = await job.run(source.id, study, taxon, {filename, allowCellMean:!!cellMeanCheckbox?.checked, excelSelection:excelSelect?.value, archiveMember:archiveSelect?.value}, metadata);
            } catch (error) {
                if (!filename && error.geoFiles?.length === 1) {
                    filename = autoFilename = error.geoFiles[0];
                    prepared = await job.run(source.id, study, taxon, {filename, allowCellMean:!!cellMeanCheckbox?.checked, excelSelection:excelSelect?.value, archiveMember:archiveSelect?.value}, metadata);
                } else throw error;
            }
            const safeId = String((study.import_id || study.accession) + (filename ? '-' + filename : '') + (excelSelect?.value ? '-' + excelSelect.value : '') + (archiveSelect?.value ? '-' + archiveSelect.value : '')).replace(/[^A-Za-z0-9_-]/g, '_');
            const name = `${source.id}-${safeId}.expression.json`;
            if (datasets.has(name)) throw new Error('This dataset is already loaded.');
            const file = new File([prepared.text], name, {type:'application/json'});
            job.set('Adding data and mapping identifiers…'); job.finishing();
            await bridge.upload([file], {name,...prepared});
            imported = true; importedStudies.set(studyKey, name);
            for (const studyButton of importedStudyButtons.get(studyKey) || []) { studyButton.disabled = true; studyButton.dataset.imported = '1'; }
            job.finish(`Imported ${study.accession}. Colour nodes by has been set to Expression. Close this box to see.`);
            bridge.refresh();
        } catch (error) {
            if (error.geoFiles && !supplementarySelect) {
                const container = element('div', null, card); container.className = 'expression-study-note';
                const label = element('label', 'GEO supplementary file:', container);
                supplementarySelect = element('select', null, container);
                supplementarySelect.id = `expression-supplementary-${++supplementaryMenuSequence}`;
                supplementarySelect.dataset.menuGroups = 'simple'; label.htmlFor = supplementarySelect.id;
                const prompt = element('option', 'Choose a file…', supplementarySelect); prompt.value = '';
                for (const name of error.geoFiles) { const option = element('option', /correlation/i.test(name) ? `${name} (correlation workbook)` : name, supplementarySelect); option.value = name; }
                supplementarySelect.addEventListener('change', () => { if (cellMeanCheckbox) cellMeanCheckbox.checked = false; if (excelSelect) { window.disposeVariableMenu?.(excelSelect); excelSelect.parentElement.remove(); excelSelect = null; } if (archiveSelect) { window.disposeVariableMenu?.(archiveSelect); archiveSelect.parentElement.remove(); archiveSelect = null; } });
                window.enhanceVariableMenu?.(supplementarySelect);
                job.finish('Choose a supplementary file above, then press Import this data.');
            } else if (error.archiveFiles) {
                const container=element('div',null,card); container.className='expression-study-note';
                const label=element('label','File in GEO archive:',container);
                archiveSelect=element('select',null,container); archiveSelect.id=`expression-archive-${++supplementaryMenuSequence}`; archiveSelect.dataset.menuGroups='simple'; label.htmlFor=archiveSelect.id;
                const prompt=element('option','Choose an archived file…',archiveSelect); prompt.value='';
                for(const name of error.archiveFiles){const option=element('option',/correlation/i.test(name) ? `${name} (correlation workbook)` : name,archiveSelect);option.value=name;}
                archiveSelect.addEventListener('change',()=>{if(excelSelect){window.disposeVariableMenu?.(excelSelect);excelSelect.parentElement.remove();excelSelect=null;}});
                window.enhanceVariableMenu?.(archiveSelect); job.finish('Choose a file in the archive, then press Import this data.');
            } else if (error.excelChoices) {
                if (excelSelect) { window.disposeVariableMenu?.(excelSelect); excelSelect.parentElement.remove(); }
                const container = element('div', null, card); container.className = 'expression-study-note';
                const label=element('label', 'Worksheet and measurement:', container);
                excelSelect=element('select', null, container); excelSelect.id=`expression-excel-${++supplementaryMenuSequence}`;
                excelSelect.dataset.menuGroups='simple'; label.htmlFor=excelSelect.id;
                const prompt=element('option','Choose a measurement…',excelSelect); prompt.value='';
                for(const choice of error.excelChoices) { const option=element('option',choice.label,excelSelect); option.value=choice.value; }
                window.enhanceVariableMenu?.(excelSelect);
                job.finish('Choose a worksheet and measurement type, then press Import this data.');
            } else if (error.requiresCellMean) {
                if (!cellMeanCheckbox) {
                    const label = element('label', null, card); label.className = 'expression-study-note';
                    cellMeanCheckbox = element('input', null, label); cellMeanCheckbox.type = 'checkbox';
                    label.appendChild(document.createTextNode(' Import the mean across all cells in the selected file. This is not a cell-type or cluster average.'));
                }
                job.finish(error.message);
            } else job.finish(error.cancelled ? `Import of ${study.accession} cancelled.` : `Could not import ${study.accession}: ${error.message}`);
        }
        finally { button.disabled = importedStudies.has(studyKey); }
    });

    }
    async function uploadExcel(original, selection) {
        const status=document.getElementById('expression-upload-status');
        const choiceBox=document.getElementById('expression-excel-upload-choice');
        const base=original.name.replace(/\.xlsx?$/i,''), suffix=selection ? '-' + selection.replace(/[^A-Za-z0-9_-]/g,'_') : '', name=`${base}${suffix}.expression.json`;
        if (datasets.has(name)) { status.textContent='A dataset with this name is already loaded; rename the file or remove the existing dataset.'; return; }
        const job=importJob(original.name,status); job.set(`Importing ${original.name}…`);
        try {
            const prepared=await job.run('upload-excel',{accession:original.name},'',{file:original,excelSelection:selection},{title:original.name});
            const file=new File([prepared.text],name,{type:'application/json'});
            job.set('Adding data and mapping identifiers…'); job.finishing();
            await bridge.upload([file],{name,...prepared});
            choiceBox?.replaceChildren();
            job.finish(`Loaded ${original.name}. Colour nodes by has been set to Expression.`); bridge.refresh();
        } catch(error) {
            if (error.excelChoices && choiceBox) {
                choiceBox.replaceChildren();
                const label=element('label','Worksheet and measurement:',choiceBox);
                const select=element('select',null,choiceBox); select.id='expression-local-excel-choice'; select.dataset.menuGroups='simple'; label.htmlFor=select.id;
                const prompt=element('option','Choose a measurement…',select); prompt.value='';
                for (const choice of error.excelChoices) { const option=element('option',choice.label,select); option.value=choice.value; }
                window.enhanceVariableMenu?.(select);
                const button=element('button','Import selected measurement',choiceBox); button.type='button';
                button.addEventListener('click',()=>{ if (!select.value) { status.textContent='Choose a worksheet and measurement type first.'; return; } const value=select.value; window.disposeVariableMenu?.(select); choiceBox.replaceChildren(); uploadExcel(original,value); });
                job.finish(`Choose a worksheet and measurement type for ${original.name}, then select Import selected measurement.`);
            } else job.finish(error.cancelled ? `Import of ${original.name} cancelled.` : `Could not load ${original.name}: ${error.message}`);
        }
    }
    function init(appBridge) {
        bridge = appBridge;
        const dialog = document.getElementById('expression-dialog');
        document.getElementById('expression-fetch')?.addEventListener('click', () => {
            const taxa = bridge.taxa();
            const select = document.getElementById('expression-taxon'), previous = select.value; select.replaceChildren();
            for (const taxon of taxa) { const option = element('option', `Taxon ${taxon}`, select); option.value = taxon; }
            if (taxa.map(String).includes(previous)) select.value = previous;
            else if (previous) { searchSequence++; findSequence++; clearStudyResults(document.getElementById('expression-results')); const button = document.getElementById('expression-filter-search'); if (button) button.disabled = false; }
            window.enhanceVariableMenu?.(select);
            if (!previous || !taxa.map(String).includes(previous)) document.getElementById('expression-search-status').textContent = taxa.length ? 'Select a taxon and search available studies.' : 'Load a network with a taxon ID first.';
            dialog.showModal();
        });
        document.getElementById('expression-close')?.addEventListener('click', () => dialog.close());
        document.getElementById('expression-taxon').addEventListener('change', () => {
            searchSequence++; findSequence++; clearStudyResults(document.getElementById('expression-results'));
            const filterButton = document.getElementById('expression-filter-search'); if (filterButton) filterButton.disabled = false;
            document.getElementById('expression-results').removeAttribute('aria-busy');
            document.getElementById('expression-search-status').textContent = 'Search available studies for the selected taxon.';
        });
        let pressedOutside = false;
        const outsideDialog = event => {
            const rect = dialog.getBoundingClientRect();
            return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
        };
        dialog.addEventListener('pointerdown', event => { pressedOutside = outsideDialog(event); });
        dialog.addEventListener('click', event => {
            if (pressedOutside && outsideDialog(event)) dialog.close();
            pressedOutside = false;
        });
        document.getElementById('expression-filter-search')?.addEventListener('click', findStudies);
        document.getElementById('expression-filter')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findStudies(); } });
        document.getElementById('expression-upload')?.addEventListener('click', () => document.getElementById('expression-file').click());
        document.getElementById('expression-file')?.addEventListener('change', async event => {
            const status = document.getElementById('expression-upload-status');
            for (const original of event.target.files) {
                if (/\.xlsx?$/i.test(original.name)) { await uploadExcel(original); continue; }
                try {
                    const text = await original.text();
                    data.parseDelimited(text); // Validate before registering an upload.
                    const base = original.name.replace(/\.(?:csv|tsv|txt)$/i, '');
                    const ext = original.name.match(/\.(csv|tsv|txt)$/i)?.[1]?.toLowerCase() || 'csv';
                    const filename = `${base}.expression.${ext}`;
                    if (datasets.has(filename)) throw new Error('A dataset with this name is already loaded; rename the file or remove the existing dataset.');
                    const file = new File([text], filename, {type: original.type});
                    await bridge.upload([file]);
                    status.textContent = `Loaded ${file.name}. Colour nodes by has been set to Expression.`;
                    bridge.refresh();
                } catch (error) { status.textContent = `Could not load ${original.name}: ${error.message}`; }
            }
            event.target.value = '';
        });
    }
    window.StringScapeExpression = {init, add, remove, prepare, value, colour, renderKey,
        has: name => datasets.has(name), clear() { datasets.clear(); current = ''; sample = ''; prepare(); }};
})();
