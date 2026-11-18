'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const functions=source.slice(source.indexOf('function compactEntry('),source.indexOf('async function key('));
function fakeFolder(initial){
 const files=new Map(Object.entries(initial));
 const dir={async getDirectoryHandle(name){return directories(name);},async getFileHandle(name){const key=this.prefix+name;if(!files.has(key)){const error=new Error('Missing');error.name='NotFoundError';throw error;}return {async getFile(){return {async text(){return files.get(key);}}}};},prefix:''};
 function directories(name){const child=Object.create(dir);child.prefix=this?.prefix??'';child.prefix+=name+'/';child.getDirectoryHandle=async n=>directories.call(child,n);return child;}
 dir.getDirectoryHandle=async name=>directories.call(dir,name);return {dir,files};
}
(async()=>{
 for(const existing of [false,true]){
  const entry={id:'abc',name:'test',status:'completed',scores:{model:{mean:.5,values:[.2,.8]}},residues:[{index:0,pae:5}]};
  const initial=existing?{'models/abc/result.json':JSON.stringify({id:'abc',scores:{model:{mean:.5,values:[.2,.8]}}})}:{};
  const {dir,files}=fakeFolder(initial),ctx={folder:dir,manifest:{version:1,entries:[entry]},JSON,Object,Array,Error,read:async(d,n)=>(await (await d.getFileHandle(n)).getFile()),write:async(d,n,v)=>{files.set(d.prefix+n,v);}};
  vm.createContext(ctx);vm.runInContext(functions+'\nthis.migrate=migrateManifest;',ctx);await ctx.migrate();
  const result=JSON.parse(files.get('models/abc/result.json')),manifest=JSON.parse(files.get('batch-manifest.json'));
  assert.deepEqual(result.scores.model.values,[.2,.8]);assert.equal(manifest.entries[0].scores.model.mean,.5);assert.equal('values' in manifest.entries[0].scores.model,false);assert.equal('residues' in manifest.entries[0],false);
 }
 console.log('Batch manifest migration tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
