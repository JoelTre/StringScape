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
 const {residues,...metadata}=entry;
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
function controls(){ $('#start').disabled=running||!workerReady||!settingsReady||!speciesReady||!folder||!rows.length;$('#stop').disabled=!running;$('#pause').disabled=!running;$('#pause').textContent=pauseRequested?'Resume run':'Pause after current row';$('#csv').disabled=running;$('#folder').disabled=running;$('#ai').disabled=running||!workerReady;$('#settings').inert=running;$('#settings-frame').inert=running;$('#save-full-session').disabled=running;$('#worker-details > summary').inert=running;$('#species').inert=running;document.querySelectorAll('.tab').forEach(b=>b.disabled=running); }
for(const b of document.querySelectorAll('.tab'))b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==b.dataset.tab);if(b.dataset.tab==='results'&&folder)renderResults().catch(showError);};
$('#csv').onchange=async e=>{try{rows=parseCSV(await e.target.files[0].text());$('#csv-status').textContent=`${e.target.files[0].name} — ${rows.length} rows loaded.`;table($('#preview'),rows.slice(0,10));table($('#queue'),rows.map((row,i)=>({row:i+2,input:row,name:row[columns[0]]||row[columns[1]]||row[columns[2]]||`Row ${i+2}`,status:'Pending'})));}catch(err){rows=[];$('#csv-status').textContent=err.message;table($('#preview'),[]);table($('#queue'),[]);}controls();};
$('#folder').onclick=async()=>{try{const chosen=await showDirectoryPicker({mode:'readwrite'});let data;try{data=JSON.parse(await (await read(chosen,'batch-manifest.json')).text());if(data.version!==1||!Array.isArray(data.entries))throw Error('Unsupported batch manifest.');}catch(e){if(e.name!=='NotFoundError')throw e;data={version:1,entries:[]};}folder=chosen;manifest=data;diagnosticRecords=[];try{const diagnostics=JSON.parse(await (await read(folder,'batch-diagnostics.json')).text());if(Array.isArray(diagnostics.entries))diagnosticRecords=diagnostics.entries;}catch(e){if(e.name!=='NotFoundError')throw e;}await migrateManifest();$('#folder-status').textContent=`Connected: ${folder.name}`;await renderResults();controls();}catch(e){if(e.name!=='AbortError')showError(e);}};
function showError(e){$('#run-status').textContent=e.message;$('#results-status').textContent=e.message;}
async function setupFrame(frame,worker){await new Promise((resolve,reject)=>{if(frame.contentDocument?.readyState==='complete'&&frame.contentWindow.stringScapeReady)return resolve();let timeout=setTimeout(()=>reject(Error('Modeller did not become ready.')),120000);const poll=setInterval(()=>{if(frame.contentWindow?.stringScapeReady){clearTimeout(timeout);clearInterval(poll);resolve();}},200);});const doc=frame.contentDocument;await new Promise((resolve,reject)=>{let script=doc.createElement('script');script.src=new URL('bridge.js?v=20261116-view-snapshot',location.href).href;script.onload=resolve;script.onerror=reject;doc.body.append(script);});frame.contentWindow.batchBridge.setTheme(document.documentElement.dataset.theme==='light');if(worker){const settings=doc.getElementById('buildSettingsBox');const host=doc.createElement('div');host.id='batch-settings-host';doc.body.append(host);host.append(settings);const style=doc.createElement('style');style.textContent='body > :not(#batch-settings-host):not(#modellerAiDialog):not(script):not(style){position:fixed!important;left:-20000px!important;top:0!important;width:1000px!important} #batch-settings-host{padding:12px} #buildSettingsToggle{display:none}';doc.head.append(style);new ResizeObserver(()=>{if($('#settings').open)frame.style.height=Math.max(100,host.scrollHeight+30)+'px';}).observe(host);}}
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
async function thumbnail(url){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=240;c.height=180;c.getContext('2d').drawImage(img,0,0,240,180);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not generate thumbnail.')),'image/jpeg',.75));}
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
  const batchSettings=settingsFrame.contentWindow.batchBridge.settingsSnapshot(),saveFullSession=$('#save-full-session').checked;
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
    const result=await worker.contentWindow.batchBridge.run(row,label=>clock.change(label),{saveFullSession});
    await stage('Preparing output folder');const root=await folder.getDirectoryHandle('models',{create:true}),dir=await root.getDirectoryHandle(id,{create:true});
    await saveSession(dir,result.session,stage);
    await stage('Saving model structure','Saving model.cif');await write(dir,'model.cif',result.model);
    if(result.image){await stage('Saving model image','Saving image.png');const blob=await (await fetch(result.image)).blob();await write(dir,'image.png',blob);await stage('Generating thumbnail','Generating thumbnail.jpg');const small=await thumbnail(result.image);await stage('Saving thumbnail','Saving thumbnail.jpg');await write(dir,'thumbnail.jpg',small);}
    const entry={id,name,row,status:'completed',completedAt:new Date().toISOString(),scores:result.scores,residues:result.residues,settings:result.settings,saveFullSession,hasImage:!!result.image};
    await stage('Saving result data','Saving result.json');await write(dir,'result.json',JSON.stringify(entry));
    manifest.entries=manifest.entries.filter(e=>e.id!==id);manifest.entries.push(compactEntry(entry));
    await stage('Saving batch manifest','Saving batch-manifest.json');await saveManifest();queue[i].status='Completed';
   }catch(e){
    queue[i].status='Failed: '+e.message;manifest.entries=manifest.entries.filter(x=>x.id!==id);manifest.entries.push({id,name,row,status:'failed',error:e.message,finishedAt:new Date().toISOString()});
    try{await stage('Saving failure details','Saving batch-manifest.json');await saveManifest();}catch(saveError){queue[i].status+=' (could not save failure: '+saveError.message+')';}
   }
   const record={id,name,row:i+2,startedAt,status:queue[i].status==='Completed'?'completed':'failed',stageMs:clock.finish()};
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
async function renderResults(){if(!folder)return;const entries=[];for(const entry of manifest.entries.filter(e=>e.status==='completed'))entries.push(await readResultEntry(entry));$('#results-status').textContent=`${entries.length} completed model${entries.length===1?'':'s'} in ${folder.name}.`;$('#stats').replaceChildren();card($('#stats'),'Completed models',String(entries.length));card($('#stats'),'Residue confidence values',String(entries.reduce((n,e)=>n+(e.scores?.model?.values?.length||0),0)));const charts=$('#charts');charts.replaceChildren();for(const [key,label] of Object.entries(labels)){const section=document.createElement('div');section.className='card chart-card';const h=document.createElement('h2');h.textContent=label;section.append(h);const grid=document.createElement('div');grid.className='chart-grid';for(const [mode,title] of [['model','Per model'],['residue','Per residue']]){const vals=mode==='model'?entries.map(e=>e.scores?.[key]?.mean).filter(Number.isFinite):entries.flatMap(e=>e.scores?.[key]?.values||[]).filter(Number.isFinite);const s=summary(vals),box=document.createElement('div'),heading=document.createElement('h3'),canvas=document.createElement('canvas'),stats=document.createElement('div');heading.textContent=`${title} (n=${s.count})`;canvas.width=550;canvas.height=200;canvas.className='hist';canvas.setAttribute('aria-label',`${label}, ${title} histogram`);box.append(heading,canvas,stats);stats.className='stats';card(stats,'Mean',s.mean===null?'Unavailable':s.mean.toFixed(3));card(stats,'Median',s.median===null?'Unavailable':s.median.toFixed(3));grid.append(box);histogram(canvas,vals);}section.append(grid);charts.append(section);}
 thumbUrls.forEach(URL.revokeObjectURL);thumbUrls=[];$('#gallery').replaceChildren();const select=$('#model-select'),previous=select.value;select.replaceChildren(new Option('Select a model',''));for(const e of entries){select.add(new Option(e.name,e.id));if(!e.hasImage)continue;try{const root=await folder.getDirectoryHandle('models'),dir=await root.getDirectoryHandle(e.id),url=URL.createObjectURL(await read(dir,'thumbnail.jpg'));thumbUrls.push(url);const b=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');img.src=url;img.loading='lazy';img.alt=`Model ${e.name}`;name.textContent=e.name;b.append(img,name);b.onclick=async()=>{try{if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(await read(dir,'image.png'));$('#full-image').src=imageUrl;$('#image-name').textContent=e.name;$('#image-dialog').showModal();}catch(err){showError(err);}};$('#gallery').append(b);}catch(err){console.warn('Thumbnail unavailable',err);}}if(entries.some(e=>e.id===previous))select.value=previous;}
$('#close-image').onclick=()=>$('#image-dialog').close();$('#image-dialog').addEventListener('close',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;$('#full-image').removeAttribute('src');});
$('#model-select').onchange=async e=>{const entry=manifest.entries.find(x=>x.id===e.target.value);$('#viewer').hidden=!entry;$('#model-details').textContent='';if(!entry)return;try{$('#model-details').textContent=`Loading ${entry.name}…`;const root=await folder.getDirectoryHandle('models'),dir=await root.getDirectoryHandle(entry.id);if(!viewerReady){const frame=$('#viewer');frame.src='../index.html?batchViewer=1';viewerReady=new Promise((resolve,reject)=>{frame.onload=()=>setupFrame(frame,false).then(resolve,reject);frame.onerror=reject;});}await viewerReady;const session=await loadSession(dir);await $('#viewer').contentWindow.batchBridge.restore(session);syncEmbeddedThemes();$('#model-details').textContent=[`Model: ${entry.name}`,`Completed: ${entry.completedAt}`,`Saved data: ${session.viewOnly?'3D viewer snapshot':'Full session'}`,...columns.map(c=>`${c}: ${entry.row[c]||'Not provided'}`),...Object.entries(labels).map(([k,label])=>`${label}: ${Number.isFinite(entry.scores?.[k]?.mean)?entry.scores[k].mean.toFixed(3):'Unavailable'}`)].join('\n');}catch(err){$('#model-details').textContent='Could not open model: '+err.message;}};
