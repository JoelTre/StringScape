'use strict';
// The existing modeller is the build engine. The parent page displays only its
// exported, prepared model; the engine's simulation is explicitly disabled.
const engine = document.getElementById('engine');
const form = document.getElementById('form');
const status = document.getElementById('status');
const button = document.getElementById('submit');
const residueSummary = document.getElementById('residue-summary');
let viewer;
let currentPdb = null;
const loadButton = document.getElementById('load');
const loadStatus = document.getElementById('load-status');
const results = document.querySelector('.results');
const resultsFooter = document.querySelector('.results-footer');
async function getViewer() {
  viewer ||= new rcsbMolstar.Viewer('viewer', {showWelcomeToast:false});
  return viewer;
}
async function loadReference(id) {
  loadButton.disabled = button.disabled = true;
  loadStatus.textContent = `Loading ${id}...`;
  try {
    const [metadata, structure] = await Promise.all([
      fetch(`https://data.rcsb.org/rest/v1/core/entry/${id}`),
      fetch(`https://files.rcsb.org/download/${id}.cif`)
    ]);
    if (!metadata.ok || !structure.ok) throw new Error(`Could not load ${id}. Check the PDB ID and connection.`);
    const [entry, cif] = await Promise.all([metadata.json(), structure.text()]);
    const v = await getViewer();
    currentPdb = null;
    await v.plugin.clear();
    const url = URL.createObjectURL(new Blob([cif], {type:'text/plain'}));
    try { await v.loadStructureFromUrl(url, 'mmcif', false, {props:{assemblyId:'1', kind:'standard'}}); } finally { URL.revokeObjectURL(url); }
    currentPdb = id;
    document.getElementById('pdb').value = id;
    document.getElementById('structure-id').textContent = id;
    document.getElementById('extended-id').textContent = `pdb_0000${id.toLowerCase()}`;
    document.getElementById('structure-title').textContent = entry.struct?.title || `Structure ${id}`;
    document.title = `3D View: ${id}`;
    results.hidden = true;
    loadStatus.textContent = '';
  } catch (error) { loadStatus.textContent = error.message || 'The structure could not be loaded.'; }
  finally { loadButton.disabled = false; button.disabled = !currentPdb; }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  if (form.reportValidity()) loadReference(document.getElementById('pdb').value.toUpperCase());
});
document.querySelectorAll('[data-pdb-example]').forEach(example => {
  example.addEventListener('click', () => {
    document.getElementById('pdb').value = example.dataset.pdbExample;
    form.requestSubmit();
  });
});
const panel = document.getElementById('pdb-panel');
const handle = document.getElementById('panel-handle');
handle.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const rect = panel.getBoundingClientRect(), dx = event.clientX - rect.left, dy = event.clientY - rect.top;
  handle.setPointerCapture(event.pointerId);
  const move = e => {
    panel.style.left = `${Math.max(0, Math.min(innerWidth - panel.offsetWidth, e.clientX - dx))}px`;
    panel.style.top = `${Math.max(0, Math.min(innerHeight - panel.offsetHeight, e.clientY - dy))}px`;
  };
  const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); };
  handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
});
loadReference('2D9Q');
const scoreOptions = {
  modelConfidence: {label: 'Model confidence', max: 1},
  localConfidence: {label: 'Local structure confidence', max: 1},
  placement2: {label: 'Placement confidence (2 Å)', max: 1},
  placement5: {label: 'Placement confidence (5 Å)', max: 1},
  plddt: {label: 'AlphaFold pLDDT', max: 100},
  pae: {label: 'AlphaFold PAE', max: Infinity}
};
let selectedScore = 'modelConfidence';
function validScore(value, option) {
  return Number.isFinite(value) && value >= 0 && value <= option.max;
}
function scoreColor(value, key) {
  const option = scoreOptions[key];
  if (!validScore(value, option)) return '#64748b';
  if (key === 'plddt') return value < 50 ? '#ff7d45' : value < 70 ? '#ffdb13' : value < 90 ? '#65cbf3' : '#1964b0';
  if (key === 'pae') return confidenceColor(1 - Math.min(value / 30, 1));
  return confidenceColor(value);
}
function confidenceColor(score) {
  if (!Number.isFinite(score) || score < 0 || score > 1) return '#64748b';
  const stops = [[0, [255, 125, 69]], [.5, [255, 219, 19]], [.7, [101, 203, 243]], [1, [0, 83, 214]]];
  const upper = stops.findIndex((stop, index) => index > 0 && score <= stop[0]);
  const [low, start] = stops[upper - 1], [high, end] = stops[upper];
  const t = (score - low) / (high - low);
  return `rgb(${start.map((component, index) => Math.round(component + (end[index] - component) * t)).join(',')})`;
}
// The model export uses B factors 1 and 2 for reference and added residues.
// Added-residue scores are supplied separately in the same model order.
function sequenceFromExport(cif, addedResidues) {
  const queues = new Map();
  for (const residue of addedResidues) {
    if (!queues.has(residue.chain)) queues.set(residue.chain, []);
    queues.get(residue.chain).push(residue);
  }
  const offsets = new Map(), seen = new Set(), sequence = [];
  for (const line of cif.split('\n')) {
    if (!line.startsWith('ATOM ')) continue;
    const fields = line.match(/(?:'[^']*'|"[^"]*"|\S+)/g);
    if (!fields || fields.length < 15) continue;
    const unquote = value => value.replace(/^['"]|['"]$/g, '');
    const chain = unquote(fields[6]);
    if (!queues.has(chain)) continue;
    const key = `${chain}\0${fields[7]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const added = Number(fields[12]) === 2;
    const offset = offsets.get(chain) || 0;
    const source = added ? queues.get(chain)[offset] : null;
    if (added) offsets.set(chain, offset + 1);
    sequence.push({chain, added, ...source});
  }
  return sequence;
}
function addSequenceBar(container, residues, pdbId, scoreKey) {
  const option = scoreOptions[scoreKey];
  const section = document.createElement('div');
  section.className = 'sequence-section';
  const bar = document.createElement('div');
  bar.className = 'sequence-bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `Protein sequence, ${residues.length} residues. Dark grey indicates residues present in the PDB; other colours indicate added residues by ${option.label}.`);
  for (const residue of residues) {
    const segment = document.createElement('span');
    const score = residue[scoreKey];
    const valid = validScore(score, option);
    segment.className = residue.added ? 'sequence-added' : 'sequence-present';
    if (residue.added) segment.style.background = scoreColor(score, scoreKey);
    segment.title = residue.added ? `Added residue · ${option.label} ${valid ? score.toFixed(scoreKey === 'plddt' || scoreKey === 'pae' ? 1 : 3) + (scoreKey === 'pae' ? ' Å' : '') : 'unavailable'}` : 'Residue present in PDB';
    bar.append(segment);
  }
  const ends = document.createElement('div');
  ends.className = 'sequence-ends';
  ends.innerHTML = `<span>1</span><span>${residues.length}</span>`;
  const key = document.createElement('div');
  key.className = 'sequence-key';
  const present = residues.filter(residue => !residue.added).length;
  const unavailable = residues.filter(residue => residue.added && !validScore(residue[scoreKey], option)).length;
  const percentage = count => residues.length ? Math.round(count / residues.length * 100) : 0;
  for (const [colour, label] of [
    ['sequence-present', `Present in ${pdbId} (${present} | ${percentage(present)}%)`],
    [scoreKey === 'pae' ? 'sequence-pae-scale' : scoreKey === 'plddt' ? 'sequence-plddt-scale' : 'sequence-confidence-scale', scoreKey === 'pae' ? 'PAE: 0 to ≥30 Å' : `${option.label}: 0 to ${option.max}`],
    ['sequence-confidence-unavailable', `Unavailable (${unavailable} | ${percentage(unavailable)}%)`]
  ]) {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.className = colour;
    swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, document.createTextNode(label));
    key.append(item);
  }
  section.append(bar, ends, key);
  container.append(section);
}
function showResidueSummary(residues, pdbId, sequenceResidues, usedSequenceFallback) {
  residueSummary.replaceChildren();
  resultsFooter.querySelector('.score-control')?.remove();
  const title = document.createElement('h2');
  title.textContent = `Added ${residues.length.toLocaleString("en-US")} missing residues`;
  residueSummary.append(title);
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = `The structure of the added residues is based on AlphaFold predictions. The AlphaFold predictions for each protein present in ${pdbId} were fetched from the AlphaFold database${usedSequenceFallback ? " (the protein sequences from UniProt were used instead if no AlphaFold predictions were available)" : ""}. The AlphaFold predictions were structurally aligned with their respective proteins in ${pdbId} and any AlphaFold residues present in ${pdbId} were locked onto their ${pdbId} coordinates. AlphaFold residues missing from ${pdbId} were then iteratively moved to try to fix backbone distance issues and steric clashes. The result was then loaded into the 3D viewer. The chain breakdown below colours added residues by the selected score. AlphaFold PAE is the mean predicted relative-position error to other represented residues in the same AlphaFold chain; lower values indicate less predicted error.`;
  residueSummary.append(note);
  const details = document.createElement('div');
  const chains = new Map();
  for (const residue of residues) {
    if (!chains.has(residue.chain)) chains.set(residue.chain, []);
    chains.get(residue.chain).push(residue);
  }
  function renderChains() {
  details.replaceChildren();
  if (!chains.size) {
    const empty = document.createElement('p');
    empty.textContent = 'No residues were added.';
    details.append(empty);
  }
  for (const [chain, added] of chains) {
    const row = document.createElement('div');
    row.className = 'chain-row';
    const heading = document.createElement('h3');
    const label = document.createElement('span');
    label.textContent = `Chain ${chain} · ${added.find(residue => residue.proteinName && residue.proteinName !== 'Unknown protein')?.proteinName || 'Unknown protein'}`;
    const count = document.createElement('span');
    count.className = 'chain-added-count';
    count.textContent = `${added.length} added`;
    heading.append(label, count);
    row.append(heading);
    const sequence = sequenceResidues.filter(residue => residue.chain === chain);
    if (sequence.length) addSequenceBar(row, sequence, pdbId, selectedScore);
    details.append(row);
  }
  }
  renderChains();
  residueSummary.append(details);
  if (chains.size) {
    const control = document.createElement('div');
    control.className = 'score-control';
    const label = document.createElement('span');
    label.id = 'gap-score-label';
    label.textContent = 'Colour added residues by';
    const menu = document.createElement('details');
    menu.className = 'score-menu';
    const trigger = document.createElement('summary');
    trigger.className = 'form-select score-menu-trigger';
    trigger.setAttribute('aria-labelledby', 'gap-score-label gap-score-value');
    const valueLabel = document.createElement('span');
    valueLabel.id = 'gap-score-value';
    valueLabel.textContent = scoreOptions[selectedScore].label;
    trigger.append(valueLabel);
    const options = document.createElement('div');
    options.className = 'score-menu-options';
    for (const [value, option] of Object.entries(scoreOptions)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = option.label;
      item.setAttribute('aria-pressed', String(value === selectedScore));
      item.addEventListener('click', () => {
        selectedScore = value;
        valueLabel.textContent = option.label;
        options.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === item)));
        menu.open = false;
        trigger.focus();
        renderChains();
      });
      options.append(item);
    }
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; trigger.focus(); }
    });
    menu.addEventListener('focusout', event => {
      if (!menu.contains(event.relatedTarget)) menu.open = false;
    });
    menu.append(trigger, options);
    control.append(label, menu);
    resultsFooter.prepend(control);
  }
  residueSummary.hidden = false;
}
const engineReady = new Promise((resolve, reject) => {
  engine.addEventListener('load', () => {
    try {
      const doc = engine.contentDocument;
      if (!doc || !doc.getElementById('dualPdbForm')) throw new Error('The modelling engine could not be loaded.');
      resolve(engine.contentWindow);
    } catch (error) { reject(error); }
  }, { once: true });
  engine.addEventListener('error', () => reject(new Error('The modelling engine could not be loaded.')), { once: true });
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
button.addEventListener('click', async () => {
  if (!currentPdb) return;
  const buildPdb = currentPdb;
  results.hidden = false;
  button.disabled = true;
  loadButton.disabled = true;
  residueSummary.hidden = true;
  residueSummary.replaceChildren();
  resultsFooter.querySelector('.score-control')?.remove();
  status.classList.add('building');
  const spinner = document.createElement('i');
  spinner.className = 'build-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  status.replaceChildren(spinner, document.createTextNode('Adding missing residues...'));
  try {
    const win = await engineReady;
    const doc = win.document;
    // Reloading gives each request fresh state, including automatic target discovery.
    if (win.getComplexAiState?.().built) {
      engine.src = '../../index.html?v=20261111chains2';
      await new Promise((resolve, reject) => { engine.addEventListener('load', resolve, {once:true}); engine.addEventListener('error', reject, {once:true}); });
    }
    const w = engine.contentWindow, d = w.document;
    d.getElementById('autoRunBuildSimulation').checked = false;
    d.getElementById('useReferencesDirectly').checked = false;
    d.getElementById('pdbInput1').value = buildPdb;
    d.getElementById('pdbInput1').dispatchEvent(new Event('input', {bubbles:true}));
    d.getElementById('dualPdbForm').requestSubmit();
    const start = Date.now();
    while (Date.now() - start < 360000) {
      await sleep(500);
      const state = w.getComplexAiState?.();
      const discovery = d.getElementById('fetchSiftsStatus');
      const build = d.getElementById('modelBuildTime');
      if (discovery?.classList.contains('discovery-warning')) throw new Error(discovery.textContent || 'Could not map all reference chains.');
      if (build?.textContent.includes('failed')) throw new Error('The model build failed. Check the PDB ID and network connection.');
      if (state?.built) {
        const cif = w.generateSimulationMmCifString?.();
        if (!cif) throw new Error('The prepared model could not be exported.');
        await getViewer();
        await viewer.plugin.clear();
        const url = URL.createObjectURL(new Blob([cif], {type:'text/plain'}));
        try { await viewer.loadStructureFromUrl(url, 'mmcif', false); } finally { URL.revokeObjectURL(url); }
        if (typeof w.getAddedProteinResidues !== 'function') throw new Error('The residue summary is unavailable; reload the page to update the modelling engine.');
        status.lastChild.textContent = 'Loading confidence scores...';
        const addedResidues = await w.getAddedProteinResidues();
        const sequenceResidues = sequenceFromExport(cif, addedResidues);
        showResidueSummary(addedResidues, buildPdb, sequenceResidues,
          d.getElementById('sequenceOnlyNotice')?.textContent.startsWith('No AlphaFold model found for '));
        status.textContent = '';
        return;
      }
    }
    throw new Error('The build timed out. Check the connection and try again.');
  } catch (error) { status.textContent = error.message || 'The model could not be built.'; }
  finally { status.classList.remove('building'); button.disabled = false; loadButton.disabled = false; }
});
