'use strict';
// Packs independent session ArrayBuffers without changing graph references.
const SessionPack=(()=>{
 const chunkSize=8*1024*1024;
 function build(binaryFiles,makeBlob=true){
  const entries={},parts=[];let offset=0;
  for(const [name,value] of Object.entries(binaryFiles)){
   if(!/^buffer-\d+\.bin$/.test(name)||!ArrayBuffer.isView(value))throw Error('Invalid session buffer.');
   const length=value.byteLength;if(!Number.isSafeInteger(offset+length))throw Error('Session buffers are too large.');
   entries[name]={offset,length};parts.push(value);offset+=length;
  }
  if(!parts.length)return {pack:null,blob:null,parts:[]};
  return {pack:{version:1,file:`session-buffers-${crypto.randomUUID()}.bin`,byteLength:offset,entries},blob:makeBlob?new Blob(parts,{type:'application/octet-stream'}):null,parts};
 }
 function records(session){return [...(session.graph?.records||[]),...(session.timeline?.records||[])].filter(r=>r.type==='Binary');}
 async function unpack(session,blob){
  const pack=session.bufferPack;
  if(!pack||pack.version!==1||!/^session-buffers-[0-9a-f-]+\.bin$/i.test(pack.file)||!Number.isSafeInteger(pack.byteLength)||pack.byteLength<0||!pack.entries||typeof pack.entries!=='object'||!blob||blob.size!==pack.byteLength)throw Error('Invalid packed session buffer file.');
  const listed=Object.entries(pack.entries).map(([name,entry])=>({name,...entry})).sort((a,b)=>a.offset-b.offset);
  let cursor=0;const lengths=new Map();
  for(const entry of listed){if(!/^buffer-\d+\.bin$/.test(entry.name)||!Number.isSafeInteger(entry.offset)||!Number.isSafeInteger(entry.length)||entry.offset!==cursor||entry.length<0||!Number.isSafeInteger(entry.offset+entry.length)||entry.offset+entry.length>blob.size)throw Error('Invalid packed session buffer index.');cursor+=entry.length;lengths.set(entry.name,entry.length);}
  if(cursor!==blob.size)throw Error('Incomplete packed session buffers.');
  for(const record of records(session))if(lengths.get(record.name)!==record.length)throw Error('Missing or invalid session buffer: '+record.name);
  const buffers={};let start=0;
  while(start<listed.length){let end=start+1,base=listed[start].offset,limit=Math.max(base+chunkSize,base+listed[start].length);
   while(end<listed.length&&listed[end].offset+listed[end].length<=limit)end++;
   const last=listed[end-1],data=await blob.slice(base,last.offset+last.length).arrayBuffer();
   for(let i=start;i<end;i++){const e=listed[i];buffers[e.name]=new Uint8Array(data,e.offset-base,e.length);}
   start=end;
  }
  return buffers;
 }
 async function loadFolder(dir){
  const session=JSON.parse(await (await (await dir.getFileHandle('session.json')).getFile()).text());
  if(session.bufferPack){if(!/^session-buffers-[0-9a-f-]+\.bin$/i.test(session.bufferPack.file))throw Error('Invalid packed session buffer filename.');const blob=await (await dir.getFileHandle(session.bufferPack.file)).getFile();session.binaryFiles=await unpack(session,blob);}
  else{session.binaryFiles={};for(const record of records(session)){if(!/^buffer-\d+\.bin$/.test(record.name))throw Error('Invalid session buffer name.');session.binaryFiles[record.name]=new Uint8Array(await (await (await dir.getFileHandle(record.name)).getFile()).arrayBuffer());}}
  session.attachments={};for(const f of [...Object.values(session.uploads||{}).flatMap(upload=>upload?.files||[]),...Object.values(session.stringFiles||{}).filter(Boolean)])if(f.entry&&/^input-\d+\.bin$/.test(f.entry))session.attachments[f.entry]=await (await dir.getFileHandle(f.entry)).getFile();
  return session;
 }
 async function writePacked(dir,pack,parts){
  const writable=await (await dir.getFileHandle(pack.file,{create:true})).createWritable();
  try{let pending=[],size=0;const flush=async()=>{if(pending.length){await writable.write(new Blob(pending));pending=[];size=0;}};
   for(const value of parts){if(size&&size+value.byteLength>1024*1024)await flush();if(value.byteLength>1024*1024)await writable.write(value);else{pending.push(value);size+=value.byteLength;}}
   await flush();await writable.close();
  }catch(error){await writable.abort();throw error;}
 }
 async function writeFile(dir,name,data){const writable=await (await dir.getFileHandle(name,{create:true})).createWritable();try{if(data instanceof Blob&&data.size>chunkSize){for(let i=0;i<data.size;i+=chunkSize)await writable.write(data.slice(i,i+chunkSize));}else await writable.write(data);await writable.close();}catch(error){await writable.abort();throw error;}}
 return {build,unpack,loadFolder,writePacked,writeFile};
})();

// Expose the helper to all classic scripts in the same document.
globalThis.SessionPack=SessionPack;
