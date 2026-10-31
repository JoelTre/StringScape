(() => {
    try {
    const main = document.querySelector('main');
    const setup = main.firstElementChild;
    const physics = document.getElementById('homologyPhysicsSimulation');
    const viewer = document.getElementById('physicsContainer');
    const pages = Array.from({length: 9}, (_, i) => {
        const page = document.createElement('section');
        page.className = 'app-page';
        page.dataset.page = String(i + 1);
        page.hidden = i !== 0;
        return page;
    });
    const labels = ['Build a model', 'Build process', '3D viewer', 'Mol* viewer', 'Build stats', 'Compare variables', 'Connect an AI', 'Save and download', 'Validation report'];
    const icons = ['fa-cubes', 'fa-list-check', 'fa-dna', 'fa-cube', 'fa-chart-bar', 'fa-chart-line', 'fa-robot', 'fa-floppy-disk', 'fa-clipboard-check'];
    const ai = document.getElementById('modellerAiOpen').closest('section');
    const session = document.getElementById('sessionPanel');
    const process = document.getElementById('buildProcessBox');
    const details = document.getElementById('detailsPanels');
    const molstar = document.getElementById('molstar-simulation-container').parentElement.parentElement;
    const download = document.getElementById('downloadMmCifBtn').closest('.bg-slate-900');
    const statsButton = document.getElementById('physicsControlsToggle');
    const stats = document.getElementById('physicsControlsPanel');
    const comparison = document.getElementById('physicsVariableComparison');
    const report = document.getElementById('validationReport');
    pages[0].append(setup);
    pages[1].append(process, details);
    pages[2].append(physics, document.getElementById('stagedModelComparisons'));
    pages[3].append(molstar);
    pages[4].append(statsButton, stats);
    pages[5].append(comparison);
    pages[6].append(ai);
    pages[7].append(session, download);
    pages[8].append(report);

    const shell = document.createElement('div'); shell.className = 'app-shell';
    const menu = document.createElement('nav'); menu.className = 'app-page-menu'; menu.setAttribute('aria-label', 'App pages');
    const title = document.createElement('h2'); title.textContent = 'Pages'; menu.append(title);
    const layer = document.createElement('div'); layer.className = 'app-page-layer';
    const burger = document.createElement('button'); burger.type = 'button'; burger.className = 'app-menu-toggle'; burger.setAttribute('aria-label', 'Open page menu'); burger.setAttribute('aria-expanded', 'false'); burger.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    const content = document.createElement('div'); content.className = 'app-page-content'; content.append(...pages);
    const topBlur=document.createElement('div'),bottomBlur=document.createElement('div');
    topBlur.className='app-scroll-blur app-scroll-blur-top';bottomBlur.className='app-scroll-blur app-scroll-blur-bottom';
    topBlur.setAttribute('aria-hidden','true');bottomBlur.setAttribute('aria-hidden','true');
    layer.append(burger, content, topBlur, bottomBlur); shell.append(menu, layer);
    let fadeUpdateFrame=0;
    function updateScrollFades() {
        fadeUpdateFrame=0;
        const maximum=Math.max(0,content.scrollHeight-content.clientHeight);
        layer.classList.toggle('has-scroll-above',content.scrollTop>1);
        layer.classList.toggle('has-scroll-below',maximum-content.scrollTop>1);
    }
    function scheduleScrollFadeUpdate() {
        if(!fadeUpdateFrame)fadeUpdateFrame=requestAnimationFrame(updateScrollFades);
    }
    content.addEventListener('scroll',scheduleScrollFadeUpdate,{passive:true});
    window.addEventListener('resize',scheduleScrollFadeUpdate);
    content.addEventListener('toggle',scheduleScrollFadeUpdate,true);
    if(typeof ResizeObserver!=='undefined') {
        const observer=new ResizeObserver(scheduleScrollFadeUpdate);
        observer.observe(content);pages.forEach(page=>observer.observe(page));
    }
    const viewerBox = document.createElement('div'); viewerBox.className = 'app-physics-viewer'; viewerBox.append(viewer);
    main.replaceChildren(shell, viewerBox); main.classList.add('app-workspace');
    const mobileSheet=window.createMobilePhysicsSheet({main,layer,burger,viewer:viewerBox,content,heading:document.querySelector('#aboutProteinComplex > h2'),chatInput:document.getElementById('complexAiQuestion')});
    let current = 1;
    const buttons = labels.map((label, i) => {
        const button = document.createElement('button'); button.type = 'button';
        button.innerHTML = `<i class="fa-solid ${icons[i]}" aria-hidden="true"></i><span>${label}</span>`;
        button.addEventListener('click', () => navigate(i + 1)); menu.append(button); return button;
    });
    function setMenu(open) {
        main.classList.toggle('menu-open', open); menu.inert = !open; burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Close page menu' : 'Open page menu');
    }
    function navigate(number) {
        if (number < 1 || number > 9) return;
        current = number;
        pages.forEach((page, i) => { page.hidden = i !== number - 1; });
        buttons.forEach((button, i) => { if (i === number - 1) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
        main.classList.toggle('physics-page', number === 3);
        mobileSheet.setPage(number);
        setMenu(false); content.scrollTop = 0; scheduleScrollFadeUpdate();
        if (number === 2 && details.classList.contains('hidden')) document.getElementById('viewDetailsBtn').click();
        if (number === 5 && stats.classList.contains('hidden')) statsButton.click();
        if (number === 6) comparison.open = true;
        if (number === 9) report.open = true;
        const refreshViewer=()=>{
            window.dispatchEvent(new Event('resize'));
            if(current===3)window.dispatchEvent(new Event('stringscape-physics-page-visible'));
        };
        requestAnimationFrame(refreshViewer);
        setTimeout(refreshViewer, 350);
    }
    const examplesButton = document.getElementById('exampleModelsButton');
    const examplesMenu = document.getElementById('exampleModelsMenu');
    function closeExamples() { examplesMenu.classList.add('hidden'); examplesButton.setAttribute('aria-expanded', 'false'); }
    function placeExamples() {
        const rect = examplesButton.getBoundingClientRect();
        const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 16);
        examplesMenu.style.width = `${width}px`;
        examplesMenu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
        examplesMenu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - examplesMenu.offsetHeight - 8))}px`;
    }
    examplesButton.addEventListener('click', () => {
        const opening = examplesMenu.classList.toggle('hidden') === false;
        examplesButton.setAttribute('aria-expanded', String(opening));
        if (opening) placeExamples();
    });
    examplesMenu.addEventListener('click', event => { if (event.target.closest('button[data-reference]')) closeExamples(); });
    document.addEventListener('click', event => { if (!examplesButton.contains(event.target) && !examplesMenu.contains(event.target)) closeExamples(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !examplesMenu.classList.contains('hidden')) { closeExamples(); examplesButton.focus(); } });
    window.addEventListener('resize', () => { if (!examplesMenu.classList.contains('hidden')) placeExamples(); });
    content.addEventListener('scroll', () => { if (!examplesMenu.classList.contains('hidden')) placeExamples(); });
    burger.addEventListener('click', () => setMenu(!main.classList.contains('menu-open')));
    for (const shiftedUi of [layer, viewerBox]) {
        shiftedUi.addEventListener('click', event => {
            if (!window.matchMedia('(max-width: 768px)').matches || !main.classList.contains('menu-open')) return;
            event.preventDefault();
            event.stopPropagation();
            setMenu(false);
        }, true);
    }
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
    document.addEventListener('click', event => {
        if (event.target.closest('.validation-score-graph')) navigate(5);
        else if (event.target.closest('.validation-color-in-3d, #qmeanKeyUpdate')) navigate(event.target.closest('#qmeanKeyUpdate') ? 9 : 3);
    }, true);
    document.getElementById('jumpToHomologyBtn').addEventListener('click', () => navigate(3));
    window.appNavigate = navigate;
    window.appNavigateWhenSimulationStarts = () => { if (current === 1) navigate(3); };
    navigate(1);
    } finally {
        document.documentElement.classList.remove('app-layout-loading');
    }
})();
