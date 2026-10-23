importScripts('genome-data.js');
onmessage = async ({ data: file }) => {
    try {
        if (file.size > GenomeData.LIMIT) throw new Error('Genome file exceeds the 512 MiB browser import limit.');
        const files = /\.zip$/i.test(file.name) ? await GenomeData.unzip(file) : [{ name: file.name, text: await file.text() }];
        const assemblies=GenomeData.parse(files);
        // Compute sequence-derived metrics off the UI thread while both files are available.
        for(const a of assemblies)for(const c of a.chromosomes)for(const g of c.genes)if(c.sequence.length>=g.end)g.gcContent=GenomeData.gcContent(c.sequence,g.start,g.end);
        postMessage({ assemblies });
    } catch (error) { postMessage({ error: error.message }); }
};
