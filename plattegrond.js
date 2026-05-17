// Interactieve plattegrond — overlay dots op de plattegrond, hover/tap toont inspector,
// gelijke planten (zelfde slug) in alle vakken worden gehighlight.

let DATA, POS, CREDITS = {};
let plantsByNr = new Map();   // nr -> {plant data + group meta}
let bySlug = new Map();        // slug -> [entry, entry, ...]
let activeNr = null;            // pinned by tap on touch
let lastHoverNr = null;
const dotEls = new Map();      // nr -> element
const treeEls = [];

const $ = sel => document.querySelector(sel);

async function load(){
  const [plants, positions, credits] = await Promise.all([
    fetch('data/plants.json').then(r=>r.json()),
    fetch('data/positions.json').then(r=>r.json()),
    fetch('data/credits.json').then(r=>r.ok?r.json():{}).catch(()=>({})),
  ]);
  DATA = plants; POS = positions; CREDITS = credits;

  // Index plants by nr and by slug
  for (const g of DATA.groups){
    for (const p of g.plants){
      const entry = {...p, groupId: g.id, groupName: g.name};
      plantsByNr.set(p.nr, entry);
      if (!bySlug.has(p.slug)) bySlug.set(p.slug, []);
      bySlug.get(p.slug).push(entry);
    }
  }

  renderDots();
  bindFilters();
  updateHeaderVar();
  // Keep dot sizes + header offset responsive
  new ResizeObserver(layoutDots).observe($('#map-img'));
  new ResizeObserver(updateHeaderVar).observe(document.querySelector('.site-header'));
  window.addEventListener('resize', updateHeaderVar);
  $('#map-img').addEventListener('load', layoutDots);
  layoutDots();
}

function updateHeaderVar(){
  const h = document.querySelector('.site-header')?.offsetHeight || 0;
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

function pdfToPct(x, y){
  const b = POS.pdf_bounds;
  return [
    (x - b.x0) / (b.x1 - b.x0) * 100,
    (y - b.y0) / (b.y1 - b.y0) * 100,
  ];
}

function renderDots(){
  const wrap = $('#dots');
  wrap.innerHTML = '';

  // Plant dots — positions[nr] is a list of [x,y] (cluster of dots for one plant)
  for (const [nr, coords] of Object.entries(POS.positions)){
    const n = parseInt(nr, 10);
    const plant = plantsByNr.get(n);
    if (!plant) continue;
    const positions = Array.isArray(coords[0]) ? coords : [coords];  // back-compat
    const elems = [];
    for (const [px, py] of positions){
      const [xp, yp] = pdfToPct(px, py);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'dot';
      el.dataset.nr = n;
      el.dataset.slug = plant.slug;
      el.dataset.group = plant.groupId;
      el.style.left = xp + '%';
      el.style.top = yp + '%';
      el.setAttribute('aria-label', `${plant.name} (#${n})`);
      el.addEventListener('mouseenter', () => onHover(n));
      el.addEventListener('mouseleave', () => onUnhover(n));
      el.addEventListener('focus', () => onHover(n));
      el.addEventListener('blur', () => onUnhover(n));
      el.addEventListener('click', (e) => { e.preventDefault(); onTap(n); });
      wrap.appendChild(el);
      elems.push(el);
    }
    dotEls.set(n, elems);
  }

  // Tree dots
  for (const [id, t] of Object.entries(POS.trees || {})){
    const [xp, yp] = pdfToPct(t.x, t.y);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dot tree';
    el.dataset.tree = id;
    el.dataset.slug = t.slug;
    el.style.left = xp + '%';
    el.style.top = yp + '%';
    el.setAttribute('aria-label', `Boom ${t.label}: ${t.name}`);
    el.addEventListener('mouseenter', () => onTreeHover(id));
    el.addEventListener('mouseleave', () => onUnhover());
    el.addEventListener('click', (e) => { e.preventDefault(); onTreeTap(id); });
    wrap.appendChild(el);
    treeEls.push({el, id, ...t});
  }
}

// Recompute pixel sizes for dots (scale with image width for nicer hit targets on big screens)
function layoutDots(){
  const img = $('#map-img');
  if (!img.naturalWidth) return;
  const w = img.clientWidth;
  // dot is 1.6% of img width by default; convert to fixed px on huge screens so they don't get massive
  // and to a sensible minimum on small screens.
  const px = Math.max(14, Math.min(28, w * 0.018));
  document.querySelectorAll('.dot').forEach(d => {
    d.style.width = px + 'px';
    d.style.height = px + 'px';
  });
  document.querySelectorAll('.dot.tree').forEach(d => {
    d.style.width = (px*1.5) + 'px';
    d.style.height = (px*1.5) + 'px';
  });
}

function onHover(nr){
  lastHoverNr = nr;
  if (activeNr !== null) return; // pinned
  highlight(nr);
  renderInspector(nr);
}
function onUnhover(){
  lastHoverNr = null;
  if (activeNr !== null) return;
  clearHighlight();
  renderEmpty();
}
function onTap(nr){
  if (activeNr === nr){
    activeNr = null;
    clearHighlight();
    renderEmpty();
    return;
  }
  activeNr = nr;
  highlight(nr);
  renderInspector(nr);
}
function onTreeHover(id){
  if (activeNr !== null) return;
  highlightTree(id);
  renderTreeInspector(id);
}
function onTreeTap(id){
  if (activeNr === 't:'+id){
    activeNr = null;
    clearHighlight();
    renderEmpty();
    return;
  }
  activeNr = 't:'+id;
  highlightTree(id);
  renderTreeInspector(id);
}

function setClasses(els, addClass){
  for (const e of els){
    e.classList.remove('is-active','is-related','is-dim');
    if (addClass) e.classList.add(addClass);
  }
}
function highlight(nr){
  const plant = plantsByNr.get(nr);
  if (!plant) return;
  const slug = plant.slug;
  dotEls.forEach((els, n) => {
    let cls = 'is-dim';
    if (n === nr) cls = 'is-active';
    else if (plantsByNr.get(n).slug === slug) cls = 'is-related';
    setClasses(els, cls);
  });
  treeEls.forEach(t => {
    t.el.classList.remove('is-active','is-related','is-dim');
    t.el.classList.add('is-dim');
  });
}
function highlightTree(id){
  const t = (POS.trees||{})[id]; if (!t) return;
  treeEls.forEach(other => {
    other.el.classList.remove('is-active','is-related','is-dim');
    if (other.id === id) other.el.classList.add('is-active');
    else if (other.slug === t.slug) other.el.classList.add('is-related');
    else other.el.classList.add('is-dim');
  });
  dotEls.forEach(els => setClasses(els, 'is-dim'));
}
function clearHighlight(){
  dotEls.forEach(els => setClasses(els, null));
  treeEls.forEach(t => t.el.classList.remove('is-active','is-related','is-dim'));
}

function renderEmpty(){
  $('#inspector').innerHTML = `
    <div class="inspector-empty">
      <h2>Selecteer een plant</h2>
      <p>Hover over een bolletje op de plattegrond, of tik erop. Je ziet hier de plant en alle plekken waar hij voorkomt.</p>
    </div>`;
}

function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderInspector(nr){
  const plant = plantsByNr.get(nr); if (!plant) return;
  const slug = plant.slug;
  const credit = CREDITS[slug] || {};
  const all = (bySlug.get(slug) || []).slice().sort((a,b)=>a.nr-b.nr);
  const totalQty = all.reduce((s,p) => s + (parseInt(p.qty)||0), 0);

  const locItems = all.map(p =>
    `<li class="${p.nr===nr?'current':''}"><b>${escapeHTML(p.groupName)}</b> — #${p.nr} · ${escapeHTML(p.qty)}</li>`
  ).join('');

  $('#inspector').innerHTML = `
    <div class="insp-card">
      <div class="insp-img">
        <img src="assets/plants/${escapeHTML(slug)}.jpg" alt="${escapeHTML(plant.name)}">
        <div class="insp-num">${plant.nr}</div>
        ${credit.similar ? '<div class="insp-similar">vergelijkbare foto</div>' : ''}
      </div>
      <div class="insp-name">${escapeHTML(plant.name)}</div>
      <div class="insp-meta">
        ${plant.bloei ? `<span>Bloei: <b>${escapeHTML(plant.bloei)}</b></span>` : ''}
        ${plant.hoogte ? `<span>Hoogte: <b>${escapeHTML(plant.hoogte)}</b></span>` : ''}
        <span>Aantal op deze plek: <b>${escapeHTML(plant.qty)}</b></span>
        ${all.length>1 ? `<span>Totaal in plan: <b>${totalQty} st</b></span>` : ''}
      </div>
      <div class="insp-locations">
        <h3>${all.length>1 ? `Komt ${all.length}× voor in het plan` : 'Eénmalig in het plan'}</h3>
        <ul>${locItems}</ul>
      </div>
      ${credit.source_url ? `<div class="insp-credit"><a href="${escapeHTML(credit.source_url)}" target="_blank" rel="noopener">Foto-bron</a></div>` : ''}
    </div>`;
}

function renderTreeInspector(id){
  const t = (POS.trees||{})[id]; if (!t) return;
  const credit = CREDITS[t.slug] || {};
  const sameTrees = treeEls.filter(x => x.slug === t.slug);
  const legend = (DATA.trees_legend || []).find(L => L.name === t.name) || {qty:'?'};

  const items = sameTrees.map(x =>
    `<li class="${x.id===id?'current':''}"><b>Boom ${x.label}</b> — positie ${x.id.replace('tree_','')}</li>`
  ).join('');

  $('#inspector').innerHTML = `
    <div class="insp-card">
      <div class="insp-img">
        <img src="assets/plants/${escapeHTML(t.slug)}.jpg" alt="${escapeHTML(t.name)}">
        <div class="insp-num">${t.label}</div>
      </div>
      <div class="insp-name">${escapeHTML(t.name)}</div>
      <div class="insp-meta">
        <span>Totaal in plan: <b>${escapeHTML(legend.qty)}</b></span>
      </div>
      <div class="insp-locations">
        <h3>${sameTrees.length>1 ? `${sameTrees.length} bomen in het plan` : 'Solitair'}</h3>
        <ul>${items}</ul>
      </div>
      ${credit.source_url ? `<div class="insp-credit"><a href="${escapeHTML(credit.source_url)}" target="_blank" rel="noopener">Foto-bron</a></div>` : ''}
    </div>`;
}

function bindFilters(){
  const links = document.querySelectorAll('.group-nav a[data-group], #filter-all');
  links.forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    links.forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    const g = a.dataset.group;
    if (!g){
      document.body.classList.remove('filter-active');
      dotEls.forEach(els => els.forEach(e => e.classList.remove('in-filter')));
    } else {
      document.body.classList.add('filter-active');
      dotEls.forEach(els => els.forEach(e => e.classList.toggle('in-filter', e.dataset.group === g)));
      treeEls.forEach(t => t.el.classList.toggle('in-filter', false));
    }
  }));
}

// Tap outside dots → unpin
document.addEventListener('click', (e) => {
  if (e.target.closest('.dot')) return;
  if (activeNr !== null){
    activeNr = null;
    clearHighlight();
    renderEmpty();
  }
});

load().catch(err => {
  $('#inspector').innerHTML = `<p style="color:#a00">Kon data niet laden: ${err.message}.</p>`;
}).then(() => {
  // Debug deep-link: ?nr=14 pins a plant on load (handy for previews/screenshots).
  const url = new URL(location.href);
  const nr = parseInt(url.searchParams.get('nr') || '', 10);
  if (nr && plantsByNr.has(nr)) onTap(nr);
});
