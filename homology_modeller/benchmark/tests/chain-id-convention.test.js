'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),app=fs.readFileSync(path.join(root,'benchmark/app.js'),'utf8');
const start=app.indexOf('function resolveBenchmarkChainMappings('),end=app.indexOf('function resultRows(',start);assert(start>=0&&end>start);
const context={};vm.createContext(context);vm.runInContext(app.slice(start,end)+'\nthis.resolve=resolveBenchmarkChainMappings;',context);
const chains=['A','B','C','E'],aliases={A:'B',B:'C',C:'D',E:'A'},csv={A:'P08394',B:'P07648',C:'P04993',E:'P11191'};
assert.deepEqual({...context.resolve(chains,aliases,csv,'label')},csv);
const author={B:'P08394',C:'P07648',D:'P04993',A:'P11191'};
assert.deepEqual({...context.resolve(chains,aliases,author,'author')},csv);
assert.throws(()=>context.resolve(chains,aliases,csv,'author'),/No UniProt mapping for reference chain C/);
assert.throws(()=>context.resolve(['A'],{},csv,'author'),/No UniProt mapping/);
assert.throws(()=>context.resolve(chains,aliases,csv,'auto'),/Choose/);
const fixture='/home/joel/PhD/StringScape/Benchmark_results/run4_Nov_13_Distance=10/0167-8B1U/reference.cif';
if(fs.existsSync(fixture)){
    const source=fs.readFileSync(path.join(root,'script.js'),'utf8'),slice=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i);return source.slice(i,j);};
    const parser={detectBindingPatches:()=>[]};vm.createContext(parser);
    vm.runInContext(fs.readFileSync(path.join(root,'memory-data.js'),'utf8')+slice('const AA_3TO1 =','// Color Tables')+slice('// structureParsing.js start','// structureParsing.js end')+slice('function* cifTokens(text)','// referenceSearch.js end')+slice('// mmcifParsing.js start','// mmcifParsing.js end')+fs.readFileSync(path.join(root,'benchmark/bridge.js'),'utf8')+'\nthis.prepare=benchmarkPrepareReference;',parser);
    const prep=parser.prepare({text:fs.readFileSync(fixture,'utf8'),distance:10,seed:1});
    assert.deepEqual({...context.resolve(prep.chains,prep.aliases,csv,'label')},csv);
    assert.deepEqual([...new Set(Object.values(context.resolve(prep.chains,prep.aliases,csv,'label')))].sort(),Object.values(csv).sort());
}
console.log('Benchmark chain ID convention tests passed');
