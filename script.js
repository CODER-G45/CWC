let rowSeq = 0;
let defaultTime = '40';
function newRow(rd=''){
  rowSeq++;
  return {id:rowSeq, rd:rd, depth:'', airCorr:'', wetCorr:'', time:defaultTime, revs:'', corrVel:''};
}
let rows = [newRow(),newRow(),newRow(),newRow(),newRow(),newRow()];

const vBody = document.getElementById('vBody');
const cols = ['rd','depth','airCorr','wetCorr','time','revs','corrVel'];

function renderRows(){
  vBody.innerHTML = '';
  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    let cells = `<td class="rowidx">${idx+1}</td>`;
    cells += `<td><input data-f="rd" type="number" step="any" value="${r.rd}"></td>`;
    cells += `<td><input data-f="depth" type="number" step="any" value="${r.depth}"></td>`;
    cells += `<td><input data-f="airCorr" type="number" step="any" value="${r.airCorr}"></td>`;
    cells += `<td><input data-f="wetCorr" type="number" step="any" value="${r.wetCorr}"></td>`;
    cells += `<td><input class="readonly" data-out="corrDepth" readonly value="0.000"></td>`;
    cells += `<td><input class="readonly" data-out="diff" readonly value="0.000"></td>`;
    cells += `<td><input class="readonly" data-out="bedIncr" readonly value="0.000"></td>`;
    cells += `<td><input data-f="time" type="number" step="any" value="${r.time}"></td>`;
    cells += `<td><input data-f="revs" type="number" step="any" value="${r.revs}"></td>`;
    cells += `<td><input class="readonly" data-out="meanVel" readonly value="0.000"></td>`;
    cells += `<td><input data-f="corrVel" type="number" step="any" value="${r.corrVel}" placeholder="= mean vel"></td>`;
    cells += `<td><input class="readonly" data-out="product" readonly value="0.000"></td>`;
    cells += `<td class="remarks"><input data-f="remarks" value="${r.remarks||''}"></td>`;
    cells += `<td><button class="rowbtn" data-del="1" title="Remove row">✕</button></td>`;
    tr.innerHTML = cells;
    vBody.appendChild(tr);
  });
  attachRowEvents();
  recalc();
}

function attachRowEvents(){
  vBody.querySelectorAll('tr').forEach(tr => {
    const id = Number(tr.dataset.id);
    tr.querySelectorAll('input[data-f]').forEach(inp => {
      inp.addEventListener('input', () => {
        const row = rows.find(r => r.id === id);
        const f = inp.dataset.f;
        row[f] = f === 'remarks' ? inp.value : inp.value;
        recalc();
      });
    });
    const delBtn = tr.querySelector('[data-del]');
    delBtn.addEventListener('click', () => {
      rows = rows.filter(r => r.id !== id);
      renderRows();
    });
  });
}

function num(v){ const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function recalc(){
  // Sort rows by RD (bank to bank), same as pandas df sorted by "Col 1 (RD)"
  const trs = [...vBody.querySelectorAll('tr')];
  const ordered = trs
    .map(tr => ({tr, row: rows.find(r => r.id === Number(tr.dataset.id))}))
    .sort((a,b) => num(a.row.rd) - num(b.row.rd));

  let sumDepth = 0, sumBedIncr = 0, sumProduct = 0;
  let prevDepth = null, prevRd = null;
  let calcRows = []; // {rd, corrDepth, product, leftWidth} in RD order

  ordered.forEach((item) => {
    const row = item.row;
    const rd = num(row.rd);
    const corrDepth = num(row.depth) + num(row.airCorr) + num(row.wetCorr);
    const width = prevRd === null ? 0 : (rd - prevRd);

    // Col 8: absolute depth difference vs previous row (0 for first row)
    const diff = prevDepth === null ? 0 : Math.abs(corrDepth - prevDepth);

    // Col 9: diff^2 / (2 * width), 0 if width is 0 (first row)
    const bedIncr = width > 0 ? (diff * diff) / (2 * width) : 0;

    // Col 14: mean velocity from rating equation V = (0.6799 x Revolutions / Time) + 0.0082
    const revs = num(row.revs);
    const time = num(row.time);
    const meanVel = (revs > 0 && time > 0) ? ((0.6799 * revs) / time + 0.0082) : 0;

    // Corr. Vel: user override, else = auto mean vel
    const corrVel = row.corrVel !== '' ? num(row.corrVel) : meanVel;

    // Col 18: Depth * Mean Velocity
    const product = corrDepth * corrVel;

    item.tr.querySelector('[data-out="corrDepth"]').value = corrDepth.toFixed(3);
    item.tr.querySelector('[data-out="diff"]').value = diff.toFixed(3);
    item.tr.querySelector('[data-out="bedIncr"]').value = bedIncr.toFixed(3);
    item.tr.querySelector('[data-out="meanVel"]').value = meanVel.toFixed(3);
    item.tr.querySelector('[data-out="product"]').value = product.toFixed(3);

    sumDepth += corrDepth;
    sumBedIncr += bedIncr;
    sumProduct += product;

    calcRows.push({rd, corrDepth, product, meanVel, leftWidth: width});

    prevDepth = corrDepth;
    prevRd = rd;
  });

  document.getElementById('sumDepth').textContent = sumDepth.toFixed(3);
  document.getElementById('sumBedIncr').textContent = sumBedIncr.toFixed(3);
  document.getElementById('sumProduct').textContent = sumProduct.toFixed(3);
  document.getElementById('totalDischarge').textContent = sumProduct.toFixed(3);

  calcSalientData(calcRows, sumDepth, sumBedIncr, sumProduct);

  drawSection();
}

function calcSalientData(calcRows, sumDepth, sumBedIncr, sumProduct){
  const n = calcRows.length;
  const set = (id, val) => { const el = document.getElementById(id); if(!el) return; if(el.tagName==='SPAN'){ el.textContent = val; } else { el.value = val; } };
  if(n < 2){
    ['sd_total7','sd_total18','sd_width','sd_width2','sd_prodA','sd_prodQ','sd_corrA','sd_corrQ','sd_areaA','sd_dischQ'].forEach(id=>set(id,'0.000'));
    ['sd_surfWidth','sd_wettedP','sd_vMean','sd_vMax','sd_R','sd_chezy','sd_manning','sd_meanDepth','slopeS'].forEach(id=>set(id,'0.000'));
    return;
  }

  // Common width of segment = most frequent RD spacing (mode)
  const widths = calcRows.slice(1).map(r => r.leftWidth).filter(w => w > 0);
  let commonWidth = 0;
  if(widths.length){
    const freq = {};
    widths.forEach(w => { const k = w.toFixed(6); freq[k] = (freq[k]||0) + 1; });
    commonWidth = parseFloat(Object.keys(freq).reduce((a,b) => freq[a] >= freq[b] ? a : b));
  }

  const surfaceWidth = calcRows[n-1].rd - calcRows[0].rd;

  // Per-row correction (CWC Note 3/4): (commonWidth - 1/2*(left+right segment)) * Col7 or Col18
  let totalAreaCorr = 0, totalDischCorr = 0;
  calcRows.forEach((r, i) => {
    const leftW = r.leftWidth || 0;
    const rightW = (i < n-1) ? calcRows[i+1].leftWidth : 0;
    const influenceWidth = (leftW/2) + (rightW/2);
    const delta = commonWidth - influenceWidth;
    totalAreaCorr += delta * r.corrDepth;
    totalDischCorr += delta * r.product;
  });

  const prodA = sumDepth * commonWidth;
  const prodQ = sumProduct * commonWidth;
  const A = prodA - totalAreaCorr;
  const Q = prodQ - totalDischCorr;
  const P = surfaceWidth + sumBedIncr;
  const vMean = A > 0 ? (Q / A) : 0;
  const vMax = Math.max(0, ...calcRows.map(r => r.meanVel));
  const R = P > 0 ? (A / P) : 0;

  const fall = num(document.getElementById('fallMetre').value);
  const meanDist = num(document.getElementById('meanDistGauge').value);
  const S = meanDist > 0 ? (fall / meanDist) : 0;

  const chezy = (R > 0 && S > 0) ? (vMean / Math.sqrt(R * S)) : 0;
  const manning = chezy > 0 ? (Math.pow(R, 1/6) / chezy) : 0;
  const meanDepth = surfaceWidth > 0 ? (A / surfaceWidth) : 0;

  document.getElementById('sd_total7').textContent = sumDepth.toFixed(3);
  document.getElementById('sd_total18').textContent = sumProduct.toFixed(3);
  document.getElementById('sd_width').textContent = 'x ' + commonWidth.toFixed(3);
  document.getElementById('sd_width2').textContent = 'x ' + commonWidth.toFixed(3);
  document.getElementById('sd_prodA').textContent = prodA.toFixed(3);
  document.getElementById('sd_prodQ').textContent = prodQ.toFixed(3);
  document.getElementById('sd_corrA').textContent = totalAreaCorr.toFixed(3);
  document.getElementById('sd_corrQ').textContent = totalDischCorr.toFixed(3);
  document.getElementById('sd_areaA').textContent = A.toFixed(3);
  document.getElementById('sd_dischQ').textContent = Q.toFixed(3);

  document.getElementById('sd_surfWidth').value = surfaceWidth.toFixed(3);
  document.getElementById('sd_wettedP').value = P.toFixed(3);
  document.getElementById('sd_vMean').value = vMean.toFixed(3);
  document.getElementById('sd_vMax').value = vMax.toFixed(3);
  document.getElementById('sd_R').value = R.toFixed(3);
  document.getElementById('slopeS').value = S.toFixed(5);
  document.getElementById('sd_chezy').value = chezy.toFixed(3);
  document.getElementById('sd_manning').value = manning.toFixed(3);
  document.getElementById('sd_meanDepth').value = meanDepth.toFixed(3);
}

document.getElementById('addRow').addEventListener('click', () => {
  rows.push(newRow());
  renderRows();
});

const defaultTimeBtn = document.getElementById('defaultTimeBtn');
defaultTimeBtn.addEventListener('click', () => {
  defaultTime = defaultTime === '40' ? '50' : '40';
  rows.forEach(r => { r.time = defaultTime; });
  defaultTimeBtn.textContent = `Default Time: ${defaultTime}s (tap to set ${defaultTime === '40' ? '50' : '40'}s for all)`;
  renderRows();
  showToast(`Time set to ${defaultTime}s for all verticals`);
});

// ---- Gauge table calc ----
const gaugeIds = ['pB_lb','pB_rb','pE_lb','pE_rb','tB_lb','tB_rb','tE_lb','tE_rb'];
function gaugeVal(id){ return num(document.getElementById(id).value); }
function recalcGauge(){
  const pB = (gaugeVal('pB_lb') + gaugeVal('pB_rb'))/ (gaugeVal('pB_lb')&&gaugeVal('pB_rb')?2:1) || (gaugeVal('pB_lb')+gaugeVal('pB_rb'));
  const pBmean = avgNonZero(gaugeVal('pB_lb'), gaugeVal('pB_rb'));
  const pEmean = avgNonZero(gaugeVal('pE_lb'), gaugeVal('pE_rb'));
  const tBmean = avgNonZero(gaugeVal('tB_lb'), gaugeVal('tB_rb'));
  const tEmean = avgNonZero(gaugeVal('tE_lb'), gaugeVal('tE_rb'));
  document.getElementById('pB_mean').textContent = pBmean.toFixed(3);
  document.getElementById('pE_mean').textContent = pEmean.toFixed(3);
  document.getElementById('tB_mean').textContent = tBmean.toFixed(3);
  document.getElementById('tE_mean').textContent = tEmean.toFixed(3);
  const pM_lb = avgNonZero(gaugeVal('pB_lb'), gaugeVal('pE_lb'));
  const pM_rb = avgNonZero(gaugeVal('pB_rb'), gaugeVal('pE_rb'));
  const tM_lb = avgNonZero(gaugeVal('tB_lb'), gaugeVal('tE_lb'));
  const tM_rb = avgNonZero(gaugeVal('tB_rb'), gaugeVal('tE_rb'));
  document.getElementById('pM_lb').textContent = pM_lb.toFixed(3);
  document.getElementById('pM_rb').textContent = pM_rb.toFixed(3);
  document.getElementById('tM_lb').textContent = tM_lb.toFixed(3);
  document.getElementById('tM_rb').textContent = tM_rb.toFixed(3);
  const pMmean = avgNonZero(pBmean, pEmean);
  const tMmean = avgNonZero(tBmean, tEmean);
  document.getElementById('pM_mean').textContent = pMmean.toFixed(3);
  document.getElementById('tM_mean').textContent = tMmean.toFixed(3);
  const zeroRL = num(document.getElementById('zeroRL').value);
  document.getElementById('meanWL').textContent = (zeroRL + tMmean).toFixed(3);
}
function avgNonZero(a,b){
  if(a && b) return (a+b)/2;
  return a || b || 0;
}
gaugeIds.concat(['zeroRL']).forEach(id => document.getElementById(id).addEventListener('input', recalcGauge));

// ---- Cross-section SVG ----
function drawSection(){
  const svg = document.getElementById('sectionSvg');
  const pts = rows
    .map(r => ({rd: num(r.rd), depth: num(r.depth) + num(r.airCorr) + num(r.wetCorr)}))
    .filter(p => p.rd !== 0 || p.depth !== 0)
    .sort((a,b) => a.rd - b.rd);
  if(pts.length < 2){ svg.innerHTML = ''; return; }
  const W = 1000, H = 220, padX = 30, padTop = 20, padBot = 30;
  const minRD = Math.min(...pts.map(p=>p.rd)), maxRD = Math.max(...pts.map(p=>p.rd));
  const maxDepth = Math.max(...pts.map(p=>p.depth), 0.5);
  const xScale = rd => padX + (rd - minRD) / (maxRD - minRD || 1) * (W - padX*2);
  const yScale = d => padTop + (d / maxDepth) * (H - padTop - padBot);
  let path = `M ${xScale(pts[0].rd)} ${padTop}`;
  pts.forEach(p => path += ` L ${xScale(p.rd)} ${yScale(p.depth)}`);
  path += ` L ${xScale(pts[pts.length-1].rd)} ${padTop} Z`;
  let waterLine = `M ${padX} ${padTop} L ${W-padX} ${padTop}`;
  let bedLine = `M ${xScale(pts[0].rd)} ${yScale(pts[0].depth)}`;
  pts.forEach(p => bedLine += ` L ${xScale(p.rd)} ${yScale(p.depth)}`);
  let dots = pts.map(p => `<circle cx="${xScale(p.rd)}" cy="${yScale(p.depth)}" r="3.5" fill="#AD7A2E" stroke="#fff" stroke-width="1"/>`).join('');
  svg.innerHTML = `
    <path d="${path}" fill="#4F8B98" fill-opacity="0.25" stroke="none"/>
    <path d="${bedLine}" fill="none" stroke="#0E2E36" stroke-width="2"/>
    <path d="${waterLine}" fill="none" stroke="#9CC6CE" stroke-width="1.5" stroke-dasharray="4,3"/>
    ${dots}
    <text x="${padX}" y="${H-8}" font-size="10" fill="#5E6B60" font-family="IBM Plex Mono">RD ${minRD}</text>
    <text x="${W-padX}" y="${H-8}" font-size="10" fill="#5E6B60" text-anchor="end" font-family="IBM Plex Mono">RD ${maxRD}</text>
  `;
}

// ---- Save / Load using browser localStorage (works when this file is opened directly) ----
const toast = document.getElementById('toast');
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// window.storage only exists inside the Claude.ai artifact sandbox. When this file is
// saved and opened on its own (double-clicked, or opened via file:// / a local server),
// we fall back to the browser's localStorage so Save/Load still works.
const STORAGE_PREFIX = 'cwc_discharge_';
const hasClaudeStorage = (typeof window.storage !== 'undefined');

const localStore = {
  async set(key, value){
    if(hasClaudeStorage) return window.storage.set(key, value);
    try{ localStorage.setItem(STORAGE_PREFIX+key, value); return {key, value}; }
    catch(e){ console.error('localStorage set failed', e); return null; }
  },
  async get(key){
    if(hasClaudeStorage) return window.storage.get(key);
    const v = localStorage.getItem(STORAGE_PREFIX+key);
    return v === null ? null : {key, value:v};
  },
  async delete(key){
    if(hasClaudeStorage) return window.storage.delete(key);
    localStorage.removeItem(STORAGE_PREFIX+key);
    return {key, deleted:true};
  },
  async list(prefix){
    if(hasClaudeStorage) return window.storage.list(prefix);
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(STORAGE_PREFIX+(prefix||''))) keys.push(k.slice(STORAGE_PREFIX.length));
    }
    return {keys};
  }
};

const headerFieldIds = ['river','site','code','date','timeFrom','timeTo','mode','locSite','usds',
  'meterNo','ratingEq','lastRating','ratedSpin','spinBefore','spinAfter','daysUse','velAt','sounding','weight','suspend','watch',
  'waterTemp','airMax','airMin','weather','windDir','rainfall','zeroRL',
  'pB_lb','pB_rb','pE_lb','pE_rb','tB_lb','tB_rb','tE_lb','tE_rb','fallMetre','meanDistGauge'];

['fallMetre','meanDistGauge'].forEach(id => document.getElementById(id).addEventListener('input', recalc));

function collectState(){
  const state = {rows, waterCond:'', windVel:''};
  headerFieldIds.forEach(id => { state[id] = document.getElementById(id).value; });
  state.waterCond = document.querySelector('input[name="waterCond"]:checked')?.value || '';
  state.windVel = document.querySelector('input[name="windVel"]:checked')?.value || '';
  return state;
}

function applyState(state){
  rows = state.rows && state.rows.length ? state.rows : [newRow()];
  rowSeq = Math.max(...rows.map(r=>r.id), 0);
  headerFieldIds.forEach(id => { if(state[id] !== undefined) document.getElementById(id).value = state[id]; });
  if(state.waterCond){
    const el = document.querySelector(`input[name="waterCond"][value="${state.waterCond}"]`);
    if(el) el.checked = true;
  }
  if(state.windVel){
    const el = document.querySelector(`input[name="windVel"][value="${state.windVel}"]`);
    if(el) el.checked = true;
  }
  const fiftyCount = rows.filter(r => String(r.time) === '50').length;
  defaultTime = fiftyCount > rows.length/2 ? '50' : '40';
  defaultTimeBtn.textContent = `Default Time: ${defaultTime}s (tap to set ${defaultTime === '40' ? '50' : '40'}s for all)`;
  renderRows();
  recalcGauge();
}

async function saveEntry(){
  const state = collectState();
  const key = `entry:${state.site||'site'}:${state.date||'nodate'}:${Date.now()}`;
  try{
    const res = await localStore.set(key, JSON.stringify(state));
    if(!res) throw new Error('storage set returned null');
    downloadJSON(state, `discharge_${slugify(state.site)}_${state.date||'nodate'}.json`);
    showToast(hasClaudeStorage ? 'Saved ✓' : 'Saved ✓ — also downloaded to your folder');
    loadSavedList();
  }catch(e){
    showToast('Save failed — try again');
    console.error(e);
  }
}

async function loadSavedList(){
  const listEl = document.getElementById('savedList');
  try{
    const res = await localStore.list('entry:');
    if(!res || !res.keys || res.keys.length === 0){
      listEl.innerHTML = '<div class="hint">No saved entries yet.</div>';
      return;
    }
    const items = await Promise.all(res.keys.map(async k => {
      const r = await localStore.get(k);
      return {key:k, data: JSON.parse(r.value)};
    }));
    items.sort((a,b) => b.key.localeCompare(a.key));
    listEl.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'saveditem';
      div.innerHTML = `
        <div class="meta"><strong>${item.data.site||'—'}</strong><span>${item.data.date||'no date'}</span><span>${item.data.river||''}</span></div>
        <div>
          <button class="btn small" data-load="${item.key}" style="background:var(--river); color:#fff;">Load</button>
          <button class="btn small" data-json="${item.key}" style="background:#5E6B60; color:#fff;">JSON</button>
          <button class="btn small" data-remove="${item.key}" style="background:var(--danger); color:#fff;">Delete</button>
        </div>`;
      listEl.appendChild(div);
    });
    listEl.querySelectorAll('[data-load]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await localStore.get(btn.dataset.load);
        applyState(JSON.parse(r.value));
        document.getElementById('savedCard').style.display = 'none';
        showToast('Loaded entry');
      });
    });
    listEl.querySelectorAll('[data-json]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await localStore.get(btn.dataset.json);
        const data = JSON.parse(r.value);
        downloadJSON(data, `discharge_${slugify(data.site)}_${data.date||'nodate'}.json`);
        showToast('JSON downloaded ✓');
      });
    });
    listEl.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await localStore.delete(btn.dataset.remove);
        loadSavedList();
      });
    });
  }catch(e){
    listEl.innerHTML = '<div class="hint">Could not load saved entries.</div>';
    console.error(e);
  }
}

function slugify(s){
  return (s||'entry').toString().trim().replace(/\s+/g,'_').replace(/[^\w\-]/g,'') || 'entry';
}

function downloadJSON(data, filename){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentJSON(){
  const state = collectState();
  downloadJSON(state, `discharge_${slugify(state.site)}_${state.date||'nodate'}.json`);
  showToast('JSON downloaded ✓');
}

function updatePrintPage2Header(){
  const el = document.getElementById('printPage2Header');
  if(!el) return;
  const river = document.getElementById('river').value || '—';
  const site = document.getElementById('site').value || '—';
  const date = document.getElementById('date').value || '—';
  const code = document.getElementById('code').value || '—';
  el.innerHTML = `<span>River: ${river}</span><span>Site: ${site}</span><span>Date: ${date}</span><span>Code: ${code}</span><span>(page 2 of 2)</span>`;
}
window.addEventListener('beforeprint', updatePrintPage2Header);

function exportCurrentPDF(){
  updatePrintPage2Header();
  showToast('Opening print dialog — choose "Save as PDF"');
  setTimeout(() => window.print(), 350);
}

async function exportAllEntries(){
  try{
    const res = await localStore.list('entry:');
    if(!res || !res.keys || res.keys.length === 0){
      showToast('No saved entries to back up yet');
      return;
    }
    const items = await Promise.all(res.keys.map(async k => {
      const r = await localStore.get(k);
      return {key:k, data: JSON.parse(r.value)};
    }));
    items.sort((a,b) => b.key.localeCompare(a.key));
    const bundle = {
      type: 'cwc-discharge-backup',
      exportedAt: new Date().toISOString(),
      count: items.length,
      entries: items.map(i => i.data)
    };
    const stamp = todayISO();
    downloadJSON(bundle, `discharge_backup_ALL_${items.length}entries_${stamp}.json`);
    showToast(`Backed up ${items.length} entr${items.length===1?'y':'ies'} ✓`);
  }catch(e){
    showToast('Backup failed — try again');
    console.error(e);
  }
}

document.getElementById('exportJsonBtn').addEventListener('click', exportCurrentJSON);
document.getElementById('exportPdfBtn').addEventListener('click', exportCurrentPDF);
document.getElementById('backupAllBtn').addEventListener('click', exportAllEntries);

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  let ok = 0;
  for(const file of files){
    try{
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept either a single saved entry, or a "Backup all" bundle containing many entries.
      const entriesToImport = (parsed && parsed.type === 'cwc-discharge-backup' && Array.isArray(parsed.entries))
        ? parsed.entries
        : [parsed];
      for(const data of entriesToImport){
        const key = `entry:${data.site||'site'}:${data.date||'nodate'}:${Date.now()}_${ok}`;
        await localStore.set(key, JSON.stringify(data));
        ok++;
      }
    }catch(err){ console.error('Import failed for', file.name, err); }
  }
  showToast(ok ? `Imported ${ok} entr${ok===1?'y':'ies'} ✓` : 'Import failed — check the file(s)');
  loadSavedList();
  document.getElementById('savedCard').style.display = 'block';
  e.target.value = '';
});

document.getElementById('saveBtn').addEventListener('click', saveEntry);

function todayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function applyDefaults(){
  document.getElementById('river').value = 'Budhi Ghandhak';
  document.getElementById('site').value = 'Chanpatia';
  document.getElementById('locSite').value = '103';
  document.getElementById('date').value = todayISO();
  document.getElementById('fallMetre').value = '0';
  document.getElementById('meanDistGauge').value = '0';
  defaultTime = '40';
  defaultTimeBtn.textContent = 'Default Time: 40s (tap to set 50s for all)';
}

document.getElementById('newBtn').addEventListener('click', () => {
  if(confirm('Clear the form for a new entry?')){
    rows = [newRow(),newRow(),newRow(),newRow(),newRow(),newRow()];
    headerFieldIds.forEach(id => document.getElementById(id).value = '');
    applyDefaults();
    renderRows(); recalcGauge();
  }
});
document.getElementById('toggleSaved').addEventListener('click', () => {
  const card = document.getElementById('savedCard');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
  if(card.style.display === 'block') loadSavedList();
});

if(!document.getElementById('date').value){
  document.getElementById('date').value = todayISO();
}
renderRows();
recalcGauge();
