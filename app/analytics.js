(() => {
    'use strict';

    const storageKey = 'stringscape_analytics_enabled';
    let enabled = true;
    let loaded = false;
    try {
        enabled = localStorage.getItem(storageKey) !== 'false';
    } catch {
        // Storage may be unavailable in private or restricted browsers.
    }

    function isAnalyticsRequest(value) {
        try {
            const url = new URL(value, location.href);
            return url.hostname === 'cloudflareinsights.com'
                || url.hostname.endsWith('.cloudflareinsights.com')
                || (url.origin === location.origin && url.pathname === '/cdn-cgi/rum');
        } catch {
            return false;
        }
    }

    // The beacon can keep event listeners after opt-out. Gate its transports
    // before loading it so later performance/unload events cannot send data.
    if (navigator.sendBeacon) {
        const sendBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => {
            if (!enabled && isAnalyticsRequest(url)) return false;
            return sendBeacon(url, data);
        };
    }
    if (window.fetch) {
        const fetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
            const url = input instanceof Request ? input.url : input;
            if (!enabled && isAnalyticsRequest(url)) {
                return Promise.reject(new TypeError('Anonymous analytics is disabled.'));
            }
            return fetch(input, init);
        };
    }
    const analyticsRequests = new WeakSet();
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        analyticsRequests.delete(this);
        if (isAnalyticsRequest(url)) analyticsRequests.add(this);
        return open.call(this, method, url, ...args);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        if (!enabled && analyticsRequests.has(this)) return;
        return send.apply(this, args);
    };

    function loadAnalytics() {
        if (!enabled || loaded) return;
        loaded = true;
        const script = document.createElement('script');
        script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
        script.defer = true;
        script.setAttribute('data-cf-beacon', JSON.stringify({
            token: 'de64078fa2a4407fba94310b9fc51393'
        }));
        document.head.appendChild(script);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('analytics-toggle');
        const status = document.getElementById('analytics-preference-status');
        function updateStatus(saved = true) {
            toggle.checked = enabled;
            status.textContent = `Anonymous analytics is ${enabled ? 'on' : 'off'}. `
                + (saved
                    ? 'Your preference is remembered in this browser. Clearing browser storage resets it to on.'
                    : 'Browser storage is unavailable; this preference applies only to this page visit.');
        }
        let saved = true;
        try {
            localStorage.setItem(storageKey, String(enabled));
        } catch {
            saved = false;
        }
        updateStatus(saved);
        toggle.addEventListener('change', () => {
            enabled = toggle.checked;
            let saved = true;
            try {
                localStorage.setItem(storageKey, String(enabled));
            } catch {
                saved = false;
            }
            updateStatus(saved);
            loadAnalytics();
        });
        window.addEventListener('storage', event => {
            if (event.key !== storageKey && event.key !== null) return;
            enabled = event.key === null || event.newValue !== 'false';
            updateStatus();
            loadAnalytics();
        });
    });

    loadAnalytics();
})();
