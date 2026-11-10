/* Mutation import and colour controls. */
(()=>{'use strict';
const datasets=new Map(), data=window.StringScapeMutationData;let bridge,current='',metric='count',sample='',kind='',mapped=new Map(),report=null,range=[0,1];
const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(parent)parent.append(e);return e;};
function prepare(){const d=datasets.get(current);if(!d||!bridge){mapped=new Map();report=null;return;}const result=d.type==='functional'?data.mapFunctional(d,bridge.catalog()):d.type==='protein'?data.mapProtein(d,bridge.catalog()):data.mapGenomic(d,bridge.genome());mapped=result.values;report=result.report;const vals=[...mapped.keys()].map(value).filter(Number.isFinite);range=vals.length?vals.reduce(([lo,hi],v)=>[Math.min(lo,v),Math.max(hi,v)],[Infinity,-Infinity]):[0,1];}
function value(id){let rows=mapped.get(id);if(!rows?.length)return null;if(kind)rows=rows.filter(r=>r.kind===kind);if(sample)rows=rows.filter(r=>{const fields=(r.format||'').split(':'),gt=(r.samples?.[sample]||'').split(':')[fields.indexOf('GT')];return gt&&gt.split(/[|/]/).some(a=>/^\d+$/.test(a)&&Number(a)>0);});if(!rows.length)return null;if(metric==='count')return rows.length;if(metric==='frequency'){const frequencies=rows.flatMap(r=>String(r.info?.AF||'').split(',').filter(x=>x.trim()).map(Number)).filter(n=>Number.isFinite(n)&&n>=0&&n<=1);return frequencies.length?frequencies.reduce((a,b)=>a+b,0)/frequencies.length:null;}const values=rows.map(r=>r[metric]).filter(v=>v!==null&&v!==undefined&&v!==''&&!/^NA$/i.test(String(v))).map(Number).filter(Number.isFinite);if(!values.length)return null;return values.reduce((a,b)=>a+b,0)/values.length;}
function colour(id){const v=value(id);if(!Number.isFinite(v))return '#73808c';return window.d3.interpolateViridis(range[0]===range[1]?0.5:Math.max(0,Math.min(1,(v-range[0])/(range[1]-range[0]))));}
function add(name,text){const d=data.parse(name,text);datasets.set(name,d);current=name;sample='';kind='';metric=d.type==='functional'&&d.scoreColumns?.includes('score')?'score':'count';prepare();}
function remove(name){if(!datasets.delete(name))return;if(current===name)current=datasets.keys().next().value||'';prepare();bridge?.refresh();}
function dropdown(parent,label,choices,selected,change){const wrap=el('div',null,parent);wrap.className='expression-legend-field';const l=el('label',label,wrap),s=el('select',null,wrap);s.className='expression-legend-select';for(const [v,t] of choices){const o=el('option',t,s);o.value=v;}s.value=selected;l.append(s);s.addEventListener('change',()=>change(s.value));}
function renderKey(controls){const box=el('div',null,controls);box.className='expression-legend-box';if(!datasets.size){box.textContent='Fetch mutation data in the left panel under Experimental data, or upload your own mutation data there.';return;}
 const d=datasets.get(current);dropdown(box,'Dataset',[...datasets.keys()].map(x=>[x,x]),current,v=>{current=v;sample='';kind='';const next=datasets.get(v);metric=next.type==='functional'&&next.scoreColumns?.includes('score')?'score':'count';bridge.refresh();});
 dropdown(box,'Display',[['count','Mapped variant count'],...(d.type==='natural'&&d.records.some(r=>r.info?.AF)?[['frequency','Mean reported allele frequency']]:[]),...(d.type==='functional'?(d.scoreColumns||[]).map(x=>[x,`Mean measured ${x}`]):[])],metric,v=>{metric=v;bridge.refresh();});
 if(d.type==='protein')dropdown(box,'Annotation type',[['','All annotations'],['Natural variant','Natural variants'],['Mutagenesis','Experimental mutagenesis']],kind,v=>{kind=v;bridge.refresh();});
 if(d.samples?.length)dropdown(box,'Sample or strain',[['','All samples'],...d.samples.map(x=>[x,x])],sample,v=>{sample=v;bridge.refresh();});
 el('p',`${d.type==='functional'?'Functional assay':d.type==='protein'?'Protein variant annotations':'Natural variation'} · Evidence: ${d.evidence||'unspecified'}`,box);
 if(d.sourceTaxon)el('p',`Source taxon: ${d.sourceTaxon}; network taxon: ${d.taxon}.`,box);
 el('p',d.type==='protein'?`Protein reference: ${d.accession||'not supplied'}.`:`Reference assembly: ${d.assembly||'not supplied'}.`,box);el('p',`${report.mapped} variants mapped; ${report.unmapped} unmapped; ${report.ambiguous} ambiguous; ${report.referenceMismatch} with missing or mismatched reference sequence.`,box);
 if(d.type==='protein')el('p','UniProt protein annotations require an exact match to one loaded protein sequence. Experimental mutagenesis and natural variants can be selected separately.',box);else if(d.type==='functional')el('p','Mean scores are calculated for mapped variants. Mapping requires one amino-acid target of at least 20 residues to occur exactly once in a unique loaded protein; multi-target, DNA and unmatched references remain unmapped.',box);else if(!d.assembly)el('p','A versioned matching assembly is required to map genomic variants.',box);
 if(d.url&&/^https:\/\/(?:www\.ebi\.ac\.uk\/eva\/|www\.mavedb\.org\/|www\.uniprot\.org\/|www\.ensembl\.org\/|www\.ncbi\.nlm\.nih\.gov\/)/.test(d.url)){const a=el('a',d.type==='functional'?'View score set ':'View study ',box);a.href=d.url;a.target='_blank';a.rel='noopener noreferrer';const i=el('i',null,a);i.className='fa-solid fa-arrow-up-right-from-square';}
 if(range){const bar=el('div',null,box);bar.className='gradient-bar';bar.style.background='linear-gradient(to right, #440154, #21918c, #fde725)';el('p',`${range[0]} – ${range[1]} ${metric==='count'?'mapped variants per node':metric==='frequency'?'mean reported allele frequency':'mean measured score'}; grey = unavailable`,box);}
}
async function request(url,options){const response=await fetch(url,{...options,credentials:'omit',signal:AbortSignal.timeout(30000)});if(!response.ok){const error=new Error(`HTTP ${response.status}`);error.status=response.status;throw error;}return response;}
async function relatedTaxa(taxon){
 const params=new URLSearchParams({db:'taxonomy',id:taxon,retmode:'xml'});
 const xml=await(await request('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?'+params)).text();
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('NCBI taxonomy returned invalid XML.');
 const root=doc.querySelector('TaxaSet > Taxon');if(!root)throw Error('NCBI taxonomy returned no taxon.');
 const field=(node,name)=>[...node.children].find(child=>child.tagName===name)?.textContent?.trim()||'';
 const current={id:field(root,'TaxId'),name:field(root,'ScientificName'),rank:field(root,'Rank')};
 if(current.id!==taxon||!current.name)throw Error('NCBI taxonomy did not return the requested taxon.');
 const lineage=[...root.querySelectorAll('LineageEx > Taxon')].map(node=>({id:field(node,'TaxId'),name:field(node,'ScientificName'),rank:field(node,'Rank')}));
 const species=[...lineage].reverse().find(item=>item.rank==='species');
 const nearest=[...lineage].reverse().find(item=>['strain','subspecies'].includes(item.rank));
 const candidates=[current,nearest,species].filter(item=>item&&/^\d+$/.test(item.id)&&item.name);
 return [...new Map(candidates.map(item=>[item.id,item])).values()];
}
async function evaCatalogue(taxon, onProgress=()=>{}){
 // EVA's public index and ENA's study API can both be accessed directly.
 const listing=await(await request('https://ftp.ebi.ac.uk/pub/databases/eva/')).text();
 const doc=new DOMParser().parseFromString(listing,'text/html');
 const accessions=[...new Set([...doc.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(x=>/^PRJ(?:EB|NA|DB)\d+\/$/.test(x||'')).map(x=>x.slice(0,-1)))];
 if(!accessions.length)throw Error('The EVA file index did not contain study accessions.');
 const batches=[];for(let i=0;i<accessions.length;i+=40)batches.push(accessions.slice(i,i+40));
 const rows=[],unavailable=[];let cursor=0,completed=0,successful=0;
 async function queryBatch(batch){
  const query=`tax_eq(${taxon}) AND (${batch.map(id=>`study_accession="${id}"`).join(' OR ')})`;
  const params=new URLSearchParams({result:'study',query,fields:'study_accession,study_title,study_description,tax_id',format:'json',limit:'0'});
  try{
   const result=await(await request('https://www.ebi.ac.uk/ena/portal/api/search?'+params)).json();
   if(!Array.isArray(result))throw Error('ENA returned an unexpected study response.');
   successful++;for(const item of result)rows.push({id:item.study_accession,name:item.study_title,description:item.study_description,taxonomyId:[item.tax_id]});
  }catch(error){
   // A rejected accession should not prevent the other studies being shown.
   if(error.status===400&&batch.length>1){const midpoint=Math.floor(batch.length/2);await queryBatch(batch.slice(0,midpoint));await queryBatch(batch.slice(midpoint));}
   else unavailable.push(...batch);
  }
 }
 async function worker(){while(cursor<batches.length){const batch=batches[cursor++];await queryBatch(batch);onProgress(++completed,batches.length);}}
 await Promise.all(Array.from({length:Math.min(4,batches.length)},worker));
 if(!successful)throw Error('ENA study metadata could not be retrieved. Try again later.');
 return {payload:{response:[{result:rows}]},unavailable};
}
async function importEva(study,taxon,status){
 if(!/^PRJ[A-Z0-9]+$/.test(study.id))throw Error('Invalid EVA study accession.');
 const root='https://ftp.ebi.ac.uk/pub/databases/eva/'+study.id+'/';
 const html=await(await request(root)).text(),doc=new DOMParser().parseFromString(html,'text/html');
 const listed=[...new Set([...doc.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(x=>x && /^[a-z0-9_.-]+\.vcf(?:\.gz)?$/i.test(x)))];
 // EVA may publish an accessioned derivative alongside its original VCF.
 const names=listed.filter(name=>!(/\.accessioned\.vcf(?:\.gz)?$/i.test(name)&&listed.includes(name.replace(/\.accessioned(?=\.vcf)/i,''))));
 if(!names.length)throw Error('No directly downloadable VCF files were found for this study.');
 const combined={format:'stringscape-mutations-v1',type:'natural',evidence:'observed',title:study.name,accession:study.id,taxon,sourceTaxon:study.taxonomyId?.join(', ')||'',assembly:study.assemblyAccession||'',url:'https://www.ebi.ac.uk/eva/?eva-study='+encodeURIComponent(study.id),metadata:study,files:names,headers:{},records:[],samples:[]};
 let totalBytes=0;for(let i=0;i<names.length;i++){
  status.textContent=`Downloading file ${i+1} of ${names.length}: ${names[i]}…`;const response=await request(root+encodeURIComponent(names[i]));
  if(Number(response.headers.get('content-length'))>256*1024*1024)throw Error('A study file exceeds the 256 MiB browser import limit. No partial study was added.');
  let stream=response.body;if(/\.gz$/i.test(names[i])){if(typeof DecompressionStream!=='function')throw Error('This browser cannot decompress VCF files.');stream=stream.pipeThrough(new DecompressionStream('gzip'));}
  const reader=stream.getReader(),chunks=[];let bytes=0;while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>256*1024*1024){await reader.cancel();throw Error('A study file exceeds the 256 MiB expanded browser limit. No partial study was added.');}totalBytes+=value.length;if(totalBytes>256*1024*1024){await reader.cancel();throw Error('The study exceeds the 256 MiB expanded browser limit. No partial study was added.');}chunks.push(value);}
  const dataset=data.parseVCF(await new Blob(chunks).text());if(dataset.assembly&&combined.assembly&&dataset.assembly!==combined.assembly)throw Error('The VCF assembly disagrees with the EVA study assembly.');
  if(!combined.assembly)combined.assembly=dataset.assembly;combined.headers[names[i]]=dataset.headers;for(const record of dataset.records)combined.records.push({...record,sourceFile:names[i]});for(const name of dataset.samples)combined.samples.push(name);
 }
 combined.samples=[...new Set(combined.samples)];const filename=study.id+'.mutation.json';if(datasets.has(filename))throw Error('This study is already loaded.');
 await bridge.upload([new File([JSON.stringify(combined)],filename,{type:'application/json'})]);status.textContent=`Imported ${combined.records.length} variants from ${names.length} files. Reference-mismatched variants remain unmapped.`;
 if(/^GC[AF]_\d{9}\.\d+$/.test(combined.assembly)&&![...bridge.genome().tracks.values()].some(({a})=>a.accession===combined.assembly)){
  status.textContent+=` Fetching matching assembly ${combined.assembly}…`;const result=await bridge.fetchGenome?.(combined.assembly);status.textContent+=result?.status==='success'?' Matching assembly loaded.':` Matching assembly unavailable: ${result?.message||'download failed'}.`;bridge.refresh();
 }
}
async function renderEva(group,taxon,keyword,taxa){
 try{const notice=el('p','Searching EVA study metadata…',group);notice.className='expression-source-message';const {payload,unavailable}=await evaCatalogue((taxa.find(item=>item.rank==='species')||taxa[0]).id,(done,total)=>{notice.textContent=`Checking EVA study records with ENA (${done}/${total})…`;});notice.textContent=`EVA file index matched against ENA metadata. Studies without an ENA record for this taxon may be missing; assembly may be unavailable.${unavailable.length ? ` ${unavailable.length} ${unavailable.length===1?'study could':'studies could'} not be checked.` : ''}`;const rows=payload.response?.[0]?.result;if(!Array.isArray(rows))throw Error('Unexpected EVA catalogue response.');const matches=rows.filter(x=>Array.isArray(x.taxonomyId)&&x.taxonomyId.length&&(!keyword||[x.name,x.id,x.description].join(' ').toLowerCase().includes(keyword.toLowerCase())));el('p',`${matches.length} studies found.`,group);if(!matches.length)el('p',`No EVA studies with ENA metadata were found for taxon ${taxon}. Other strains or the species may have separate records.`,group);
 for(const study of matches){
  const card=el('article',null,group);card.className='expression-study-card';
  const identity=el('div',null,card);identity.className='expression-study-identity';
  const badge=el('span','EVA · natural variation',identity);badge.className='expression-study-source';
  const accession=el('span',study.id,identity);accession.className='expression-study-accession';
  const title=el('h4',study.name||study.id,card);title.className='expression-study-title';
  if(study.description){const desc=el('p',study.description,card);desc.className='expression-study-description';}
  const metadata=el('dl',null,card);metadata.className='expression-study-metadata';
  for(const [label,value] of [['Source taxon',study.taxonomyId?.join(', ')||'Unavailable'],['Assembly',study.assemblyAccession],['Samples',study.numSamples],['Variants',study.numVariants||null]]){const field=el('div',null,metadata);el('dt',label,field);el('dd',value??'Unavailable',field);}
  const actions=el('div',null,card);actions.className='expression-study-actions';
  const button=el('button','Import study variants',actions);button.type='button';
  const link=el('a','View study ',actions);link.className='expression-view-study';link.href='https://www.ebi.ac.uk/eva/?eva-study='+encodeURIComponent(study.id);link.target='_blank';link.rel='noopener noreferrer';const icon=el('i',null,link);icon.className='fa-solid fa-arrow-up-right-from-square';icon.setAttribute('aria-hidden','true');
  const status=el('p','',card);status.className='expression-card-status';status.setAttribute('role','status');
  button.onclick=async()=>{button.disabled=true;try{await importEva(study,taxon,status);}catch(error){status.textContent=`Import failed: ${error.message}`;button.disabled=false;}};
 }
 }catch(error){el('p',`Search unavailable: ${error.message}`,group);}
}
function sourceGroup(results,label){
 const section=el('section',null,results);section.className='expression-source';
 const header=el('div',null,section);header.className='expression-source-header';
 const heading=el('h3',null,header),toggle=el('button',null,heading);toggle.type='button';toggle.className='mutation-source-toggle';toggle.setAttribute('aria-expanded','true');
 el('span',label,toggle);const icon=el('i',null,toggle);icon.className='fa-solid fa-chevron-down';icon.setAttribute('aria-hidden','true');
 const content=el('div',null,section);content.className='mutation-source-content';toggle.addEventListener('click',()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));});return content;
}
function sourceCard(group,source,accession,title,description,linkUrl,importLabel,action){
 const card=el('article',null,group);card.className='expression-study-card';const identity=el('div',null,card);identity.className='expression-study-identity';
 const badge=el('span',source,identity);badge.className='expression-study-source';const acc=el('span',accession,identity);acc.className='expression-study-accession';const h=el('h4',title,card);h.className='expression-study-title';
 const note=el('p',description,card);note.className='expression-study-description';const actions=el('div',null,card);actions.className='expression-study-actions';const button=el('button',importLabel,actions);button.type='button';
 const link=el('a','View source ',actions);link.className='expression-view-study';link.href=linkUrl;link.target='_blank';link.rel='noopener noreferrer';const icon=el('i',null,link);icon.className='fa-solid fa-arrow-up-right-from-square';icon.setAttribute('aria-hidden','true');
 const status=el('p','',card);status.className='expression-card-status';status.setAttribute('role','status');button.onclick=async()=>{button.disabled=true;try{await action(status);status.textContent+=' Colour nodes by has been set to Mutations.';}catch(error){status.textContent=`Import failed: ${error.message}`;button.disabled=false;}};
}
async function saveMutation(name,dataset){if(datasets.has(name))throw Error('This dataset is already loaded.');await bridge.upload([new File([JSON.stringify(dataset)],name,{type:'application/json'})]);}
async function renderUniProt(results,taxon,keyword,taxa){
 const group=sourceGroup(results,'UniProt');try{
  // Include the closest strain/subspecies ancestor where present, rather than
  // searching every strain of a species as though it were the loaded strain.
  const ids=taxa.filter((item,i)=>i===0||['strain','subspecies'].includes(item.rank)).map(item=>item.id);
  const taxQuery=ids.map(id=>`organism_id:${id}`).join(' OR ');
  const params=new URLSearchParams({query:`(${taxQuery}) AND (ft_mutagen:* OR ft_variant:*)${keyword?' AND ('+keyword.replace(/[^A-Za-z0-9 _.-]/g,' ')+')':''}`,format:'json',size:'100',fields:'accession,protein_name,organism_name,sequence,ft_mutagen,ft_variant'});
  let next='https://rest.uniprot.org/uniprotkb/search?'+params,shown=0,total=null;const count=el('p','Searching…',group);
  async function loadPage(){
   const response=await request(next),payload=await response.json();if(!Array.isArray(payload.results))throw Error('Unexpected UniProt response.');total=Number(response.headers.get('x-total-results'))||total;
   for(const entry of payload.results){const id=entry.primaryAccession,features=(entry.features||[]).filter(f=>f.type==='Natural variant'||f.type==='Mutagenesis');if(!features.length||!id)continue;
    shown++;const sourceTaxon=String(entry.organism?.taxonId||'');const title=entry.proteinDescription?.recommendedName?.fullName?.value||entry.proteinDescription?.submissionNames?.[0]?.fullName?.value||id;
    sourceCard(group,'UniProt · protein',id,title,`${features.length} natural-variant and experimental-mutagenesis annotations. Source taxon: ${sourceTaxon||'unavailable'}${sourceTaxon&&sourceTaxon!==taxon?` (related to network taxon ${taxon})`:''}. Effects and evidence are retained as reported.`,`https://www.uniprot.org/uniprotkb/${encodeURIComponent(id)}/entry`,'Import protein annotations',async status=>{
     status.textContent='Preparing protein annotations…';const records=features.map((feature,i)=>({id:feature.featureId||`${id}:${i+1}`,kind:feature.type,location:feature.location,description:feature.description||'',evidences:feature.evidences||[],alternativeSequence:feature.alternativeSequence||null}));
     await saveMutation(`uniprot-${id}.mutation.json`,{format:'stringscape-mutations-v1',type:'protein',evidence:'source-reported',source:'UniProt',accession:id,taxon,sourceTaxon,proteinSequence:entry.sequence?.value||'',title,url:`https://www.uniprot.org/uniprotkb/${id}/entry`,records});status.textContent=`Imported ${records.length} annotations.`;
    });
   }
   const link=response.headers.get('link')||'',match=link.match(/<([^>]+)>\s*;\s*rel="?next"?/i);next='';if(match){const url=new URL(match[1]);if(url.protocol==='https:'&&url.hostname==='rest.uniprot.org'&&url.pathname==='/uniprotkb/search')next=url.href;}
   count.textContent=`${shown}${total?' of '+total:''} proteins shown. Searched source taxa: ${ids.join(', ')}.`;
   if(next){const button=el('button','Load more UniProt proteins',group);button.type='button';button.onclick=async()=>{button.disabled=true;try{await loadPage();button.remove();}catch(error){button.disabled=false;count.textContent=`Could not load more proteins: ${error.message}`;}};}
  }
  await loadPage();
 }catch(error){el('p',`Search unavailable: ${error.message}`,group);}
}

function currentGenomeRegions(genome,assembly){
 const tracks=[...genome.tracks.values()].filter(({a})=>a.accession===assembly),regions=new Map();
 for(const features of genome.features.values())for(const {gene,chromosome} of features.values())if(tracks.some(t=>t.c===chromosome)){
  const key=`${chromosome.name}:${gene.start}:${gene.end}`;regions.set(key,{chromosome:chromosome.name,start:gene.start,end:gene.end});
 }
 return [...regions.values()];
}
async function renderEnsembl(results,taxon,keyword){
 const group=sourceGroup(results,'Ensembl');try{
  const genomes=await(await request(`https://rest.ensembl.org/info/genomes/taxonomy/${taxon}?content-type=application/json`)).json();if(!Array.isArray(genomes))throw Error('Unexpected Ensembl response.');
  const available=genomes.filter(g=>g.has_variations&&(!keyword||JSON.stringify(g).toLowerCase().includes(keyword.toLowerCase())));if(!available.length){el('p','No Ensembl variation collection is available for this taxon.',group);return;}
  for(const genome of available){if(!/^[a-z0-9_]+$/i.test(genome.name||'')||!/^GC[AF]_\d{9}\.\d+$/.test(genome.assembly_accession||''))continue;
   sourceCard(group,'Ensembl · genome collection',genome.assembly_accession,genome.display_name||genome.name,'Imports variants overlapping genes mapped to the loaded network. Ensembl consequence terms are predictions; this is a network-gene collection, not a whole study.','https://www.ensembl.org/','Import network-gene variants',async status=>{
    let state=bridge.genome();if(![...state.tracks.values()].some(({a})=>a.accession===genome.assembly_accession)){status.textContent=`Fetching ${genome.assembly_accession}…`;const fetched=await bridge.fetchGenome(genome.assembly_accession);if(fetched?.status!=='success')throw Error(fetched?.message||'Matching genome unavailable.');state=bridge.genome();}
    const regions=currentGenomeRegions(state,genome.assembly_accession);if(!regions.length)throw Error('No network genes are mapped to this assembly.');const records=new Map();let done=0;
    for(const region of regions){for(let start=region.start;start<=region.end;start+=5000000){const end=Math.min(region.end,start+4999999);status.textContent=`Fetching network genes ${done+1} of ${regions.length}…`;const url=`https://rest.ensembl.org/overlap/region/${encodeURIComponent(genome.name)}/${encodeURIComponent(region.chromosome+':'+start+'-'+end)}?feature=variation;content-type=application/json`;const found=await(await request(url)).json();if(!Array.isArray(found))throw Error('Unexpected Ensembl variant response.');for(const v of found){const alleles=Array.isArray(v.alleles)?v.alleles.map(String):String(v.allele_string||'').split('/');const key=[v.id,v.seq_region_name,v.start,alleles.join('/')].join(':');records.set(key,{id:v.id||key,chromosome:String(v.seq_region_name||region.chromosome),position:Number(v.start),ref:alleles[0]||'',alt:alleles.slice(1).join(','),info:{consequence:v.consequence_type||'',source:v.source||'',evidence:'predicted consequence'},raw:v});}}done++;}
    if(!records.size)throw Error('No variants were returned for the mapped network genes.');const dataset={format:'stringscape-mutations-v1',type:'natural',evidence:'observed variants; consequences predicted',source:'Ensembl',taxon,assembly:genome.assembly_accession,title:genome.display_name||genome.name,url:'https://www.ensembl.org/',records:[...records.values()]};await saveMutation(`ensembl-${genome.assembly_accession}.mutation.json`,dataset);status.textContent=`Imported ${records.size} variants overlapping ${regions.length} network gene regions.`;
   });
  }
 }catch(error){el('p',`Search unavailable: ${error.message}`,group);}
}
async function renderDbSnp(results,taxon,keyword){
 const group=sourceGroup(results,'NCBI dbSNP');if(taxon!=='9606'){el('p','The current dbSNP online service covers human variants. Non-human records are archived and EVA manages non-human variation.',group);return;}
 const genes=[...new Set(bridge.catalog().filter(n=>String(n.taxId)==='9606').map(n=>n.preferred).filter(x=>/^[A-Za-z0-9_-]{1,40}$/.test(x||'')&&(!keyword||x.toLowerCase().includes(keyword.toLowerCase()))))];
 if(!genes.length){el('p','No matching loaded human protein names are available to query dbSNP.',group);return;}
 el('p',`${Math.min(genes.length,50)} of ${genes.length} loaded protein names shown. Each card searches variants associated with that gene name.`,group);
 for(const gene of genes.slice(0,50))sourceCard(group,'dbSNP · gene collection',gene,`${gene} variants`,'Gene-name search; may include regulatory and neighboring variants. Clinical associations and allele frequencies are retained where supplied.','https://www.ncbi.nlm.nih.gov/snp/','Import gene variants',async status=>{
  const query=`${gene}[Gene Name] AND txid9606[Organism:exp]`,params=new URLSearchParams({db:'snp',term:query,retmax:'10000',retmode:'json'});status.textContent='Searching dbSNP…';const search=await(await request('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?'+params)).json(),ids=search.esearchresult?.idlist,total=Number(search.esearchresult?.count);
  if(!Array.isArray(ids)||!Number.isFinite(total))throw Error('Unexpected dbSNP search response.');if(total>10000||ids.length!==total)throw Error(`The search returned ${total} variants; the 10,000-variant browser import limit prevents a partial import.`);if(!ids.length)throw Error('No dbSNP variants were found for this gene.');
  const records=[];for(let i=0;i<ids.length;i+=100){if(i)await new Promise(resolve=>setTimeout(resolve,370));status.textContent=`Downloading variants ${Math.min(i+100,ids.length)} of ${ids.length}…`;const q=new URLSearchParams({db:'snp',id:ids.slice(i,i+100).join(','),retmode:'json'}),payload=await(await request('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?'+q)).json();for(const id of ids.slice(i,i+100)){const v=payload.result?.[id];if(!v)throw Error(`Missing dbSNP record ${id}; no partial dataset was added.`);const spdi=String(v.spdi||'').split(':');records.push({id:`rs${v.snp_id||id}`,chromosome:spdi[0]||v.acc||'',position:/^\d+$/.test(spdi[1]||'')?Number(spdi[1])+1:null,ref:spdi[2]||'',alt:spdi[3]||'',info:{frequencies:v.global_mafs||[],clinical_significance:v.clinical_significance||'',consequence:v.fxn_class||''},raw:v});}}
  const assemblies=new Set();for(const rec of records)for(const {a,c} of bridge.genome().tracks.values())if(c.id===rec.chromosome)assemblies.add(a.accession);const assembly=assemblies.size===1?[...assemblies][0]:'';const dataset={format:'stringscape-mutations-v1',type:'natural',evidence:'source-reported',source:'NCBI dbSNP',title:`${gene} dbSNP variants`,taxon,assembly,url:'https://www.ncbi.nlm.nih.gov/snp/',records};await saveMutation(`dbsnp-${gene}.mutation.json`,dataset);status.textContent=`Imported ${records.length} variants. ${assembly?'Matching loaded assembly: '+assembly+'.':'Assembly could not be established; variants remain unmapped.'}`;
 });
}
async function search(){const taxon=document.getElementById('mutation-taxon').value,status=document.getElementById('mutation-search-status'),results=document.getElementById('mutation-results'),keyword=document.getElementById('mutation-keyword').value.trim();results.replaceChildren();if(!/^\d+$/.test(taxon)){status.textContent='Load a network with a valid taxon ID first.';return;}status.textContent='Searching mutation databases…';
 let taxa;try{taxa=await relatedTaxa(taxon);}catch(error){status.textContent=`Could not resolve related taxa: ${error.message}`;return;}
 status.textContent=`Searching for ${taxa.map(item=>`${item.name} (${item.id})`).join('; ')}…`;
 const section=sourceGroup(results,'European Variation Archive');const evaSearch=renderEva(section,taxon,keyword,taxa);const additionalSearches=[renderUniProt(results,taxon,keyword,taxa),renderEnsembl(results,taxon,keyword),renderDbSnp(results,taxon,keyword)];
 const group=sourceGroup(results,'MaveDB');
 try{const name=taxa[0].name;const payload=await(await request('https://api.mavedb.org/api/v1/score-sets/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetOrganismNames:taxa.map(item=>item.name),text:keyword||null,limit:100,offset:0})})).json();const rows=payload.scoreSets||[];let shown=0;
 for(const row of rows){shown++;
  const card=el('article',null,group);card.className='expression-study-card';const identity=el('div',null,card);identity.className='expression-study-identity';
  const badge=el('span','MaveDB · score set',identity);badge.className='expression-study-source';const accession=el('span',row.urn,identity);accession.className='expression-study-accession';
  const title=el('h4',row.title||row.urn,card);title.className='expression-study-title';if(row.shortDescription){const description=el('p',row.shortDescription,card);description.className='expression-study-description';}
  const meta=el('dl',null,card);meta.className='expression-study-metadata';for(const [label,value] of [['Evidence','Measured functional effects'],['Variants',row.numVariants],['Target',(row.targetGenes||[]).map(x=>x.name).filter(Boolean).join(', ')]]){const field=el('div',null,meta);el('dt',label,field);el('dd',value??'Unavailable',field);}
  const sourceTaxa=[...new Set((row.targetGenes||[]).map(target=>target.targetSequence?.taxonomy).filter(Boolean).map(t=>`${t.organismName||'Unknown'} (${t.code||'unknown'})`))];const note=el('p',`Source organism: ${sourceTaxa.join(', ')||'not supplied'}. Target reference must be verified before mapping.`,card);note.className='expression-study-note';
  const actions=el('div',null,card);actions.className='expression-study-actions';const button=el('button','Import score set',actions);button.type='button';
  const a=el('a','View score set ',actions);a.className='expression-view-study';a.href='https://www.mavedb.org/score-sets/'+encodeURIComponent(row.urn);a.target='_blank';a.rel='noopener noreferrer';const icon=el('i',null,a);icon.className='fa-solid fa-arrow-up-right-from-square';icon.setAttribute('aria-hidden','true');
  const message=el('p','',card);message.className='expression-card-status';message.setAttribute('role','status');
  button.onclick=async()=>{button.disabled=true;message.textContent='Downloading score set…';try{if(!/^urn:mavedb:[a-z0-9-]+$/i.test(row.urn))throw Error('Invalid score set accession.');const base='https://api.mavedb.org/api/v1/score-sets/'+encodeURIComponent(row.urn);const [metadata,csv]=await Promise.all([request(base).then(r=>r.json()),request(base+'/scores').then(r=>r.text())]);if(!csv.trim())throw Error('The score set is empty.');const records=data.parseScores(csv);if(Number.isInteger(metadata.numVariants)&&records.length!==metadata.numVariants)throw Error(`Score download is incomplete: received ${records.length} of ${metadata.numVariants} variants.`);const dataset={format:'stringscape-mutations-v1',type:'functional',evidence:'measured',title:row.title,accession:row.urn,url:'https://www.mavedb.org/score-sets/'+encodeURIComponent(row.urn),taxon,sourceTaxon:sourceTaxa.join(', '),metadata,rawScores:csv,scoreColumns:metadata.datasetColumns?.scoreColumns||['score'],records};const filename=row.urn.replace(/[^a-z0-9-]/gi,'_')+'.mutation.json';await bridge.upload([new File([JSON.stringify(dataset)],filename,{type:'application/json'})]);message.textContent='Score set imported. Exact target sequence matching is required for colouring.';}catch(error){message.textContent=`Import failed: ${error.message}`;button.disabled=false;}};
 }
 el('p',`${shown} of ${payload.numScoreSets ?? rows.length} matching score sets shown${(payload.numScoreSets ?? rows.length)>rows.length?'; refine the search to see more.':'.'}`,group);if(!shown)el('p',`No MaveDB score sets were found for the searched taxa${keyword?' with these search terms':''}.`,group);await Promise.all([evaSearch,...additionalSearches]);status.textContent='Search complete.';
 }catch(error){el('p',`Search unavailable: ${error.message}`,group);await Promise.all([evaSearch,...additionalSearches]);status.textContent='Search finished with unavailable sources.';}}
function init(b){bridge=b;const dialog=document.getElementById('mutation-dialog');document.getElementById('mutation-fetch').onclick=()=>{const select=document.getElementById('mutation-taxon');select.replaceChildren();for(const taxon of bridge.taxa()){const o=el('option',`Taxon ${taxon}`,select);o.value=taxon;}document.getElementById('mutation-search-status').textContent=select.value?'Select a taxon and find data.':'Load a network with a taxon ID first.';dialog.showModal();};document.getElementById('mutation-close').onclick=()=>dialog.close();document.getElementById('mutation-search').onclick=search;document.getElementById('mutation-keyword').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};document.getElementById('mutation-upload').onclick=()=>document.getElementById('mutation-file').click();document.getElementById('mutation-file').onchange=async e=>{const status=document.getElementById('mutation-upload-status');for(const file of e.target.files){try{const text=await file.text();data.parse(file.name,text);const name=file.name.replace(/\.(vcf|json)$/i,'')+'.mutation.'+(/\.vcf$/i.test(file.name)?'vcf':'json');if(datasets.has(name))throw Error('A dataset with this name is already loaded.');await bridge.upload([new File([text],name)]);status.textContent=`Loaded ${file.name}. Colour nodes by has been set to Mutations.`;}catch(error){status.textContent=`Could not load ${file.name}: ${error.message}`;}}e.target.value='';};}
function recordsForNode(id){
 if(!bridge)return [];
 const catalog=bridge.catalog(),genome=bridge.genome(),result=[];
 for(const [name,dataset] of datasets){
  const mapping=dataset.type==='functional'?data.mapFunctional(dataset,catalog):dataset.type==='protein'?data.mapProtein(dataset,catalog):data.mapGenomic(dataset,genome);
  const records=mapping.values.get(id);if(records?.length)result.push({name,title:dataset.title||name,source:dataset.source||(String(dataset.accession||'').startsWith('urn:mavedb:')?'MaveDB':'Uploaded mutation data'),accession:dataset.accession||'',url:dataset.url||'',type:dataset.type,evidence:dataset.evidence||'',records});
 }
 return result;
}
window.StringScapeMutations={init,add,remove,prepare,value,colour,renderKey,recordsForNode,has:name=>datasets.has(name),clear(){datasets.clear();current='';prepare();}};
})();
