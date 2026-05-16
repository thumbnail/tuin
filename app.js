// Beplantingsgids — render groups from data/plants.json, manage checkbox state in localStorage.
const STORAGE_KEY = 'beplanting_gids_v1';
let credits = {};

function loadChecks(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveChecks(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function el(tag, props={}, children=[]){
  const e = document.createElement(tag);
  for (const k in props){
    if (k === 'class') e.className = props[k];
    else if (k === 'html') e.innerHTML = props[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else e.setAttribute(k, props[k]);
  }
  for (const c of [].concat(children)){
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function renderPlantCard(plant, groupId, state){
  const key = `${groupId}-${plant.nr}`;
  const isChecked = !!state[key];
  const credit = credits[plant.slug] || {};
  const similar = credit.similar;
  const imgSrc = `assets/plants/${plant.slug}.jpg`;

  const card = el('article', {class: 'plant' + (isChecked ? ' checked' : ''), 'data-key': key, id: `plant-${groupId}-${plant.nr}`});

  const imgWrap = el('div', {class:'plant-img'});
  imgWrap.appendChild(el('img', {src: imgSrc, alt: plant.name, loading:'lazy'}));
  imgWrap.appendChild(el('div', {class:'plant-num', title:'Plantnummer'}, [String(plant.nr)]));
  imgWrap.appendChild(el('div', {class:'plant-qty', title:'Aantal'}, [plant.qty]));
  if (similar) imgWrap.appendChild(el('div', {class:'plant-similar', title:'Vergelijkbare foto, geen exacte cultivar'}, ['vergelijkbare foto']));
  card.appendChild(imgWrap);

  const body = el('div', {class:'plant-body'});
  body.appendChild(el('div', {class:'plant-name'}, [plant.name]));
  const meta = el('div', {class:'plant-meta'});
  if (plant.bloei) meta.appendChild(el('span', {}, [el('span',{class:'lbl'},['Bloei: ']), plant.bloei]));
  if (plant.hoogte) meta.appendChild(el('span', {}, [el('span',{class:'lbl'},['Hoogte: ']), plant.hoogte]));
  body.appendChild(meta);
  card.appendChild(body);

  // Interactive checkbox (hidden when printing)
  const lbl = el('label', {class:'plant-check'});
  const cb = el('input', {type:'checkbox'});
  if (isChecked) cb.setAttribute('checked','checked');
  cb.addEventListener('change', () => {
    const s = loadChecks();
    if (cb.checked) s[key] = true; else delete s[key];
    saveChecks(s);
    card.classList.toggle('checked', cb.checked);
  });
  lbl.appendChild(cb);
  lbl.appendChild(document.createTextNode(cb.checked ? 'Aangevinkt' : 'Aanvinken'));
  cb.addEventListener('change', () => {
    lbl.lastChild.textContent = cb.checked ? 'Aangevinkt' : 'Aanvinken';
  });
  card.appendChild(lbl);

  // Print-only checkbox row
  card.appendChild(el('div', {class:'plant-check-print'}, [`Gecheckt in tuin`]));

  // Credit
  if (credit.source_url) {
    card.appendChild(el('div', {class:'plant-credit'}, [
      el('a', {href: credit.source_url, target:'_blank', rel:'noopener'}, ['Foto-bron'])
    ]));
  }
  return card;
}

function renderGroup(group, state){
  const sec = el('section', {class:'group', id: group.id});
  const header = el('div', {class:'group-header'});

  const title = el('div', {class:'group-title'});
  title.appendChild(el('h2', {}, [group.name]));
  title.appendChild(el('p', {}, [group.description || '']));
  if (group.tree) {
    title.appendChild(el('div', {class:'group-tree'}, [`Boom ${group.tree.label}: ${group.tree.name} (${group.tree.qty})`]));
  }
  title.appendChild(el('div', {class:'group-stats'}, [`${group.plants.length} verschillende planten · totaal ${group.plants.reduce((s,p)=>s+parseInt(p.qty)||0,0)} stuks`]));
  header.appendChild(title);

  if (group.crop) {
    const crop = el('div', {class:'group-crop'});
    crop.appendChild(el('img', {src: group.crop, alt: `Plattegrond ${group.name}`}));
    header.appendChild(crop);
  }
  sec.appendChild(header);

  const grid = el('div', {class:'plant-grid'});
  group.plants.forEach(p => grid.appendChild(renderPlantCard(p, group.id, state)));
  sec.appendChild(grid);
  return sec;
}

async function init(){
  const [data, creditsResp] = await Promise.all([
    fetch('data/plants.json').then(r => r.json()),
    fetch('data/credits.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  credits = creditsResp;
  const state = loadChecks();
  const main = document.getElementById('app');
  main.innerHTML = '';
  data.groups.forEach(g => main.appendChild(renderGroup(g, state)));

  // Trees
  const trees = document.getElementById('trees-list');
  (data.trees_legend || []).forEach(t => {
    const li = el('li', {}, [el('strong',{},[t.label + ': ']), `${t.name} — ${t.qty}`]);
    trees.appendChild(li);
  });

  // Reset
  document.getElementById('reset-checks').addEventListener('click', () => {
    if (!confirm('Alle vinkjes wissen?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
  document.getElementById('check-all').addEventListener('click', () => {
    const s = {};
    data.groups.forEach(g => g.plants.forEach(p => { s[`${g.id}-${p.nr}`] = true; }));
    saveChecks(s);
    location.reload();
  });
}

init().catch(err => {
  document.getElementById('app').innerHTML =
    `<p style="color:#a00;padding:1rem">Kon data niet laden: ${err.message}.<br>Tip: open dit bestand via een lokale server (bv. <code>python3 -m http.server</code>) i.p.v. <code>file://</code>.</p>`;
});
