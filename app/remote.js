import { connectRoom } from '../shared/remote.js';
const words = 'amber apple beach birch blue breeze brook cedar cloud coral dawn delta dune eagle earth fern field flame forest frost garden golden harbor hazel hill island ivy jade lake leaf lemon light maple meadow mist moon mountain ocean olive orange orchid pine plum river rose silver sky snow solar star stone sun tiger valley violet willow wind winter'.split(' ');
const random = max => { const limit = Math.floor(4294967296 / max) * max; let n; do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= limit); return n % max; };
let connection, generation = 0, interval, observer, peer = false, closeModalTimer;
let screenVisible = false, screenDirty = true, interactionActive = false, lastCapture = 0, canvasFingerprint = null, screenObserver, sharpRequested = false;
const CAPTURE_INTERVAL = 1000;
let cropRequest = null, cropVersion = 0, remoteActionVersion = 0;
let captureStream = null, captureVideo = null, captureSession = 0;
const modal = document.createElement('dialog');
modal.className = 'remote-connect-dialog';
modal.setAttribute('aria-labelledby', 'remote-title');
modal.setAttribute('aria-describedby', 'remote-description');
modal.innerHTML = `<form method="dialog" class="remote-connect-content">
  <button class="remote-close" type="submit" aria-label="Close remote connection dialog">&times;</button>
  <div class="remote-heading-icon" aria-hidden="true"><i class="fa-solid fa-mobile-screen-button"></i></div>
  <h2 id="remote-title">Remote connect</h2>
  <p id="remote-description">You can connect your mobile device to this StringScape tab to control it remotely.</p>
  <div class="remote-qr-card"><div id="remote-qr"></div><span>Scan with your mobile device's camera</span></div>
  <div class="remote-credentials"><div><span>Room code</span><strong id="remote-code"></strong></div><div><span>Passcode</span><strong id="remote-pass"></strong></div></div>
  <p class="remote-status"><span class="remote-status-dot" aria-hidden="true"></span><span id="remote-status" role="status" aria-live="polite">Waiting for mobile...</span></p>
  <p class="remote-share-description">To show the screen on your mobile device, share this browser tab. Chat works without screen sharing.</p>
  <button type="button" id="remote-share">Share this tab</button>
  <p class="remote-share-status" id="remote-share-status" role="status"></p>
  <button type="button" id="remote-stop">Stop Remote Session</button>
</form>`;
document.body.append(modal);
modal.addEventListener('click', event => {
  if (event.target !== modal) return;
  const rect = modal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
});
const status = modal.querySelector('#remote-status');
function stop() { stopCapture(); generation++; peer = false; window.StringScapeRemoteChat?.setMobileConnected(false); clearTimeout(closeModalTimer); modal.classList.remove('is-connected'); clearInterval(interval); observer?.disconnect(); screenObserver?.disconnect(); screenVisible = false; interactionActive = false; cropRequest = null; cropVersion++; connection?.room.leave(); connection = null; status.textContent = 'Remote session stopped'; }
modal.querySelector('#remote-stop').onclick = () => { stop(); modal.close(); };
let captureInProgress = false, pointerTarget = null;
const shareButton = modal.querySelector('#remote-share');
shareButton.disabled = true;
const shareStatus = modal.querySelector('#remote-share-status');
function sendCaptureStatus(available, text) {
  if (peer && connection) connection.sendScreen({type:'capture-status', available, text});
}
function stopCapture() {
  captureSession++;
  const old = captureStream; captureStream = null;
  if (captureVideo) { captureVideo.pause(); captureVideo.srcObject = null; captureVideo = null; }
  if (old) old.getTracks().forEach(track => track.stop());
  shareButton.textContent = 'Share this tab';
  shareButton.disabled = false;
  shareStatus.textContent = '';
  sendCaptureStatus(false, 'On the desktop, open Remote connect and click Share this tab.');
}
shareButton.addEventListener('click', async () => {
  if (captureStream) { stopCapture(); return; }
  if (!navigator.mediaDevices?.getDisplayMedia) { shareStatus.textContent = 'Screen sharing is unavailable in this browser.'; sendCaptureStatus(false, shareStatus.textContent); return; }
  const session = ++captureSession;
  shareButton.disabled = true;
  shareStatus.textContent = 'Choose the StringScape browser tab in the sharing prompt.';
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser', frameRate:{ideal:5, max:10}}, audio:false, preferCurrentTab:true, selfBrowserSurface:'include'});
    if (session !== captureSession || !connection) { stream.getTracks().forEach(track => track.stop()); return; }
    const track = stream.getVideoTracks()[0];
    if (!track || (track.getSettings().displaySurface && track.getSettings().displaySurface !== 'browser')) {
      stream.getTracks().forEach(item => item.stop());
      throw new Error('Please choose the StringScape browser tab, not a window or screen.');
    }
    captureStream = stream;
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream; captureVideo = video;
    track.addEventListener('ended', () => { if (captureStream === stream) { stopCapture(); shareStatus.textContent = 'Screen sharing stopped. You can share this tab again.'; } }, {once:true});
    await video.play();
    if (session !== captureSession || captureStream !== stream) return;
    shareButton.textContent = 'Stop sharing screen'; shareStatus.textContent = 'Screen sharing is active.';
    sendCaptureStatus(true, ''); screenDirty = true; lastCapture = 0; refreshScreen();
    if (peer && modal.open) { clearTimeout(closeModalTimer); closeModalTimer = setTimeout(() => { if (captureStream === stream && modal.open) modal.close(); }, 1000); }
  } catch (error) {
    if (session !== captureSession) return;
    stopCapture();
    shareStatus.textContent = error?.name === 'NotAllowedError' ? 'Screen sharing was cancelled. You can try again.' : (error?.message || 'Could not start screen sharing.');
    sendCaptureStatus(false, 'On the desktop, open Remote connect and click Share this tab.');
  } finally { if (session === captureSession) shareButton.disabled = false; }
});
async function sendSnapshot(c, sharp = false) {
  if (!peer || !screenVisible || interactionActive || captureInProgress || !captureStream || !captureVideo || captureVideo.readyState < 2) return;
  captureInProgress = true;
  screenDirty = false;
  lastCapture = Date.now();
  try {
    const width = window.innerWidth, height = window.innerHeight;
    const crop = cropRequest && cropRequest.viewportWidth === width && cropRequest.viewportHeight === height ? {...cropRequest} : null;
    const version = cropVersion, capturedActionVersion = remoteActionVersion, stream = captureStream;
    const videoWidth = captureVideo.videoWidth, videoHeight = captureVideo.videoHeight;
    if (!videoWidth || !videoHeight) { screenDirty = true; return; }
    const area = crop || {x:0, y:0, width:1, height:1};
    const sourceWidth = area.width * videoWidth, sourceHeight = area.height * videoHeight;
    const limit = crop || sharp ? 1200 : 800;
    const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale)); canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    canvas.getContext('2d').drawImage(captureVideo, area.x * videoWidth, area.y * videoHeight, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    if (peer && screenVisible && connection === c && stream === captureStream && version === cropVersion) await c.sendScreen(crop ? {type:'state', sliders:{}, cropDataUrl:canvas.toDataURL('image/jpeg', .8), crop, viewportWidth:width, viewportHeight:height, actionVersion:capturedActionVersion} : {type:'state', sliders:{}, canvasDataUrl:canvas.toDataURL('image/jpeg', sharp ? .8 : .65), viewportWidth:width, viewportHeight:height, actionVersion:capturedActionVersion});
    if (cropRequest && !crop) { cropRequest = null; cropVersion++; screenDirty = true; }
  } catch (error) { screenDirty = true; console.warn('Remote screen capture failed:', error); }
  finally { captureInProgress = false; }
}
// Canvas drawing does not produce DOM mutations. Sample it cheaply so physics and
// other animated views are refreshed without repeatedly rendering the whole page.
const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = sampleCanvas.height = 32;
const sampleContext = sampleCanvas.getContext('2d', {willReadFrequently:true});
function canvasChanged() {
  try {
    const source = captureVideo;
    if (!source || source.readyState < 2 || !source.videoWidth || !source.videoHeight) return false;
    sampleContext.clearRect(0,0,32,32);
    sampleContext.drawImage(source,0,0,32,32);
    const pixels = sampleContext.getImageData(0,0,32,32).data;
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i++) hash = Math.imul(hash ^ pixels[i],16777619);
    const changed = hash !== canvasFingerprint;
    canvasFingerprint = hash;
    return changed;
  } catch { return true; }
}
function refreshScreen() {
  if (!peer || !screenVisible || interactionActive || captureInProgress || !connection || !captureStream) return;
  if (Date.now() - lastCapture < CAPTURE_INTERVAL) return;
  if (canvasChanged() || screenDirty || sharpRequested) { const sharp = sharpRequested; sharpRequested = false; void sendSnapshot(connection, sharp); }
}
function watchScreen() {
  screenObserver?.disconnect();
  screenObserver = new MutationObserver(records => {
    if (records.some(record => !modal.contains(record.target) && !record.target.closest?.('.html2canvas-container') && ![...record.addedNodes, ...record.removedNodes].some(node => node.classList?.contains('html2canvas-container')))) screenDirty = true;
  });
  screenObserver.observe(document.body, {subtree:true, childList:true, attributes:true, characterData:true});
}
for (const type of ['input', 'change', 'click', 'scroll']) document.addEventListener(type, event => { if (!modal.contains(event.target)) screenDirty = true; }, true);
document.addEventListener('pointerdown', event => { if (!modal.contains(event.target)) interactionActive = true; }, true);
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => { if (interactionActive) { interactionActive = false; screenDirty = true; sharpRequested = true; refreshScreen(); } }, true);
function handlePointer(p) {
  if (!p || !['down','move','up'].includes(p.kind) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  const x = Math.max(0, Math.min(1, p.x)) * window.innerWidth, y = Math.max(0, Math.min(1, p.y)) * window.innerHeight;
  const target = p.kind === 'down' ? document.elementFromPoint(x,y) : pointerTarget;
  if (!target || modal.contains(target)) return;
  if (p.kind === 'down') { pointerTarget = target; interactionActive = true; }
  if (target instanceof HTMLInputElement && target.type === 'range') {
    const rect = target.getBoundingClientRect(), min = Number(target.min || 0), max = Number(target.max || 100), step = Number(target.step) || 1;
    target.value = String(Math.max(min, Math.min(max, min + Math.round(((x-rect.left)/rect.width * (max-min))/step)*step)));
    target.dispatchEvent(new Event('input', {bubbles:true}));
    if (p.kind === 'up') target.dispatchEvent(new Event('change', {bubbles:true}));
  } else {
    const destination = p.kind === 'down' ? target : window;
    destination.dispatchEvent(new MouseEvent({down:'mousedown',move:'mousemove',up:'mouseup'}[p.kind], {bubbles:true, cancelable:true, view:window, clientX:x, clientY:y, buttons:p.kind === 'up' ? 0 : 1, button:0}));
    if (p.kind === 'up' && document.elementFromPoint(x,y) === target) {
      if (target instanceof HTMLCanvasElement) {
        target.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window, clientX:x, clientY:y, button:0, detail:1}));
      } else target.click();
    }
  }
  if (p.kind === 'up') { pointerTarget = null; interactionActive = false; screenDirty = true; sharpRequested = true; refreshScreen(); }
}
function handleWheel(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.deltaY)) return;
  const x = Math.max(0, Math.min(1,p.x))*window.innerWidth, y = Math.max(0, Math.min(1,p.y))*window.innerHeight;
  let target = document.elementFromPoint(x,y);
  if (!target || modal.contains(target)) return;
  const event = new WheelEvent('wheel', {bubbles:true, cancelable:true, view:window, clientX:x, clientY:y, deltaX:p.deltaX || 0, deltaY:p.deltaY});
  if (target.dispatchEvent(event)) {
    while (target && target !== document.body) { const style = getComputedStyle(target); if (/(auto|scroll)/.test(style.overflowY) && target.scrollHeight > target.clientHeight) { target.scrollTop += p.deltaY; break; } target = target.parentElement; }
  }
}
let lastPhysicsState;
function syncPhysicsState(force = false) {
  if (!peer || !connection || !window.StringScapeRemoteWorkspace) return;
  const playing = window.StringScapeRemoteWorkspace.physicsRunning();
  if (force || playing !== lastPhysicsState) { lastPhysicsState = playing; connection.sendScreen({type:'workspace-controls', physicsRunning:playing}); }
}
function syncMobileTheme() {
  if (peer && connection) connection.sendChat({type:'theme', mode:document.body.dataset.appMode === 'light' ? 'light' : 'dark'});
}
new MutationObserver(syncMobileTheme).observe(document.body, {attributes:true, attributeFilter:['data-app-mode']});
window.addEventListener('stringscape-remote-library-change', () => { if (peer && connection) connection.sendChat({type:'library-changed'}); });
function watchChat() {
  const chatbox = document.querySelector('#ai-chatbox');
  const ids = new WeakMap(), sentImages = new Set();
  let scheduled = null, sending = false, pending = false, stopped = false;
  const idFor = element => { if (!ids.has(element)) ids.set(element, crypto.randomUUID()); return ids.get(element); };
  function items() {
    const result = [];
    for (const child of chatbox.children) {
      if (child.classList.contains('ai-bubble')) {
        const text = child.querySelector('.ai-bubble-text');
        result.push({id:idFor(child), kind:child.classList.contains('ai-user-bubble') ? 'user' : 'assistant', text:text?.innerText || '', html:text?.innerHTML || '', attachments:[...child.querySelectorAll('.ai-file-attachment-tag')].map(tag => tag.textContent), images:[...child.querySelectorAll('img')].map(image => image.src).filter(src => src.startsWith('data:image/'))});
      } else {
        const log = child.matches('.log-item') ? child : child.querySelector('.log-item');
        if (log) result.push({id:idFor(log), kind:'activity', text:log.innerText.trim(), active:log.classList.contains('animate-pulse')});
      }
    }
    return result;
  }
  async function send() {
    scheduled = null;
    if (stopped || !peer || !connection) return;
    if (sending) { pending = true; return; }
    sending = true;
    try { const view = items(); for (const item of view) if (sentImages.has(item.id)) delete item.images; await connection.sendChat({type:'chat-view', items:view}); for (const item of view) if (item.images?.length) sentImages.add(item.id); }
    catch (error) { console.warn('Remote chat sync failed:', error); }
    finally { sending = false; if (pending && !stopped) { pending = false; schedule(); } }
  }
  function schedule() { if (!scheduled && !stopped) scheduled = setTimeout(send, 100); }
  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(chatbox, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class']});
  observer = {disconnect() { stopped = true; clearTimeout(scheduled); mutationObserver.disconnect(); }};
  schedule();
}
document.querySelector('#ai-remote-connect-btn').onclick = async () => {
  document.querySelector('#ai-menu-dropdown').classList.remove('open');
  if (connection) { modal.showModal(); return; }
  shareButton.disabled = true; shareStatus.textContent = '';
  const token = ++generation, code = Array.from({length:4}, () => words[random(words.length)]).join('-'), passcode = String(random(1000000)).padStart(6, '0');
  modal.querySelector('#remote-code').textContent = code; modal.querySelector('#remote-pass').textContent = passcode; status.textContent = 'Starting remote session...';
  const qr = modal.querySelector('#remote-qr'); qr.textContent = ''; modal.showModal();
  const url = new URL('https://stringscape.net/remote_connect/'); url.hash = `${code}:${passcode}`;
  try { const { default: QRCode } = await import('https://esm.run/qrcode'); qr.append(Object.assign(document.createElement('img'), {src:await QRCode.toDataURL(url.href, { width:220, margin:2 }), alt:'Scan to connect'})); } catch { const link = document.createElement('a'); link.href = url.href; link.textContent = 'Open connection link'; qr.append(link); }
  try {
    const c = await connectRoom(code, passcode); if (token !== generation) { c.room.leave(); return; } connection = c; shareButton.disabled = false; status.textContent = 'Waiting for mobile...';
    c.room.onPeerJoin(() => {
      peer = true; window.StringScapeRemoteChat.setMobileConnected(true); syncMobileTheme();
      modal.classList.add('is-connected'); status.textContent = 'Mobile connected'; clearTimeout(closeModalTimer);
      if (captureStream) {
        closeModalTimer = setTimeout(() => { if (peer && connection === c && modal.open) modal.close(); }, 1000);
      } else {
        shareStatus.textContent = 'Mobile connected. Click Share this tab to enable the screen view.';
        if (!modal.open) modal.showModal();
        shareButton.focus();
      }
      c.sendChat({type:'history', messages:window.StringScapeRemoteChat.history()});
      screenVisible = false; screenDirty = true; canvasFingerprint = null; cropRequest = null; cropVersion++; remoteActionVersion = 0;
      sendCaptureStatus(!!captureStream, captureStream ? '' : 'On the desktop, click Share this tab in the Remote connect dialog.'); syncPhysicsState(true);
      watchScreen(); watchChat();
    });
    c.room.onPeerLeave(() => { peer = false; window.StringScapeRemoteChat.setMobileConnected(false); clearTimeout(closeModalTimer); modal.classList.remove('is-connected'); status.textContent = 'Waiting for mobile...'; observer?.disconnect(); screenObserver?.disconnect(); screenVisible = false; interactionActive = false; cropRequest = null; cropVersion++; });
    c.onChat(message => {
      const chat = window.StringScapeRemoteChat;
      if (message?.type === 'prompt' && typeof message.text === 'string') { if (!chat.send(message.text, message.imageBase64)) c.sendChat({type:'chunk', id:crypto.randomUUID(), delta:'Connect an AI in the desktop chat panel before sending a message.'}); }
      else if (message?.type === 'get-saved-chats') c.sendChat({type:'saved-chats', chats:chat.savedChats()});
      else if (message?.type === 'get-media' && ['ai','user'].includes(message.source)) c.sendChat({type:'media', source:message.source, items:chat.media(message.source)});
      else if (message?.type === 'load-chat' && typeof message.id === 'string') { if (chat.loadChat(message.id)) c.sendChat({type:'chat-opened'}); else c.sendChat({type:'chat-action-error', text:'Unable to open this chat. Switch the desktop panel to AI chat and try again.'}); }
      else if (message?.type === 'new-chat') { if (chat.newChat()) c.sendChat({type:'chat-opened'}); else c.sendChat({type:'chat-action-error', text:'Switch the desktop panel to AI chat to start a new chat.'}); }
    });
    c.onScreen(message => { if (message?.type !== 'state') return; if (['toggle-physics','zoom-selection'].includes(message.command)) { if (Number.isSafeInteger(message.actionVersion) && message.actionVersion > remoteActionVersion) remoteActionVersion = message.actionVersion; screenDirty = true; if (message.command === 'toggle-physics') { window.StringScapeRemoteWorkspace.togglePhysics(); syncPhysicsState(true); } else if (!window.StringScapeRemoteWorkspace.zoomSelection()) c.sendScreen({type:'workspace-feedback', text:'Select nodes on the desktop first.'}); } if (message.pointer || message.wheel) { screenDirty = true; if (Number.isSafeInteger(message.actionVersion) && message.actionVersion > remoteActionVersion) remoteActionVersion = message.actionVersion; } if (typeof message.screenVisible === 'boolean') { screenVisible = message.screenVisible; if (screenVisible) { screenDirty = true; lastCapture = 0; refreshScreen(); } } if (Object.hasOwn(message, 'crop')) { const r = message.crop; if (r === null) { cropRequest = null; cropVersion++; screenDirty = true; } else if (r && ['x','y','width','height','viewportWidth','viewportHeight','id'].every(key => Number.isFinite(r[key])) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001 && r.viewportWidth === window.innerWidth && r.viewportHeight === window.innerHeight) { cropRequest = {...r}; cropVersion++; screenDirty = true; } else { cropRequest = null; cropVersion++; screenDirty = true; } } if (message.requestSharp === true) { sharpRequested = true; screenDirty = true; } handlePointer(message.pointer); handleWheel(message.wheel); if (message.wheel) { screenDirty = true; sharpRequested = true; } });
    interval = setInterval(() => { refreshScreen(); syncPhysicsState(); }, 1000);
  } catch (error) { status.textContent = `Could not start session: ${error.message}`; }
};
