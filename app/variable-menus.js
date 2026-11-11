// Keep native selects as the source of truth for application state and handlers.
(() => {
    const ids = ['colorMode', 'nodeBorderColorMode', 'nodeSizeVariable', 'nodeBorderWidthMode',
        'nodeLabelField', 'linkMode', 'linkVisibilityMode', 'linkWidthMode', 'bgMode', 'colorTheme'];
    const numeric = new Set(['layer', 'centrality', 'local_clustering_coefficient', 'eigen',
        'embeddings', 'annotation', 'size', 'pdb_structure_count', 'score']);
    const categorical = new Set(['collection', 'characterization', 'localization',
        'biological_process', 'complex_pdbs', 'species']);
    let active = null;
    const close = (focus = false) => {
        if (!active) return;
        const { trigger, panel } = active;
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        active = null;
        if (focus) trigger.focus();
    };
    const place = () => {
        if (!active) return;
        const { trigger, panel } = active;
        const rect = trigger.getBoundingClientRect();
        if (!trigger.getClientRects().length) { close(); return; }
        panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8))}px`;
        panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`;
    };
    const enhanced = new WeakSet();
    const cleanups = new Map();
    function enhance(select) {
            if (!select || enhanced.has(select)) return;
            const id = select.id;
            cleanups.get(id)?.();
            enhanced.add(select);
            const label = select.previousElementSibling?.textContent.trim() || id;
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.id = `${id}MenuButton`;
            trigger.className = 'app-variable-trigger';
            trigger.setAttribute('aria-haspopup', 'dialog');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-controls', `${id}Menu`);
            const panel = document.createElement('div');
            panel.id = `${id}Menu`;
            panel.className = 'app-variable-menu';
            if (['linkVisibilityMode', 'bgMode', 'colorTheme', 'nodeLabelField'].includes(id)) panel.classList.add('app-variable-menu-compact');
            panel.hidden = true;
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', label);
            select.hidden = true;
            select.after(trigger);
            document.body.append(panel);
            const sync = () => {
                const selected = select.selectedOptions[0];
                trigger.textContent = `${selected?.textContent || 'Choose an option'} ▾`;
                trigger.setAttribute('aria-label', `${label}: ${selected?.textContent || 'Choose an option'}`);
                trigger.disabled = select.disabled;
                panel.querySelectorAll('button').forEach(button => {
                    button.setAttribute('aria-pressed', String(button.dataset.value === select.value));
                });
            };
            const rebuild = () => {
                const groups = new Map(['Numeric', 'Categorical', 'Other', 'Custom'].map(name => [name, []]));
                if (id === 'nodeLabelField') { groups.clear(); groups.set('', []); }
                Array.from(select.options).forEach(option => {
                    if (option.hidden || option.style.display === 'none' || (option.parentElement.tagName === 'OPTGROUP' && option.parentElement.hidden)) return;
                    const key = option.value;
                    const group = key.startsWith('var::') || key.startsWith('linkvar::') || option.parentElement.tagName === 'OPTGROUP'
                        ? 'Custom' : option.dataset.variableType === 'continuous' || numeric.has(key) ? 'Numeric' : option.dataset.variableType === 'categorical' || categorical.has(key) || key.startsWith('#') ? 'Categorical' : 'Other';
                    groups.get(id === 'nodeLabelField' ? '' : group).push(option);
                });
                panel.replaceChildren();
                groups.forEach((options, name) => {
                    if (!options.length) return;
                    const section = document.createElement('section');
                    const heading = document.createElement('h3');
                    heading.textContent = name;
                    if (name) section.append(heading);
                    options.forEach(option => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.dataset.value = option.value;
                        button.textContent = option.textContent;
                        button.disabled = option.disabled || option.parentElement.disabled;
                        button.addEventListener('click', () => {
                            select.value = option.value;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            sync();
                            close(true);
                        });
                        section.append(button);
                    });
                    panel.append(section);
                });
                sync();
                if (active?.panel === panel) place();
            };
            // Programmatic state restores and D3 property writes also update the trigger.
            ['value', 'selectedIndex'].forEach(property => {
                const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
                Object.defineProperty(select, property, {
                    configurable: true,
                    get() { return descriptor.get.call(this); },
                    set(value) { descriptor.set.call(this, value); sync(); }
                });
            });
            const observer = new MutationObserver(rebuild);
            observer.observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
            cleanups.set(id, () => {
                observer.disconnect();
                if (active?.panel === panel) close();
                panel.remove();
            });
            select.addEventListener('change', sync);
            trigger.addEventListener('click', () => {
                const wasOpen = active?.panel === panel;
                close();
                if (wasOpen) return;
                rebuild();
                panel.hidden = false;
                active = { trigger, panel };
                trigger.setAttribute('aria-expanded', 'true');
                place();
                (panel.querySelector('button[aria-pressed="true"]:not(:disabled)') || panel.querySelector('button:not(:disabled)'))?.focus();
            });
            panel.addEventListener('keydown', event => {
                const buttons = Array.from(panel.querySelectorAll('button:not(:disabled)'));
                const index = buttons.indexOf(document.activeElement);
                let next;
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % buttons.length;
                if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = buttons.length - 1;
                if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
            });
            rebuild();
    }
    window.enhanceVariableMenu = enhance;
    function init() {
        [...ids, 'keyColorMode'].forEach(id => enhance(document.getElementById(id)));
        document.addEventListener('pointerdown', event => {
            if (active && !active.panel.contains(event.target) && !active.trigger.contains(event.target)) close();
        });
        document.addEventListener('focusin', event => {
            if (active && !active.panel.contains(event.target) && !active.trigger.contains(event.target)) close();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && active) { event.preventDefault(); close(true); }
        });
        window.addEventListener('resize', place);
        window.addEventListener('scroll', event => {
            if (active && !active.panel.contains(event.target)) place();
        }, true);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
