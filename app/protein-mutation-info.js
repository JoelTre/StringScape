/* On-demand UniProt mutation annotations for a selected protein. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StringScapeProteinMutations=api;})(globalThis,function(){
'use strict';
function create(fetcher){
 const cache=new Map();
 const clean=s=>String(s||'').replace(/\s/g,'').toUpperCase();
 async function request(url){const response=await fetcher(url,{headers:{Accept:'application/json'},credentials:'omit',signal:AbortSignal.timeout(25000)});if(!response.ok){const error=new Error(`UniProt returned HTTP ${response.status}.`);error.status=response.status;throw error;}return response;}
 async function fetchAnnotations({nodeId,accession,sequence}){
  const reference=clean(sequence);let entries=[];
  if(accession){
   try{entries=[await(await request(`https://rest.uniprot.org/uniprotkb/${encodeURIComponent(accession)}.json`)).json()];}
   catch(error){if(error.status!==404)throw error;}
  }
  if(!entries.length){
   if(!/^[A-Za-z0-9_.:-]+$/.test(String(nodeId||'')))return {status:'unavailable',message:'No UniProt identifier or searchable STRING protein ID is available.'};
   const params=new URLSearchParams({query:`xref:STRING-${nodeId}`,format:'json',size:'10',fields:'accession,organism_name,sequence,ft_variant,ft_mutagen'});
   const response=await request('https://rest.uniprot.org/uniprotkb/search?'+params),payload=await response.json();
   if(!Array.isArray(payload.results))throw Error('UniProt returned an unexpected response.');
   if(Number(response.headers.get('x-total-results'))>payload.results.length)return {status:'ambiguous',message:'More than ten UniProt entries match this STRING identifier; the source cannot be selected safely.'};
   entries=payload.results;
  }
  if(!entries.length)return {status:'no_match',message:'No UniProt entry was found for this protein, so mutation annotations are unavailable.'};
  if(reference){const exact=entries.filter(entry=>clean(entry.sequence?.value)===reference);if(!exact.length)return {status:'sequence_mismatch',message:'The UniProt reference sequence does not match the loaded protein sequence. No annotations were assigned.'};entries=exact;}
  if(entries.length!==1)return {status:'ambiguous',message:'Multiple UniProt entries match this protein. No annotations were assigned.'};
  const entry=entries[0];if(!entry.primaryAccession||!Array.isArray(entry.features)){
   if(!entry.primaryAccession)throw Error('UniProt returned an invalid protein entry.');
   if(entry.features!=null)throw Error('UniProt returned invalid feature annotations.');
  }
  return {status:'success',accession:entry.primaryAccession,sourceTaxon:entry.organism?.taxonId||null,sequenceVerified:!!reference,features:(entry.features||[]).filter(feature=>feature.type==='Natural variant'||feature.type==='Mutagenesis')};
 }
 function get(identity,{retry=false}={}){const key=JSON.stringify([identity.nodeId,identity.accession||'',clean(identity.sequence)]);if(retry)cache.delete(key);if(!cache.has(key)){const promise=fetchAnnotations(identity).catch(error=>{cache.delete(key);throw error;});cache.set(key,promise);}return cache.get(key);}
 return {get,clear:()=>cache.clear()};
}
return {create};
});
