/* Direct browser access to public expression resources; no application server. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.StringScapeExpressionSources = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
    const ATLAS = 'https://www.ebi.ac.uk/gxa/';
    const FTP = 'https://ftp.ebi.ac.uk/pub/databases/microarray/data/atlas/';
    const PROTEOMICS = 'https://www.proteomicsdb.org/proteomicsdb/logic/api/';
    const GEMMA = 'https://gemma.msl.ubc.ca/';
    let ncbiQueue = Promise.resolve(), lastNcbi = 0;
    let geoMetadataQueue = Promise.resolve(), lastGeoMetadata = 0;
    let importProgress = () => {}, atlasConfigParser = null;
    const setAtlasConfigParser = callback => { atlasConfigParser = callback; };
    const setProgress = callback => { importProgress = typeof callback === 'function' ? callback : () => {}; };
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function request(url, kind = 'json', limit = 128 * 1024 * 1024) {
        let response;
        importProgress('Downloading data…');
        try { response = await fetch(url, {credentials:'omit', signal:AbortSignal.timeout(25000)}); }
        catch (error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('The database request timed out.');
            throw new Error('The browser could not access this database. It may be unavailable or block cross-origin requests.');
        }
        if (!response.ok) throw new Error(`The database returned HTTP ${response.status}.`);
        const size = Number(response.headers.get('content-length'));
        if (size > limit) throw new Error('The data exceeds the browser import size limit.');
        if (kind === 'json') { importProgress('Processing data…'); return response.json(); }
        const bytes = new Uint8Array(await response.arrayBuffer());
        importProgress('Processing data…');
        if (bytes.length > limit) throw new Error('The data exceeds the browser import size limit.');
        if (kind === 'bytes') return bytes;
        if (kind === 'gzip' && bytes[0] === 0x1f && bytes[1] === 0x8b) {
            if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress the downloaded data.');
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            const reader = stream.getReader(), chunks = []; let total = 0;
            while (true) { const {value, done} = await reader.read(); if (done) break; total += value.length; if (total > limit) { await reader.cancel(); throw new Error('The expanded data exceeds the browser import size limit.'); } chunks.push(value); }
            return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
        }
        return new TextDecoder().decode(bytes);
    }
    function ncbi(path, params) {
        const task = ncbiQueue.then(async () => {
            const wait = 370 - (Date.now() - lastNcbi); if (wait > 0) await delay(wait);
            lastNcbi = Date.now();
            return request(EUTILS + path + '?' + new URLSearchParams(params));
        });
        ncbiQueue = task.catch(() => {}); return task;
    }
    async function scientificName(taxon) {
        const data = await ncbi('esummary.fcgi', {db:'taxonomy', id:taxon, retmode:'json'});
        const name = data.result?.[taxon]?.scientificname;
        if (!name) throw new Error('NCBI did not return a scientific name for this taxon.');
        return name;
    }
    function table(text, delimiter = '\t') {
        const rows = []; let row = [], field = '', quoted = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (quoted) { if (c === '"' && text[i+1] === '"') {field += '"'; i++;} else if (c === '"') quoted = false; else field += c; }
            else if (c === '"' && !field) quoted = true;
            else if (c === delimiter) {row.push(field); field = '';}
            else if (c === '\n' || c === '\r') { if(c === '\r' && text[i+1] === '\n') i++; row.push(field); field=''; if(row.some(Boolean)) rows.push(row); row=[]; }
            else field += c;
        }
        if (quoted) throw new Error('The downloaded table contains an incomplete quoted field.');
        if (field || row.length) {row.push(field); rows.push(row);} return rows;
    }
    function number(value) { const raw = String(value ?? '').trim(); if (!raw || /^(NA|N\/A|null|nan)$/i.test(raw)) return null; const n = Number(raw); if (!Number.isFinite(n)) throw new Error('The downloaded table contains a non-numeric value.'); return n; }
    function atlasAccession(id) { if (!/^E-[A-Z0-9]{4}-\d{1,12}$/.test(id)) throw new Error('Invalid Atlas accession.'); return id; }
    function validTaxon(taxon) { if (!/^\d{1,12}$/.test(String(taxon))) throw new Error('Invalid taxon ID.'); return String(taxon); }
    async function searchGeo(taxon, keywords = '') {
        validTaxon(taxon);
        const words = String(keywords).trim().split(/\s+/).map(word => word.replace(/["\\]/g, '')).filter(Boolean);
        const query = `txid${taxon}[Organism:exp] AND gse[ETYP]` + (words.length ? ' AND ' + words.map(word => `"${word}"[All Fields]`).join(' AND ') : '');
        const result = await ncbi('esearch.fcgi',{db:'gds',term:query,retmode:'json',retmax:'30',sort:'relevance'});
        const ids=result.esearchresult?.idlist; if (!Array.isArray(ids)) throw new Error('NCBI GEO returned an unexpected search response.');
        if (!ids.length) return {studies:[],total:Number(result.esearchresult.count)||0};
        const summary=await ncbi('esummary.fcgi',{db:'gds',id:ids.join(','),retmode:'json'});
        let publications={}; const pmids=[...new Set(ids.flatMap(id=>summary.result?.[id]?.pubmedids||[]).map(String).filter(id=>/^\d+$/.test(id)))].slice(0,100);
        if (pmids.length) try { publications=(await ncbi('esummary.fcgi',{db:'pubmed',id:pmids.join(','),retmode:'json'})).result||{}; } catch (_) {}
        const studies=ids.map(id=>summary.result?.[id]).filter(r=>/^GSE\d+$/.test(r?.accession||'')).map(r=>({accession:r.accession,title:r.title||'',description:r.summary||'',species:r.taxon||'',technology:r.gdstype||'',samples:r.samples||[],sample_count:r.n_samples||'',publication_ids:r.pubmedids||[],authors:(publications[r.pubmedids?.[0]]?.authors||[]).map(a=>a.name).filter(Boolean),url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.accession}`}));
        return {studies,total:Number(result.esearchresult.count)||0};
    }
    async function geoDetails(accession) {
        if (!/^GSE\d{1,12}$/.test(accession)) throw new Error('Invalid GEO accession.');
        // Space out requests, without making each response block the next request.
        const turn = geoMetadataQueue.then(async () => {
            const wait = 370 - (Date.now() - lastGeoMetadata); if (wait > 0) await delay(wait);
            lastGeoMetadata = Date.now();
        });
        geoMetadataQueue = turn.catch(() => {});
        await turn;
        const url = 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?' + new URLSearchParams({acc:accession,targ:'self',form:'text',view:'full'});
        const text = await request(url, 'text', 2 * 1024 * 1024);
        if (!text.split(/\r?\n/).some(line => line.trim() === `^SERIES = ${accession}`)) throw new Error('GEO returned an unexpected study record.');
        const contributors=[...text.matchAll(/^!Series_contributor[ \t]*=[ \t]*([^\r\n]+)$/gm)].map(match => match[1].trim().split(',').map(part => part.trim()).filter(Boolean).join(' ')).filter(Boolean);
        const corrections=[...text.matchAll(/^!Series_(?:overall_design|summary)[ \t]*=[ \t]*([^\r\n]+)$/gm)].map(match=>match[1].trim()).filter(line=>/submitter|correct(?:ed)? data/i.test(line) && /correct(?:ed)? data.*\bGSE\d+/i.test(line)).map(line=>({message:line,accession:line.match(/correct(?:ed)? data.*?\b(GSE\d+)\b/i)?.[1]})).filter(x=>x.accession);
        return {contributors,corrections};
    }
    async function geoContributors(accession) { return (await geoDetails(accession)).contributors; }
    async function geoStudy(accession) {
        if (!/^GSE\d{1,12}$/.test(accession)) throw new Error('Invalid GEO accession.');
        const search=await ncbi('esearch.fcgi',{db:'gds',term:`${accession}[ACCN] AND gse[ETYP]`,retmode:'json',retmax:'20'});
        const ids=search.esearchresult?.idlist; if (!Array.isArray(ids) || !ids.length) throw new Error(`GEO did not find ${accession}.`);
        const summary=await ncbi('esummary.fcgi',{db:'gds',id:ids.join(','),retmode:'json'});
        const r=ids.map(id=>summary.result?.[id]).find(x=>x?.accession===accession);
        if(!r) throw new Error(`GEO did not return the ${accession} study.`);
        return {accession:r.accession,title:r.title||'',description:r.summary||'',species:r.taxon||'',technology:r.gdstype||'',samples:r.samples||[],sample_count:r.n_samples||'',publication_ids:r.pubmedids||[],authors:[],url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.accession}`};
    }
    async function searchAtlas(taxon, single, namePromise) {
        const [species,catalog]=await Promise.all([namePromise,request(ATLAS+(single?'sc/':'')+'json/experiments')]);
        if (!Array.isArray(catalog.experiments)) throw new Error('Expression Atlas returned an unexpected catalogue.');
        const all=catalog.experiments.filter(x=>(Array.isArray(x.species)?x.species:[x.species]).some(n=>String(n||'').toLowerCase()===species.toLowerCase()) && /^E-[A-Z0-9]{4}-\d{1,12}$/.test(x.experimentAccession||''));
        return {total:all.length,studies:all.slice(0,30).map(x=>({accession:x.experimentAccession,title:x.experimentDescription||'',species,technology:[x.experimentType||x.technologyType||''].flat().join(', '),sample_count:x.numberOfAssays||'',url:ATLAS+(single?'sc/':'')+'experiments/'+x.experimentAccession}))};
    }
    async function searchGemma(taxon,namePromise) {
        const species=await namePromise, payload=await request(GEMMA+'rest/v2/taxa/'+encodeURIComponent(species)+'/datasets?limit=30');
        if (!Array.isArray(payload.data)) throw new Error('Gemma returned an unexpected response.');
        return {total:payload.totalElements ?? payload.data.length,studies:payload.data.filter(x=>/^\d+$/.test(String(x.id))).map(x=>({accession:x.shortName||String(x.id),import_id:String(x.id),title:x.name||'',description:x.description||'',species,technology:x.technologyType||'',sample_count:x.numberOfBioAssays||'',url:GEMMA+'expressionExperiment/showExpressionExperiment.html?id='+x.id}))};
    }
    async function searchProteomics(taxon) {
        const q=new URLSearchParams({'$format':'json','$filter':`TAXCODE eq ${taxon}`,'$top':'100','$select':'TISSUE_ID,TISSUE_NAME,TISSUE_CATEGORY,TAXCODE'});
        const payload=await request(PROTEOMICS+'tissuelist.xsodata/CA_AVAILABLEBIOLOGICALSOURCES_API?'+q), rows=payload.d?.results;
        if (!Array.isArray(rows)) throw new Error('ProteomicsDB returned an unexpected response.');
        const seen=new Set(), matches=rows.filter(x=>/^BTO:\d+$/.test(x.TISSUE_ID||'') && String(x.TAXCODE)===taxon && !seen.has(x.TISSUE_ID) && seen.add(x.TISSUE_ID));
        return {total:matches.length,limited:rows.length>=100,studies:matches.slice(0,30).map(x=>({accession:x.TISSUE_ID,title:x.TISSUE_NAME||x.TISSUE_ID,species:'Taxon '+taxon,technology:'Mass spectrometry · iBAQ',description:'Biological-source aggregate across ProteomicsDB; not a single study.',url:'https://www.proteomicsdb.org/'}))};
    }
    function searches(taxon) {
        taxon=validTaxon(taxon); let namePromise;
        const name=()=>namePromise ||= scientificName(taxon);
        return [
            {id:'geo',label:'NCBI GEO',run:()=>searchGeo(taxon),searchKeywords:keywords=>searchGeo(taxon,keywords),contributors:geoContributors,details:geoDetails,study:geoStudy},
            {id:'proteomics',label:'ProteomicsDB',run:()=>searchProteomics(taxon)},
            {id:'gemma',label:'Gemma',run:()=>searchGemma(taxon,name())},
            {id:'bulk',label:'Expression Atlas',run:()=>searchAtlas(taxon,false,name())},
            {id:'single-cell',label:'Single Cell Expression Atlas',run:()=>searchAtlas(taxon,true,name())}
        ];
    }
    function geoBase(id) {
        if (!/^GSE\d{1,12}$/.test(id)) throw new Error('Invalid GEO accession.');
        const group = id.length > 6 ? id.slice(0, -3) + 'nnn' : 'GSEnnn';
        return `https://ftp.ncbi.nlm.nih.gov/geo/series/${group}/${id}/`;
    }
    async function geoSupplementaryFiles(id) {
        const html = await request(geoBase(id) + 'suppl/', 'text');
        const files = [];
        for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
            let name; try { name = decodeURIComponent(match[1]); } catch (_) { continue; }
            if (!name.startsWith(id + '_') || !/^[A-Za-z0-9_.-]+$/.test(name)) continue;
            if (/\.(?:(?:csv|tsv|txt)(?:\.gz)?|xlsx|xls)$/i.test(name) && !files.includes(name)) files.push(name);
        }
        return files;
    }
    function geoSupplementary(id, filename, content, allowCellMean) {
        const rows = table(content.replace(/^\uFEFF/, ''), /\.csv(?:\.gz)?$/i.test(filename) ? ',' : '\t');
        const header = rows.shift() || [];
        if (header.length < 2 || !rows.length || rows.some(row => row.length !== header.length)) throw new Error('This supplementary file is not a supported rectangular table.');
        const common = {source:'NCBI GEO', accession:id, url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id}`, supplementary_file:filename};
        const fold = header.findIndex(x => /^(?:log2foldchange|log2fc|logfc|log2_fold_change)$/i.test(x.trim()));
        const gene = header.findIndex(x => /^(?:gene_acc|gene_id|geneid|gene|gene_symbol|genesymbol|symbol|id)$/i.test(x.trim()));
        const rawCount=header.findIndex(x => /^(?:count|counts)$/i.test(x.trim()));
        if (gene >= 0 && /^geneid$/i.test(header[gene].trim()) && rawCount >= 0 && rawCount !== gene) {
            const records=rows.filter(row=>row[gene].trim()).map(row=>({id:row[gene].trim(),values:[number(row[rawCount])]}));
            if (!records.length || !records.some(row=>row.values[0] !== null) || records.some(row=>row.values[0] !== null && (!Number.isInteger(row.values[0]) || row.values[0]<0))) throw new Error('The raw-count table contains invalid values.');
            return {...common,identifierLabel:header[gene],measurements:[{id:filename,sample:filename,label:filename}],records,measured_gene_count:new Set(records.map(x=>x.id)).size,measurement:'Gene counts (normalization not specified)',note:'These are gene counts for one sample; consult the study for normalization.'};
        }
        if (fold >= 0 && gene >= 0 && fold !== gene) {
            const records = rows.filter(row => row[gene].trim()).map(row => ({id:row[gene].trim(), values:[number(row[fold])]}));
            if (!records.length || !records.some(row => row.values[0] !== null)) throw new Error('No numeric fold-change values were found.');
            return {...common, identifierLabel:header[gene], measurements:[{id:filename, sample:filename, label:`${filename}: ${header[fold]}`, condition:filename}], records, measurement:`${header[fold]} · differential expression; consult the study for comparison direction`, note:'Differential comparison values, not per-sample expression. Comparison and normalization are defined by the study.'};
        }
        // Only infer sample columns for files that explicitly identify an abundance measure.
        // Annotation and coordinate columns can also be numeric, so exclude them by name.
        const abundance = filename.match(/(?:^|[_-])(fpkm|tpm|counts?)(?:[_.-]|$)/i);
        if (gene >= 0 && abundance) {
            const annotation = /^(?:gene(?:_.*)?|chr(?:omosome)?|start|end|strand|length|biotype|description|tf_family|id)$/i;
            const columns = header.map((name,index)=>({name:name.trim(),index})).filter(({name,index}) => index !== gene && name && !annotation.test(name) && rows.every(row => {
                const value=row[index].trim(); return !value || /^(?:NA|N\/A|null|nan)$/i.test(value) || Number.isFinite(Number(value));
            }) && rows.some(row => row[index].trim() && Number.isFinite(Number(row[index]))));
            if (!columns.length || new Set(columns.map(x=>x.name)).size !== columns.length) throw new Error('No uniquely named numeric sample columns were found in this abundance table.');
            const records=rows.filter(row=>row[gene].trim()).map(row=>({id:row[gene].trim(),values:columns.map(col=>number(row[col.index]))}));
            if (!records.length) throw new Error('No gene identifiers were found in this abundance table.');
            const unit=abundance[1].toLowerCase() === 'count' || abundance[1].toLowerCase() === 'counts' ? 'Counts' : abundance[1].toUpperCase();
            return {...common,identifierLabel:header[gene],measurements:columns.map(col=>({id:col.name,sample:col.name,label:col.name})),records,measured_gene_count:new Set(records.map(row=>row.id)).size,measurement:`${unit} · per sample`,note:'Sample names and units are taken from the supplementary file; consult the study for experimental conditions and normalization.'};
        }
        if (/^(?:gene|cell|barcode)$/i.test(header[0].trim()) && header.length > 2 && /(?:_bc\d+_|^[ACGT]{12,}(?:-\d+)?$)/i.test(rows[0][0])) {
            if (!allowCellMean) { const error = new Error('This file contains a cell-by-gene table. Choose whether to import the mean across all cells in this file.'); error.requiresCellMean = true; throw error; }
            const genes = header.slice(1).map(x => x.trim());
            if (genes.some(x=>!x) || new Set(genes).size !== genes.length || genes.length * rows.length > 5000000) throw new Error('The cell-by-gene table has duplicate genes or exceeds the browser processing limit.');
            const sums = new Float64Array(genes.length), counts = new Uint32Array(genes.length);
            for (const row of rows) for (let i=0; i<genes.length; i++) { const value=number(row[i+1]); if(value !== null) { sums[i]+=value; counts[i]++; } }
            return {...common, identifierLabel:'Gene ID', measurements:[{id:filename, sample:filename, label:`All cells in ${filename} (n=${rows.length})`, cell_count:rows.length}], records:genes.map((gene,i)=>({id:gene,values:[counts[i] ? sums[i]/counts[i] : null]})), measured_gene_count:genes.length, measurement:'Mean across cells in the selected file; original units and normalization depend on the study', note:'Mean across all cells in this file, including zeros; no cell-type or cluster grouping was available.'};
        }
        throw new Error('This supplementary file does not contain a supported differential-expression table or cell-by-gene matrix.');
    }
    async function geoCellMatrix(id, filename, allowCellMean) {
        let response;
        importProgress('Downloading and processing cell data…');
        try { response = await fetch(geoBase(id) + 'suppl/' + encodeURIComponent(filename), {credentials:'omit', signal:AbortSignal.timeout(60000)}); }
        catch (_) { throw new Error('The browser could not access the GEO supplementary file.'); }
        if (!response.ok) throw new Error(`The database returned HTTP ${response.status}.`);
        if (!response.body || typeof DecompressionStream !== 'function') throw new Error('This browser cannot stream and decompress the GEO file.');
        const reader = response.body.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader();
        let pending='', genes, sums, counts, cells=0, expanded=0;
        function processLine(line) {
            if (!line) return;
            const fields = line.replace(/\r$/, '').split('\t');
            if (!genes) {
                if (!/^(?:gene|cell|barcode)$/i.test(fields[0]) || fields.length < 3) { genes = false; return; }
                if (!allowCellMean) { const error = new Error('This file contains a cell-by-gene table. Choose whether to import the mean across all cells in this file.'); error.requiresCellMean = true; throw error; }
                genes = fields.slice(1).map(x=>x.trim());
                if (genes.some(x=>!x) || new Set(genes).size !== genes.length || genes.length > 100000) throw new Error('Invalid or duplicate gene identifiers.');
                sums = new Float64Array(genes.length); counts = new Uint32Array(genes.length); return;
            }
            if (!cells && !/(?:_bc\d+_|^[ACGT]{12,}(?:-\d+)?$)/i.test(fields[0])) throw new Error('The table orientation cannot be confirmed as cells by genes.');
            if (fields.length !== genes.length + 1 || !fields[0]) throw new Error('The cell-by-gene table has inconsistent rows.');
            if (++cells % 256 === 0) importProgress(`Processing ${cells.toLocaleString()} cells…`);
            if (cells * genes.length > 200000000) throw new Error('The cell-by-gene table exceeds the browser processing limit.');
            for (let i=0;i<genes.length;i++) { const value=number(fields[i+1]); if (value !== null) { sums[i]+=value; counts[i]++; } }
        }
        try {
            while (true) {
                const {value,done} = await reader.read(); if(done) break;
                expanded += value.length; if (expanded > 512 * 1024 * 1024) throw new Error('The expanded GEO file exceeds the browser import size limit.');
                pending += value; let end;
                while ((end=pending.indexOf('\n')) >= 0) { processLine(pending.slice(0,end)); pending=pending.slice(end+1); if (genes === false) { await reader.cancel(); return null; } }
            }
            if (pending) processLine(pending);
        } catch (error) { await reader.cancel().catch(()=>{}); throw error; }
        if (!genes || !cells) throw new Error('The cell-by-gene table contains no cells.');
        return {source:'NCBI GEO',accession:id,url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id}`,supplementary_file:filename,identifierLabel:'Gene ID',measurements:[{id:filename,sample:filename,label:`All cells in ${filename} (n=${cells})`,cell_count:cells}],records:genes.map((gene,i)=>({id:gene,values:[counts[i]?sums[i]/counts[i]:null]})),measured_gene_count:genes.length,measurement:'Mean across cells in the selected file; original units and normalization depend on the study',note:'Mean across all cells in this file, including zeros; no cell-type or cluster grouping was available.'};
    }
    function sampleFilesFromMatrix(rows) {
        const fields = {};
        for (const row of rows) if (row[0]?.startsWith('!Sample_')) (fields[row[0].slice(8)] ||= []).push(row.slice(1));
        const accessions=fields.geo_accession?.[0] || [], files=[];
        for (const [key, entries] of Object.entries(fields)) if (/^supplementary_file(?:_\d+)?$/.test(key)) for (const entry of entries) entry.forEach((raw,i)=>{
            const accession=accessions[i]; if (!/^GSM\d{1,12}$/.test(accession || '')) return;
            try {
                const url=new URL(String(raw).replace(/^ftp:/i,'https:'));
                const group=accession.length>6?accession.slice(0,-3)+'nnn':'GSMnnn';
                const prefix=`/geo/samples/${group}/${accession}/suppl/`;
                const name=decodeURIComponent(url.pathname.slice(prefix.length));
                if(url.origin!=='https://ftp.ncbi.nlm.nih.gov'||!url.pathname.startsWith(prefix)||!name.startsWith(accession+'_')||!/^[A-Za-z0-9_.-]+$/.test(name)||!/\.(?:(?:csv|tsv|txt)(?:\.gz)?|xlsx|xls)$/i.test(name))return;
                files.push({name,url:`https://ftp.ncbi.nlm.nih.gov${prefix}${encodeURIComponent(name)}`,accession,title:fields.title?.[0]?.[i]||accession,organism:fields.organism_ch1?.[0]?.[i]||'',source:fields.source_name_ch1?.[0]?.[i]||'',characteristics:(fields.characteristics_ch1||[]).map(values=>values[i]).filter(Boolean),dataProcessing:(fields.data_processing||[]).map(values=>values[i]).filter(Boolean)});
            } catch (_) {}
        });
        return files;
    }
    function applySampleMetadata(dataset,sample) {
        if (!sample) return dataset;
        if (dataset.measurement==='Gene counts (normalization not specified)' && sample.dataProcessing.some(text=>/\braw counts\b/i.test(text))) { dataset.measurement='Raw RNA-seq read counts (not normalized)'; dataset.note='GEO describes these values as raw counts for one sample; they are not normalized.'; }
        for(const measure of dataset.measurements){
            if(dataset.measurements.length===1){measure.sample=sample.accession;measure.label=sample.title;}
            measure.source=sample.source;measure.organism=sample.organism;measure.characteristics=sample.characteristics;
        }
        return dataset;
    }
    async function gunzipBytes(bytes, limit=128*1024*1024) {
        if (bytes[0]!==0x1f || bytes[1]!==0x8b) throw new Error('The archived gzip file is invalid.');
        if (typeof DecompressionStream!=='function') throw new Error('This browser cannot decompress the downloaded data.');
        const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(), chunks=[]; let total=0;
        while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new Error('The expanded data exceeds the browser import size limit.');}chunks.push(value);}
        return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
    }
    function readTar(bytes) {
        const files=new Map(), decoder=new TextDecoder(); let pos=0;
        const read=(block,start,length)=>decoder.decode(block.subarray(start,start+length)).replace(/\0.*$/s,'');
        while(pos+512<=bytes.length){
            const block=bytes.subarray(pos,pos+512); if(block.every(x=>x===0)) break;
            const rawSize=read(block,124,12).trim(), rawSum=read(block,148,8).trim();
            if(!/^[0-7]+$/.test(rawSize)||!/^[0-7]+$/.test(rawSum))throw new Error('The TAR archive has an invalid header.');
            const checksum=block.reduce((sum,value,index)=>sum+(index>=148&&index<156?32:value),0);
            if(checksum!==parseInt(rawSum,8))throw new Error('The TAR archive checksum is invalid.');
            const size=parseInt(rawSize,8), name=read(block,0,100), prefix=read(block,345,155), type=block[156];
            pos+=512;if(!Number.isSafeInteger(size)||size>32*1024*1024||pos+size>bytes.length)throw new Error('An archived file exceeds the import limit or is incomplete.');
            if(type===0||type===48){
                if(prefix||!/^[A-Za-z0-9_.-]+$/.test(name)||name==='.'||name==='..')throw new Error('The TAR archive contains an unsafe path.');
                if(files.has(name))throw new Error('The TAR archive contains duplicate filenames.');
                if(/\.(?:(?:csv|tsv|txt)(?:\.gz)?|xlsx|xls)$/i.test(name))files.set(name,bytes.subarray(pos,pos+size));
            } else if(type!==53) throw new Error('The TAR archive contains an unsupported entry type.');
            pos+=Math.ceil(size/512)*512;
        }
        return files;
    }
    async function importGeo(id, options = {}) {
        const base = geoBase(id);
        if (options.filename) {
            if (/^GSM\d+_[A-Za-z0-9_.-]+$/.test(options.filename)) {
                const content=await request(base+`matrix/${id}_series_matrix.txt.gz`,'gzip');
                const sample=sampleFilesFromMatrix(table(content)).find(file=>file.name===options.filename);
                if (!sample) throw new Error('This sample file is not declared by the GEO study.');
                let dataset;
                if (/\.xlsx?$/i.test(sample.name)) {
                    const excel=typeof module==='object'&&module.exports?require('./expression-excel.js'):globalThis.StringScapeExpressionExcel;
                    if(!excel) throw new Error('The Excel reader is unavailable.');
                    dataset=excel.read(await request(sample.url,'bytes',32*1024*1024),{selection:options.excelSelection});
                    Object.assign(dataset,{source:'NCBI GEO',accession:id,url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id}`,supplementary_file:sample.name});
                } else dataset=geoSupplementary(id,sample.name,await request(sample.url,'gzip'),options.allowCellMean);
                return applySampleMetadata(dataset,sample);
            }
            if (options.filename===`${id}_RAW.tar`) {
                const archive=readTar(await request(base+'suppl/'+encodeURIComponent(options.filename),'bytes'));
                if (!archive.size) throw new Error('The archive contains no supported expression files.');
                if (!options.archiveMember) {const error=new Error('Choose a file from the GEO archive.');error.archiveFiles=[...archive.keys()];throw error;}
                const bytes=archive.get(options.archiveMember); if(!bytes) throw new Error('The selected file is not in the GEO archive.');
                let dataset;
                if (/\.xlsx?$/i.test(options.archiveMember)) {
                    const excel=typeof module==='object'&&module.exports?require('./expression-excel.js'):globalThis.StringScapeExpressionExcel;
                    if(!excel) throw new Error('The Excel reader is unavailable.');
                    dataset={...excel.read(bytes,{selection:options.excelSelection}),source:'NCBI GEO',accession:id,url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id}`,supplementary_file:options.archiveMember};
                } else {
                    const text=/\.gz$/i.test(options.archiveMember)?await gunzipBytes(bytes):new TextDecoder().decode(bytes);
                    dataset=geoSupplementary(id,options.archiveMember,text,options.allowCellMean);
                }
                if (/^GSM\d+_/.test(options.archiveMember)) {
                    try { const matrixText=await request(base+`matrix/${id}_series_matrix.txt.gz`,'gzip'); applySampleMetadata(dataset,sampleFilesFromMatrix(table(matrixText)).find(file=>file.name===options.archiveMember)); } catch (_) {}
                }
                return dataset;
            }
            if (!options.filename.startsWith(id + '_') || !/^[A-Za-z0-9_.-]+$/.test(options.filename) || !/\.(?:(?:csv|tsv|txt)(?:\.gz)?|xlsx|xls)$/i.test(options.filename)) throw new Error('Invalid GEO supplementary filename.');
            if (/\.xlsx?$/i.test(options.filename)) {
                const excel = typeof module === 'object' && module.exports ? require('./expression-excel.js') : globalThis.StringScapeExpressionExcel;
                if (!excel) throw new Error('The Excel reader is unavailable.');
                const bytes=await request(base + 'suppl/' + encodeURIComponent(options.filename), 'bytes', 32 * 1024 * 1024);
                const dataset=excel.read(bytes,{selection:options.excelSelection});
                return {...dataset,source:'NCBI GEO',accession:id,url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id}`,supplementary_file:options.filename};
            }
            if (/\.(?:txt|tsv)\.gz$/i.test(options.filename)) { const cells = await geoCellMatrix(id, options.filename, options.allowCellMean); if (cells) return cells; }
            return geoSupplementary(id, options.filename, await request(base + 'suppl/' + encodeURIComponent(options.filename), 'gzip'), options.allowCellMean);
        }
        let content, matrixError;
        try { content = await request(base + `matrix/${id}_series_matrix.txt.gz`, 'gzip'); }
        catch (error) { if (!/HTTP (?:403|404)/.test(error.message)) throw error; matrixError = error; }
        const rows = content ? table(content) : [], meta={}, matrix=[]; let inside=false;
        for(const row of rows) { const k=row[0]; if(k==='!series_matrix_table_begin') inside=true; else if(k==='!series_matrix_table_end') break; else if(inside) matrix.push(row); else if(k.startsWith('!Sample_')) (meta[k.slice(8)] ||= []).push(row.slice(1)); }
        if(matrix.length<2 || matrix[0].length<2 || matrix.some(r=>r.length!==matrix[0].length)) {
            let files;
            const sampleFiles=sampleFilesFromMatrix(rows);
            const archiveDeclared=rows.filter(row=>row[0]==='!Series_supplementary_file').flatMap(row=>row.slice(1)).some(value=>{try {const url=new URL(value.replace(/^ftp:/i,'https:'));return url.origin==='https://ftp.ncbi.nlm.nih.gov' && url.pathname===new URL(base+`suppl/${id}_RAW.tar`).pathname;}catch(_){return false;}});
            const declared = rows.filter(row=>row[0]==='!Series_supplementary_file').flatMap(row=>row.slice(1)).filter(value=>value && value !== 'NONE').map(value=>{
                try { const url=new URL(value.replace(/^ftp:/i,'https:')); if (url.origin !== 'https://ftp.ncbi.nlm.nih.gov' || !url.pathname.startsWith(new URL(base).pathname+'suppl/')) return ''; return decodeURIComponent(url.pathname.split('/').pop()); } catch (_) { return ''; }
            }).filter(name=>name.startsWith(id+'_') && /^[A-Za-z0-9_.-]+$/.test(name) && /\.(?:(?:csv|tsv|txt)(?:\.gz)?|xlsx|xls)$/i.test(name));
            try { files = await geoSupplementaryFiles(id); }
            catch (error) {
                if (declared.length || sampleFiles.length || archiveDeclared) files = declared;
                else if (matrixError) throw new Error(`Series matrix: ${matrixError.message} Supplementary directory: ${error.message}`);
                else throw new Error(`GEO supplementary directory: ${error.message}`);
            }
            files=[...new Set([...files,...declared,...sampleFiles.map(file=>file.name),...(archiveDeclared?[`${id}_RAW.tar`]:[])])];
            if (!files.length) throw new Error('No supported series matrix or supplementary expression table was found.');
            const error = new Error('Choose a supplementary file to import.'); error.geoFiles = files; throw error;
        }
        const measurements=matrix[0].slice(1).map((name,i)=>({id:name,sample:name,label:meta.title?.[0]?.[i]||name,description:meta.description?.[0]?.[i]||'',source:meta.source_name_ch1?.[0]?.[i]||'',organism:meta.organism_ch1?.[0]?.[i]||'',characteristics:(meta.characteristics_ch1||[]).map(r=>r[i]).filter(Boolean)}));
        return {identifierLabel:matrix[0][0],measurements,records:matrix.slice(1).map(row=>({id:row[0],values:row.slice(1).map(number)})),source:'NCBI GEO',accession:id,url:`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id}`,measurement:'Series matrix values; units and normalization vary by study',note:'Identifiers may be platform probe IDs. Check the mapping report.'};
    }
    async function importGemma(id) {
        if(!/^\d{1,12}$/.test(id)) throw new Error('Invalid Gemma dataset ID.');
        const text=await request(GEMMA+`rest/v2/datasets/${id}/data/processed`,'gzip'), rows=table(text), header=rows.shift()||[];
        if(header[0]!=='Probe') throw new Error('Unsupported Gemma table format.');
        const fixed=new Set(['Probe','Sequence','GeneSymbol','GeneName','GemmaId','NCBIid']); let i=0; while(i<header.length&&fixed.has(header[i])) i++;
        const cols=header.slice(i); if(!cols.length||new Set(cols).size!==cols.length) throw new Error('No uniquely named samples in Gemma table.');
        const idColumn=['NCBIid','GeneSymbol','Probe'].find(k=>header.includes(k)); let excluded=0;
        const records=[]; for(const row of rows) { if(row.length!==header.length) throw new Error('Inconsistent Gemma table.'); const gene=row[header.indexOf(idColumn)].trim(); if(!gene||/[|;,]/.test(gene)){excluded++;continue;} records.push({id:gene,values:row.slice(i).map(number)}); }
        if(!records.length) throw new Error('No unambiguous identifiers in Gemma table.');
        return {identifierLabel:idColumn,measurements:cols.map(x=>({id:x,sample:x,label:x})),records,source:'Gemma',accession:id,measurement:'Processed expression · scale and units depend on study',url:GEMMA+'expressionExperiment/showExpressionExperiment.html?id='+id,measured_gene_count:idColumn==='Probe'?null:new Set(records.map(x=>x.id)).size,excluded_features:excluded,note:'Multi-gene and unannotated probes were excluded; repeated probes remain ambiguous.'};
    }
    async function importAtlas(id) {
        atlasAccession(id); const base=FTP+'experiments/'+id+'/'+id;
        const xmlText=await request(base+'-configuration.xml','text');
        let config;
        if (atlasConfigParser) config=await atlasConfigParser(xmlText);
        else {
            const xml=new DOMParser().parseFromString(xmlText,'application/xml');
            config={invalid:!!xml.querySelector('parsererror'),type:xml.documentElement?.getAttribute('experimentType'),labels:[...xml.querySelectorAll('assay_group')].map(x=>[x.getAttribute('id'),x.getAttribute('label')||x.getAttribute('id')])};
        }
        if(config.invalid||config.type!=='rnaseq_mrna_baseline') throw new Error('Only baseline RNA-seq TPM datasets are currently supported.');
        const labels=new Map(config.labels);
        const rows=table((await request(base+'-tpms.tsv','text')).split(/\r?\n/).filter(x=>!x.startsWith('#')).join('\n')), header=rows.shift()||[];
        if(header.length<3||!/^gene[ _]?id$/i.test(header[0])) throw new Error('Unsupported Atlas TPM table.');
        const cols=header.slice(2); if(cols.some(x=>!x)||new Set(cols).size!==cols.length) throw new Error('Invalid Atlas assay groups.');
        const records=rows.map(row=>{if(row.length!==header.length) throw new Error('Inconsistent Atlas table.');return {id:row[0],values:row.slice(2).map(cell=>{const p=cell.split(',');if(p.length!==1&&p.length!==5)throw new Error('Unsupported Atlas summary values.');return number(p.length===5?p[2]:p[0]);})};});
        if(!records.length) throw new Error('Empty Atlas table.');
        return {identifierLabel:header[0],measurements:cols.map(x=>({id:x,sample:x,label:labels.get(x)||x,condition:labels.get(x)||x})),records,source:'Expression Atlas',accession:id,measured_gene_count:new Set(records.map(x=>x.id)).size,measurement:'TPM · Atlas assay-group mean',url:ATLAS+'experiments/'+id};
    }
    async function importProteomics(taxon,tissue) {
        validTaxon(taxon); if(!/^BTO:\d{1,16}$/.test(tissue))throw new Error('Invalid biological source.');
        const args=`TISSUE_ID='${tissue}',CALCULATION_METHOD=0,SWISSPROT_ONLY=1,NO_ISOFORM=1,TAXCODE=${taxon}`;
        const query=new URLSearchParams({'$format':'json','$top':'20000','$select':'UNIQUE_IDENTIFIER,SAMPLE_NAME,NORMALIZED_EXPRESSION'});
        const payload=await request(PROTEOMICS+'proteinspertissue.xsodata/InputParams('+args+')/Results?'+query),rows=payload.d?.results;
        if(!Array.isArray(rows)||rows.length>=20000||payload.d?.__next)throw new Error('Results are unavailable or exceed the import limit.');
        const samples=new Set(), entries=new Map();
        for(const row of rows){const protein=String(row.UNIQUE_IDENTIFIER||'').trim(),sample=String(row.SAMPLE_NAME||tissue).trim(),value=number(row.NORMALIZED_EXPRESSION);if(!protein||value===null)continue;samples.add(sample);if(!entries.has(protein))entries.set(protein,new Map());const values=entries.get(protein);values.set(sample,values.has(sample)?null:value);}
        if(!entries.size||samples.size>1000)throw new Error('No supported abundance values or too many samples.');const cols=[...samples];
        return {identifierLabel:'UniProt',measurements:cols.map(x=>({id:x,sample:x,label:x})),records:[...entries].map(([id,values])=>({id,values:cols.map(x=>values.get(x)??null)})),source:'ProteomicsDB',accession:tissue,taxon,measurement:'Normalized protein abundance · iBAQ',url:'https://www.proteomicsdb.org/',note:'Biological-source aggregate, not a single study. Duplicate protein/sample values are omitted.'};
    }
    async function importSingleCell(id) {
        atlasAccession(id); const base=FTP+'sc_experiments/'+id+'/'+id;
        const [geneText,cellText,clusterText,matrixText]=await Promise.all(['.aggregated_filtered_normalised_counts.mtx_rows','.aggregated_filtered_normalised_counts.mtx_cols','.clusters.tsv','.aggregated_filtered_normalised_counts.mtx'].map(s=>request(base+s,'text')));
        const genes=table(geneText).map(r=>r[0]),cells=table(cellText).map(r=>r[0]),clusters=table(clusterText),header=clusters.shift()||[];
        if(!genes.length||!cells.length||new Set(genes).size!==genes.length||new Set(cells).size!==cells.length||!header.includes('K')||!header.includes('sel.K')||new Set(header).size!==header.length)throw new Error('Unsupported single-cell identifiers or clustering.');
        const selected=clusters.filter(r=>r.length===header.length&&/^(true|t|1)$/i.test(r[header.indexOf('sel.K')])); if(selected.length!==1)throw new Error('No unique default clustering.');
        const assign=new Map(header.map((v,i)=>[v,selected[0][i]])), groups=cells.map(c=>assign.get(c)); if(groups.some(x=>!x))throw new Error('Cluster assignments do not cover all cells.');
        const names=[...new Set(groups)].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); if(names.length>1000||genes.length*names.length>5000000)throw new Error('Aggregated matrix exceeds the browser import limit.');
        const lookup=new Map(names.map((x,i)=>[x,i])),indexes=groups.map(x=>lookup.get(x)),counts=names.map(()=>0);indexes.forEach(i=>counts[i]++);
        const sums=genes.map(()=>new Float64Array(names.length)), lines=matrixText.split(/\r?\n/);if(lines.shift()?.toLowerCase()!=='%%matrixmarket matrix coordinate real general')throw new Error('Unsupported Matrix Market encoding.');
        const nonempty=lines.filter(x=>x.trim()&&!x.startsWith('%')),dims=nonempty.shift()?.trim().split(/\s+/).map(Number);if(!dims||dims.length!==3||dims[0]!==genes.length||dims[1]!==cells.length||dims[2]!==nonempty.length)throw new Error('Invalid sparse matrix dimensions.');
        for(const line of nonempty){const p=line.trim().split(/\s+/).map(Number),gene=p[0]-1,cell=p[1]-1;if(p.length!==3||!Number.isInteger(gene)||!Number.isInteger(cell)||gene<0||gene>=genes.length||cell<0||cell>=cells.length||!Number.isFinite(p[2]))throw new Error('Invalid sparse matrix entry.');sums[gene][indexes[cell]]+=p[2];}
        return {identifierLabel:'Gene ID',measurements:names.map((x,i)=>({id:x,sample:x,label:`Cluster ${x} (n=${counts[i]})`,condition:`Cluster ${x}`,cell_count:counts[i]})),records:genes.map((id,j)=>({id,values:Array.from(sums[j],(value,i)=>value/counts[i])})),source:'Single Cell Expression Atlas',accession:id,measured_gene_count:genes.length,measurement:'Mean normalized expression per cluster, including zero-valued cells',url:ATLAS+'sc/experiments/'+id,note:`Default clustering K=${selected[0][header.indexOf('K')]}; values are means across all cells in each cluster.`};
    }
    async function importStudy(source,study,taxon,options) { switch(source){case 'geo':return importGeo(study.accession, options);case 'gemma':return importGemma(study.import_id);case 'proteomics':return importProteomics(taxon,study.accession);case 'bulk':return importAtlas(study.accession);case 'single-cell':return importSingleCell(study.accession);default:throw new Error('Unknown database.');} }
    return {searches,importStudy,table,number,setProgress,setAtlasConfigParser};
});
