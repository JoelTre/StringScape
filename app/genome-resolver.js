/* Resolve assembly accessions from the same taxon/Gene IDs used in protein info. */
(function (root) {
    'use strict';
    const validAccession = value => /^GC[AF]_\d{9}\.\d+$/.test(value || '');
    const field = (obj, snake, camel) => obj?.[snake] ?? obj?.[camel];
    const info = r => r.assembly_info || r.assemblyInfo || {};
    const taxId = r => String(field(r.organism, 'tax_id', 'taxId') || '');
    function choose(reports, requestedTaxon) {
        const candidates = reports.filter(r => validAccession(r.accession) && !/suppressed|replaced/i.test(field(info(r), 'assembly_status', 'assemblyStatus') || ''));
        const score = r => [
            Number(taxId(r) === String(requestedTaxon)),
            Number(/reference/i.test(field(info(r), 'refseq_category', 'refseqCategory') || '')),
            Number(r.accession.startsWith('GCF_')),
            String(field(info(r), 'release_date', 'releaseDate') || '')
        ];
        candidates.sort((a, b) => { const x = score(a), y = score(b); for (let i = 0; i < x.length; i++) { if (x[i] !== y[i]) return x[i] > y[i] ? -1 : 1; } return a.accession.localeCompare(b.accession); });
        return candidates[0];
    }
    function result(record, source) {
        return { accession: field(record, 'current_accession', 'currentAccession') || record.accession,
            taxId: taxId(record), organism: field(record.organism, 'organism_name', 'organismName') || '', source };
    }
    async function resolve(context, request) {
        let taxon = String(context.taxId || '');
        const geneIds = [...new Set(context.geneIds || [])].map(String).filter(id => /^\d+$/.test(id)).slice(0, 5);
        if (geneIds.length) {
            try {
                const payload = await request('gene', geneIds.join(','));
                const genes = (payload.reports || []).map(r => r.gene).filter(Boolean);
                const taxa = [...new Set(genes.map(g => String(field(g, 'tax_id', 'taxId') || '')).filter(Boolean))];
                if (!taxon && taxa.length > 1) throw new Error('Select proteins from one organism to fetch its genome.');
                if (!taxon && taxa.length === 1) taxon = taxa[0];
                const matching = genes.filter(g => !taxon || String(field(g, 'tax_id', 'taxId')) === taxon);
                const accessions = [...new Set(matching.flatMap(g => g.annotations || []).map(a => field(a, 'assembly_accession', 'assemblyAccession')).filter(validAccession))];
                if (accessions.length) {
                    // Validate current assembly metadata; Gene reports may list older releases too.
                    const records = await request('assembly', accessions.slice(0, 20).join(','));
                    const chosen = choose(records.reports || [], taxon);
                    if (chosen) return result(chosen, `NCBI Gene ${matching.map(g => field(g, 'gene_id', 'geneId')).filter(Boolean).join(', ')}`);
                }
            } catch (error) {
                if (error.name === 'AbortError' || !taxon) throw error;
                // A taxon-only lookup still works when the Gene service is unavailable.
            }
        }
        if (!/^\d+$/.test(taxon)) throw new Error('No organism could be identified. Load taxon-labelled app data or select a protein with an NCBI Gene link.');
        for (const reference of [true, false]) {
            const payload = await request('taxon', taxon, reference);
            const chosen = choose(payload.reports || [], taxon);
            if (chosen) return result(chosen, `taxon ${taxon}${reference ? ' reference genome' : ' annotated assembly'}`);
        }
        throw new Error(`NCBI has no current annotated assembly for taxon ${taxon}. You can enter an assembly accession manually.`);
    }
    root.GenomeResolver = { resolve, choose };
    if (typeof module !== 'undefined') module.exports = root.GenomeResolver;
})(globalThis);
