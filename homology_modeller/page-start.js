// Hide the source layout until the paged interface has been assembled.
document.documentElement.classList.add('app-layout-loading');
document.addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement && /\/app-pages\.js(?:\?|$)/.test(event.target.src)) document.documentElement.classList.remove('app-layout-loading');
}, true);

// Disable the browser's saved scroll position before it restores the page.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('pageshow', () => {
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
});

// Consume shared access before loading third-party scripts; preserve all other URL inputs.
(() => {
    const url = new URL(location.href);
    if (!url.searchParams.has('passcode')) return;
    window.sharedAIPasscodeFromUrl = url.searchParams.get('passcode');
    url.searchParams.delete('passcode');
    history.replaceState(history.state, '', url.href);
})();
