// Disable the browser's saved scroll position before it restores the page.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('pageshow', () => {
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
});
