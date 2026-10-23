importScripts('genetic-codes.js', 'genome-sequence.js');
onmessage = ({data}) => {
    try { postMessage({id:data.id,model:GenomeSequence.build(data.gene,data.dna,data.protein)}); }
    catch(error) { postMessage({id:data.id,error:error.message}); }
};
