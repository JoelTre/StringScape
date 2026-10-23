/* Role evidence from uploaded annotations; broad terms are not treated as proof of a specific role. */
(function(root){
    'use strict';
    function sentences(text) {
        return String(text || '').split(/(?<=[.!?])\s+(?=[A-Z(])|\n+/).map(s=>s.trim()).filter(s=>/3\s*['′’]/.test(s));
    }
    function classify(records = [], annotation = '') {
        const evidence = records.map(r=>({...r, text:String(r.description || '').toLowerCase().replace(/[‐‑–]/g,'-')}));
        const roles = [];
        function add(label, strong, related) {
            const support = evidence.filter(strong), hints = support.length ? [] : evidence.filter(related || (()=>false));
            if (support.length || hints.length) roles.push({label,confidence:support.length?'supported':'related',evidence:support.length?support:hints});
        }
        const hasDNA=evidence.some(r=>/annotated keywords/i.test(r.category)&&r.text==='dna-binding'||/molecular function/i.test(r.category)&&/dna binding|dna-binding/.test(r.text));
        const mf=r=>/molecular function/i.test(r.category), cc=r=>/cellular component/i.test(r.category), kw=r=>/annotated keywords/i.test(r.category), bp=r=>/biological process/i.test(r.category), cluster=r=>/local network cluster/i.test(r.category);
        add('Transcription factor',r=>mf(r)&&/dna-binding transcription (?:factor|activator|repressor) activity|ligand-activated transcription factor activity/.test(r.text),r=>mf(r)&&/transcription (?:regulator|coregulator|corepressor) activity|transcription (?:cis-regulatory region|regulatory region nucleic acid) binding/.test(r.text)||hasDNA&&kw(r)&&r.text==='transcription regulation');
        add('Transcription regulation',r=>kw(r)&&r.text==='transcription regulation'||bp(r)&&/regulation of (?:dna-templated transcription|nucleic acid-templated transcription|transcription, (?:dna|nucleic acid)-templated)/.test(r.text),r=>bp(r)&&/^(?:positive |negative )?regulation of gene expression$/.test(r.text)||kw(r)&&/transcription/.test(r.text)||cluster(r)&&/transcription.*regulat|transcriptional.*repress/.test(r.text));
        add('Ribosomal protein',r=>kw(r)&&r.text==='ribosomal protein'||mf(r)&&r.text==='structural constituent of ribosome',r=>cc(r)&&/^(?:(?:cytosolic|mitochondrial|plastid|bacterial-type) )?(?:ribosome|(?:large|small) ribosomal subunit|ribosomal subunit|polysomal ribosome)$/.test(r.text));
        add('Ribosome-associated',r=>cc(r)&&/^(?:(?:cytosolic|mitochondrial|plastid) )?(?:ribosome|(?:large|small) ribosomal subunit|ribosomal subunit|polysomal ribosome)$/.test(r.text)||mf(r)&&/^(?:ribosome|ribosomal (?:large|small) subunit|preribosome) binding$/.test(r.text)||bp(r)&&/ribosom.*(?:assembly|biogenesis|disassembly)|rescue of stalled ribosome/.test(r.text),r=>cluster(r)&&/ribosom|polysome/.test(r.text)&&!/nonribosom|non-ribosom/.test(r.text));
        add('RNA polymerase',r=>kw(r)&&r.text==='dna-directed rna polymerase'||mf(r)&&/^(?:dna-directed (?:5-3 |5['′]?-3['′]? )?|5-3 )?rna polymerase activity$/.test(r.text)||cc(r)&&/^(?:cytosolic )?(?:dna-directed )?rna polymerase complex$/.test(r.text),r=>cluster(r)&&/rna polymerase/.test(r.text)&&!/binding|sigma/.test(r.text));
        add('DNA-binding',r=>kw(r)&&r.text==='dna-binding'||mf(r)&&/dna binding|dna-binding|transcription cis-regulatory region binding|transcription regulatory region nucleic acid binding/.test(r.text),()=>false);
        add('Nucleic-acid binding',r=>mf(r)&&r.text==='nucleic acid binding');
        add('Translation-related',r=>kw(r)&&r.text==='translation',r=>bp(r)&&r.text==='translation');
        // Product/annotation text can independently provide specific evidence, with the source exposed.
        for (const [label,pattern] of [ ['Transcription factor',/\b(?:dna-binding transcription (?:factor|activator|repressor)|transcriptional (?:dual )?(?:regulator|repressor|activator))\b/i], ['Ribosomal protein',/\b(?:[35]0s |[46]0s )?ribosomal protein\s+[ls]\d+/i], ['Ribosome-associated',/\b(?:ribosome (?:binding|hibernation|recycling|maturation)|ribosomal (?:assembly|biogenesis))\b/i], ['RNA polymerase',/\bdna[- ](?:directed|dependent) rna polymerase\b/i], ['DNA-binding',/\bdna[- ]binding\b/i] ]) {
            if (pattern.test(annotation)) {
                const ev={category:'Protein annotation',description:annotation.split(/[.;]\s/)[0]};
                const found=roles.find(r=>r.label===label);
                if(found){found.confidence='supported';found.evidence.push(ev);}else roles.push({label,confidence:'supported',evidence:[ev]});
            }
        }
        return roles;
    }
    root.GenomeAnnotations={classify,sentences};if(typeof module!=='undefined')module.exports=root.GenomeAnnotations;
})(globalThis);
