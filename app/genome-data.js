/* NCBI package parsing. Shared by the import worker and deterministic data tests. */
(function (root) {
    'use strict';
    const LIMIT = 512 * 1024 * 1024;
    const decode = value => { try { return decodeURIComponent(value); } catch { return value; } };
    function attrs(text) {
        return Object.fromEntries(text.split(';').filter(Boolean).map(part => {
            const i = part.indexOf('=');
            return [part.slice(0, i), decode(part.slice(i + 1))];
        }));
    }
    function keys(value) {
        const text = String(value || '').trim().toLowerCase();
        if (!text) return [];
        const values = [text, text.replace(/^\d+\./, ''), text.replace(/^(gene|rna|cds)-/, '')];
        return [...new Set(values.flatMap(v => [v, v.replace(/\.\d+$/, '')]))];
    }
    function gcContent(sequence,start,end){
        if(!sequence||start<1||end<start||sequence.length<end)return null;
        let gc=0,total=0;
        for(let i=start-1;i<end;i++){const b=sequence.charCodeAt(i)&~32;if(b===71||b===67){gc++;total++;}else if(b===65||b===84)total++;}
        return total?gc/total*100:null;
    }
    function parse(files) {
        const assemblies = new Map();
        for (const file of files) {
            const accession = file.name.match(/GC[AF]_\d+\.\d+/)?.[0] || file.text.slice(0, 1000).match(/NCBI_Assembly:(GC[AF]_\d+\.\d+)/)?.[1] || 'Uploaded genome';
            if (!assemblies.has(accession)) assemblies.set(accession, { accession, chromosomes: new Map(), genes: [], reports: [] });
            const a = assemblies.get(accession);
            const chromosome = id => {
                if (!a.chromosomes.has(id)) a.chromosomes.set(id, { id, name: id, length: 0, topology: 'unknown', sequence: '', genes: [] });
                return a.chromosomes.get(id);
            };
            if (/(?:^|\/)(?:rna|cds_from_genomic|protein)[_.]/i.test(file.name)) continue;
            if (/assembly_data_report\.jsonl$/i.test(file.name)) {
                for (const line of file.text.split(/\r?\n/).filter(Boolean)) {
                    const report = JSON.parse(line);
                    const target = report.accession || accession;
                    if (!assemblies.has(target)) assemblies.set(target, { accession: target, chromosomes: new Map(), genes: [], reports: [] });
                    assemblies.get(target).reports.push(report);
                }
            } else if (/\.(fna|fasta|fa)$/i.test(file.name)) {
                let c;
                for (const line of file.text.split(/\r?\n/)) {
                    if (line.startsWith('>')) {
                        const header = line.slice(1), id = header.split(/\s/)[0];
                        c = chromosome(id); c.header = header;
                        if (/\b(circular|topology=circular)\b/i.test(header)) c.topology = 'circular';
                    } else if (c) c.sequence += line.replace(/\s/g, '').toUpperCase();
                }
                for (const c of a.chromosomes.values()) c.length = Math.max(c.length, c.sequence.length);
            } else if (/\.gff3?$/i.test(file.name)) {
                a.features ||= [];
                for (const line of file.text.split(/\r?\n/)) {
                    if (line === '##FASTA') break;
                    const region = line.match(/^##sequence-region\s+(\S+)\s+\d+\s+(\d+)/);
                    if (region) chromosome(region[1]).length = Number(region[2]);
                    if (!line || line.startsWith('#')) continue;
                    const f = line.split('\t');
                    if (f.length !== 9) continue;
                    const start = Number(f[3]), end = Number(f[4]);
                    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue;
                    const at = attrs(f[8]), c = chromosome(f[0]);
                    c.length = Math.max(c.length, end);
                    if (f[2] === 'region') {
                        a.taxId ||= at.Dbxref?.match(/(?:^|,)taxon:(\d+)/)?.[1];
                        if (at.Is_circular) c.topology = at.Is_circular.toLowerCase() === 'true' ? 'circular' : 'linear';
                        c.name = at.chromosome ? `Chromosome ${at.chromosome}` : at.Name || c.name;
                        continue;
                    }
                    a.features.push({ seqid: f[0], type: f[2], start, end, strand: f[6], phase: /^[012]$/.test(f[7]) ? Number(f[7]) : null, attrs: at, id: at.ID, parents: (at.Parent || '').split(',').filter(Boolean) });
                }
            } else if (/sequence.*report\.jsonl$/i.test(file.name)) {
                for (const line of file.text.split(/\r?\n/).filter(Boolean)) {
                    const r = JSON.parse(line), id = [r.refseqAccession, r.genbankAccession].find(id => a.chromosomes.has(id)) || (accession.startsWith('GCA_') ? r.genbankAccession || r.refseqAccession : r.refseqAccession || r.genbankAccession);
                    if (!id) continue;
                    const c = chromosome(id);
                    c.name = r.chrName && r.chrName !== 'chromosome' ? `Chromosome ${r.chrName}` : id;
                    c.length = Math.max(c.length, Number(r.length) || 0);
                    c.role = r.role || ''; // Topology is read from explicit annotations, never inferred from role.
                }
            }
        }
        // Metadata often lives outside the accession directory. Attach by report accession above.
        for (const a of assemblies.values()) {
            const features = a.features || [], byId = new Map(features.filter(f => f.id).map(f => [f.id, f]));
            const geneMap = new Map();
            for (const f of features.filter(f => ['gene', 'pseudogene'].includes(f.type))) {
                const g = { ...f, name: f.attrs.gene || f.attrs.Name || f.attrs.locus_tag || f.id, identifiers: [], transcripts: [] };
                geneMap.set(f.id, g); a.genes.push(g); chromosomeFor(a, f.seqid).genes.push(g);
            }
            function owner(f, visited = new Set()) {
                if (!f || visited.has(f)) return [];
                visited.add(f);
                if (geneMap.has(f.id)) return [geneMap.get(f.id)];
                return f.parents.flatMap(id => owner(byId.get(id), visited));
            }
            for (const f of features) {
                for (const g of owner(f)) {
                    const at = f.attrs;
                    g.identifiers.push(f.id, at.Name, at.gene, at.locus_tag, at.protein_id, at.transcript_id,
                        ...(at.Alias || '').split(','), ...(at.gene_synonym || '').split(','), ...(at.Dbxref || '').split(',').flatMap(x => [x, x.slice(x.indexOf(':') + 1)]));
                    if (/rna|transcript/i.test(f.type)) g.transcripts.push({ ...f, exons: [], cds: [] });
                }
            }
            const directProducts = new Map();
            for (const f of features) if (f.type === 'CDS' && f.attrs.protein_id) for (const parent of f.parents) {
                if (!directProducts.has(parent)) directProducts.set(parent, new Set());
                directProducts.get(parent).add(f.attrs.protein_id);
            }
            for (const g of a.genes) {
                if (!g.transcripts.length) {
                    const products = [...(directProducts.get(g.id) || [])];
                    if (products.length > 1) for (const proteinId of products) g.transcripts.push({id:proteinId,name:proteinId,directProteinId:proteinId,exons:[],cds:[]});
                    else g.transcripts.push({ id: g.id, name: g.name, exons: [], cds: [] });
                }
            }
            for (const f of features) {
                if (!['exon', 'CDS'].includes(f.type)) continue;
                for (const g of owner(f)) {
                    const targets = g.transcripts.filter(t => (f.parents.includes(t.id) || f.parents.includes(g.id)) && (!t.directProteinId || t.directProteinId === f.attrs.protein_id));
                    for (const t of targets) (f.type === 'exon' ? t.exons : t.cds).push({ start: f.start, end: f.end, phase: f.phase, attrs: f.attrs });
                }
            }
            for (const g of a.genes) {
                g.identifiers = [...new Set(g.identifiers.flatMap(keys))];
                for (const t of g.transcripts) {
                    t.exons.sort((x, y) => x.start - y.start); t.cds.sort((x, y) => x.start - y.start);
                }
            }
            for (const c of a.chromosomes.values()) {
                c.genes.sort((x, y) => x.start - y.start);
                if (c.sequence) c.length = c.sequence.length;
            }
            delete a.features;
            a.chromosomes = [...a.chromosomes.values()];
        }
        const result = [...assemblies.values()].filter(a => a.chromosomes.length);
        if (!result.length) throw new Error('No genomic FASTA or GFF3 found. Upload a hydrated NCBI genome package.');
        return result;
    }
    function chromosomeFor(a, id) { return a.chromosomes.get(id); }
    function matches(gene, selected) { return gene.identifiers.some(key => selected.has(key)); }
    function clusters(chromosome, selected, gap = 10000, flank = 5000) {
        const result = [];
        for (const g of chromosome.genes.filter(g => matches(g, selected))) {
            const last = result.at(-1);
            if (last && g.start - last.end <= gap) { last.end = Math.max(last.end, g.end); last.selected.push(g); }
            else result.push({ start: g.start, end: g.end, selected: [g] });
        }
        if (chromosome.topology === 'circular' && result.length > 1) {
            const first = result[0], last = result.at(-1);
            if (first.start + chromosome.length - last.end <= gap) {
                result.pop(); result.shift();
                result.push({ start: last.start, end: first.end + chromosome.length, selected: [...last.selected, ...first.selected] });
            }
        }
        return result.map(c => {
            let start = c.start - flank, end = c.end + flank;
            if (chromosome.topology !== 'circular') { start = Math.max(1, start); end = Math.min(chromosome.length, end); }
            else if (end - start + 1 >= chromosome.length) { start = 1; end = chromosome.length; }
            return { ...c, start, end };
        });
    }
    async function unzip(file) {
        if (file.size > LIMIT) throw new Error('Genome ZIP exceeds the 512 MiB browser import limit.');
        if (file.size < 22) throw new Error('Invalid ZIP archive.');
        const buffer = await file.arrayBuffer(), v = new DataView(buffer), bytes = new Uint8Array(buffer);
        let eocd = bytes.length - 22;
        for (; eocd >= Math.max(0, bytes.length - 65557); eocd--) if (v.getUint32(eocd, true) === 0x06054b50) break;
        if (eocd < 0 || eocd < bytes.length - 65557) throw new Error('Invalid or unsupported ZIP archive.');
        const count = v.getUint16(eocd + 10, true);
        let offset = v.getUint32(eocd + 16, true), total = 0;
        if (count === 65535 || offset === 0xffffffff) throw new Error('ZIP64 packages are too large for this browser importer.');
        const files = [];
        for (let i = 0; i < count; i++) {
            if (v.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP directory.');
            const flags = v.getUint16(offset + 8, true), method = v.getUint16(offset + 10, true);
            let packed = v.getUint32(offset + 20, true), size = v.getUint32(offset + 24, true);
            const n = v.getUint16(offset + 28, true), extra = v.getUint16(offset + 30, true), comment = v.getUint16(offset + 32, true);
            const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + n));
            let local = v.getUint32(offset + 42, true);
            // NCBI emits ZIP64 entry sizes even for small assemblies.
            for (let at = offset + 46 + n; at + 4 <= offset + 46 + n + extra;) {
                const type = v.getUint16(at, true), length = v.getUint16(at + 2, true);
                if (type === 1) {
                    let field = at + 4;
                    const next = () => { const value = Number(v.getBigUint64(field, true)); field += 8;
                        if (!Number.isSafeInteger(value)) throw new Error('ZIP entry exceeds supported size.'); return value; };
                    if (size === 0xffffffff) size = next();
                    if (packed === 0xffffffff) packed = next();
                    if (local === 0xffffffff) local = next();
                }
                at += 4 + length;
            }
            offset += 46 + n + extra + comment;
            if (!/\.(fna|fasta|fa|gff|gff3)$|(?:assembly_data_report|sequence_report)\.jsonl$/i.test(name)) continue;
            total += size;
            if (total > LIMIT) throw new Error('Expanded genome exceeds the 512 MiB browser import limit. Use a smaller assembly or chromosome subset.');
            if (flags & 1) throw new Error('Encrypted ZIP files are unsupported.');
            if (v.getUint32(local, true) !== 0x04034b50) throw new Error('Invalid ZIP entry.');
            const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
            let blob = new Blob([bytes.subarray(start, start + packed)]);
            if (method === 8) {
                const reader = blob.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
                const parts = []; let expanded = 0;
                while (true) { const { done, value } = await reader.read(); if (done) break; expanded += value.length;
                    if (expanded > size || expanded > LIMIT) { await reader.cancel(); throw new Error('Invalid ZIP expanded size.'); } parts.push(value); }
                blob = new Blob(parts);
            } else if (method !== 0) throw new Error('Unsupported ZIP compression. Use a standard NCBI ZIP.');
            if (blob.size !== size) throw new Error('Truncated ZIP entry.');
            files.push({ name, text: await blob.text() });
        }
        return files;
    }
    root.GenomeData = { parse, gcContent, keys, matches, clusters, unzip, LIMIT };
    if (typeof module !== 'undefined') module.exports = root.GenomeData;
})(globalThis);
