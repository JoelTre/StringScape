/* Parsing and conservative reference-aware mapping for mutation datasets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StringScapeMutationData=api;})(globalThis,function(){
'use strict';
function parseVCF(text){
 const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/), header=lines.find(x=>x.startsWith('#CHROM\t'));
 if(!header)throw Error('Expected a VCF header beginning #CHROM.');
 const assembly=(lines.filter(x=>x.startsWith('##')).join('\n').match(/\bGC[AF]_\d{9}\.\d+\b/i)||[])[0]||'';
 const samples=header.split('\t').slice(9), records=[];
 for(const line of lines){if(!line||line[0]==='#')continue;const cols=line.split('\t');if(cols.length<8||!/^\d+$/.test(cols[1]))throw Error('Invalid VCF record.');
  const info=Object.fromEntries(cols[7].split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,true]:[x.slice(0,i),x.slice(i+1)];}));
  records.push({chromosome:cols[0],position:Number(cols[1]),id:cols[2],ref:cols[3],alt:cols[4],quality:cols[5],filter:cols[6],info,format:cols[8]||'',samples:Object.fromEntries(samples.map((name,i)=>[name,cols[9+i]||'']))});
 }
 if(!records.length)throw Error('The VCF contains no variants.');
 return {format:'stringscape-mutations-v1',type:'natural',evidence:'observed',assembly,records,samples,headers:lines.filter(x=>x.startsWith('##'))};
}
function parseScores(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'&&!field)quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(Boolean))rows.push(row);row=[];}else field+=c;}
 if(quoted)throw Error('Incomplete CSV quoted field.');if(field||row.length){row.push(field);rows.push(row);}if(rows.length<2)throw Error('Score set has no records.');const head=rows.shift();if(rows.some(r=>r.length!==head.length))throw Error('Score set has inconsistent columns.');return rows.map(r=>Object.fromEntries(head.map((name,i)=>[name,r[i]])));
}
function mapFunctional(dataset,nodes){
 const targets=dataset.metadata?.targetGenes||[],matches=[];
 // Require one amino-acid target that occurs exactly once in a unique active protein.
 if(targets.length===1){const target=targets[0],seq=target.targetSequence;
  if(/^(protein|amino.?acid|aa)$/i.test(seq?.sequenceType||'')&&seq.sequence){const reference=seq.sequence.replace(/\s/g,'').toUpperCase();for(const node of nodes){if(dataset.taxon&&String(node.taxId)!==String(dataset.taxon))continue;const protein=String(node.sequence||'').replace(/\s/g,'').toUpperCase();const at=protein.indexOf(reference);if(reference.length>=20&&at>=0&&protein.indexOf(reference,at+1)<0)matches.push(node.id);}}
 }
 const unique=[...new Set(matches)],values=new Map(),report={mapped:0,unmapped:dataset.records.length,ambiguous:0,referenceMismatch:0};
 if(unique.length===1){values.set(unique[0],dataset.records);report.mapped=dataset.records.length;report.unmapped=0;}else if(unique.length>1){report.ambiguous=dataset.records.length;report.unmapped=0;}
 return {values,report};
}
function mapProtein(dataset,nodes){
 const reference=String(dataset.proteinSequence||'').replace(/\s/g,'').toUpperCase();
 const ids=new Set(nodes.filter(n=>(!dataset.taxon||String(n.taxId)===String(dataset.taxon))&&reference&&String(n.sequence||'').replace(/\s/g,'').toUpperCase()===reference).map(n=>n.id));
 const report={mapped:0,unmapped:0,ambiguous:0,referenceMismatch:0},values=new Map();
 if(ids.size===1){const id=[...ids][0];values.set(id,dataset.records);report.mapped=dataset.records.length;}else if(ids.size>1)report.ambiguous=dataset.records.length;else report.unmapped=dataset.records.length;
 return {values,report};
}
function parse(name,text){if(/\.vcf$/i.test(name))return parseVCF(text);const d=JSON.parse(text);if(d.format!=='stringscape-mutations-v1'||!Array.isArray(d.records))throw Error('Expected a StringScape mutation JSON dataset.');if(d.type==='functional'&&!d.records.length&&d.rawScores){d.records=parseScores(d.rawScores);d.scoreColumns=d.metadata?.datasetColumns?.scoreColumns||['score'];}return d;}
function mapGenomic(dataset, genome){
 const values=new Map(),report={mapped:0,unmapped:0,ambiguous:0,referenceMismatch:0};
 const index=new Map();for(const [id,features] of genome.features)for(const {gene,chromosome} of features.values()){if(!index.has(chromosome))index.set(chromosome,[]);index.get(chromosome).push({id,start:gene.start,end:gene.end});}
 for(const intervals of index.values()){intervals.sort((a,b)=>a.start-b.start);let max=0;for(const entry of intervals){max=Math.max(max,entry.end);entry.prefixMax=max;}}
 for(const record of dataset.records){
  if(!dataset.assembly || !record.chromosome || !Number.isInteger(record.position) || !record.ref){report.unmapped++;continue;}
  const matching=[...genome.tracks.values()].filter(({a,c})=>a.accession===dataset.assembly&&(c.id===record.chromosome||c.name===record.chromosome));
  if(matching.length!==1){report[matching.length?'ambiguous':'unmapped']++;continue;}
  const {c}=matching[0], actual=c.sequence?.slice(record.position-1,record.position-1+record.ref.length);
  if(!actual || actual.toUpperCase()!==record.ref.toUpperCase()){report.referenceMismatch++;continue;}
  const end=record.position+record.ref.length-1, nodes=new Set(),intervals=index.get(c)||[];
  let lo=0,hi=intervals.length;while(lo<hi){const mid=(lo+hi)>>1;if(intervals[mid].start<=end)lo=mid+1;else hi=mid;}
  for(let i=lo-1;i>=0&&intervals[i].prefixMax>=record.position;i--)if(intervals[i].end>=record.position)nodes.add(intervals[i].id);
  if(!nodes.size){report.unmapped++;continue;}
  report.mapped++;for(const id of nodes){if(!values.has(id))values.set(id,[]);values.get(id).push(record);}
 }
 return {values,report};
}
return {parseVCF,parseScores,parse,mapGenomic,mapFunctional,mapProtein};
});
