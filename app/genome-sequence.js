/* Coding-strand sequence models. Coordinates stay 1-based and inclusive. */
(function (root) {
    'use strict';
    const codes = typeof module !== 'undefined' ? require('./genetic-codes.js') : root.GeneticCodes;
    const complement = { A:'T', T:'A', U:'A', C:'G', G:'C', R:'Y', Y:'R', S:'S', W:'W', K:'M', M:'K', B:'V', V:'B', D:'H', H:'D', N:'N' };
    const reverseComplement = dna => [...dna.toUpperCase()].reverse().map(b => complement[b] || 'N').join('');
    const cleanProtein = s => String(s || '').replace(/\s/g, '').toUpperCase().replace(/\*$/, '');
    const coordinate = (gene, i) => gene.strand === '-' ? gene.end - i : gene.start + i;
    function extract(chromosome, gene) {
        const sequence = chromosome.sequence || '';
        if (!sequence) return '';
        if (gene.start >= 1 && gene.end <= sequence.length) return sequence.slice(gene.start - 1, gene.end);
        if (chromosome.topology !== 'circular') return '';
        let result = '';
        for (let p = gene.start; p <= gene.end; p++) result += sequence[((p - 1) % sequence.length + sequence.length) % sequence.length];
        return result;
    }
    // Banded global edit alignment: insertions/deletions do not shift all subsequent residues.
    function align(predicted, observed) {
        const a = cleanProtein(predicted), b = cleanProtein(observed), n = a.length, m = b.length;
        if (a === b) return { columns: Array.from(a, (_, i) => ({ p:i, q:i })), differences:0, identity:1, distance:0 };
        const width = Math.max(64, Math.abs(n - m) + 32), stride = width * 2 + 1;
        if ((n + 1) * stride > 12000000) return { columns:[], limited:true, differences:null, identity:0, distance:Infinity };
        const trace = new Uint8Array((n + 1) * stride), infinity = 1e9;
        let prev = new Float64Array(m + 1).fill(infinity);
        for (let j = 0; j <= Math.min(m, width); j++) { prev[j] = j; trace[j + width] = 2; }
        for (let i = 1; i <= n; i++) {
            const curr = new Float64Array(m + 1).fill(infinity);
            for (let j = Math.max(0, i - width); j <= Math.min(m, i + width); j++) {
                const diagonal = j ? prev[j - 1] + Number(a[i - 1] !== b[j - 1]) : infinity;
                const up = prev[j] + 1, left = j ? curr[j - 1] + 1 : infinity;
                const best = Math.min(diagonal, up, left);
                curr[j] = best; trace[i * stride + j - i + width] = best === diagonal ? 0 : best === up ? 1 : 2;
            }
            prev = curr;
        }
        let i = n, j = m, differences = 0, matches = 0; const columns = [];
        while (i || j) {
            const move = trace[i * stride + j - i + width];
            if (!i || (j && move === 2)) { columns.push({p:null,q:--j}); differences++; }
            else if (!j || move === 1) { columns.push({p:--i,q:null}); differences++; }
            else { const p=--i,q=--j; columns.push({p,q}); a[p] === b[q] ? matches++ : differences++; }
        }
        return { columns:columns.reverse(), differences, identity:matches / Math.max(1, columns.length), distance:prev[m] };
    }
    function intervals(gene, ranges) {
        const sorted = [...ranges].sort((a,b) => gene.strand === '-' ? b.end - a.end : a.start - b.start);
        const coords = [];
        for (const r of sorted) {
            for (let p = gene.strand === '-' ? r.end : r.start; gene.strand === '-' ? p >= r.start : p <= r.end; p += gene.strand === '-' ? -1 : 1) coords.push(p);
        }
        return { sorted, coords };
    }
    function candidate(gene, dna, transcript) {
        const warnings = [], negative = gene.strand === '-', base = pos => {
            const value = dna[pos - gene.start] || 'N'; return negative ? complement[value] || 'N' : value;
        };
        const cds = intervals(gene, transcript.cds || []), first = cds.sorted[0], phase = first?.phase || 0;
        const codingPositions = cds.coords.slice(phase), codingDNA = codingPositions.map(base).join('');
        const annotatedExons = transcript.exons?.length > 0;
        const exonRanges = annotatedExons ? transcript.exons : cds.sorted.length > 1 ? cds.sorted : [{start:gene.start,end:gene.end}];
        const exons = intervals(gene, exonRanges), transcriptDNA = exons.coords.map(base).join('');
        const tableId = String(first?.attrs?.transl_table || transcript.attrs?.transl_table || 1), table = codes[tableId];
        if (!first) warnings.push('No annotated CDS: protein translation and codon mapping are unavailable.');
        if (!table) warnings.push(`Genetic code ${tableId} is unavailable; translation has not been assumed.`);
        let accumulated = 0;
        for (let i = 0; i < cds.sorted.length; i++) {
            const r = cds.sorted[i];
            if (i && r.phase != null && r.phase !== (3 - accumulated % 3) % 3) warnings.push('CDS phase discontinuity is annotated; inspect sequence differences and possible frameshifting.');
            accumulated += r.end - r.start + 1 - (i ? 0 : phase);
        }
        if (phase) warnings.push(`Partial initial codon: ${phase} leading CDS base(s) are not translated.`);
        if (codingDNA.length % 3) warnings.push('The terminal CDS codon is incomplete.');
        const isStartPartial = negative ? /\./.test(first?.attrs?.end_range || '') : /\./.test(first?.attrs?.start_range || '');
        const exceptions = [...new Set(cds.sorted.map(r => r.attrs?.transl_except).filter(Boolean))];
        const special = new Map();
        for (const text of exceptions) for (const match of text.matchAll(/pos:((?:complement\()?\d+(?:\.\.\d+)?\)?),aa:([A-Za-z*]+)/g)) {
            const nums = match[1].match(/\d+/g).map(Number), positions = Array.from({length:(nums[1] || nums[0]) - nums[0] + 1},(_,i)=>nums[0]+i);
            const aa = {Sec:'U',Pyl:'O',TERM:'*',OTHER:'X'}[match[2]] || (match[2].length === 1 ? match[2] : null);
            if (aa) special.set([...positions].sort((a,b)=>a-b).join(','), aa);
        }
        if (exceptions.length && !special.size) warnings.push('Complex translation exception is present; its effect is not automatically inferred.');
        if (cds.sorted.some(r => r.attrs?.exception)) warnings.push(...new Set(cds.sorted.map(r=>r.attrs?.exception).filter(Boolean)));
        const codons = []; let predicted = '';
        if (table && first) for (let i = 0; i + 2 < codingDNA.length; i += 3) {
            const codon = codingDNA.slice(i,i+3), positions = codingPositions.slice(i,i+3);
            const index = [...codon].reduce((sum,b) => sum * 4 + 'TCAG'.indexOf(b), 0);
            let aa = /^[TCAG]{3}$/.test(codon) ? table.aminoAcids[index] : 'X';
            if (!i && !phase && !isStartPartial && table.starts[index] === 'M') aa = 'M';
            const exceptionAA = special.get([...positions].sort((a,b)=>a-b).join(','));
            aa = exceptionAA || aa;
            // NCBI marks contextual stop codons in the starts row for dual-coding tables.
            if (!exceptionAA && i + 3 === codingDNA.length && table.starts[index] === '*') aa = '*';
            codons.push({ dna:codon, rna:codon.replace(/T/g,'U'), aa, positions }); predicted += aa;
        }
        return { transcriptStart:transcript.start || Math.min(...exonRanges.map(r=>r.start)), transcriptEnd:transcript.end || Math.max(...exonRanges.map(r=>r.end)), id:transcript.id, name:transcript.attrs?.Name || transcript.id, proteinId:first?.attrs?.protein_id || '',
            product:first?.attrs?.product || '', exonRanges:exons.sorted, annotatedExons, transcriptDNA,
            splicedRNA:transcriptDNA.replace(/T/g,'U'), codingDNA, codingPositions, codons, predicted,
            tableId, tableName:table?.name || '', phase, warnings:[...new Set(warnings)] };
    }
    function build(gene, geneDNA, appProtein = '') {
        const dna = geneDNA.toUpperCase(), orientedDNA = gene.strand === '-' ? reverseComplement(dna) : dna;
        const observed = cleanProtein(appProtein), candidates = (gene.transcripts || []).map(t => candidate(gene,dna,t));
        for (const c of candidates) {
            c.comparison = observed && c.predicted ? align(c.predicted,observed) : null;
            c.score = c.comparison ? c.comparison.distance : observed ? Infinity : c.predicted ? -c.predicted.length : 0;
        }
        candidates.sort((a,b) => a.score - b.score || Math.abs(cleanProtein(a.predicted).length-observed.length)-Math.abs(cleanProtein(b.predicted).length-observed.length));
        const best = candidates[0];
        if (!best) return { geneDNA:orientedDNA, preRNA:orientedDNA.replace(/T/g,'U'), observed, unavailable:true };
        const ambiguous=candidates.filter(c=>c.comparison&&Number.isFinite(c.score)&&c.score===best.score).map(c=>c.id);
        if(ambiguous.length>1)best.warnings.push(`${ambiguous.length} annotated transcripts are equally consistent with the app protein. Showing ${best.id}; the protein sequence alone cannot distinguish their exon choices.`);
        const rnaProjection=Array.from(orientedDNA,(base,i)=>{const p=coordinate(gene,i);return p>=best.transcriptStart&&p<=best.transcriptEnd?base.replace('T','U'):'·';}).join('');
        return { geneDNA:orientedDNA, preRNA:rnaProjection.replace(/·/g,''),rnaProjection, observed, ...best,
            ambiguous, alternatives:candidates.map(c=>({id:c.id,proteinId:c.proteinId,differences:c.comparison?.differences,identity:c.comparison?.identity})),
            choice:observed ? best.comparison?.differences === 0 ? 'exact' : best.comparison?.limited ? 'limited' : best.predicted ? 'closest' : 'unavailable' : 'no-app-protein',
            hasIntrons:best.exonRanges.some((r,i,all)=> i && Math.abs(gene.strand === '-' ? all[i-1].start-r.end : r.start-all[i-1].end)>1) };
    }
    // Full genomic alignment with explicit extra columns for app-only amino acids.
    // Typed arrays keep long introns scrollable without allocating a DOM node per base.
    function mappingLayout(gene, model) {
        const length=model.geneDNA.length, toIndex=pos=>gene.strand==='-'?gene.end-pos:pos-gene.start;
        const aligned=!!model.comparison&&!model.comparison.limited;
        const residues=aligned?model.comparison.columns.map(c=>({...c})):model.codons.map((_,p)=>({p,q:null}));
        if(aligned&&model.predicted.endsWith('*'))residues.push({p:model.codons.length-1,q:null,terminal:true});
        const insertions=new Map();let nextPredicted=null,extraCount=0;
        for(let i=residues.length-1;i>=0;i--){const r=residues[i];
            if(r.p!=null){nextPredicted=r.p;continue;}
            const last=model.codons.at(-1),anchor=Math.max(0,Math.min(length,nextPredicted==null?(last?toIndex(last.positions.at(-1))+1:length):toIndex(model.codons[nextPredicted].positions[0])));
            if(!insertions.has(anchor))insertions.set(anchor,[]);insertions.get(anchor).push(r);extraCount++;
        }
        const slots=new Int32Array(length+extraCount*3).fill(-1),geneSlots=new Int32Array(length),baseCodons=new Int32Array(length).fill(-1);
        let column=0;
        for(let i=0;i<=length;i++){
            for(const r of (insertions.get(i)||[]).sort((a,b)=>a.q-b.q)){r.center=column+1;r.insertionStart=column;column+=3;}
            if(i<length){slots[column]=i;geneSlots[i]=column++;}
        }
        for(let p=0;p<model.codons.length;p++)for(const pos of model.codons[p].positions){const i=toIndex(pos);if(i>=0&&i<length)baseCodons[i]=p;}
        const differences=new Set();
        for(const r of residues){
            if(r.p!=null){const codon=model.codons[r.p],i=toIndex(codon.positions[1]);r.center=i>=0&&i<length?geneSlots[i]:0;
                r.junction=codon.positions.some((pos,j,all)=>j&&Math.abs(pos-all[j-1])!==1);
            }
            r.difference=aligned&&!r.terminal&&(r.p==null||r.q==null||model.codons[r.p].aa!==model.observed[r.q]);
            if(r.difference&&r.p!=null)differences.add(r.p);
        }
        residues.sort((a,b)=>a.center-b.center);
        return {slots,geneSlots,baseCodons,residues,differences,aligned};
    }
    root.GenomeSequence = { reverseComplement, cleanProtein, coordinate, extract, align, build, mappingLayout };
    if (typeof module !== 'undefined') module.exports = root.GenomeSequence;
})(globalThis);
