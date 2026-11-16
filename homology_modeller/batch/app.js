'use strict';
const $=s=>document.querySelector(s), columns=['What do you want a model of?','Reference PDB IDs','AlphaFold IDs, UniProt IDs, or PDB IDs'];
let rows=[],folder=null,manifest={version:1,entries:[]},running=false,stop=false,pauseRequested=false,pauseWake=null,workerReady=false,settingsReady=false,speciesReady=false,viewerReady=null,imageUrl=null,thumbUrls=[],diagnosticRecords=[];
function parseCSV(text){let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'){if(field)throw Error('Invalid CSV quote');quoted=true;}else if(c===','){row.push(field);field='';}else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('Unclosed quoted CSV field');if(field||row.length){row.push(field);rows.push(row);}const headers=(rows.shift()||[]).map((x,i)=>i===0?x.replace(/^\ufeff/,''):x);if(new Set(headers).size!==headers.length||columns.some(x=>!headers.includes(x)))throw Error('CSV must contain the three required column names exactly.');return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV row ${i+2} has ${r.length} fields; expected ${headers.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});}
const queueColumnWidths=new Map();
function sizeQueueColumns(table,keys,data,host){
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d'),style=getComputedStyle(table);context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
 const available=host.clientWidth;if(!available)return;
 const desired=keys.map((key,index)=>{let widest=context.measureText(key).width;for(const row of data)widest=Math.max(widest,context.measureText(String(row[key]??'')).width);return Math.ceil(widest+30);});
 const widths=keys.map((key,index)=>queueColumnWidths.get(key)??Math.min(desired[index],index===0?60:index===keys.length-1?100:80));
 let remaining=Math.max(0,available-widths.reduce((a,b)=>a+b,0));
 while(remaining>0){const needing=widths.map((width,index)=>queueColumnWidths.has(keys[index])?0:Math.max(0,desired[index]-width));const total=needing.reduce((a,b)=>a+b,0);if(!total)break;const used=Math.min(remaining,total);for(let i=0;i<widths.length;i++)widths[i]+=used*needing[i]/total;remaining-=used;}
 widths[widths.length-1]+=remaining;table.style.width=Math.max(available,widths.reduce((a,b)=>a+b,0))+'px';[...table.rows[0].cells].forEach((cell,index)=>cell.style.width=widths[index]+'px');
}
function table(host,data){const isQueue=host===$('#queue');if(isQueue){renderProgress(data);data=data.map(item=>({Row:item.row,...Object.fromEntries(columns.map(column=>[column,item.input[column]])),Status:item.status}));}host.replaceChildren();if(!data.length)return;const t=document.createElement('table'),head=document.createElement('tr');if(isQueue)t.className='queue-table';for(const key of Object.keys(data[0])){const th=document.createElement('th');th.textContent=key;if(isQueue&&columns.includes(key)){th.className='queue-input-column';if(queueColumnWidths.has(key))th.style.width=queueColumnWidths.get(key)+'px';const handle=document.createElement('span');handle.className='column-resize';handle.title='Drag to resize column';handle.addEventListener('pointerdown',event=>{event.preventDefault();handle.setPointerCapture(event.pointerId);const startX=event.clientX,startWidth=th.getBoundingClientRect().width;const move=e=>{const width=Math.max(80,Math.round(startWidth+e.clientX-startX));queueColumnWidths.set(key,width);t.style.width=(t.getBoundingClientRect().width+width-th.getBoundingClientRect().width)+'px';th.style.width=width+'px';};const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);});th.append(handle);}head.append(th);}t.append(head);for(const row of data){const tr=document.createElement('tr');for(const value of Object.values(row)){const td=document.createElement('td');td.textContent=value??'';tr.append(td);}t.append(tr);}host.append(t);if(isQueue)sizeQueueColumns(t,Object.keys(data[0]),data,host);}
function renderProgress(queue){
 const host=$('#run-progress'),counts=new Map(),fragment=document.createDocumentFragment(),groups=[];
 for(const row of queue){const status=row.status||'Pending',state=status==='Running...'?'running':status==='Completed'?'completed':status==='Already completed'?'attempted':status.startsWith('Failed')?'failed':'pending';counts.set(state,(counts.get(state)||0)+1);const last=groups[groups.length-1];if(last&&last.state===state)last.count++;else groups.push({state,count:1});}
 for(const group of groups){const segment=document.createElement('span');segment.className=`run-progress-segment ${group.state}`;segment.style.flexGrow=group.count;segment.title=`${group.count} ${group.state}`;fragment.append(segment);}
 host.replaceChildren(fragment);host.setAttribute('aria-label',queue.length?`${queue.length} entries: ${[...counts].map(([state,n])=>`${n} ${state}`).join(', ')}`:'No entries loaded');
}
async function write(dir,name,data){const stream=await (await dir.getFileHandle(name,{create:true})).createWritable();try{await stream.write(data);await stream.close();}catch(e){await stream.abort();throw e;}}
async function read(dir,name){return (await dir.getFileHandle(name)).getFile();}
function compactEntry(entry){
 const {residues,atomKeys,...metadata}=entry;
 const scores=entry.scores&&Object.fromEntries(Object.entries(entry.scores).map(([name,score])=>[name,{mean:score?.mean??null}]));
 return scores?{...metadata,scores}:{...metadata};
}
async function saveManifest(){await write(folder,'batch-manifest.json',JSON.stringify({...manifest,entries:manifest.entries.map(compactEntry)},null,2));}
async function readResultEntry(entry){
 const root=await folder.getDirectoryHandle('models'),dir=await root.getDirectoryHandle(entry.id);
 const result=JSON.parse(await (await read(dir,'result.json')).text());
 if(result.id!==entry.id)throw Error(`Result ID does not match manifest for ${entry.name}.`);
 return {...entry,...result};
}
async function migrateManifest(){
 let changed=false;
 for(const entry of manifest.entries){
  if(!Object.values(entry.scores||{}).some(score=>Array.isArray(score?.values)))continue;
  const root=await folder.getDirectoryHandle('models',{create:true}),dir=await root.getDirectoryHandle(entry.id,{create:true});
  let result,missing=false;
  try{result=JSON.parse(await (await read(dir,'result.json')).text());if(result.id!==entry.id)throw Error(`Result ID does not match manifest for ${entry.name}.`);}
  catch(error){if(error.name!=='NotFoundError')throw error;result={...entry};missing=true;}
  const scores={...result.scores};let needsWrite=missing||!result.scores;
  for(const [name,score] of Object.entries(entry.scores||{}))if(Array.isArray(score?.values)&&!Array.isArray(scores[name]?.values)){scores[name]={...score,...scores[name],values:score.values};needsWrite=true;}
  if(needsWrite||!result.scores)await write(dir,'result.json',JSON.stringify({...result,scores}));
  changed=true;
 }
 if(changed){await saveManifest();manifest.entries=manifest.entries.map(compactEntry);}
}
async function key(row){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(columns.map(c=>row[c]||''))));return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');}
function updatePages(){const selected=document.querySelector('.tab.active').dataset.tab;document.querySelectorAll('.page').forEach(p=>{const keepWorkerVisible=p.id==='run'&&selected!=='run'&&running;p.hidden=p.id!==selected&&!keepWorkerVisible;p.classList.toggle('run-offscreen',keepWorkerVisible);});}
function controls(){ $('#start').disabled=running||!workerReady||!settingsReady||!speciesReady||!folder||!rows.length;$('#stop').disabled=!running;$('#pause').disabled=!running;$('#pause').textContent=pauseRequested?'Resume run':'Pause after current row';$('#csv').disabled=running;$('#folder').disabled=running;$('#ai').disabled=running||!workerReady;$('#settings').inert=running;$('#settings-frame').inert=running;$('#save-mode').disabled=running;$('#worker-details > summary').inert=running;$('#species').inert=running;updatePages(); }
for(const b of document.querySelectorAll('.tab'))b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));updatePages();if(b.dataset.tab==='results'&&folder)renderResults().catch(showError);};
$('#csv').onchange=async e=>{try{rows=parseCSV(await e.target.files[0].text());$('#csv-status').textContent=`${e.target.files[0].name} — ${rows.length} rows loaded.`;table($('#preview'),rows.slice(0,10));table($('#queue'),rows.map((row,i)=>({row:i+2,input:row,name:row[columns[0]]||row[columns[1]]||row[columns[2]]||`Row ${i+2}`,status:'Pending'})));}catch(err){rows=[];$('#csv-status').textContent=err.message;table($('#preview'),[]);table($('#queue'),[]);}controls();};
let rememberedFolder=null,folderChoiceStarted=false;
function folderStore(mode,action){return new Promise((resolve,reject)=>{const request=indexedDB.open('stringscape-batch',1);request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings',mode),store=tx.objectStore('settings');let result;try{const operation=action(store);operation.onsuccess=()=>{result=operation.result;};}catch(error){db.close();reject(error);return;}tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error('Folder storage was interrupted.'));};};});}
async function connectFolder(chosen){let data;try{data=JSON.parse(await (await read(chosen,'batch-manifest.json')).text());if(data.version!==1||!Array.isArray(data.entries))throw Error('Unsupported batch manifest.');}catch(e){if(e.name!=='NotFoundError')throw e;data={version:1,entries:[]};}folder=chosen;manifest=data;diagnosticRecords=[];try{const diagnostics=JSON.parse(await (await read(folder,'batch-diagnostics.json')).text());if(Array.isArray(diagnostics.entries))diagnosticRecords=diagnostics.entries;}catch(e){if(e.name!=='NotFoundError')throw e;}await migrateManifest();$('#folder-status').textContent=`Connected: ${folder.name}`;$('#reconnect-folder').hidden=true;await renderResults();controls();}
$('#folder').onclick=async()=>{folderChoiceStarted=true;try{const chosen=await showDirectoryPicker({mode:'readwrite'});await connectFolder(chosen);rememberedFolder=chosen;try{await folderStore('readwrite',store=>store.put(chosen,'outputFolder'));}catch(error){$('#folder-status').textContent=`Connected: ${chosen.name}. The browser could not remember this folder.`;}}catch(e){if(e.name!=='AbortError')showError(e);}};
$('#reconnect-folder').onclick=async()=>{try{if(await rememberedFolder.requestPermission({mode:'readwrite'})==='granted')await connectFolder(rememberedFolder);else $('#folder-status').textContent=`Access to ${rememberedFolder.name} was not granted. Reconnect or choose another folder.`;}catch(e){showError(e);}};
async function restoreFolder(){try{const saved=await folderStore('readonly',store=>store.get('outputFolder'));if(!saved||folderChoiceStarted)return;rememberedFolder=saved;if(await saved.queryPermission({mode:'readwrite'})==='granted'){if(!folderChoiceStarted)await connectFolder(saved);}else if(!folderChoiceStarted){$('#folder-status').textContent=`Previously connected: ${saved.name}. Reconnect to allow access.`;$('#reconnect-folder').hidden=false;}}catch(e){if(!folderChoiceStarted){$('#folder-status').textContent='Could not reconnect the remembered folder. Choose a folder to continue.';showError(e);}}}
function showError(e){$('#run-status').textContent=e.message;$('#results-status').textContent=e.message;}
async function setupFrame(frame,worker){await new Promise((resolve,reject)=>{if(frame.contentDocument?.readyState==='complete'&&frame.contentWindow.stringScapeReady)return resolve();let timeout=setTimeout(()=>reject(Error('Modeller did not become ready.')),120000);const poll=setInterval(()=>{if(frame.contentWindow?.stringScapeReady){clearTimeout(timeout);clearInterval(poll);resolve();}},200);});const doc=frame.contentDocument;await new Promise((resolve,reject)=>{let script=doc.createElement('script');script.src=new URL('bridge.js?v=20261117-protein-sources',location.href).href;script.onload=resolve;script.onerror=reject;doc.body.append(script);});frame.contentWindow.batchBridge.setTheme(document.documentElement.dataset.theme==='light');if(worker){const settings=doc.getElementById('buildSettingsBox');const host=doc.createElement('div');host.id='batch-settings-host';doc.body.append(host);host.append(settings);const style=doc.createElement('style');style.textContent='body > :not(#batch-settings-host):not(#modellerAiDialog):not(script):not(style){position:fixed!important;left:-20000px!important;top:0!important;width:1000px!important} #batch-settings-host{padding:12px} #buildSettingsToggle{display:none}';doc.head.append(style);new ResizeObserver(()=>{if($('#settings').open)frame.style.height=Math.max(100,host.scrollHeight+30)+'px';}).observe(host);}}
const worker=$('#worker'),settingsFrame=$('#settings-frame');
function syncEmbeddedThemes(){for(const frame of [worker,settingsFrame,$('#species'),$('#viewer')])frame.contentWindow?.batchBridge?.setTheme(document.documentElement.dataset.theme==='light');}
new MutationObserver(syncEmbeddedThemes).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
function showBuildSettings(){
 if(!settingsReady||!$('#settings').open)return;
 const doc=settingsFrame.contentDocument,toggle=doc.getElementById('buildSettingsToggle'),host=doc.getElementById('batch-settings-host');
 if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();
 settingsFrame.style.height=Math.max(100,host.scrollHeight+30)+'px';
 requestAnimationFrame(()=>{if(!$('#settings').open)return;doc.getElementById('buildSettingsBox').scrollIntoView({block:'start'});$('#settings').scrollIntoView({block:'start',behavior:'smooth'});});
}
if(location.protocol==='file:'){
 $('#file-protocol-notice').hidden=false;
 $('#run-status').textContent='Open this app through a local web server to use the modeller and output folders.';
 worker.removeAttribute('src');
 settingsFrame.removeAttribute('src');
 $('#species').removeAttribute('src');
 controls();
 $('#settings').inert=true;
 $('#folder').disabled=true;
}else {
 setupFrame(worker,false).then(()=>{workerReady=true;controls();}).catch(showError);
 setupFrame(settingsFrame,true).then(()=>{settingsReady=true;controls();showBuildSettings();}).catch(showError);
 const speciesFrame=$('#species');
 setupFrame(speciesFrame,false).then(()=>{
  const doc=speciesFrame.contentDocument,box=doc.getElementById('stringUploadBox'),host=doc.createElement('div');
  host.id='batch-species-host';doc.body.prepend(host);host.append(box);
  const style=doc.createElement('style');style.textContent='body > :not(#batch-species-host):not(script):not(style){position:fixed!important;left:-20000px!important;top:0!important;width:1000px!important} #batch-species-host{padding:4px} #stringUploadBox{padding:0;border:0;box-shadow:none;background:transparent} #stringFinderContent > h2{display:none} .species-menu{position:static;margin-top:.25rem}';doc.head.append(style);
  const resize=()=>{speciesFrame.style.height=Math.max(100,host.scrollHeight+12)+'px';};
  new ResizeObserver(resize).observe(host);new MutationObserver(resize).observe(host,{subtree:true,childList:true,attributes:true,characterData:true});resize();
  speciesReady=true;controls();
 }).catch(showError);
}
$('#settings').ontoggle=()=>{const open=$('#settings').open;$('#settings-note').hidden=!open;settingsFrame.classList.toggle('expanded',open);if(open)showBuildSettings();else settingsFrame.style.height='900px';};
$('#ai').onclick=()=>{worker.classList.add('ai-open');const doc=worker.contentDocument,dialog=doc.getElementById('modellerAiDialog');dialog.addEventListener('close',()=>{worker.classList.remove('ai-open');$('#ai-status').textContent=doc.getElementById('modellerAiState').textContent||'AI disconnected.';},{once:true});doc.getElementById('modellerAiOpen').click();};
function wakePause(){if(pauseWake){const wake=pauseWake;pauseWake=null;wake();}}
$('#pause').onclick=()=>{pauseRequested=!pauseRequested;controls();if(pauseRequested){$('#run-status').textContent='Pausing after the current row is saved.';$('#run-etc').textContent='ETC unavailable while paused.';}else{wakePause();$('#run-status').textContent='Resuming batch…';}};
$('#stop').onclick=()=>{stop=true;pauseRequested=false;wakePause();controls();$('#run-status').textContent='Stopping after the current row is saved.';};
function formatRemaining(ms){const minutes=Math.max(1,Math.ceil(ms/60000)),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;return [days?`${days} ${days===1?'day':'days'}`:'',hours?`${hours} ${hours===1?'hr':'hrs'}`:'',mins?`${mins} min`:''].filter(Boolean).join(' ');}
function updateEtc(queue,durations){const remaining=queue.filter(row=>row.status==='Pending').length;if(pauseRequested){$('#run-etc').textContent='ETC unavailable while paused.';return;}if(!remaining){$('#run-etc').textContent='No rows remaining.';return;}if(!durations.length){$('#run-etc').textContent='ETC available after a row finishes.';return;}const ms=durations.reduce((a,b)=>a+b,0)/durations.length*remaining;$('#run-etc').textContent=`Estimated completion: ${new Date(Date.now()+ms).toLocaleString()} (${formatRemaining(ms)} remaining; ${remaining} rows)`;}
async function waitForResume(){while(pauseRequested&&!stop){$('#run-status').textContent='Batch paused. Select Resume run to continue.';$('#stage-status').textContent='Paused between rows.';await new Promise(resolve=>{pauseWake=resolve;});}}

async function saveSession(dir,session,stage){
 const {binaryFiles,attachments,...metadata}=session,{pack,parts}=SessionPack.build(binaryFiles,false);
 if(pack){await stage('Saving session buffers',`Saving ${pack.file}`);await SessionPack.writePacked(dir,pack,parts);metadata.bufferPack=pack;}
 for(const [n,v] of Object.entries(attachments)){await stage('Saving session input attachments',`Saving ${n}`);await write(dir,n,v);}
 await stage('Saving session metadata','Saving session.json');await write(dir,'session.json',JSON.stringify(metadata));
}
async function loadSession(dir){return SessionPack.loadFolder(dir);}
function snapshotImageNames(info){
 const fractions=Array.isArray(info?.membranes)?info.membranes:[],multiple=fractions.length>1&&fractions[1]!==null&&Number.isFinite(fractions[1]);
 const positions=fractions.flatMap((fraction,index)=>Number.isFinite(fraction)?[{membrane:index+1,fraction,fullSizeY:Math.round(fraction*(Number.isFinite(info.height)&&info.height>0?info.height:900)),thumbnailY:Math.round(fraction*180)}]:[]);
 const suffix=(field)=>positions.map(position=>`-membrane${multiple?position.membrane:''}-y-${position[field]}px`).join('');
 const fullScale=info?.pixelsPerAngstrom,thumbnailScale=fullScale*180/(info?.height||900);
 const zoom=value=>Number.isFinite(value)&&value>0?`-zoom-${Number(value.toPrecision(8))}px-per-A`:'';
 return {imageFile:`image${suffix('fullSizeY')}${zoom(fullScale)}.png`,thumbnailFile:`thumbnail${suffix('thumbnailY')}${zoom(thumbnailScale)}.png`,positions,imageScale:Number.isFinite(fullScale)&&fullScale>0?{fullSizePixelsPerAngstrom:fullScale,thumbnailPixelsPerAngstrom:thumbnailScale}:null};
}
async function thumbnail(url){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=240;c.height=180;c.getContext('2d').drawImage(img,0,0,240,180);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not generate thumbnail.')),'image/png'));}
function diagnosticSummary(records,status){
 const groups=new Map(),matching=records.filter(record=>record.status===status);
 for(const record of matching)for(const [stage,ms] of Object.entries(record.stageMs||{})){if(!Number.isFinite(ms)||ms<0)continue;const group=groups.get(stage)||{total:0,count:0};group.total+=ms;group.count++;groups.set(stage,group);}
 return {count:matching.length,rows:[...groups].map(([stage,g])=>({'Step':stage,'Average time (seconds)':(g.total/g.count/1000).toFixed(2),'Rows measured':g.count}))};
}
function renderDiagnostics(){
 const host=$('#diagnostics-content');host.replaceChildren();
 for(const [status,title] of [['completed','Successful rows'],['failed','Failed rows']]){const result=diagnosticSummary(diagnosticRecords,status),h=document.createElement('h3'),p=document.createElement('p'),wrap=document.createElement('div');h.textContent=`${title} (${result.count})`;p.className='muted';p.textContent=result.rows.length?'Only rows that reached each step are included.':'No timings available yet.';wrap.className='table-wrap';table(wrap,result.rows);host.append(h,p,wrap);}
}
$('#diagnostics-open').onclick=()=>{renderDiagnostics();$('#diagnostics-dialog').showModal();};
$('#diagnostics-close').onclick=()=>$('#diagnostics-dialog').close();
function makeStageClock(name){
 let current=null,started=performance.now();const timings={};
 function change(stage,detail=stage){const now=performance.now();if(current!==stage){if(current)timings[current]=(timings[current]||0)+(now-started);current=stage;started=now;}$('#stage-status').textContent=`${name}: ${detail}…`;}
 return {change,finish(){const now=performance.now();if(current)timings[current]=(timings[current]||0)+(now-started);current=null;return timings;}};
}
async function recordDiagnostics(record){diagnosticRecords.push(record);try{await write(folder,'batch-diagnostics.json',JSON.stringify({version:1,entries:diagnosticRecords},null,2));}catch(error){$('#stage-status').textContent=`Could not save performance diagnostics: ${error.message}`;}if($('#diagnostics-dialog').open)renderDiagnostics();}
$('#start').onclick=async()=>{
 if(running)return;
 running=true;stop=false;pauseRequested=false;$('#worker-details').open=true;const durations=[];
 $('#run-etc').textContent='ETC available after a row finishes.';$('#stage-status').textContent='Preparing batch settings and species…';controls();
 try{
  const batchSettings=settingsFrame.contentWindow.batchBridge.settingsSnapshot(),saveMode=$('#save-mode').value;
  worker.contentWindow.batchBridge.applySpecies($('#species').contentWindow.batchBridge.speciesSnapshot());
  const queue=[];
  for(let i=0;i<rows.length;i++){const row=rows[i],id=await key(row),existing=manifest.entries.find(e=>e.id===id&&e.status==='completed');queue.push({row:i+2,input:row,name:row[columns[0]]||row[columns[1]]||row[columns[2]]||`Row ${i+2}`,status:existing?'Already completed':'Pending'});}
  table($('#queue'),queue);updateEtc(queue,durations);
  for(let i=0;i<rows.length&&!stop;i++){
   if(queue[i].status==='Already completed')continue;
   await waitForResume();if(stop)break;updateEtc(queue,durations);
   const row=rows[i],id=await key(row),name=queue[i].name;
   if(manifest.entries.some(e=>e.id===id&&e.status==='completed')){queue[i].status='Already completed';table($('#queue'),queue);continue;}
   queue[i].status='Running...';const rowStarted=performance.now(),startedAt=new Date().toISOString(),clock=makeStageClock(name);
   const stage=async(label,detail=label)=>{clock.change(label,detail);await new Promise(resolve=>setTimeout(resolve,0));};
   table($('#queue'),queue);$('#run-status').textContent=`Processing row ${i+2} of ${rows.length+1} (${((i+1)/rows.length*100).toFixed(2)}%): ${name}`;
   try{
    await stage('Applying build settings');
    if(!columns.some(c=>row[c]?.trim()))throw Error('All three input columns are empty.');
    worker.contentWindow.batchBridge.applySettings(batchSettings);
    const result=await worker.contentWindow.batchBridge.run(row,label=>clock.change(label),{saveMode});
    await stage('Preparing output folder');const root=await folder.getDirectoryHandle('models',{create:true}),dir=await root.getDirectoryHandle(id,{create:true});
    if(result.session)await saveSession(dir,result.session,stage);
    await stage('Saving model structure','Saving model.cif');await write(dir,'model.cif',result.model);
    if(result.bonds){await stage('Saving bond topology','Saving bonds.bin');await write(dir,'bonds.bin',result.bonds);}
    const imageNames=snapshotImageNames(result.imageInfo);
    if(result.image){if(saveMode!=='minimal'){await stage('Saving model image',`Saving ${imageNames.imageFile}`);const blob=await (await fetch(result.image)).blob();await write(dir,imageNames.imageFile,blob);}await stage('Generating thumbnail',`Generating ${imageNames.thumbnailFile}`);const small=await thumbnail(result.image);await stage('Saving thumbnail',`Saving ${imageNames.thumbnailFile}`);await write(dir,imageNames.thumbnailFile,small);}
    const entry={id,name,row:saveMode==='minimal'?Object.fromEntries(columns.map(c=>[c,row[c]||''])):row,status:'completed',completedAt:new Date().toISOString(),scores:result.scores,proteinSources:result.proteinSources,residues:result.residues,...(saveMode==='minimal'?{membrane:result.membrane,atomKeys:result.atomKeys}:{settings:result.settings}),saveMode,hasImage:!!result.image,hasFullImage:!!result.image&&saveMode!=='minimal',...(result.image?{imageFile:saveMode==='minimal'?null:imageNames.imageFile,thumbnailFile:imageNames.thumbnailFile,membraneImagePositions:imageNames.positions,imageScale:imageNames.imageScale,transparentImage:result.imageInfo?.transparentBackground===true}: {})};
    await stage('Saving result data','Saving result.json');await write(dir,'result.json',JSON.stringify(entry));
    manifest.entries=manifest.entries.filter(e=>e.id!==id);manifest.entries.push(compactEntry(entry));
    await stage('Saving batch manifest','Saving batch-manifest.json');await saveManifest();queue[i].status='Completed';
   }catch(e){
    queue[i].status='Failed: '+e.message;manifest.entries=manifest.entries.filter(x=>x.id!==id);manifest.entries.push({id,name,row,status:'failed',error:e.message,finishedAt:new Date().toISOString()});
    try{await stage('Saving failure details','Saving batch-manifest.json');await saveManifest();}catch(saveError){queue[i].status+=' (could not save failure: '+saveError.message+')';}
   }
   const record={id,name,row:i+2,startedAt,status:queue[i].status==='Completed'?'completed':'failed',elapsedMs:performance.now()-rowStarted,stageMs:clock.finish()};
   $('#stage-status').textContent=`${name}: Saving batch-diagnostics.json…`;await recordDiagnostics(record);
   durations.push(performance.now()-rowStarted);table($('#queue'),queue);updateEtc(queue,durations);
  }
  if(stop)$('#run-etc').textContent='ETC unavailable: batch stopped.';
  $('#run-status').textContent=(stop?'Stopped after current row.':'Batch finished.')+` ${queue.filter(x=>x.status.startsWith('Failed')).length} failed.`;
  $('#stage-status').textContent='Loading batch results…';await renderResults();$('#stage-status').textContent=stop?'Batch stopped.':'Batch complete.';
 }catch(e){showError(e);$('#stage-status').textContent=`Batch could not continue: ${e.message}`;}
 finally{running=false;pauseRequested=false;wakePause();controls();}
};
const labels={constraint:'Constraint confidence',model:'Model confidence',local:'Local structure confidence',placement2:'Placement confidence (2 Å)',placement5:'Placement confidence (5 Å)'};
function summary(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return {count:a.length,mean:a.length?a.reduce((x,y)=>x+y,0)/a.length:null,median:a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null};}
function card(host,label,value){const div=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');div.className='stat';small.textContent=label;strong.textContent=value;div.append(small,strong);host.append(div);}
function histogram(canvas,values){const ctx=canvas.getContext('2d'),bins=Array(10).fill(0);for(const x of values)if(Number.isFinite(x)&&x>=0&&x<=1)bins[Math.min(9,Math.floor(x*10))]++;const max=Math.max(1,...bins),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#54d5c8';bins.forEach((n,i)=>{const bar=(h-35)*n/max;ctx.fillRect(38+i*(w-50)/10,h-24-bar,(w-50)/10-4,bar);});ctx.fillStyle='#dbe8f7';ctx.font='14px sans-serif';ctx.fillText('0',38,h-5);ctx.fillText('1',w-20,h-5);ctx.fillText(String(max),2,18);}
function processingTimes(records){
 return records.flatMap(record=>{
  if(record.status!=='completed'&&record.status!=='failed')return [];
  if(Number.isFinite(record.elapsedMs)&&record.elapsedMs>=0)return [record.elapsedMs/1000];
  const stages=Object.values(record.stageMs||{});if(!stages.length||stages.some(ms=>!Number.isFinite(ms)||ms<0))return [];
  return [stages.reduce((sum,ms)=>sum+ms,0)/1000];
 });
}
function renderProcessingTimes(records){
 const values=processingTimes(records),stats=summary(values),host=$('#processing-time-stats'),canvas=$('#processing-time-histogram'),ctx=canvas.getContext('2d');
 host.replaceChildren();card(host,'Mean processing time',stats.mean===null?'Unavailable':`${stats.mean.toFixed(1)} s`);card(host,'Median processing time',stats.median===null?'Unavailable':`${stats.median.toFixed(1)} s`);
 $('#processing-time-note').textContent=values.length?`${values.length} recorded row attempt${values.length===1?'':'s'}, including failed attempts. Skipped rows are excluded. Older timings are estimated from recorded steps.`:'No processing times recorded in this folder.';
 const w=canvas.width,h=canvas.height,left=52,right=20,top=18,bottom=45,bins=Array(40).fill(0),maxTime=values.reduce((max,value)=>Math.max(max,value),1);
 for(const value of values)bins[Math.min(bins.length-1,Math.floor(value/maxTime*bins.length))]++;
 const maxCount=Math.max(1,...bins),barWidth=(w-left-right)/bins.length;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#54d5c8';bins.forEach((count,index)=>{const height=(h-top-bottom)*count/maxCount;ctx.fillRect(left+index*barWidth,h-bottom-height,Math.max(1,barWidth-2),height);});
 ctx.fillStyle='#dbe8f7';ctx.font='16px sans-serif';ctx.textAlign='left';ctx.fillText(String(maxCount),4,top+12);ctx.fillText('0',left,h-bottom+20);ctx.textAlign='right';ctx.fillText(maxTime.toFixed(1),w-right,h-bottom+20);ctx.textAlign='center';ctx.fillText('Processing time (seconds)',(left+w-right)/2,h-5);
 canvas.setAttribute('aria-label',`Histogram of processing time in seconds for ${values.length} recorded row attempts`);
}
async function renderResults(){if(!folder)return;const entries=[];for(const entry of manifest.entries.filter(e=>e.status==='completed'))entries.push(await readResultEntry(entry));$('#results-status').textContent=`${entries.length} completed model${entries.length===1?'':'s'} in ${folder.name}.`;$('#stats').replaceChildren();card($('#stats'),'Completed models',String(entries.length));card($('#stats'),'Residue confidence values',String(entries.reduce((n,e)=>n+(e.scores?.model?.values?.length||0),0)));const sourceKnown=entries.filter(e=>e.proteinSources);card($('#stats'),'Builds with a chain without AlphaFold',sourceKnown.length?String(sourceKnown.filter(e=>e.proteinSources.hasChainWithoutAlphaFold).length):'Unavailable');$('#protein-source-note').textContent=sourceKnown.length<entries.length||sourceKnown.some(e=>e.proteinSources.hasUnknownSource)?'Some builds have missing or incomplete chain source information and may not be counted.':'';renderProcessingTimes(diagnosticRecords);const charts=$('#charts');charts.replaceChildren();for(const [key,label] of Object.entries(labels)){const section=document.createElement('div');section.className='card chart-card';const h=document.createElement('h2');h.textContent=label;section.append(h);const grid=document.createElement('div');grid.className='chart-grid';for(const [mode,title] of [['model','Per model'],['residue','Per residue']]){const vals=mode==='model'?entries.map(e=>e.scores?.[key]?.mean).filter(Number.isFinite):entries.flatMap(e=>e.scores?.[key]?.values||[]).filter(Number.isFinite);const s=summary(vals),box=document.createElement('div'),heading=document.createElement('h3'),canvas=document.createElement('canvas'),stats=document.createElement('div');heading.textContent=`${title} (n=${s.count})`;canvas.width=550;canvas.height=200;canvas.className='hist';canvas.setAttribute('aria-label',`${label}, ${title} histogram`);box.append(heading,canvas,stats);stats.className='stats';card(stats,'Mean',s.mean===null?'Unavailable':s.mean.toFixed(3));card(stats,'Median',s.median===null?'Unavailable':s.median.toFixed(3));grid.append(box);histogram(canvas,vals);}section.append(grid);charts.append(section);}
 const select=$('#model-select'),previous=select.value;select.replaceChildren(new Option('Select a model',''));for(const entry of entries)select.add(new Option(entry.name,entry.id));if(entries.some(entry=>entry.id===previous))select.value=previous;
 galleryEntries=entries;$('#landscape-download').disabled=!entries.some(entry=>entry.hasImage);await renderModelGallery();}
let galleryMode='gallery',galleryEntries=[],galleryGeneration=0,landscapeBoxes=[];
function membraneThumbnailY(entry){
 const positions=entry.membraneImagePositions;
 if(Array.isArray(positions)){const primary=positions.find(position=>position?.membrane===1&&(Number.isFinite(position.fraction)||Number.isFinite(position.thumbnailY)))||positions.find(position=>Number.isFinite(position?.fraction)||Number.isFinite(position?.thumbnailY));if(primary)return Number.isFinite(primary.fraction)?primary.fraction*180:primary.thumbnailY;}
 const name=entry.thumbnailFile||'',match=name.match(/(?:^|-)membrane(?:1|2)?-y-(-?\d+)px(?:-|\.)/i);
 return match?Number(match[1]):null;
}
function thumbnailScale(entry){
 const saved=entry.imageScale?.thumbnailPixelsPerAngstrom;if(Number.isFinite(saved)&&saved>0)return saved;
 const match=(entry.thumbnailFile||'').match(/(?:^|-)zoom-([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)px-per-A(?:-|\.)/i),value=match?Number(match[1]):null;
 return Number.isFinite(value)&&value>0?value:null;
}
function planLandscape(entries,viewportWidth){
 const items=[];let unknownCount=0;
 for(const entry of entries){if(!entry.hasImage)continue;const y=membraneThumbnailY(entry);if(!Number.isFinite(y)&&!Array.isArray(entry.membraneImagePositions))unknownCount++;items.push({entry,membraneY:y,scale:thumbnailScale(entry)});}
 const known=items.filter(item=>item.scale!==null),unknown=items.filter(item=>item.scale===null),common=known.reduce((min,item)=>Math.min(min,item.scale),Infinity);
 // Older snapshots have no physical scale. Keep them together after scaled images.
 const primary=known.length?known:unknown,remaining=known.length?unknown:[],membrane=[],other=[];
 for(const item of primary){const factor=known.length?common/item.scale:1;item.width=240*factor;item.height=180*factor;item.scaledY=item.membraneY*factor;(Number.isFinite(item.membraneY)?membrane:other).push(item);}
 const anchor=membrane.reduce((max,item)=>Math.max(max,item.scaledY),0),boxes=[];let x=0,top=0,maxWidth=0;
 for(const item of membrane){const y=anchor-item.scaledY;boxes.push({...item,x,y});x+=item.width;top=Math.max(top,y+item.height);}
 maxWidth=x;
 const limit=Math.max(240,viewportWidth||0);
 function addRows(group){let rowX=0,rowHeight=0;for(const item of group){if(rowX>0&&rowX+item.width>limit){top+=rowHeight;rowX=0;rowHeight=0;}boxes.push({...item,x:rowX,y:top});rowX+=item.width;rowHeight=Math.max(rowHeight,item.height);maxWidth=Math.max(maxWidth,rowX);}top+=rowHeight;}
 addRows(other);for(const item of remaining){item.width=240;item.height=180;}addRows(remaining);
 return {boxes,width:Math.max(1,maxWidth),height:Math.max(1,top),membraneCount:membrane.length,unknownCount,unscaledCount:unknown.length};
}
async function openGalleryImage(entry,dir){
 try{if(imageUrl)URL.revokeObjectURL(imageUrl);const name=entry.hasFullImage===false?(entry.thumbnailFile||'thumbnail.jpg'):(entry.imageFile||'image.png');const file=await read(dir,name),display=await transparentGalleryBlob(file,entry.transparentImage===true);imageUrl=URL.createObjectURL(display);$('#full-image').src=imageUrl;$('#image-name').textContent=entry.name;$('#image-quality').hidden=entry.hasFullImage!==false;$('#image-quality').textContent=entry.hasFullImage===false?'Thumbnail only; a full-size image was not saved.':'';$('#image-dialog').showModal();}catch(error){showError(error);}
}
async function renderModelGallery(){
 const generation=++galleryGeneration,landscape=galleryMode==='landscape',gallery=$('#gallery'),scroller=$('#landscape-scroller'),status=$('#landscape-status');
 thumbUrls.forEach(URL.revokeObjectURL);thumbUrls=[];gallery.replaceChildren();$('#landscape-tooltip').hidden=true;gallery.hidden=landscape;scroller.hidden=!landscape;status.hidden=!landscape;landscapeBoxes=[];
 if(!folder){status.textContent='Connect a results folder.';return;}
 let root;try{root=await folder.getDirectoryHandle('models');}catch(error){if(error.name==='NotFoundError'&&!galleryEntries.some(entry=>entry.hasImage)){status.textContent='No model images available.';return;}throw error;}
 if(generation!==galleryGeneration)return;
 if(!landscape){
  for(const entry of galleryEntries){if(!entry.hasImage)continue;try{const dir=await root.getDirectoryHandle(entry.id),file=await read(dir,entry.thumbnailFile||'thumbnail.jpg'),display=await transparentGalleryBlob(file,entry.transparentImage===true),url=URL.createObjectURL(display);if(generation!==galleryGeneration){URL.revokeObjectURL(url);return;}thumbUrls.push(url);const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');img.src=url;img.loading='lazy';img.alt=`Model ${entry.name}`;name.textContent=entry.name;button.append(img,name);button.onclick=()=>void openGalleryImage(entry,dir);gallery.append(button);}catch(error){console.warn('Thumbnail unavailable',error);}}
  return;
 }
 const canvas=$('#landscape'),plan=planLandscape(galleryEntries,scroller.clientWidth||$('#gallery-card').clientWidth||960);
 landscapeBoxes=plan.boxes;const maxSide=16384,maxPixels=16000000,scale=Math.min(1,maxSide/plan.width,maxSide/plan.height,Math.sqrt(maxPixels/(plan.width*plan.height)));
 canvas.width=Math.max(1,Math.floor(plan.width*scale));canvas.height=Math.max(1,Math.floor(plan.height*scale));canvas.style.width=plan.width+'px';canvas.style.height=plan.height+'px';
 const context=canvas.getContext('2d');context.setTransform(canvas.width/plan.width,0,0,canvas.height/plan.height,0,0);context.clearRect(0,0,plan.width,plan.height);
 canvas.setAttribute('aria-label',`Cell landscape: ${plan.membraneCount} membrane models and ${plan.boxes.length-plan.membraneCount} other models`);
 status.textContent=plan.boxes.length?'Loading model thumbnails…':'No model images available.';
 let cursor=0,failed=0;
 async function drawNext(){while(generation===galleryGeneration){const index=cursor++;if(index>=plan.boxes.length)return;const box=plan.boxes[index];let prepared;try{const dir=await root.getDirectoryHandle(box.entry.id),file=await read(dir,box.entry.thumbnailFile||'thumbnail.jpg');if(generation!==galleryGeneration)return;prepared=await transparentGallerySource(file,box.entry.transparentImage===true);if(generation!==galleryGeneration)return;context.drawImage(prepared.source,box.x,box.y,box.width,box.height);box.dir=dir;}catch(error){failed++;console.warn('Thumbnail unavailable',error);}finally{prepared?.dispose();}}}
 await Promise.all(Array.from({length:Math.min(4,plan.boxes.length)},()=>drawNext()));
 if(generation===galleryGeneration){const notes=[];if(failed)notes.push(`${failed} thumbnail${failed===1?'':'s'} could not be loaded.`);if(plan.unknownCount)notes.push(`${plan.unknownCount} older image${plan.unknownCount===1?' lacks':'s lack'} a recorded membrane position and ${plan.unknownCount===1?'appears':'appear'} below.`);if(plan.unscaledCount)notes.push(`${plan.unscaledCount} older image${plan.unscaledCount===1?' has':'s have'} no recorded zoom and ${plan.unscaledCount===1?'is':'are'} displayed without a known scale${plan.unscaledCount<plan.boxes.length?', below the scaled images':''}.`);if(!plan.boxes.length)notes.push('No model images available.');status.hidden=!notes.length;status.textContent=notes.join(' ');}
}
function landscapeAt(event){const canvas=$('#landscape'),rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*(parseFloat(canvas.style.width)/rect.width),y=(event.clientY-rect.top)*(parseFloat(canvas.style.height)/rect.height);return landscapeBoxes.find(box=>box.dir&&x>=box.x&&x<box.x+box.width&&y>=box.y&&y<box.y+box.height);}
$('#landscape').addEventListener('pointermove',event=>{const tip=$('#landscape-tooltip'),box=landscapeAt(event);if(!box){tip.hidden=true;return;}tip.textContent=box.entry.name;tip.hidden=false;tip.style.left=Math.max(4,Math.min(event.clientX+14,window.innerWidth-tip.offsetWidth-4))+'px';tip.style.top=Math.max(4,Math.min(event.clientY+14,window.innerHeight-tip.offsetHeight-4))+'px';});
$('#landscape').addEventListener('pointerleave',()=>{$('#landscape-tooltip').hidden=true;});
$('#landscape-scroller').addEventListener('scroll',()=>{$('#landscape-tooltip').hidden=true;});
$('#landscape').addEventListener('click',event=>{const box=landscapeAt(event);if(box)void openGalleryImage(box.entry,box.dir);});
async function downloadLandscape(){
 const button=$('#landscape-download');button.disabled=true;
 try{
  const plan=planLandscape(galleryEntries,$('#landscape-scroller').clientWidth||$('#gallery').clientWidth||$('#gallery-card').clientWidth||960);
  if(!plan.boxes.length)throw Error('No model images are available to download.');
  const root=await folder.getDirectoryHandle('models'),canvas=document.createElement('canvas'),maxSide=16384,maxPixels=16000000,scale=Math.min(1,maxSide/plan.width,maxSide/plan.height,Math.sqrt(maxPixels/(plan.width*plan.height)));
  canvas.width=Math.max(1,Math.floor(plan.width*scale));canvas.height=Math.max(1,Math.floor(plan.height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Could not create the landscape image.');context.setTransform(canvas.width/plan.width,0,0,canvas.height/plan.height,0,0);
  for(const box of plan.boxes){let prepared;try{const dir=await root.getDirectoryHandle(box.entry.id),file=await read(dir,box.entry.thumbnailFile||'thumbnail.jpg');prepared=await transparentGallerySource(file,box.entry.transparentImage===true);context.drawImage(prepared.source,box.x,box.y,box.width,box.height);}finally{prepared?.dispose();}}
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('Could not create the landscape PNG.')),'image/png'));
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cell-landscape.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){showError(error);}
 finally{button.disabled=!folder||!galleryEntries.some(entry=>entry.hasImage);}
}
$('#landscape-download').onclick=()=>void downloadLandscape();
function setGalleryMode(mode){galleryMode=mode;$('#gallery-mode-grid').setAttribute('aria-pressed',String(mode==='gallery'));$('#gallery-mode-landscape').setAttribute('aria-pressed',String(mode==='landscape'));void renderModelGallery().catch(showError);}
$('#gallery-mode-grid').onclick=()=>setGalleryMode('gallery');$('#gallery-mode-landscape').onclick=()=>setGalleryMode('landscape');
let landscapeResizeTimer;window.addEventListener('resize',()=>{if(galleryMode==='landscape'&&!$('#results').hidden){clearTimeout(landscapeResizeTimer);landscapeResizeTimer=setTimeout(()=>void renderModelGallery().catch(showError),150);}});
$('#close-image').onclick=()=>$('#image-dialog').close();$('#image-dialog').addEventListener('close',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;$('#full-image').removeAttribute('src');});
$('#model-select').onchange=async e=>{const entry=manifest.entries.find(x=>x.id===e.target.value);$('#viewer').hidden=!entry;$('#model-details').textContent='';if(!entry)return;try{$('#model-details').textContent=`Loading ${entry.name}…`;const root=await folder.getDirectoryHandle('models'),dir=await root.getDirectoryHandle(entry.id);if(!viewerReady){const frame=$('#viewer');frame.src='../index.html?batchViewer=1';viewerReady=new Promise((resolve,reject)=>{frame.onload=()=>setupFrame(frame,false).then(resolve,reject);frame.onerror=reject;});}await viewerReady;let session=null;if(entry.saveMode==='minimal'){const full=await readResultEntry(entry),model=await (await read(dir,'model.cif')).text(),bonds=await (await read(dir,'bonds.bin')).arrayBuffer();await $('#viewer').contentWindow.batchBridge.restoreMinimal(model,full,bonds);}else{session=await loadSession(dir);await $('#viewer').contentWindow.batchBridge.restore(session);}syncEmbeddedThemes();$('#model-details').textContent=[`Model: ${entry.name}`,`Completed: ${entry.completedAt}`,`Saved data: ${entry.saveMode==='minimal'?'Minimal':session.viewOnly?'3D viewer snapshot':'Full session'}`,...columns.map(c=>`${c}: ${entry.row[c]||'Not provided'}`),...Object.entries(labels).map(([k,label])=>`${label}: ${Number.isFinite(entry.scores?.[k]?.mean)?entry.scores[k].mean.toFixed(3):'Unavailable'}`)].join('\n');}catch(err){$('#model-details').textContent='Could not open model: '+err.message;}};

if(location.protocol!=='file:')void restoreFolder();
