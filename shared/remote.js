export const TURN_BROKER_URL = 'https://remoteconnect.joel-tregurtha.workers.dev';
const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];
export async function connectRoom(code, passcode) {
  let iceServers = fallback;
  try {
    const response = await fetch(TURN_BROKER_URL, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`TURN broker: ${response.status}`);
    const body = await response.json();
    const servers = Array.isArray(body) ? body : body.iceServers;
    if (!Array.isArray(servers) || !servers.length) throw new Error('Invalid ICE server response');
    iceServers = servers;
  } catch (error) { console.warn('Using public STUN fallback:', error); }
  const { joinRoom } = await import('https://esm.run/trystero');
  const room = joinRoom({ appId: 'stringscape-remote-v1', password: passcode, maxUsers: 2, rtcConfig: { iceServers } }, code);
  try {
    const chat = room.makeAction('chat');
    const screen = room.makeAction('screen');
    return {
      room,
      sendChat: (...args) => chat.send(...args),
      onChat: (...args) => chat.onMessage(...args),
      sendScreen: (...args) => screen.send(...args),
      onScreen: (...args) => screen.onMessage(...args)
    };
  } catch (error) {
    await room.leave();
    throw error;
  }
}
export function throttle(fn, delay = 50) {
  let timer = null, latest;
  return (...args) => { latest = args; if (!timer) timer = setTimeout(() => { timer = null; fn(...latest); }, delay); };
}
