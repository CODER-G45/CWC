const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f3 = n => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(3);   // avoids "-0.000"
const isBlank = v => String(v ?? '').trim() === '';
const ratingVal = (id, dflt) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? dflt : v; };
let recalcQueued = false;
function scheduleRecalc(){            // batch fast typing into one recalculation per frame
  if(recalcQueued) return;
  recalcQueued = true;
  requestAnimationFrame(() => { recalcQueued = false; recalc(); });
}
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
    cells += `<td><input enterkeyhint="next" data-f="rd" type="number" step="any" value="${esc(r.rd)}"></td>`;
    cells += `<td><input enterkeyhint="next" data-f="depth" type="number" step="any" value="${esc(r.depth)}"></td>`;
    cells += `<td><input enterkeyhint="next" data-f="airCorr" type="number" step="any" value="${esc(r.airCorr)}"></td>`;
    cells += `<td><input enterkeyhint="next" data-f="wetCorr" type="number" step="any" value="${esc(r.wetCorr)}"></td>`;
    cells += `<td><input class="readonly" data-out="corrDepth" readonly value="0.000"></td>`;
    cells += `<td><input class="readonly" data-out="diff" readonly value="0.000"></td>`;
    cells += `<td><input class="readonly" data-out="bedIncr" readonly value="0.000"></td>`;
    cells += `<td><input enterkeyhint="next" data-f="time" type="number" step="any" value="${esc(r.time)}"></td>`;
    cells += `<td><input enterkeyhint="next" data-f="revs" type="number" step="any" value="${esc(r.revs)}"></td>`;
    cells += `<td><input class="readonly" data-out="meanVel" readonly value="0.000"></td>`;
    cells += `<td><input enterkeyhint="next" data-f="corrVel" type="number" step="any" value="${esc(r.corrVel)}" placeholder="= mean vel"></td>`;
    cells += `<td><input class="readonly" data-out="product" readonly value="0.000"></td>`;
    cells += `<td class="remarks"><input enterkeyhint="next" data-f="remarks" value="${esc(r.remarks)}"></td>`;
    cells += `<td><button class="rowbtn" data-del="1" title="Remove row">✕</button></td>`;
    tr.innerHTML = cells;
    vBody.appendChild(tr);
  });
  recalc();
  saveDraftSoon();
}

// One delegated listener per event type instead of one per input
vBody.addEventListener('input', e => {
  const inp = e.target.closest('input[data-f]');
  if(!inp) return;
  const row = rows.find(r => r.id === Number(inp.closest('tr').dataset.id));
  if(row){ row[inp.dataset.f] = inp.value; scheduleRecalc(); }
});
vBody.addEventListener('click', e => {
  const btn = e.target.closest('[data-del]');
  if(!btn) return;
  const id = Number(btn.closest('tr').dataset.id);
  rows = rows.filter(r => r.id !== id);
  if(!rows.length) rows.push(newRow());
  renderRows();
});
// ---- Phone-friendly entry: move between cells without tapping the table ----
const FIELD_LABEL = {rd:'RD', depth:'Depth', airCorr:'Air corr', wetCorr:'Wet corr', time:'Time', revs:'Revs', corrVel:'Corr vel', remarks:'Remarks'};
const entryBar = document.getElementById('entryBar');
let lastCell = null, barTimer;

function focusCell(tr, f){
  const t = tr && tr.querySelector(`input[data-f="${f}"]`);
  if(!t) return;
  t.focus({preventScroll:true});
  if(t.select) t.select();                       // typing overwrites the old value
  t.scrollIntoView({block:'center', inline:'center', behavior:'smooth'});
}
function moveFrom(inp, dir){
  const tr = inp.closest('tr'), f = inp.dataset.f;
  const nextRow = () => {                        // adds a new vertical after the last row
    if(tr.nextElementSibling) return tr.nextElementSibling;
    rows.push(newRow()); renderRows(); return vBody.lastElementChild;
  };
  if(dir === 'down'){ focusCell(nextRow(), f); return; }
  if(dir === 'up'){ focusCell(tr.previousElementSibling, f); return; }
  const cells = [...tr.querySelectorAll('input[data-f]')];
  const nxt = cells[cells.indexOf(inp) + (dir === 'right' ? 1 : -1)];
  if(nxt){ focusCell(tr, nxt.dataset.f); return; }
  if(dir === 'right'){ focusCell(nextRow(), cells[0].dataset.f); return; }
  const p = tr.previousElementSibling;           // left from first field -> last field of previous row
  if(p){ const pc = [...p.querySelectorAll('input[data-f]')]; focusCell(p, pc[pc.length - 1].dataset.f); }
}
vBody.addEventListener('keydown', e => {         // Enter / phone "Next" key = move down the same column
  if(e.key !== 'Enter') return;
  const inp = e.target.closest('input[data-f]');
  if(!inp) return;
  e.preventDefault();
  moveFrom(inp, 'down');
});
vBody.addEventListener('focusin', e => {
  const inp = e.target.closest('input[data-f]');
  if(!inp) return;
  lastCell = inp; clearTimeout(barTimer);
  const idx = [...vBody.children].indexOf(inp.closest('tr')) + 1;
  document.getElementById('entryPos').textContent = `Row ${idx} · ${FIELD_LABEL[inp.dataset.f] || ''}`;
  entryBar.hidden = false; document.body.classList.add('has-entrybar');
});
vBody.addEventListener('focusout', () => {
  clearTimeout(barTimer);
  barTimer = setTimeout(() => { entryBar.hidden = true; document.body.classList.remove('has-entrybar'); }, 250);
});
entryBar.addEventListener('mousedown', e => e.preventDefault());   // keep keyboard open while tapping the bar
entryBar.addEventListener('click', e => {
  const b = e.target.closest('button[data-nav]');
  if(!b) return;
  if(b.dataset.nav === 'add'){ rows.push(newRow()); renderRows(); focusCell(vBody.lastElementChild, 'rd'); return; }
  if(lastCell && lastCell.isConnected) moveFrom(lastCell, b.dataset.nav);
});
if(window.visualViewport){                       // lift the bar above the on-screen keyboard
  const vv = window.visualViewport;
  const place = () => { entryBar.style.transform = `translateY(${-Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px)`; };
  vv.addEventListener('resize', place); vv.addEventListener('scroll', place);
}

function num(v){ const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function recalc(){
  // Sort rows by RD (bank to bank), same as pandas df sorted by "Col 1 (RD)"
  const trs = [...vBody.querySelectorAll('tr')];
  const byId = new Map(rows.map(r => [r.id, r]));
  const all = trs.map(tr => ({tr, row: byId.get(Number(tr.dataset.id))})).filter(x => x.row);
  // Rows with no RD are ignored (blank rows used to sit at RD 0 and corrupt width / area / discharge)
  const ordered = all.filter(x => !isBlank(x.row.rd)).sort((a,b) => num(a.row.rd) - num(b.row.rd));
  all.filter(x => isBlank(x.row.rd)).forEach(x => {
    x.tr.classList.remove('dup');
    ['corrDepth','diff','bedIncr','meanVel','product'].forEach(k => { x.tr.querySelector(`[data-out="${k}"]`).value = '0.000'; });
  });

  let sumDepth = 0, sumBedIncr = 0, sumProduct = 0;
  const rA = ratingVal('ratingA', 0.7014), rB = ratingVal('ratingB', -0.0075);
  document.getElementById('ratingHint').textContent = `V = ${rA}·N/T ${rB < 0 ? '−' : '+'} ${Math.abs(rB)}`;
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

    // Col 14: mean velocity from rating equation V = a x Revolutions / Time + b
    const revs = num(row.revs);
    const time = num(row.time);
    const meanVel = (revs > 0 && time > 0) ? ((rA * revs) / time + rB) : 0;

    // Corr. Vel: user override, else = auto mean vel
    const corrVel = row.corrVel !== '' ? num(row.corrVel) : meanVel;

    // Col 18: Depth * Mean Velocity
    const product = corrDepth * corrVel;

    item.tr.querySelector('[data-out="corrDepth"]').value = f3(corrDepth);
    item.tr.querySelector('[data-out="diff"]').value = f3(diff);
    item.tr.querySelector('[data-out="bedIncr"]').value = f3(bedIncr);
    item.tr.querySelector('[data-out="meanVel"]').value = f3(meanVel);
    item.tr.querySelector('[data-out="product"]').value = f3(product);
    item.tr.classList.toggle('dup', prevRd !== null && width === 0);   // duplicate RD

    sumDepth += corrDepth;
    sumBedIncr += bedIncr;
    sumProduct += product;

    calcRows.push({rd, corrDepth, product, meanVel, leftWidth: width});

    prevDepth = corrDepth;
    prevRd = rd;
  });

  document.getElementById('sumDepth').textContent = f3(sumDepth);
  document.getElementById('sumBedIncr').textContent = f3(sumBedIncr);
  document.getElementById('sumProduct').textContent = f3(sumProduct);

  // Headline = final discharge Q (common-width scaled, end-corrected), same as the Salient Data table
  document.getElementById('totalDischarge').textContent = f3(calcSalientData(calcRows, sumDepth, sumBedIncr, sumProduct));

  drawSection();
}

function calcSalientData(calcRows, sumDepth, sumBedIncr, sumProduct){
  const n = calcRows.length;
  const set = (id, val) => { const el = document.getElementById(id); if(!el) return; if(el.tagName==='SPAN'){ el.textContent = val; } else { el.value = val; } };
  if(n < 2){
    ['sd_total7','sd_total18','sd_width','sd_width2','sd_prodA','sd_prodQ','sd_corrA','sd_corrQ','sd_areaA','sd_dischQ'].forEach(id=>set(id,'0.000'));
    ['sd_surfWidth','sd_wettedP','sd_vMean','sd_vMax','sd_R','sd_chezy','sd_manning','sd_meanDepth','slopeS'].forEach(id=>set(id,'0.000'));
    return 0;
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

  document.getElementById('sd_total7').textContent = f3(sumDepth);
  document.getElementById('sd_total18').textContent = f3(sumProduct);
  document.getElementById('sd_width').textContent = 'x ' + f3(commonWidth);
  document.getElementById('sd_width2').textContent = 'x ' + f3(commonWidth);
  document.getElementById('sd_prodA').textContent = f3(prodA);
  document.getElementById('sd_prodQ').textContent = f3(prodQ);
  document.getElementById('sd_corrA').textContent = f3(totalAreaCorr);
  document.getElementById('sd_corrQ').textContent = f3(totalDischCorr);
  document.getElementById('sd_areaA').textContent = f3(A);
  document.getElementById('sd_dischQ').textContent = f3(Q);

  document.getElementById('sd_surfWidth').value = f3(surfaceWidth);
  document.getElementById('sd_wettedP').value = f3(P);
  document.getElementById('sd_vMean').value = f3(vMean);
  document.getElementById('sd_vMax').value = f3(vMax);
  document.getElementById('sd_R').value = f3(R);
  document.getElementById('slopeS').value = S.toFixed(5);
  document.getElementById('sd_chezy').value = f3(chezy);
  document.getElementById('sd_manning').value = f3(manning);
  document.getElementById('sd_meanDepth').value = f3(meanDepth);
  return Q;
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
  const pBmean = avgNonZero(gaugeVal('pB_lb'), gaugeVal('pB_rb'));
  const pEmean = avgNonZero(gaugeVal('pE_lb'), gaugeVal('pE_rb'));
  const tBmean = avgNonZero(gaugeVal('tB_lb'), gaugeVal('tB_rb'));
  const tEmean = avgNonZero(gaugeVal('tE_lb'), gaugeVal('tE_rb'));
  document.getElementById('pB_mean').textContent = f3(pBmean);
  document.getElementById('pE_mean').textContent = f3(pEmean);
  document.getElementById('tB_mean').textContent = f3(tBmean);
  document.getElementById('tE_mean').textContent = f3(tEmean);
  const pM_lb = avgNonZero(gaugeVal('pB_lb'), gaugeVal('pE_lb'));
  const pM_rb = avgNonZero(gaugeVal('pB_rb'), gaugeVal('pE_rb'));
  const tM_lb = avgNonZero(gaugeVal('tB_lb'), gaugeVal('tE_lb'));
  const tM_rb = avgNonZero(gaugeVal('tB_rb'), gaugeVal('tE_rb'));
  document.getElementById('pM_lb').textContent = f3(pM_lb);
  document.getElementById('pM_rb').textContent = f3(pM_rb);
  document.getElementById('tM_lb').textContent = f3(tM_lb);
  document.getElementById('tM_rb').textContent = f3(tM_rb);
  const pMmean = avgNonZero(pBmean, pEmean);
  const tMmean = avgNonZero(tBmean, tEmean);
  document.getElementById('pM_mean').textContent = f3(pMmean);
  document.getElementById('tM_mean').textContent = f3(tMmean);
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
    .filter(r => !isBlank(r.rd))
    .map(r => ({rd: num(r.rd), depth: num(r.depth) + num(r.airCorr) + num(r.wetCorr)}))
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
  let dots = pts.map(p => `<circle cx="${xScale(p.rd)}" cy="${yScale(p.depth)}" r="3.5" fill="#AD7A2E" stroke="#fff" stroke-width="1"><title>RD ${p.rd} · depth ${p.depth.toFixed(2)} m</title></circle>`).join('');
  const grid = [0.5, 1].map(t => { const y = yScale(maxDepth * t); return `<line x1="${padX}" x2="${W-padX}" y1="${y}" y2="${y}" stroke="#D9D1BB" stroke-dasharray="2,4"/><text x="${W-padX}" y="${y-4}" font-size="14" fill="#5E6B60" text-anchor="end" font-family="IBM Plex Mono">${(maxDepth*t).toFixed(2)} m</text>`; }).join('');
  svg.innerHTML = `
    <path d="${path}" fill="#4F8B98" fill-opacity="0.25" stroke="none"/>
    <path d="${bedLine}" fill="none" stroke="#0E2E36" stroke-width="2"/>
    <path d="${waterLine}" fill="none" stroke="#9CC6CE" stroke-width="1.5" stroke-dasharray="4,3"/>
    ${grid}
    ${dots}
    <text x="${padX}" y="${H-8}" font-size="14" fill="#5E6B60" font-family="IBM Plex Mono">RD ${minRD}</text>
    <text x="${W-padX}" y="${H-8}" font-size="14" fill="#5E6B60" text-anchor="end" font-family="IBM Plex Mono">RD ${maxRD}</text>
  `;
}

// ---- Save / Load using browser localStorage (works when this file is opened directly) ----
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// window.storage only exists inside the Claude.ai artifact sandbox. When this file is
// saved and opened on its own (double-clicked, or opened via file:// / a local server),
// we fall back to the browser's localStorage so Save/Load still works.
const STORAGE_PREFIX = 'cwc_discharge_';
const hasClaudeStorage = (typeof window.storage !== 'undefined');

// Backend (optional). If <apiBase>/health answers, entries are stored on the server;
// otherwise everything stays on this device (localStorage), exactly as before.
const CFG = window.CWC_CONFIG || {};
const API_BASE = String(CFG.apiBase || '').replace(/\/$/, '');
let useApi = false;
async function apiFetch(path, opts = {}, retried = false){
  const headers = {'Content-Type':'application/json'};
  try{ const t = localStorage.getItem('cwc_token'); if(t) headers.Authorization = 'Bearer ' + t; }catch(_){}
  const res = await fetch(API_BASE + path, {...opts, headers});
  if(res.status === 401 && !retried){          // ask for the access code once, then retry
    const code = prompt('Enter the access code for the server:');
    if(code && code.trim()){
      try{ localStorage.setItem('cwc_token', code.trim()); }catch(_){}
      return apiFetch(path, opts, true);
    }
  }
  if(res.status === 401) showToast('Wrong or missing access code');
  if(res.status === 404 && opts.allow404) return null;
  if(!res.ok) throw new Error('API ' + res.status);
  return res.json();
}
const enc = encodeURIComponent;
const api = {
  set: (key, value) => apiFetch(`/entries/${enc(key)}`, {method:'PUT', body:JSON.stringify({value})}),
  get: key => apiFetch(`/entries/${enc(key)}`, {allow404:true}),
  delete: key => apiFetch(`/entries/${enc(key)}`, {method:'DELETE'}),
  list: prefix => apiFetch(`/entries?prefix=${enc(prefix || '')}`)
};
function updateStorageLabel(){
  const el = document.getElementById('storageMode');
  if(el) el.textContent = useApi ? 'Storage: server ✓' : 'Storage: this device only';
}
async function detectBackend(){
  if(API_BASE && location.protocol !== 'file:' && !hasClaudeStorage){
    try{
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
      const res = await fetch(API_BASE + '/health', {signal: ctl.signal});
      clearTimeout(t);
      useApi = res.ok && (await res.json()).ok === true;
    }catch(_){ useApi = false; }
  }
  updateStorageLabel();
}

const localStore = {
  async set(key, value){
    if(useApi) return api.set(key, value);
    if(hasClaudeStorage) return window.storage.set(key, value);
    try{ localStorage.setItem(STORAGE_PREFIX+key, value); return {key, value}; }
    catch(e){ console.error('localStorage set failed', e); return null; }
  },
  async get(key){
    if(useApi) return api.get(key);
    if(hasClaudeStorage) return window.storage.get(key);
    const v = localStorage.getItem(STORAGE_PREFIX+key);
    return v === null ? null : {key, value:v};
  },
  async delete(key){
    if(useApi) return api.delete(key);
    if(hasClaudeStorage) return window.storage.delete(key);
    localStorage.removeItem(STORAGE_PREFIX+key);
    return {key, deleted:true};
  },
  async list(prefix){
    if(useApi) return api.list(prefix);
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
  'pB_lb','pB_rb','pE_lb','pE_rb','tB_lb','tB_rb','tE_lb','tE_rb','fallMetre','meanDistGauge','ratingA','ratingB'];

['fallMetre','meanDistGauge','ratingA','ratingB'].forEach(id => document.getElementById(id).addEventListener('input', recalc));

function collectState(){
  const state = {schema:2, rows, waterCond:'', windVel:''};
  headerFieldIds.forEach(id => { state[id] = document.getElementById(id).value; });
  state.waterCond = document.querySelector('input[name="waterCond"]:checked')?.value || '';
  state.windVel = document.querySelector('input[name="windVel"]:checked')?.value || '';
  return state;
}

function applyState(state){
  rows = state.rows && state.rows.length ? state.rows : [{}];
  rowSeq = Math.max(0, ...rows.map(r => Number(r.id) || 0));
  rows = rows.map(r => ({...newRow(), ...r, id: Number(r.id) || ++rowSeq}));   // repair imported rows
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
    if(!useApi) downloadJSON(state, `discharge_${slugify(state.site)}_${state.date||'nodate'}.json`);
    showToast(useApi ? 'Saved to server ✓' : hasClaudeStorage ? 'Saved ✓' : 'Saved ✓ — also downloaded to your folder');
    loadSavedList();
  }catch(e){
    showToast('Save failed — try again');
    console.error(e);
  }
}

const entryTime = key => Number(String(key).slice(String(key).lastIndexOf(':') + 1).split('_')[0]) || 0;

async function loadSavedList(){
  const listEl = document.getElementById('savedList');
  try{
    const res = await localStore.list('entry:');
    const keys = (res && res.keys) || [];
    const items = (await Promise.all(keys.map(async k => {
      try{ const r = await localStore.get(k); return r ? {key:k, data:JSON.parse(r.value)} : null; }
      catch(_){ return null; }
    }))).filter(Boolean).sort((a,b) => entryTime(b.key) - entryTime(a.key));   // newest saved first
    if(!items.length){ listEl.innerHTML = '<div class="hint">No saved entries yet.</div>'; return; }
    listEl.innerHTML = items.map(({key, data}) => {
      const t = entryTime(key);
      return `<div class="saveditem">
        <div class="meta"><strong>${esc(data.site || '—')}</strong><span>${esc(data.date || 'no date')}</span><span>${esc(data.river || '')}</span>${t ? `<span>saved ${esc(new Date(t).toLocaleString())}</span>` : ''}</div>
        <div>
          <button class="btn small" data-act="load" data-key="${esc(key)}" style="background:var(--river); color:#fff;">Load</button>
          <button class="btn small" data-act="json" data-key="${esc(key)}" style="background:#5E6B60; color:#fff;">JSON</button>
          <button class="btn small" data-act="remove" data-key="${esc(key)}" style="background:var(--danger); color:#fff;">Delete</button>
        </div></div>`;
    }).join('');
  }catch(e){
    listEl.innerHTML = '<div class="hint">Could not load saved entries.</div>';
    console.error(e);
  }
}
document.getElementById('savedList').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]');
  if(!btn) return;
  const key = btn.dataset.key;
  if(btn.dataset.act === 'remove'){
    if(!confirm('Delete this saved entry?')) return;
    await localStore.delete(key);
    loadSavedList();
    return;
  }
  try{
    const r = await localStore.get(key);
    const data = JSON.parse(r.value);
    if(btn.dataset.act === 'load'){
      applyState(data);
      document.getElementById('savedCard').style.display = 'none';
      showToast('Loaded entry');
    }else{
      downloadJSON(data, `discharge_${slugify(data.site)}_${data.date||'nodate'}.json`);
      showToast('JSON downloaded ✓');
    }
  }catch(err){ showToast('Could not open that entry'); console.error(err); }
});

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
  el.replaceChildren(...[`River: ${river}`, `Site: ${site}`, `Date: ${date}`, `Code: ${code}`, '(page 2 of 2)'].map(t => { const sp = document.createElement('span'); sp.textContent = t; return sp; }));
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
  document.getElementById('ratingA').value = '0.7014';
  document.getElementById('ratingB').value = '-0.0075';
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

document.getElementById('sortRows').addEventListener('click', () => {
  rows.sort((a,b) => (isBlank(a.rd) - isBlank(b.rd)) || (num(a.rd) - num(b.rd)));
  renderRows();
  showToast('Sorted by RD');
});

// ---- Auto-saved draft: survives accidental refresh / tab close ----
const DRAFT_KEY = STORAGE_PREFIX + 'draft:current';
let draftTimer;
function saveDraftSoon(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(collectState())); }catch(_){} }, 600);
}
document.addEventListener('input', saveDraftSoon);

if(!document.getElementById('date').value){
  document.getElementById('date').value = todayISO();
}
let restored = false;
try{
  const d = localStorage.getItem(DRAFT_KEY);
  if(d){ applyState(JSON.parse(d)); restored = true; showToast('Restored your unsaved draft'); }
}catch(_){ restored = false; }
if(!restored){ renderRows(); recalcGauge(); }
detectBackend().then(() => { if(document.getElementById('savedCard').style.display === 'block') loadSavedList(); });
