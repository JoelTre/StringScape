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
function confidenceCounts(residues) {
  const counts = [0, 0, 0, 0, 0];
  for (const {plddt} of residues) {
    if (!Number.isFinite(plddt) || plddt < 0 || plddt > 100) counts[4]++;
    else counts[plddt < 50 ? 0 : plddt < 70 ? 1 : plddt < 90 ? 2 : 3]++;
  }
  return counts;
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
    sequence.push({chain, added, plddt: source?.plddt});
  }
  return sequence;
}
function addSequenceBar(container, residues, pdbId) {
  const section = document.createElement('div');
  section.className = 'sequence-section';
  const bar = document.createElement('div');
  bar.className = 'sequence-bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `Protein sequence, ${residues.length} residues. Dark grey indicates residues present in the PDB; other colours indicate added residues by pLDDT.`);
  for (const residue of residues) {
    const segment = document.createElement('span');
    const score = residue.plddt;
    const category = !Number.isFinite(score) || score < 0 || score > 100 ? 4 : score < 50 ? 0 : score < 70 ? 1 : score < 90 ? 2 : 3;
    segment.className = residue.added ? `sequence-confidence-${category}` : 'sequence-present';
    segment.title = residue.added ? `Added residue · pLDDT ${Number.isFinite(score) ? score.toFixed(1) : 'unavailable'}` : 'Residue present in PDB';
    bar.append(segment);
  }
  const ends = document.createElement('div');
  ends.className = 'sequence-ends';
  ends.innerHTML = `<span>1</span><span>${residues.length}</span>`;
  const key = document.createElement('div');
  key.className = 'sequence-key';
  const items = [['sequence-present', `Present in ${pdbId}`], ['sequence-confidence-0', 'pLDDT 0–<50'], ['sequence-confidence-1', '50–<70'], ['sequence-confidence-2', '70–<90'], ['sequence-confidence-3', '90–100'], ['sequence-confidence-4', 'Unavailable']];
  const counts = [residues.filter(residue => !residue.added).length, ...confidenceCounts(residues.filter(residue => residue.added))];
  for (const [index, [colour, label]] of items.entries()) {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.className = colour;
    swatch.setAttribute('aria-hidden', 'true');
    const percentage = residues.length ? Math.round(counts[index] / residues.length * 100) : 0;
    item.append(swatch, document.createTextNode(`${label} (${counts[index]} | ${percentage}%)`));
    key.append(item);
  }
  section.append(bar, ends, key);
  container.append(section);
}
function showResidueSummary(residues, pdbId, sequenceResidues, usedSequenceFallback) {
  residueSummary.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = `Added ${residues.length.toLocaleString("en-US")} missing residues`;
  residueSummary.append(title);
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = `The structure of the added residues is based on AlphaFold predictions. The AlphaFold predictions for each protein present in ${pdbId} were fetched from the AlphaFold database${usedSequenceFallback ? " (the protein sequences from UniProt were used instead if no AlphaFold predictions were available)" : ""}. The AlphaFold predictions were structurally aligned with their respective proteins in ${pdbId} and any AlphaFold residues present in ${pdbId} were locked onto their ${pdbId} coordinates. AlphaFold residues missing from ${pdbId} were then iteratively moved to try to fix backbone distance issues and steric clashes. The result was then loaded into the 3D viewer. The chain breakdown below shows the AlphaFold pLDDT scores of the added residues (higher score means AlphaFold has higher confidence that the structure is accurate).`;
  residueSummary.append(note);
  const details = document.createElement('div');
  const chains = new Map();
  for (const residue of residues) {
    if (!chains.has(residue.chain)) chains.set(residue.chain, []);
    chains.get(residue.chain).push(residue);
  }
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
    if (sequence.length) addSequenceBar(row, sequence, pdbId);
    details.append(row);
  }
  residueSummary.append(details);
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
        const addedResidues = w.getAddedProteinResidues();
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
