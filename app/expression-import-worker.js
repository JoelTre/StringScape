/* Keep remote downloads and expression-table processing off the UI thread. */
importScripts('expression-sources.js?v=geo-sample-data', 'expression-data.js');
let resolveConfig;
self.StringScapeExpressionSources.setAtlasConfigParser(text => new Promise(resolve => { resolveConfig=resolve; self.postMessage({type:'parse-atlas-config',text}); }));
self.onmessage = async event => {
    if (event.data.type === 'atlas-config') { resolveConfig(event.data.config); resolveConfig=null; return; }
    const {source, study, taxon, options, metadata, nodesForMapping} = event.data;
    try {
        self.StringScapeExpressionSources.setProgress(message => self.postMessage({type:'progress', message}));
        const isExcel = source === 'upload-excel' || (/\.xlsx?$/i.test(options.filename || '') || /\.xlsx?$/i.test(options.archiveMember || ''));
        if (isExcel) importScripts('sheetjs-xlsx-0.20.3.min.js','expression-excel.js?v=geo-paired-counts');
        let matrix;
        if (source === 'upload-excel') {
            self.postMessage({type:'progress',message:'Reading the Excel workbook…'});
            if (options.file.size > 32 * 1024 * 1024) throw new Error('The Excel file exceeds the 32 MiB import limit.');
            matrix=self.StringScapeExpressionExcel.read(await options.file.arrayBuffer(),{upload:true,selection:options.excelSelection});
        } else matrix = await self.StringScapeExpressionSources.importStudy(source, study, taxon, options);
        Object.assign(matrix, metadata);
        for (const measure of matrix.measurements) {
            for (const entry of measure.characteristics || []) {
                const match = entry.match(/^\s*(condition|treatment|time|time point|timepoint)\s*:\s*(.+)$/i);
                if (match) measure[/^time/i.test(match[1]) ? 'time' : 'condition'] ||= match[2].trim();
            }
        }
        self.postMessage({type:'progress',message:'Mapping identifiers…'});
        const mapping=self.StringScapeExpressionData.mapRecords(matrix,nodesForMapping);
        self.postMessage({type:'progress',message:'Preparing the imported dataset…'});
        self.postMessage({type:'result',text:JSON.stringify(matrix),dataset:matrix,mapping});
    } catch (error) {
        self.postMessage({type:'error',message:error.message,geoFiles:error.geoFiles,requiresCellMean:error.requiresCellMean,excelChoices:error.excelChoices,archiveFiles:error.archiveFiles});
    }
};
