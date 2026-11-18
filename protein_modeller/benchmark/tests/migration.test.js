'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {unpackBenchmarkResult}=require('../storage.js');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const code=source.slice(source.indexOf('async function readEntryResult('),source.indexOf('async function ensureResults('));
function missing(){const e=Error('missing');e.name='NotFoundError';return e;}
const files=new Map(),dirs=new Set();
const folder=name=>({name,async getFileHandle(file){if(!files.has(`${name}/${file}`))throw missing();return {};}});
const directory={async getDirectoryHandle(name,opts){if(!dirs.has(name)){if(!opts?.create)throw missing();dirs.add(name);}return folder(name);}};
const context={directory,runManifest:null,manifestLoading:null,folderRevision:1,unpackBenchmarkResult,crypto:{randomUUID:()=>`unique-${dirs.size}`},setTimeout,
    normalisePdbId:v=>String(v||'').trim().toUpperCase(),benchmarkNumber:v=>v==null?null:Number(v),
    readJson:async(dir,name)=>files.has(`${dir.name||''}/${name}`)?JSON.parse(files.get(`${dir.name||''}/${name}`)):null,
    writeFile:async(dir,name,data)=>files.set(`${dir.name}/${name}`,data),
    manifestParts:function*(m){yield JSON.stringify(m)},writeChunks:async(dir,name,parts)=>files.set(`/${name}`,[...parts].join(''))};
vm.createContext(context);vm.runInContext(code,context);
(async()=>{
    const legacy={version:1,entries:[{input:{'PDB ID':'6SBC'},status:'completed',summary:{score:1},residues:[{residue:1}]}]};files.set('/benchmark-manifest.json',JSON.stringify(legacy));
    let manifest=await vm.runInContext('loadExistingResults()',context);assert(manifest.entries[0].resultFile.startsWith('0001-6SBC/benchmark-legacy-'));assert.equal(manifest.entries[0].residues,undefined);assert.deepEqual(JSON.parse(files.get('/benchmark-manifest.json')).entries[0].summary,{score:1});
    context.entry=manifest.entries[0];let result=await vm.runInContext('readEntryResult(entry)',context);assert.equal(result.residues[0].residue,1);
    dirs.add('0001-6SBC');files.set('0001-6SBC/result.json',JSON.stringify({residues:[{residue:999}]}));files.set('/benchmark-manifest.json',JSON.stringify(legacy));
    manifest=await vm.runInContext('loadExistingResults()',context);assert(manifest.entries[0].resultFile.includes('benchmark-legacy-'));context.entry=manifest.entries[0];result=await vm.runInContext('readEntryResult(entry)',context);assert.equal(result.residues[0].residue,1);assert.equal(JSON.parse(files.get('0001-6SBC/result.json')).residues[0].residue,999);
    files.delete('/benchmark-manifest.json');files.set('/benchmark-results.json',JSON.stringify({summary:[{'PDB ID':'2ABC',Status:'completed'}],residues:[{'PDB ID':'2ABC',Residue:'A 1'}]}));
    manifest=await vm.runInContext('loadExistingResults()',context);assert.equal(manifest.entries[0].status,'completed');assert(manifest.entries[0].resultFile.startsWith('legacy-import-'));context.entry=manifest.entries[0];result=await vm.runInContext('readEntryResult(entry)',context);assert.equal(result.residues[0].Residue,'A 1');assert(files.has('/benchmark-manifest.json'));
    console.log('legacy manifest and results-only migration tests passed');
})().catch(error=>{console.error(error);process.exitCode=1});
