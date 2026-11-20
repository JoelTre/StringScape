import { connectRoom } from '../shared/remote.js';
const $ = id => document.getElementById(id), modal = $('connect-modal'), status = $('status'), storageKey = 'stringscape_remote_credentials_v1';
let connection, generation = 0, connected = false, screenShareAvailable = false, timeout, imageData = '', currentMessages = [], bubbles = new Map();
function sendScreenVisibility() { if (connected) connection?.sendScreen({type:'state', sliders:{}, screenVisible:!$('screen').hidden && document.visibilityState === 'visible'}); }
document.addEventListener('visibilitychange', sendScreenVisibility);
function setConnecting(active) { const button = $('connect-submit'); button.disabled = active; button.classList.toggle('connecting', active); button.querySelector('.connect-button-text').textContent = active ? 'Connecting...' : 'Connect'; }
function connectFeedback(message = '') { const feedback = $('connect-feedback'); feedback.textContent = message; feedback.hidden = !message; }
function showModal() { if (!modal.open) modal.showModal(); }
$('menu-button').onclick = showModal;
$('close-modal').onclick = () => modal.close();
for (const name of ['screen','chat']) $(name+'-tab').onclick = () => { for (const n of ['screen','chat']) { $(n).hidden = n !== name; $(n+'-tab').classList.toggle('active', n === name); $(n+'-tab').setAttribute('aria-pressed', String(n === name)); } document.querySelector('.primary-segments').classList.toggle('second-active', name === 'chat'); $('header-title').hidden = name === 'chat'; $('header-chat-actions').hidden = name !== 'chat'; sendScreenVisibility(); };
function addBubble(role, content, id) { const node = document.createElement('div'); node.className = `bubble ${role}`; node.textContent = content; $('chat-items').append(node); if (id) bubbles.set(id,node); $('messages').scrollTop = $('messages').scrollHeight; return node; }
function renderHistory(messages) { currentMessages = messages; bubbles = new Map(); $('chat-items').replaceChildren(); for (const msg of messages) if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') addBubble(msg.role,msg.content); }
function renderFormattedText(container, html, fallback) {
  if (typeof html !== 'string') { container.textContent = fallback; return; }
  if (container.dataset.renderedHtml === html) return;
  const allowed = new Set(['P','BR','STRONG','B','EM','I','UL','OL','LI','PRE','CODE','BLOCKQUOTE','A','H1','H2','H3','H4','TABLE','THEAD','TBODY','TR','TH','TD','HR']);
  const source = new DOMParser().parseFromString(html, 'text/html');
  function copy(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (!allowed.has(node.tagName)) { for (const child of node.childNodes) copy(child,parent); return; }
    const el = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'A') { try { const url = new URL(node.getAttribute('href')); if (url.protocol === 'https:' || url.protocol === 'http:') { el.href = url.href; el.target = '_blank'; el.rel = 'noopener noreferrer'; } } catch {} }
    for (const child of node.childNodes) copy(child,el);
    parent.append(el);
  }
  const fragment = document.createDocumentFragment(); for (const child of source.body.childNodes) copy(child,fragment);
  container.replaceChildren(fragment); container.dataset.renderedHtml = html;
}
function renderChatView(items) {
  const list = $('chat-items'), scroll = $('messages');
  const follow = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 60;
  const existing = new Map([...list.children].filter(node => node.dataset.id).map(node => [node.dataset.id,node]));
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !['user','assistant','activity'].includes(item.kind) || typeof item.text !== 'string') continue;
    let node = existing.get(item.id);
    if (!node || node.dataset.kind !== item.kind) { node?.remove(); node = document.createElement('div'); node.dataset.id = item.id; node.dataset.kind = item.kind; node.className = item.kind === 'activity' ? 'chat-activity' : `bubble ${item.kind}`; if (item.kind !== 'activity') { const media = document.createElement('div'); media.className = 'chat-media'; const text = document.createElement('div'); text.className = 'chat-text'; node.append(media,text); } }
    existing.delete(item.id);
    if (item.kind === 'activity') { node.textContent = item.text; node.classList.toggle('active', !!item.active); }
    else {
      renderFormattedText(node.querySelector('.chat-text'), item.html, item.text);
      if (Array.isArray(item.images)) { const media = node.querySelector('.chat-media'); media.replaceChildren(); for (const src of item.images) if (typeof src === 'string' && src.startsWith('data:image/')) { const img = document.createElement('img'); img.src = src; img.alt = 'Chat attachment'; media.append(img); } }
      if (Array.isArray(item.attachments)) { node.querySelectorAll('.chat-file').forEach(tag => tag.remove()); for (const name of item.attachments) { const tag = document.createElement('span'); tag.className = 'chat-file'; tag.textContent = name; node.querySelector('.chat-media').append(tag); } }
    }
    list.append(node);
  }
  for (const node of existing.values()) node.remove();
  for (const node of [...list.children]) if (!node.dataset.id) node.remove();
  if (follow) scroll.scrollTop = scroll.scrollHeight;
}
let chatView = 'chat', mediaSource = 'ai', libraryRefreshTimer;
function requestLibrary() {
  if (!connected) { $('library-status').textContent = 'Connect to a desktop tab to view this content.'; return; }
  if (chatView === 'history') connection.sendChat({type:'get-saved-chats'});
  if (chatView === 'media') connection.sendChat({type:'get-media', source:mediaSource});
}
function showChatView(view) {
  chatView = view;
  $('messages').hidden = view !== 'chat'; $('composer').hidden = view !== 'chat'; $('chat-library').hidden = view === 'chat';
  $('chat-history-button').setAttribute('aria-pressed', String(view === 'history'));
  $('chat-media-button').setAttribute('aria-pressed', String(view === 'media'));
  if (view !== 'chat') { $('library-title').textContent = view === 'history' ? 'Chat history' : 'Media'; $('library-filters').hidden = view !== 'media'; $('library-items').replaceChildren(); $('library-status').textContent = 'Loading...'; requestLibrary(); }
}
$('chat-history-button').onclick = () => showChatView(chatView === 'history' ? 'chat' : 'history');
$('chat-media-button').onclick = () => showChatView(chatView === 'media' ? 'chat' : 'media');
$('library-close').onclick = () => showChatView('chat');
$('chat-new-button').onclick = () => { if (!connected) { showModal(); return; } connection.sendChat({type:'new-chat'}); };
for (const button of document.querySelectorAll('[data-media-source]')) button.onclick = () => { mediaSource = button.dataset.mediaSource; updateMediaButtons(); $('library-items').replaceChildren(); $('library-status').textContent = 'Loading...'; requestLibrary(); };
function updateMediaButtons() { for (const button of document.querySelectorAll('[data-media-source]')) button.setAttribute('aria-pressed', String(button.dataset.mediaSource === mediaSource)); }
updateMediaButtons();
function renderSavedChats(chats) {
  if (chatView !== 'history') return;
  const list = $('library-items'); list.replaceChildren(); $('library-status').textContent = chats.length ? '' : 'No previous chats yet.';
  for (const chat of chats) { if (typeof chat.id !== 'string') continue; const button = document.createElement('button'); button.type = 'button'; button.className = 'library-chat'; const title = document.createElement('strong'); title.textContent = chat.title || 'Untitled Chat'; button.append(title); if (chat.active) { const badge = document.createElement('span'); badge.className = 'library-badge'; badge.textContent = 'Current'; button.append(badge); } else if (chat.updatedAt) { const date = document.createElement('span'); date.textContent = new Date(chat.updatedAt).toLocaleDateString(); button.append(date); } button.onclick = () => { if (connected) { $('library-status').textContent = 'Opening chat...'; connection.sendChat({type:'load-chat', id:chat.id}); } }; list.append(button); }
}
function renderMedia(source, items) {
  if (chatView !== 'media' || source !== mediaSource) return;
  const list = $('library-items'); list.replaceChildren(); $('library-status').textContent = items.length ? '' : (source === 'ai' ? 'No AI-created files or screenshots yet.' : 'No user-uploaded files yet.');
  for (const item of items) { if (!item || typeof item.data !== 'string') continue; const card = document.createElement('details'); card.className = 'library-media'; const summary = document.createElement('summary'); summary.textContent = item.name || 'Untitled file'; card.append(summary); if (item.type === 'image' && item.data.startsWith('data:image/')) { const image = document.createElement('img'); image.src = item.data; image.alt = item.name || 'Image'; card.append(image); } else { const text = document.createElement('pre'); text.textContent = item.data; card.append(text); } list.append(card); }
}
$('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !event.repeat) { event.preventDefault(); $('composer').requestSubmit(); } });
async function connect(code, passcode, auto = false) {
  const token = ++generation; clearTimeout(timeout); const previous = connection; connection = null; connected = false; status.dataset.connected = 'false'; status.textContent = 'Connecting...'; connectFeedback(); setConnecting(true);
  try { if (previous) await previous.room.leave(); if (token !== generation) return; const c = await connectRoom(code,passcode); if (token !== generation) { await c.room.leave(); return; } connection = c;
    c.room.onPeerJoin(() => { if (token !== generation) return; connected = true; clearTimeout(timeout); setConnecting(false); connectFeedback(); status.textContent = 'Desktop connected'; status.dataset.connected = 'true'; updateWorkspaceButtons(); try { localStorage.setItem(storageKey,JSON.stringify({code,passcode})); } catch {} if (modal.open) modal.close(); sendScreenVisibility(); if (chatView !== 'chat') requestLibrary(); });
    c.room.onPeerLeave(() => { screenShareAvailable = false; viewport.classList.remove('awaiting-update'); preview.style.display = 'none'; preview.removeAttribute('src'); $('preview-placeholder').hidden = false; $('preview-placeholder').textContent = 'Connect to a desktop tab to see its workspace.'; actionVersion = 0; invalidateCrop(); desktopWidth = desktopHeight = 0; connected = false; physicsRunning = null; updateWorkspaceButtons(); status.textContent = 'Desktop disconnected'; status.dataset.connected = 'false'; });
    c.onChat(message => { if (message?.type === 'theme' && (message.mode === 'light' || message.mode === 'dark')) { document.documentElement.dataset.theme = message.mode; document.querySelector('meta[name="theme-color"]').content = message.mode === 'light' ? '#f5f8fc' : '#171c24'; } else if (message?.type === 'chat-view' && Array.isArray(message.items)) { renderChatView(message.items); if (chatView !== 'chat') { clearTimeout(libraryRefreshTimer); libraryRefreshTimer = setTimeout(requestLibrary, 1500); } } else if (message?.type === 'library-changed' && chatView !== 'chat') { clearTimeout(libraryRefreshTimer); libraryRefreshTimer = setTimeout(requestLibrary, 500); } else if (message?.type === 'saved-chats' && Array.isArray(message.chats)) renderSavedChats(message.chats); else if (message?.type === 'media' && Array.isArray(message.items)) renderMedia(message.source, message.items); else if (message?.type === 'chat-opened') showChatView('chat'); else if (message?.type === 'chat-action-error') { if (chatView === 'chat') { showChatView('history'); } $('library-status').textContent = message.text; } else if (message?.type === 'history' && Array.isArray(message.messages)) renderHistory(message.messages); else if (message?.type === 'chunk' && typeof message.delta === 'string') { let bubble = bubbles.get(message.id); if (!bubble) bubble = addBubble('assistant','',message.id); bubble.textContent += message.delta; $('messages').scrollTop = $('messages').scrollHeight; } });
    c.onScreen(message => {
      if (message?.type === 'workspace-controls') { setPhysicsState(message.physicsRunning); return; }
      if (message?.type === 'workspace-feedback') { document.querySelector('.screen-help').textContent = message.text || ''; return; }
      if (message?.type === 'capture-status') {
        screenShareAvailable = message.available === true;
        if (!screenShareAvailable) { viewport.classList.remove('awaiting-update'); invalidateCrop(); preview.style.display = 'none'; preview.removeAttribute('src'); $('preview-placeholder').hidden = false; $('preview-placeholder').textContent = typeof message.text === 'string' && message.text ? message.text : 'Ask the desktop user to share the StringScape tab.'; }
        else { $('preview-placeholder').hidden = false; $('preview-placeholder').textContent = 'Waiting for the desktop screen...'; }
        return;
      }
      if (message?.type !== 'state' || !screenShareAvailable) return;
      if (typeof message.canvasDataUrl === 'string' && message.canvasDataUrl.startsWith('data:image/')) {
        const changed = desktopWidth !== message.viewportWidth || desktopHeight !== message.viewportHeight;
        desktopWidth = message.viewportWidth || 0; desktopHeight = message.viewportHeight || 0;
        if (changed) invalidateCrop();
        restoreOnScreenshotLoad($('canvas-preview'), message.actionVersion);
        $('canvas-preview').src = message.canvasDataUrl; $('canvas-preview').style.display = 'block'; $('preview-placeholder').hidden = true;
        if (changed && zoom > 1) $('canvas-preview').addEventListener('load', scheduleSharp, {once:true});
      }
      if (typeof message.cropDataUrl === 'string' && message.cropDataUrl.startsWith('data:image/') && message.crop?.id === cropId && message.viewportWidth === desktopWidth && message.viewportHeight === desktopHeight && zoom > 1) {
        const nextCrop = new Image();
        nextCrop.onload = () => {
          if (message.crop.id !== cropId || message.viewportWidth !== desktopWidth || message.viewportHeight !== desktopHeight || zoom <= 1) return;
          cropBounds = message.crop; restoreOnScreenshotLoad(cropPreview, message.actionVersion); cropPreview.src = message.cropDataUrl; cropPreview.style.display = 'block'; positionCrop();
        };
        nextCrop.src = message.cropDataUrl;
      }
    });
    timeout = setTimeout(() => { if (!connected && token === generation) { status.textContent = 'Desktop tab offline — enter a new code'; setConnecting(false); connectFeedback('Desktop tab offline — enter a new code.'); showModal(); } }, 6000);
  } catch (error) { if (token !== generation) return; setConnecting(false); status.textContent = `Connection failed: ${error.message}`; connectFeedback('Could not connect. Please try again.'); showModal(); }
}
$('connect-form').onsubmit = e => { e.preventDefault(); const code = $('code').value.trim().toLowerCase(), passcode = $('passcode').value.trim(); if (!/^[a-z]+(?:-[a-z]+){3}$/.test(code) || !/^\d{6}$/.test(passcode)) { status.textContent = 'Enter a four-word code and six-digit passcode.'; connectFeedback('Enter a four-word code and six-digit passcode.'); return; } connect(code,passcode); };
$('image').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { const bitmap = await createImageBitmap(file); const scale = Math.min(1,1024/Math.max(bitmap.width,bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale)); canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close(); imageData = canvas.toDataURL('image/jpeg',.82); const img = document.createElement('img'); img.src = imageData; img.alt = 'Attached image'; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove image'; remove.onclick = () => { imageData = ''; $('image').value = ''; $('image-preview').replaceChildren(); }; $('image-preview').replaceChildren(img,remove); } catch { status.textContent = 'Could not open image.'; } };
$('composer').onsubmit = e => { e.preventDefault(); const text = $('prompt').value.trim(); if (!connected) { status.textContent = 'Connect to a desktop tab first.'; return; } if (!text && !imageData) return; connection.sendChat({type:'prompt',text,imageBase64:imageData || undefined}); $('prompt').value = ''; imageData = ''; $('image').value = ''; $('image-preview').replaceChildren(); };
const hash = decodeURIComponent(location.hash.slice(1)).split(':'); let saved; try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {} const creds = hash.length === 2 ? {code:hash[0],passcode:hash[1]} : saved; if (creds && /^[a-z]+(?:-[a-z]+){3}$/.test(creds.code) && /^\d{6}$/.test(creds.passcode)) { $('code').value = creds.code; $('passcode').value = creds.passcode; if (hash.length === 2) showModal(); $('connect-form').requestSubmit(); }

const preview = $('canvas-preview'), viewport = document.querySelector('.preview'), cropPreview = $('crop-preview');
let desktopWidth = 0, desktopHeight = 0, cropId = 0, cropBounds = null, actionVersion = 0;
let screenMode = 'zoom', zoom = 1, panX = 0, panY = 0, lastPointerMove = 0, remotePointer = null;
const pointers = new Map();
let gesture = null;
function applyTransform() {
  const width = viewport.clientWidth * zoom, height = preview.offsetHeight * zoom;
  const marginX = Math.min(64, viewport.clientWidth * .15);
  const marginY = Math.min(64, viewport.clientHeight * .15);
  panX = Math.min(marginX, Math.max(Math.min(0, viewport.clientWidth - width) - marginX, panX));
  panY = Math.min(marginY, Math.max(Math.min(0, viewport.clientHeight - height) - marginY, panY));
  preview.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  positionCrop();
}
function zoomAt(next, x, y) {
  const newZoom = Math.max(1, Math.min(6, next)), ratio = newZoom / zoom;
  panX = x - (x - panX) * ratio; panY = y - (y - panY) * ratio; zoom = newZoom; applyTransform();
}
function invalidateCrop(clear = true) { cropId++; if (clear) { cropBounds = null; cropPreview.style.display = 'none'; } }
function positionCrop() {
  if (!cropBounds) return;
  const width = preview.offsetWidth * zoom, height = preview.offsetHeight * zoom;
  cropPreview.style.left = `${panX + cropBounds.x * width}px`;
  cropPreview.style.top = `${panY + cropBounds.y * height}px`;
  cropPreview.style.width = `${cropBounds.width * width}px`;
  cropPreview.style.height = `${cropBounds.height * height}px`;
}
function requestSharp() {
  if (!connected) return;
  if (zoom <= 1 || !desktopWidth || !desktopHeight || !preview.offsetWidth || !preview.offsetHeight) {
    connection.sendScreen({type:'state', sliders:{}, crop:null, requestSharp:true}); return;
  }
  const image = preview.getBoundingClientRect(), view = viewport.getBoundingClientRect();
  const x = Math.max(0, (view.left-image.left)/image.width), y = Math.max(0, (view.top-image.top)/image.height);
  const right = Math.min(1, (view.right-image.left)/image.width), bottom = Math.min(1, (view.bottom-image.top)/image.height);
  if (right <= x || bottom <= y) return;
  connection.sendScreen({type:'state', sliders:{}, crop:{id:cropId, x, y, width:right-x, height:bottom-y, viewportWidth:desktopWidth, viewportHeight:desktopHeight}});
}
let sharpTimer;
function scheduleSharp() { clearTimeout(sharpTimer); sharpTimer = setTimeout(requestSharp, 100); }
function setMode(mode) {
  if (remotePointer !== null) { const point = pointers.get(remotePointer); if (point) sendPointer(point, 'up'); remotePointer = null; }
  pointers.clear(); gesture = null; screenMode = mode;
  for (const name of ['zoom','control']) { $(name+'-mode').classList.toggle('active', mode === name); $(name+'-mode').setAttribute('aria-pressed', String(mode === name)); }
  document.querySelector('.screen-mode').classList.toggle('second-active', mode === 'control');
  viewport.classList.toggle('zoom-mode', mode === 'zoom'); viewport.classList.toggle('control-mode', mode === 'control');
  document.querySelector('.screen-help').textContent = mode === 'zoom' ? 'Pinch or scroll to zoom; drag to pan.' : 'Tap and drag to control the desktop.';
}
$('zoom-mode').onclick = () => setMode('zoom'); $('control-mode').onclick = () => setMode('control');
$('reset-zoom').onclick = () => { invalidateCrop(); zoom = 1; panX = panY = 0; applyTransform(); scheduleSharp(); };
setMode('zoom');
window.addEventListener('resize', () => { invalidateCrop(false); applyTransform(); scheduleSharp(); });
let physicsRunning = null;
function updateWorkspaceButtons() {
  $('physics-control').disabled = !connected || physicsRunning === null;
  $('zoom-selection').disabled = !connected;
}
function setPhysicsState(running) {
  if (typeof running !== 'boolean') return;
  physicsRunning = running;
  const label = running ? 'Pause physics' : 'Play physics';
  $('physics-icon').classList.toggle('fa-pause', running); $('physics-icon').classList.toggle('fa-play', !running);
  $('physics-label').textContent = 'Physics'; $('physics-control').setAttribute('aria-label', label); $('physics-control').title = label;
  updateWorkspaceButtons();
}
function workspaceCommand(command) {
  if (!connected) return;
  connection.sendScreen({type:'state', sliders:{}, command, actionVersion:screenShareAvailable ? markControlAction() : ++actionVersion});
}
$('physics-control').onclick = () => workspaceCommand('toggle-physics');
$('zoom-selection').onclick = () => workspaceCommand('zoom-selection');
function restoreOnScreenshotLoad(image, version) {
  const expectedVersion = Number.isSafeInteger(version) ? version : 0;
  image.onload = () => { if (expectedVersion >= actionVersion) viewport.classList.remove('awaiting-update'); };
}
function markControlAction() { viewport.classList.add('awaiting-update'); return ++actionVersion; }
function sendPointer(point, kind) {
  if (!connected || !screenShareAvailable) return; const rect = preview.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  connection.sendScreen({type:'state', sliders:{}, actionVersion:markControlAction(), pointer:{kind, x:(point.clientX-rect.left)/rect.width, y:(point.clientY-rect.top)/rect.height}});
}
function beginGesture() {
  const points = [...pointers.values()];
  if (points.length === 1) gesture = {kind:'pan', x:points[0].clientX, y:points[0].clientY, panX, panY};
  else if (points.length >= 2) { const [a,b] = points; const rect = viewport.getBoundingClientRect(); gesture = {kind:'pinch', distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY) || 1, zoom, panX, panY, x:(a.clientX+b.clientX)/2-rect.left, y:(a.clientY+b.clientY)/2-rect.top}; }
  else gesture = null;
}
document.querySelector('.screen-actions').addEventListener('pointerdown', event => event.stopPropagation());
viewport.addEventListener('pointerdown', event => {
  if (preview.style.display === 'none' || !preview.getAttribute('src')) return;
  const imageRect = preview.getBoundingClientRect();
  if (screenMode === 'control' && (event.clientX < imageRect.left || event.clientX > imageRect.right || event.clientY < imageRect.top || event.clientY > imageRect.bottom)) return;
  event.preventDefault(); viewport.setPointerCapture(event.pointerId); pointers.set(event.pointerId, {clientX:event.clientX, clientY:event.clientY});
  if (screenMode === 'control') { if (remotePointer === null) { remotePointer = event.pointerId; sendPointer(event, 'down'); } }
  else { invalidateCrop(false); beginGesture(); }
});
viewport.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return; event.preventDefault(); pointers.set(event.pointerId, {clientX:event.clientX, clientY:event.clientY});
  if (screenMode === 'control') { const now = performance.now(); if (remotePointer === event.pointerId && now-lastPointerMove >= 50) { lastPointerMove = now; sendPointer(event,'move'); } return; }
  const points = [...pointers.values()]; if (!gesture) return;
  if (gesture.kind === 'pan' && points.length === 1) { panX = gesture.panX + points[0].clientX-gesture.x; panY = gesture.panY + points[0].clientY-gesture.y; applyTransform(); }
  else if (gesture.kind === 'pinch' && points.length >= 2) { const [a,b] = points, rect = viewport.getBoundingClientRect(); const centerX = (a.clientX+b.clientX)/2-rect.left, centerY = (a.clientY+b.clientY)/2-rect.top; zoom = gesture.zoom; panX = gesture.panX; panY = gesture.panY; zoomAt(gesture.zoom * Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/gesture.distance, gesture.x, gesture.y); panX += centerX-gesture.x; panY += centerY-gesture.y; applyTransform(); }
});
function endPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  if (screenMode === 'control' && remotePointer === event.pointerId) { sendPointer(event,'up'); remotePointer = null; }
  pointers.delete(event.pointerId); if (screenMode === 'zoom') { beginGesture(); scheduleSharp(); }
}
viewport.addEventListener('pointerup', endPointer); viewport.addEventListener('pointercancel', endPointer); viewport.addEventListener('lostpointercapture', endPointer);
viewport.addEventListener('wheel', event => {
  if (!preview.getAttribute('src')) return; event.preventDefault();
  if (screenMode === 'zoom') { invalidateCrop(false); const rect = viewport.getBoundingClientRect(); zoomAt(zoom * Math.exp(-event.deltaY * .002), event.clientX-rect.left, event.clientY-rect.top); scheduleSharp(); }
  else if (connected && screenShareAvailable) { const rect = preview.getBoundingClientRect(); connection.sendScreen({type:'state', sliders:{}, actionVersion:markControlAction(), wheel:{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height,deltaX:event.deltaX,deltaY:event.deltaY}}); }
}, {passive:false});
