/* Interpret spreadsheet measurements without combining distinct units or statistics. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./sheetjs-xlsx-0.20.3.min.js'));
    else root.StringScapeExpressionExcel = factory(root.XLSX);
})(typeof globalThis === 'object' ? globalThis : this, function (XLSX) {
    'use strict';
    const MAX_BYTES = 32 * 1024 * 1024, MAX_CELLS = 5000000;
    function read(bytes, options = {}) {
        if (!XLSX) throw new Error('The Excel reader is unavailable.');
        if (bytes.byteLength > MAX_BYTES) throw new Error('The Excel file exceeds the 32 MiB import limit.');
        let workbook;
        try { workbook = XLSX.read(bytes, {type:'array',sheetRows:200001,cellDates:false}); }
        catch (_) { throw new Error('Could not read the Excel workbook. Check that it is a valid, unencrypted Excel file.'); }
        const choices = [], tables = new Map();
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]; if (!sheet?.['!ref']) continue;
            const range = XLSX.utils.decode_range(sheet['!ref']);
            if ((range.e.r-range.s.r+1)*(range.e.c-range.s.c+1) > MAX_CELLS || range.e.r >= 200000) throw new Error(`Sheet “${sheetName}” exceeds the browser spreadsheet processing limit.`);
            const rows = XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:false});
            if (rows.length < 2) continue;
            // Some GEO correlation sheets explicitly describe two paired count tables.
            // Only recognize this format when the sheet itself identifies the units.
            const intro=rows.slice(0,12).flat().map(value=>String(value ?? '')).join(' ');
            if (/single-cell sequencing data were combined.*UMI expression numbers of all cells/i.test(intro) && /bulk RNA-seq data was the raw reads counts/i.test(intro)) {
                const start=rows.findIndex(row=>row[0] && row[2] && String(row[1] ?? '').trim() && String(row[3] ?? '').trim() && Number.isFinite(Number(row[1])) && Number.isFinite(Number(row[3])));
                if (start < 1) throw new Error(`Sheet “${sheetName}” has no supported paired count table.`);
                const entries=rows.slice(start).filter(row=>row.some(value=>String(value ?? '').trim()));
                if (!entries.length || entries.some(row=>!row[0] || row[0]!==row[2] || !Number.isSafeInteger(Number(row[1])) || Number(row[1])<0 || !Number.isSafeInteger(Number(row[3])) || Number(row[3])<0 || !String(row[1] ?? '').trim() || !String(row[3] ?? '').trim())) throw new Error(`Sheet “${sheetName}” contains inconsistent paired gene counts.`);
                const single=String(rows[start-1]?.[0] || 'Single-cell combined counts'), bulk=String(rows[start-1]?.[2] || 'Bulk RNA-seq');
                const normalized=[['Gene ID',single,bulk],...entries.map(row=>[row[0],row[1],row[3]])];
                for (const [group,column] of [['Summed single-cell UMI counts (all cells)',1],['Raw bulk RNA-seq read counts',2]]) {
                    const key=JSON.stringify([sheetName,group]); choices.push({value:key,label:`${sheetName} — ${group}`});
                    tables.set(key,{sheetName,group,columns:[column],header:normalized[0],id:0,rows:normalized});
                }
                continue;
            }
            const header = rows[0].map(value=>String(value ?? '').trim());
            const id = ['locus_tag','gene_id','gene_acc','gene_symbol','genesymbol','gene','id','id_ref'].map(name=>header.findIndex(value=>value.toLowerCase()===name)).find(index=>index>=0) ?? (options.upload ? 0 : -1);
            if (id < 0) continue;
            const groups = new Map();
            for (let i=0; i<header.length; i++) {
                if (i === id) continue;
                const h=header[i], match=h.match(/^(log2_fc_avg|log2foldchange|log2_fc|log2fc|logfc|avg_log2_rpkm|log2_rpkm|fpkm|rpkm|tpm|counts?|normalized_counts?)(?:[._ :/-]|$)/i);
                if (!match) continue;
                const key=match[1].toLowerCase();
                const group=/^(log2_fc_avg|log2foldchange|log2_fc|log2fc|logfc)$/.test(key)?'log2 fold change':/^(avg_log2_rpkm|log2_rpkm)$/.test(key)?'log2 RPKM':/^(counts?|normalized_counts?)$/.test(key)?'counts':key.toUpperCase();
                if (!groups.has(group)) groups.set(group,[]); groups.get(group).push(i);
            }
            if (!groups.size && options.upload) {
                const cols=header.map((_,i)=>i).filter(i=>i!==id);
                if (cols.length && cols.every(i=>header[i] && rows.slice(1).every(row=>row[i]==='' || row[i]==null || /^(?:NA|N\/A|null|nan)$/i.test(String(row[i]).trim()) || (typeof row[i]!=='boolean' && Number.isFinite(Number(row[i])))))) groups.set('User-provided numeric values',cols);
            }
            for (const [group,columns] of groups) {
                const key=JSON.stringify([sheetName,group]);
                const names=columns.map(i=>header[i]);
                if (names.some(x=>!x) || new Set(names).size!==names.length) continue;
                choices.push({value:key,label:`${sheetName} — ${group} (${columns.length} ${columns.length===1?'column':'columns'})`});
                tables.set(key,{sheetName,group,columns,header,id,rows});
            }
        }
        if (!choices.length) throw new Error('No supported expression table was found in the Excel workbook. Use a sheet with gene identifiers and labelled expression columns, or upload a simple identifier-by-sample table.');
        if (!options.selection && choices.length>1) { const error=new Error('Choose a worksheet and measurement type to import.'); error.excelChoices=choices; throw error; }
        const selection=options.selection || choices[0].value, item=tables.get(selection);
        if (!item) throw new Error('The selected worksheet and measurement type are not available in this workbook.');
        const {sheetName,group,columns,header,id,rows}=item;
        const records=[];
        for (const row of rows.slice(1)) {
            const identifier=String(row[id] ?? '').trim(); if (!identifier) continue;
            const values=columns.map(i=>{const raw=String(row[i] ?? '').trim();if(!raw||/^(?:NA|N\/A|null|nan)$/i.test(raw))return null; const value=Number(raw);if(!Number.isFinite(value))throw new Error(`Sheet “${sheetName}” contains a non-numeric measurement for ${identifier}.`);return value;});
            records.push({id:identifier,values});
        }
        if (!records.length || !records.some(row=>row.values.some(Number.isFinite))) throw new Error('No numeric measurements were found in the selected Excel table.');
        return {identifierLabel:header[id], measurements:columns.map(i=>({id:header[i],sample:header[i],label:header[i]})), records, measured_gene_count:new Set(records.map(row=>row.id)).size, measurement:group, note:`Worksheet “${sheetName}”; measurement type: ${group}. Column names are supplied by the workbook.${group.startsWith('Summed single-cell') ? ' Values are sums across all cells, not cell-type or cluster averages.' : ''}`, spreadsheet_sheet:sheetName, spreadsheet_measurement:group};
    }
    return {read};
});
