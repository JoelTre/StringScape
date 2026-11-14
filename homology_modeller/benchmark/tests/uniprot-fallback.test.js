'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../script.js'),'utf8');
const start=source.indexOf('        async function resolveUniProtInput('),end=source.indexOf('        async function loadModelInput(',start);
assert.ok(start>=0&&end>start);
const requests=[];
const context={window:{__benchmarkRun:{forceSequenceAccessions:new Set()}},fetch:async url=>{requests.push(url);if(url.includes('alphafold'))return {ok:false,status:404};return {ok:true,text:async()=>'>P12345\nACD'};},parseModelInputs:()=>[{sequence:'ACD'}],sequenceToPdb:s=>'PDB:'+s,trustedAlphaFoldUrl:s=>s,encodeURIComponent,Error,Set};
vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nthis.resolve=resolveUniProtInput;',context);
(async()=>{
 context.window.__benchmarkRun.forceSequenceAccessions.add('P12345');
 let result=await context.resolve({id:'P12345'});assert.equal(result.sequence,'ACD');assert.equal(result.fallbackReason,'forced');assert.equal(requests.length,1);assert.match(requests[0],/uniprot/);assert.ok(!requests.some(x=>x.includes('alphafold')));
 requests.length=0;context.window.__benchmarkRun.forceSequenceAccessions.clear();result=await context.resolve({id:'P12345'});assert.equal(result.fallbackReason,'alphafold-unavailable');assert.equal(requests.length,2);assert.match(requests[0],/alphafold/);
 console.log('UniProt natural and forced input tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
