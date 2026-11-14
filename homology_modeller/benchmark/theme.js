'use strict';
(() => {
    const root = document.documentElement;
    const button = document.getElementById('theme-toggle');
    let theme = 'dark';
    try { theme = localStorage.getItem('benchmark-theme') === 'light' ? 'light' : 'dark'; } catch (_) {}
    function applyTheme() {
        root.dataset.theme = theme;
        const next = theme === 'dark' ? 'light' : 'dark';
        button.setAttribute('aria-label', `Switch to ${next} mode`);
        button.innerHTML = `${next === 'light' ? '☀' : '☾'} <span>${next === 'light' ? 'Light' : 'Dark'} mode</span>`;
    }
    button.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('benchmark-theme', theme); } catch (_) {}
        applyTheme();
    });
    applyTheme();
})();
