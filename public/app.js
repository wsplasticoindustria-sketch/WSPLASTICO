'use strict';
// ---------- util ----------
const $app = document.getElementById('app');
let CFG = null, ME = null;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(2)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const num = (v, d = 0) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const kg = v => (v == null || v === '' ? '' : num(v, 1));
const dec = v => (v == null || v === '' ? '' : String(v).replace('.', ','));
const pn = v => Number(String(v == null ? '' : v).replace(',', '.')) || 0;
const dt = s => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
const hoje = () => new Date().toISOString().slice(0, 10);
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
const dias = d => Math.max(0, Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 864e5));
const diasTxt = n => (n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`);
const iniciais = s => (s || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

// ---------- logo da empresa (public/logo.png) ----------
const logoImg = cls => h('div', { class: 'lg ' + cls }, h('img', { class: 'n', src: '/logo.png', alt: CFG ? CFG.empresa : 'Logo' }), h('img', { class: 'c', src: '/logo-claro.png', alt: '' }));

// ---------- icones ----------
const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  board: '<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/>',
  building: '<path d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M2 21h20M8 8h2M8 12h2M8 16h2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.300 2.300 3.700 5.200"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>', right: '<path d="M5 12h14M13 6l6 6-6 6"/>', left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>', moon: '<path d="M21 13.500A8.500 8.500 0 1110.500 3a7 7 0 0010.500 10.500z"/>',
  refresh: '<path d="M20 11a8 8 0 00-14.500-3M4 5v4h4M4 13a8 8 0 0014.500 3M20 19v-4h-4"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.600 7.600L20 18M8.600 16.400L20 6"/>', truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.800"/><circle cx="17" cy="18" r="1.800"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>', done: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>',
  bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 016 0v2"/>', roll: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.500"/>', sheet: '<path d="M4 6h16v12H4z"/><path d="M4 10h16"/>',
  weight: '<path d="M5 8h14l1.500 11h-17z"/><path d="M9 8a3 3 0 016 0"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
  tag: '<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.600"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>',
  chat: '<path d="M21 12a8 8 0 01-11.800 7L4 20l1.100-4.600A8 8 0 1121 12z"/><path d="M9 10h6M9 13.500h4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>', link: '<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1"/>'
};
function ic(n, s = 18) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  e.setAttribute('viewBox', '0 0 24 24'); e.setAttribute('width', s); e.setAttribute('height', s); e.setAttribute('class', 'ic'); e.innerHTML = IC[n] || ''; return e;
}
const ETAPAS = [
  { s: 'Aberta', i: 'clipboard', acao: 'Iniciar extrusão' }, { s: 'Em extrusão', i: 'layers', acao: 'Enviar para corte e solda' },
  { s: 'Em corte e solda', i: 'scissors', acao: 'Marcar como pronta' }, { s: 'Pronta', i: 'done', acao: 'Marcar como entregue' }, { s: 'Entregue', i: 'truck' }
];
const etapa = s => ETAPAS.find(e => e.s === s) || { s, i: 'clipboard' };
const PROX = Object.fromEntries(ETAPAS.slice(0, 4).map((e, i) => [e.s, ETAPAS[i + 1].s]));
const ANT = Object.fromEntries(ETAPAS.slice(1).map((e, i) => [e.s, ETAPAS[i].s]));
// papel "producao": so enxerga as etapas que o administrador liberou e anda uma etapa para frente ou para tras
const ehProd = () => ME.papel === 'producao';
const podeEditar = () => ME.papel !== 'producao' && ME.papel !== 'vendedor';   // vendedor: so consulta OPs, clientes e precos
const etapasVisiveis = () => ehProd() ? ETAPAS.filter(e => ME.etapas.includes(e.s)) : ETAPAS;
const podeAvancar = o => ME.papel !== 'vendedor' && !!PROX[o.status] && (!ehProd() || PROX[o.status] !== 'Entregue' || ME.etapas.includes('Entregue'));
const pill = s => h('span', { class: 'pill st-' + slug(s), text: s });

// ---------- tema / toast / dialogo ----------
function aplicaTema() { const t = lsGet('op_tema'); if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
function alternaTema() {
  const escuro = document.documentElement.getAttribute('data-theme') === 'dark' || (!lsGet('op_tema') && matchMedia('(prefers-color-scheme: dark)').matches);
  lsSet('op_tema', escuro ? 'light' : 'dark'); aplicaTema();
}
aplicaTema();
function toast(t, tipo) { const e = h('div', { class: 'toast' }, ic(tipo === 'erro' ? 'alert' : 'check', 18), t); document.body.append(e); setTimeout(() => e.remove(), 2800); }
function confirmar(titulo, msg, ok = 'Confirmar') {
  return new Promise(res => {
    const d = h('dialog', {}, h('h3', { text: titulo }), h('p', { text: msg }), h('div', { class: 'acts' },
      h('button', { class: 'btn', text: 'Voltar', onclick: () => { d.close(); res(false); } }), h('button', { class: 'btn pri', text: ok, onclick: () => { d.close(); res(true); } })));
    d.addEventListener('close', () => { d.remove(); res(false); }); document.body.append(d); d.showModal();
  });
}

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  if (r.status === 401 && !url.endsWith('/login')) { ME = null; renderLogin(); throw new Error('Sessão expirada'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.erro || 'Erro ' + r.status); e.desafio = !!j.desafio; throw e; }
  return j;
}
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- paginacao ----------
const TAMANHOS = [10, 20, 50, 100];
const tamanhoSalvo = () => { const n = Number(lsGet('op_porpagina')); return TAMANHOS.includes(n) ? n : 20; };
function paginas(atual, total) {          // ex.: 1 … 4 5 [6] 7 8 … 36
  const s = new Set([0, total - 1, atual - 1, atual, atual + 1]); if (atual < 3) { s.add(1); s.add(2); } if (atual > total - 4) { s.add(total - 2); s.add(total - 3); }
  const l = [...s].filter(n => n >= 0 && n < total).sort((a, b) => a - b), out = [];
  l.forEach((n, i) => { if (i && n - l[i - 1] > 1) out.push('…'); out.push(n); }); return out;
}
// estado = { pagina, limite }; onChange() deve recarregar a lista
function pager(estado, total, onChange) {
  const np = Math.max(1, Math.ceil(total / estado.limite)), de = total ? estado.pagina * estado.limite + 1 : 0, ate = Math.min(total, (estado.pagina + 1) * estado.limite);
  const ir = n => { estado.pagina = n; onChange(); };
  const btn = (txt, n, opc = {}) => h('button', { class: 'pg' + (opc.on ? ' on' : ''), disabled: opc.dis, 'aria-label': opc.rot, 'aria-current': opc.on ? 'page' : null, onclick: () => ir(n) }, txt);
  const sel = h('select', { class: 'sel', 'aria-label': 'Itens por página', onchange: e => { estado.limite = Number(e.target.value); lsSet('op_porpagina', estado.limite); estado.pagina = 0; onChange(); } },
    TAMANHOS.map(n => h('option', { value: n, text: n + ' por página', selected: n === estado.limite })));
  return h('div', { class: 'pager' }, h('span', { class: 'info', text: total ? `Mostrando ${num(de)}–${num(ate)} de ${num(total)}` : 'Nenhum resultado' }),
    np > 1 ? h('div', { class: 'pgs' }, btn(ic('left', 16), estado.pagina - 1, { dis: estado.pagina === 0, rot: 'Anterior' }),
      paginas(estado.pagina, np).map(n => n === '…' ? h('span', { class: 'gap', text: '…' }) : btn(String(n + 1), n, { on: n === estado.pagina, rot: 'Página ' + (n + 1) })),
      btn(ic('right', 16), estado.pagina + 1, { dis: estado.pagina >= np - 1, rot: 'Próxima' })) : h('span'), sel);
}

// ---------- login ----------
const HERO_ART = '<svg class="art" viewBox="0 0 640 640" fill="none"><g stroke="#5eead4" stroke-opacity=".22" stroke-width="2"><circle cx="320" cy="320" r="300"/><circle cx="320" cy="320" r="240"/><circle cx="320" cy="320" r="180"/><circle cx="320" cy="320" r="120"/></g><circle cx="320" cy="320" r="60" fill="#5eead4" fill-opacity=".14"/><g fill="#5eead4" fill-opacity=".18"><rect x="120" y="110" width="110" height="150" rx="14"/><rect x="250" y="70" width="110" height="190" rx="14"/></g></svg>';
// "Nao sou um robo": o navegador resolve uma prova de trabalho (pow.js) antes de enviar a senha; sem isso o servidor recusa o login
function resolveDesafio(token, bits) {
  return new Promise((ok, falha) => {
    const prefixo = token.split('.')[0], n = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)), ws = [];
    const fim = () => { clearTimeout(t); ws.forEach(w => w.terminate()); };
    const t = setTimeout(() => { fim(); falha(new Error('tempo esgotado')); }, 90000);
    for (let i = 0; i < n; i++) {
      const w = new Worker('/pow.js'); ws.push(w);
      w.onmessage = e => { fim(); ok(String(e.data)); };
      w.onerror = () => { fim(); falha(new Error('erro na verificação')); };
      w.postMessage({ prefixo, bits, inicio: i, passo: n });
    }
  });
}
function renderLogin(msg) {
  const u = h('input', { autocomplete: 'username', autofocus: true, placeholder: 'Seu usuário', autocapitalize: 'none', spellcheck: false }), s = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Sua senha' });
  const hp = h('input', { name: 'site', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });   // isca: pessoas nao veem nem preenchem
  const err = h('div', { class: 'msg-err', role: 'alert', text: msg || '' }), btn = h('button', { class: 'btn pri', type: 'submit', style: { width: '100%', minHeight: '46px' } }, 'Entrar', ic('right', 18));
  let prova = null, estado = 'idle', timer = null;
  const caixa = h('span', { class: 'cx' }), rotulo = h('span', { class: 'tx' }), humano = h('button', { type: 'button', class: 'humano', role: 'checkbox', onclick: () => verifica() }, caixa, h('span', { class: 'tt' }, rotulo, h('small', { text: 'Verificação de segurança' })), ic('shield', 24));
  const pinta = () => {
    humano.className = 'humano ' + estado; humano.setAttribute('aria-checked', String(estado === 'ok'));
    caixa.replaceChildren(...(estado === 'work' ? [h('i', { class: 'spin' })] : estado === 'ok' ? [ic('check', 16)] : []));
    rotulo.textContent = estado === 'work' ? 'Verificando…' : estado === 'ok' ? 'Verificado' : estado === 'erro' ? 'Falhou. Toque para tentar de novo' : 'Não sou um robô';
  };
  async function verifica() {
    if (estado === 'work' || estado === 'ok') return;
    estado = 'work'; prova = null; pinta();
    try { const d = await api('GET', '/api/desafio'); prova = { desafio: d.token, nonce: await resolveDesafio(d.token, d.bits) }; estado = 'ok'; clearTimeout(timer); timer = setTimeout(() => { prova = null; estado = 'idle'; pinta(); }, 4 * 60e3); }
    catch { estado = 'erro'; }
    pinta();
  }
  pinta();
  for (const c of [u, s]) c.addEventListener('input', () => { if (estado === 'idle') verifica(); }, { once: true });   // ja comeca a verificar quando a pessoa digita
  const f = h('form', { autocomplete: 'on', onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    if (!prova) { err.textContent = 'Marque "Não sou um robô" para continuar.'; if (estado === 'idle' || estado === 'erro') verifica(); return; }
    btn.disabled = true; const p = prova; prova = null; estado = 'idle'; pinta();
    try { ME = await api('POST', '/api/login', { usuario: u.value, senha: s.value, desafio: p.desafio, nonce: p.nonce, site: hp.value }); location.hash = '#/painel'; boot(); }
    catch (x) { err.textContent = x.message; s.value = ''; s.focus(); verifica(); }   // cada desafio vale 1 vez: ja prepara o proximo
    finally { btn.disabled = false; }
  } }, logoImg('lgm auto'), h('h2', { text: 'Bem-vindo de volta' }), h('p', { text: 'Entre para acompanhar a produção.' }),
    h('label', { class: 'field' }, h('span', { class: 'l', text: 'Usuário' }), h('div', { class: 'inp' }, u)),
    h('label', { class: 'field' }, h('span', { class: 'l', text: 'Senha' }), h('div', { class: 'inp' }, s)), h('div', { class: 'hp' }, hp), humano, btn, err,
    h('div', { class: 'hint' }, ic('shield', 16), 'Acesso protegido. Use seu usuário e a senha de acesso do sistema.'),
    null);
  const hero = h('div', { class: 'hero' });
  hero.insertAdjacentHTML('afterbegin', HERO_ART);
  hero.append(h('div', { class: 'brandrow' }, logoImg('lgh auto')),
    h('div', {}, h('h1', { text: 'Ordens de produção, do pedido à entrega.' }),
      h('ul', {}, ['Ficha digital igual à de papel, sem rasuras', 'Acompanhe extrusão, corte e solda e entrega', 'Total por cliente na hora, pronto para imprimir'].map(t => h('li', {}, ic('check', 18), t)))),
    h('small', { text: 'Clientes e usuários vêm do Serp, somente leitura.' }));
  $app.replaceChildren(h('div', { class: 'login' }, hero, h('div', { class: 'loginbox' }, f)));
}

// ---------- shell ----------
function shell(ativo, conteudo) {
  const links = ehProd() ? [['ordens', 'Ordens', 'board']] : [['painel', 'Painel', 'home'], ['ordens', 'Ordens', 'board'], ['clientes', 'Clientes', 'building'], ['precos', 'Preços', 'tag'], ['relatorio', 'Relatório', 'chart']];
  if (ME.papel === 'admin') links.push(['usuarios', 'Usuários', 'users']);
  const papel = { admin: 'Administrador', escritorio: 'Escritório', vendedor: 'Vendedor', producao: 'Produção' }[ME.papel];
  const cnt = h('span', { class: 'cnt', hidden: true }), syncTxt = h('div', {}, 'Verificando…'), syncDot = h('span', { class: 'dot off' });
  const sair = async () => { await api('POST', '/api/logout', {}); ME = null; renderLogin(); };
  const botTema = h('button', { title: 'Tema claro/escuro', onclick: alternaTema }, ic('moon', 18)), botSair = h('button', { title: 'Sair', onclick: sair }, ic('logout', 18));
  const side = h('aside', { class: 'side' },
    h('div', { class: 'brand' }, logoImg('lgs auto'), h('small', { text: 'Ordem de Produção' + (CFG.versao ? ' · v' + CFG.versao : '') })),
    h('nav', {}, links.map(([k, t, i]) => h('a', { href: '#/' + k, class: ativo === k ? 'on' : '' }, ic(i, 19), t, k === 'ordens' ? cnt : null))),
    h('div', { class: 'sp' }), ehProd() ? null : h('div', { class: 'sync' }, syncDot, syncTxt),
    h('div', { class: 'usercard' }, h('div', { class: 'avatar', text: iniciais(ME.usuario) }), h('div', {}, h('b', { text: ME.usuario.toLowerCase() }), h('small', { text: papel })), h('div', { class: 'ib' }, botTema, botSair)));
  const mtop = h('div', { class: 'mtop' }, logoImg('lgt auto'), h('b', { text: 'Ordem de Produção' }),
    h('div', { class: 'ib' }, h('button', { onclick: alternaTema }, ic('moon', 18)), h('button', { onclick: sair }, ic('logout', 18))));
  const tab = h('nav', { class: 'tabbar' }, links.map(([k, t, i]) => h('a', { href: '#/' + k, class: ativo === k ? 'on' : '' }, ic(i, 22), t)));
  $app.replaceChildren(h('div', { class: 'layout' }, side, h('div', {}, mtop, h('main', { class: 'content fade' }, conteudo))), tab);
  api('GET', '/api/resumo').then(r => {
    const n = r.porStatus.filter(x => ehProd() ? x.status !== 'Entregue' : ['Aberta', 'Em extrusão', 'Em corte e solda'].includes(x.status)).reduce((a, x) => a + x.n, 0);
    if (n) { cnt.textContent = n; cnt.hidden = false; }
    if (!r.sync) return;
    const sy = r.sync, velho = sy.ultimoOk && Date.now() - Date.parse(sy.ultimoOk) > 3600e3;
    syncDot.className = 'dot' + (!sy.ativo || velho ? ' off' : sy.erro ? ' err' : '');
    syncTxt.textContent = !sy.ativo ? 'Serp: aguardando 1ª sincronização' : sy.erro ? 'Serp: falha na última leitura' : `Serp · ${num(sy.clientes)} clientes · ${atras(sy.ultimoOk)}`;
  }).catch(() => {});
}
function atras(iso) {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : new Date(iso).toLocaleDateString('pt-BR');
}
function pageHead(titulo, sub, acoes, voltar) {
  return h('div', {}, voltar ? h('a', { class: 'crumb', href: voltar[0] }, ic('left', 16), voltar[1]) : null,
    h('div', { class: 'ph' }, h('div', { class: 'grow' }, h('h1', { text: titulo }), sub ? h('p', { text: sub }) : null), h('div', { class: 'acts' }, acoes)));
}
function vazio(titulo, texto) { return h('div', { class: 'empty' }, ic('clipboard', 54), h('b', { text: titulo }), texto); }

function tempoRel(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora'; if (min < 60) return 'há ' + min + ' min';
  const hr = Math.round(min / 60); if (hr < 24) return 'há ' + hr + ' h';
  const d = Math.round(hr / 24); return d === 1 ? 'há 1 dia' : 'há ' + d + ' dias';
}
const fraseAtiv = a => a.acao === 'Criada' ? 'criou a OP' : a.acao === 'Status' ? 'moveu para ' + String(a.detalhe || '').split('→').pop().trim() : 'editou ' + (a.detalhe || 'a OP');

// ---------- painel ----------
async function viewPainel() {
  const [r, ab, ult, atv] = await Promise.all([api('GET', '/api/resumo'), api('GET', '/api/ordens?limite=500&status=' + encodeURIComponent('Aberta,Em extrusão,Em corte e solda,Pronta')), api('GET', '/api/ordens?limite=8'), api('GET', '/api/atividade?limite=4')]);
  const por = Object.fromEntries(r.porStatus.map(x => [x.status, x]));
  const hora = new Date().getHours(), saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const pipe = h('div', { class: 'pipe', style: { marginBottom: '18px' } }, ETAPAS.map(e => h('a', { class: 'stage st-' + slug(e.s), href: '#/ordens?status=' + encodeURIComponent(e.s) },
    h('div', { class: 't' }, ic(e.i, 18), e.s), h('b', { text: num((por[e.s] || {}).n || 0) }), h('small', { text: kg((por[e.s] || {}).kg || 0) + ' kg pedidos' }))));
  const prontas = ab.linhas.filter(o => o.status === 'Pronta').sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5);
  const antigas = ab.linhas.filter(o => o.status !== 'Pronta').sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5);
  const itemLista = (o, rot) => h('a', { href: '#/ordem/' + o.id, class: 'cellrow', style: { padding: '10px 0', borderBottom: '1px solid var(--bd)', color: 'inherit' } },
    h('div', { class: 'initials', text: iniciais(o.cliente_nome) }), h('div', { style: { flex: '1', minWidth: 0 } }, h('div', { class: 'main', style: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: o.cliente_nome }),
      h('div', { class: 'sub', text: `OP ${o.numero} · ${produtoTxt(o)}` })), h('div', { style: { textAlign: 'right' } }, pill(o.status), h('div', { class: 'sub', text: rot })));
  shell('painel', [
    pageHead(`${saud}, ${ME.usuario.toLowerCase()}`, new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
      podeEditar() ? h('a', { class: 'btn pri', href: '#/ordem/novo' }, ic('plus', 18), 'Nova OP') : null), pipe,
    h('div', { class: 'grid cols2' },
      h('div', {}, h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('weight', 17)), 'Produção do mês'),
        h('div', { class: 'cols4s' },
          h('div', { class: 'stat' }, h('div', { class: 'ico' }, ic('weight', 22)), h('div', {}, h('b', { text: kg(r.mes.kg) }), h('span', { text: 'kg cortados' }))),
          h('div', { class: 'stat' }, h('div', { class: 'ico' }, ic('box', 22)), h('div', {}, h('b', { text: num(r.mes.pac) }), h('span', { text: 'pacotes' }))),
          h('div', { class: 'stat' }, h('div', { class: 'ico' }, ic('scissors', 22)), h('div', {}, h('b', { text: kg(r.mes.aparas) }), h('span', { text: 'kg de aparas' }))),
          h('div', { class: 'stat' }, h('div', { class: 'ico' }, ic('truck', 22)), h('div', {}, h('b', { text: num(r.mes.entregues) }), h('span', { text: 'OPs entregues' }))))),
        h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('clock', 17)), 'Movimentações recentes'),
          atv.length ? atv.map(a => h('a', { href: '#/ordem/' + a.ordem_id, class: 'cellrow', style: { padding: '10px 0', borderBottom: '1px solid var(--bd)', color: 'inherit' } },
            h('div', { class: 'initials', text: iniciais(a.usuario || '?') }),
            h('div', { style: { flex: '1', minWidth: 0 } },
              h('div', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, h('b', { text: String(a.usuario || '').toLowerCase(), style: { textTransform: 'capitalize' } }), ' ' + fraseAtiv(a)),
              h('div', { class: 'sub', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: 'OP ' + a.numero + ' · ' + a.cliente_nome })),
            h('div', { class: 'sub', style: { whiteSpace: 'nowrap' }, text: tempoRel(a.quando) }))) : h('div', { class: 'sub', text: 'Ainda não há movimentações.' }))
      ),
      h('div', {},
        h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('truck', 17)), 'Prontas aguardando entrega', h('small', { text: String(prontas.length ? ab.linhas.filter(o => o.status === 'Pronta').length : 0) })),
          prontas.length ? prontas.map(o => itemLista(o, diasTxt(dias(o.data)))) : h('div', { class: 'sub', text: 'Nenhuma OP pronta esperando entrega.' })),
        h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('alert', 17)), 'Em andamento há mais tempo'),
          antigas.length ? antigas.map(o => itemLista(o, diasTxt(dias(o.data)))) : h('div', { class: 'sub', text: 'Nada em andamento.' })))),
    h('h3', { style: { margin: '4px 0 12px' }, text: 'Últimas ordens' }), tabelaOrdens(ult.linhas, { compacta: innerWidth < 1400 })]);
}

// ---------- listas de ordens ----------
function medidas(o) { const p = [o.largura, o.comprimento].filter(x => x != null).map(x => num(x, x % 1 ? 1 : 0)); return p.length ? p.join(' × ') : ''; }
function produtoTxt(o) { return [o.litros ? o.litros + ' L' : null, o.reforco, o.formato].filter(Boolean).join(' · ') || o.produto; }
function qtd(p, k) { return [p != null ? num(p) + ' pct' : '', k != null ? kg(k) + ' kg' : ''].filter(Boolean).join(' · '); }
const SEL = new Set();   // OPs marcadas na lista (imprimir fichas / agrupar)
function tabelaOrdens(linhas, opc = {}) {
  if (!linhas.length) return h('div', { class: 'tw' }, vazio('Nenhuma ordem encontrada', 'Ajuste os filtros ou crie uma nova OP.'));
  const cp = !!opc.compacta;
  return h('div', { class: 'tw' + (cp ? ' compact' : '') }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', { text: 'OP' }), opc.semCliente ? null : h('th', { text: 'Cliente' }), h('th', { text: 'Produto' }), cp ? null : h('th', { text: 'Medidas' }), h('th', { class: 'n', text: 'Pedido' }), cp ? null : h('th', { class: 'n', text: 'Produzido' }), h('th', { text: 'Status' }))),
    h('tbody', {}, linhas.map(o => h('tr', { class: 'click', onclick: () => (location.hash = '#/ordem/' + o.id) },
      h('td', {}, opc.selecionavel ? h('input', { type: 'checkbox', class: 'selk', checked: SEL.has(o.id), 'aria-label': 'Selecionar OP ' + o.numero, onclick: e => e.stopPropagation(), onchange: e => { e.target.checked ? SEL.add(o.id) : SEL.delete(o.id); if (opc.onSel) opc.onSel(); } }) : null,
        h('span', { class: 'opn', text: o.numero }), h('span', { class: 'sub2', text: dt(o.data) }), o.grupo_n > 1 ? h('span', { class: 'grp', title: 'Grupo ' + o.grupo }, ic('link', 12), 'grupo ' + o.grupo + ' · ' + o.grupo_n + ' OPs') : null),
      opc.semCliente ? null : h('td', {}, h('div', { class: 'cellrow' }, h('div', { class: 'initials', text: iniciais(o.cliente_nome) }), h('span', { class: 'main', text: o.cliente_nome }))),
      h('td', {}, h('span', { class: 'main', text: produtoTxt(o) }), h('span', { class: 'sub2', text: [o.cor, o.espessura != null ? 'esp ' + num(o.espessura, 2) : ''].filter(Boolean).join(' · ') })),
      cp ? null : h('td', { text: medidas(o) }), h('td', { class: 'n', text: cp ? (o.qtd_kg != null ? kg(o.qtd_kg) + ' kg' : '') : qtd(o.qtd_pacote, o.qtd_kg) }), cp ? null : h('td', { class: 'n', text: qtd(o.corte_pacotes, o.corte_kg) || '—' }),
      h('td', {}, pill(o.status), o.entregue_em ? h('span', { class: 'sub2', text: 'em ' + dt(o.entregue_em) }) : null))))));
}
function cartao(o, recarrega) {
  const pct = o.qtd_kg ? Math.min(100, Math.round(((o.corte_kg || 0) / o.qtd_kg) * 100)) : 0, prox = PROX[o.status];
  const pode = podeAvancar(o), ant = ehProd() ? ANT[o.status] : null;
  const mover = novo => async e => { e.stopPropagation(); try { await api('PUT', '/api/ordens/' + o.id, { status: novo }); toast(`OP ${o.numero}: ${novo}`); recarrega(); } catch (x) { toast(x.message, 'erro'); } };
  return h('div', { class: 'kcard st-' + slug(o.status), draggable: !TOQUE && ME.papel !== 'vendedor', onclick: () => (location.hash = '#/ordem/' + o.id),
    ondragstart: e => { e.dataTransfer.setData('text/plain', o.id + '|' + o.status); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); },
    ondragend: e => e.currentTarget.classList.remove('dragging') },
    h('div', { class: 'top' }, h('span', { class: 'opn', text: 'OP ' + o.numero }), h('span', { class: 'topd' }, h('span', { class: 'sub', text: diasTxt(dias(o.data)) }),
      podeEditar() ? h('a', { class: 'dup', href: '#/ordem/lote?copiar=' + o.id, title: 'Duplicar esta OP', 'aria-label': 'Duplicar a OP ' + o.numero, draggable: false, onclick: e => e.stopPropagation() }, ic('copy', 15)) : null)), h('div', { class: 'cli', text: o.cliente_nome }),
    h('div', { class: 'tags' }, [o.litros ? o.litros + ' L' : null, o.reforco, o.formato].filter(Boolean).map(t => h('span', { class: 'tag', text: t })), o.grupo_n > 1 ? h('span', { class: 'tag grp' }, ic('link', 11), 'grupo ' + o.grupo_n) : null),
    h('div', { class: 'meta' }, h('span', { text: [medidas(o), o.cor].filter(Boolean).join(' · ') }), h('span', { class: 'num', text: o.qtd_kg != null ? kg(o.qtd_kg) + ' kg' : '' })),
    o.qtd_kg ? h('div', { class: 'mini' }, h('i', { style: { width: pct + '%' } })) : null,
    pode || ant ? h('div', { class: 'kact' },
      ant ? h('button', { class: 'btn sm ghost back', title: 'Voltar para ' + ant, 'aria-label': 'Voltar para ' + ant, onclick: mover(ant) }, ic('left', 15), 'Voltar') : null,
      pode ? h('button', { class: 'btn sm go', onclick: mover(prox) }, etapa(o.status).acao, ic('right', 15)) : null) : null);
}
// quadro: limite de cartoes por coluna (configuravel) e arrastar para mudar de etapa
const TOQUE = matchMedia('(pointer:coarse)').matches;   /* mobile */
const LIMITES_COLUNA = [5, 10, 20, 50, 100], MOSTRAR = {};
const limiteColuna = () => { const n = Number(lsGet('op_limcol')); return LIMITES_COLUNA.includes(n) ? n : 10; };
let ETAPA_MOB = null;   /* mobile3 */
function quadro(linhas, recarrega) {
  const lim = limiteColuna();
  const ET = etapasVisiveis();
  if (!ET.some(e => e.s === ETAPA_MOB)) ETAPA_MOB = (ET.find(e => linhas.some(o => o.status === e.s)) || ET[0] || ETAPAS[0]).s;
  const board = h('div', { class: 'board n' + ET.length }, ET.map(e => {
    const todas = linhas.filter(o => o.status === e.s), vis = MOSTRAR[e.s] || lim, l = todas.slice(0, vis);
    const col = h('div', { class: 'col st-' + slug(e.s) },
      h('h4', {}, ic(e.i, 17), e.s, h('span', { class: 'cn', text: todas.length })),
      h('div', { class: 'colbody' }, l.length ? l.map(o => cartao(o, recarrega)) : h('div', { class: 'colempty', text: (TOQUE ? 'Nenhuma OP nesta etapa' : 'Nenhuma OP — arraste um cartão para cá') })),
      todas.length > l.length ? h('div', { class: 'more' },
        h('button', { class: 'btn sm', onclick: () => { MOSTRAR[e.s] = vis + lim; recarrega(); } }, 'Mostrar mais ' + Math.min(lim, todas.length - l.length)),
        h('a', { class: 'sub', href: '#/ordens?status=' + encodeURIComponent(e.s), text: `Ver todas (${todas.length}) na lista` })) : null);
    col.addEventListener('dragover', ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; col.classList.add('over'); });
    col.addEventListener('dragleave', ev => { if (!col.contains(ev.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', async ev => {
      ev.preventDefault(); col.classList.remove('over');
      const [id, de] = ev.dataTransfer.getData('text/plain').split('|'); if (!id || de === e.s) return;
      try { await api('PUT', '/api/ordens/' + id, { status: e.s }); toast('OP movida para ' + e.s); } catch (x) { toast(x.message, 'erro'); }
      recarrega();
    });
    return col;
  }));
  const abas = h('div', { class: 'stabs' }, ET.map(e => h('button', { type: 'button', class: 'stab st-' + slug(e.s), onclick: () => { ETAPA_MOB = e.s; aplica(); } },
    h('span', { class: 'cn', text: linhas.filter(o => o.status === e.s).length }), e.s)));
  const aplica = () => {
    abas.querySelectorAll('.stab').forEach((b, i) => b.classList.toggle('on', ET[i].s === ETAPA_MOB));
    board.querySelectorAll('.col').forEach((c, i) => c.classList.toggle('ativa', ET[i].s === ETAPA_MOB));
  };
  aplica();
  return h('div', { class: 'bwrap' }, abas, board);
}
async function viewOrdens(qs) {
  Object.keys(MOSTRAR).forEach(k => delete MOSTRAR[k]); SEL.clear();
  const par = new URLSearchParams(qs);
  const st = new Set((par.get('status') || '').split(',').filter(Boolean));
  const f = { q: par.get('q') || '', de: par.get('de') || '', ate: par.get('ate') || '', grupo: par.get('grupo') || '' };
  let modo = par.get('status') || par.get('grupo') ? 'lista' : (lsGet('op_modo') || 'quadro');
  const resumo = await api('GET', '/api/resumo'); const porSt = Object.fromEntries(resumo.porStatus.map(x => [x.status, x.n]));
  const box = h('div'), tot = h('div', { class: 'total' }), csvBtn = h('a', { class: 'btn', download: '' }, ic('download', 17), 'Exportar Excel');
  const chipsEl = h('div', { class: 'chips' }), pagEl = h('div'), pg = { pagina: 0, limite: tamanhoSalvo() };
  const filtra = () => { pg.pagina = 0; carrega(); };
  async function carrega() {
    const p = new URLSearchParams(); if (f.q) p.set('q', f.q); if (f.de) p.set('de', f.de); if (f.ate) p.set('ate', f.ate); if (f.grupo) p.set('grupo', f.grupo);
    csvBtn.href = '/api/export/ordens.csv?' + p;
    if (modo === 'lista') { if (st.size) p.set('status', [...st].join(',')); }
    if (modo === 'lista') { p.set('limite', pg.limite); p.set('pagina', pg.pagina); } else p.set('limite', '1000');
    const r = await api('GET', '/api/ordens?' + p);
    tot.replaceChildren(h('span', {}, h('b', { text: num(r.total) }), ' ordens'), h('span', {}, h('b', { text: kg(r.kgPedido) }), ' kg pedidos'), h('span', {}, h('b', { text: kg(r.kgProduzido) }), ' kg produzidos'),
      ...(modo === 'lista' && podeEditar() && r.linhas.length ? [h('button', { class: 'btn sm ghost', onclick: () => { r.linhas.forEach(o => SEL.add(o.id)); atualizaSel(); carrega(); } }, 'Selecionar esta página')] : []));
    if (modo === 'lista') { box.replaceChildren(tabelaOrdens(r.linhas, { selecionavel: podeEditar(), onSel: atualizaSel })); pagEl.replaceChildren(pager(pg, r.total, carrega)); }
    else { pagEl.replaceChildren(); box.replaceChildren(quadro(r.linhas, carrega)); }
  }
  const pintaChips = () => chipsEl.replaceChildren(...CFG.status.filter(s => !ehProd() || ME.etapas.includes(s)).map(s => h('button', { class: 'chip st-' + slug(s) + (st.has(s) ? ' on' : ''), onclick: () => { st.has(s) ? st.delete(s) : st.add(s); pintaChips(); filtra(); } }, s, h('span', { class: 'cn', text: porSt[s] || 0 }))));
  pintaChips();
  const limSel = h('select', { class: 'sel', 'aria-label': 'Cartões por coluna', onchange: e => { lsSet('op_limcol', e.target.value); Object.keys(MOSTRAR).forEach(k => delete MOSTRAR[k]); carrega(); } },
    LIMITES_COLUNA.map(n => h('option', { value: n, text: n + ' por coluna', selected: n === limiteColuna() })));
  const selInfo = h('b');
  const atualizaSel = () => { barSel.hidden = !SEL.size; selInfo.textContent = SEL.size + (SEL.size === 1 ? ' OP selecionada' : ' OPs selecionadas'); };
  const barSel = h('div', { class: 'selbar', hidden: true }, selInfo,
    h('button', { class: 'btn sm', onclick: async () => { try { await dialogoFichas((await api('GET', '/api/ordens?limite=100&ids=' + [...SEL].join(','))).linhas, 'Imprimir fichas selecionadas'); } catch (e) { toast(e.message, 'erro'); } } }, ic('print', 15), 'Imprimir fichas'),
    h('button', { class: 'btn sm pri', onclick: async () => { if (SEL.size < 2) return toast('Marque 2 ou mais OPs para agrupar', 'erro'); try { const g = await api('POST', '/api/ordens/agrupar', { ids: [...SEL] }); SEL.clear(); atualizaSel(); toast('OPs agrupadas (grupo ' + g.grupo + ')'); carrega(); } catch (e) { toast(e.message, 'erro'); } } }, ic('link', 15), 'Agrupar'),
    h('button', { class: 'btn sm ghost', onclick: () => { SEL.clear(); atualizaSel(); carrega(); } }, 'Limpar'));
  const limEl = h('div', { class: 'lim' }, limSel);
  const seg = h('div', { class: 'seg' }, [['quadro', 'Quadro', 'board'], ['lista', 'Lista', 'list']].map(([m, t, i]) => h('button', { class: modo === m ? 'on' : '', onclick: () => { modo = m; lsSet('op_modo', m); seg.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', ['quadro', 'lista'][k] === m)); chipsEl.hidden = m !== 'lista'; limEl.hidden = m !== 'quadro'; dicaEl.hidden = m !== 'quadro'; filtra(); } }, ic(i, 16), t)));
  const busca = h('input', { placeholder: 'Buscar cliente, nº da OP, cor…', value: f.q, oninput: debounce(e => { f.q = e.target.value; filtra(); }) });
  const de = h('input', { type: 'date', value: f.de, onchange: e => { f.de = e.target.value; filtra(); } }), ate = h('input', { type: 'date', value: f.ate, onchange: e => { f.ate = e.target.value; filtra(); } });
  chipsEl.hidden = modo !== 'lista'; limEl.hidden = modo !== 'quadro';
  const dicaEl = h('div', { class: 'sub', style: { margin: '-4px 2px 12px' }, hidden: modo !== 'quadro', text: TOQUE ? 'Escolha a etapa acima. Toque no botão do cartão para avançar a OP.' : 'Arraste um cartão para outra coluna para mudar a etapa da OP.' });
  shell('ordens', [pageHead('Ordens de produção', ehProd() ? (ME.etapas.length ? 'Suas etapas: ' + ME.etapas.join(', ') + '.' : 'Nenhuma etapa liberada para você. Fale com o administrador.') : 'Acompanhe cada pedido da extrusão à entrega.', [ehProd() ? null : csvBtn, podeEditar() ? h('a', { class: 'btn', href: '#/ordem/lote' }, ic('copy', 17), 'Lançar várias') : null, podeEditar() ? h('a', { class: 'btn pri', href: '#/ordem/novo' }, ic('plus', 18), 'Nova OP') : null]),
    h('div', { class: 'tools' }, seg, limEl, h('div', { class: 'inp search' }, ic('search', 18), busca), h('div', { class: 'inp' }, de), h('span', { class: 'sub', text: 'até' }), h('div', { class: 'inp' }, ate)),
    f.grupo ? h('div', { class: 'note' }, ic('link', 18), 'Mostrando só o grupo ' + f.grupo + '. ', h('a', { href: '#/ordens' }, 'Ver todas as OPs')) : null,
    chipsEl, dicaEl, tot, box, pagEl, barSel]);
  await carrega();
}

// ---------- consulta avancada de clientes (modal) ----------
function lupaClientes(onPick) {
  return h('button', { class: 'lupa', type: 'button', title: 'Consulta avançada', 'aria-label': 'Consulta avançada de clientes', onclick: () => consultaClientes(onPick) }, ic('search', 18));
}
function consultaClientes(onPick) {
  const f = {}, res = h('div', { class: 'avres' }), info = h('div', { class: 'sub' });
  const busca = debounce(async () => {
    const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
    if (!qs) { res.replaceChildren(h('div', { class: 'sub', text: 'Preencha um ou mais filtros para consultar.' })); info.textContent = ''; return; }
    const r = await api('GET', '/api/clientes?limite=50&comOrdens=0' + qs);
    info.textContent = r.total > 50 ? `Mostrando 50 de ${num(r.total)} — refine os filtros.` : num(r.total) + (r.total === 1 ? ' cliente' : ' clientes');
    res.replaceChildren(...(r.linhas.length ? r.linhas.map(c => h('button', { type: 'button', class: 'avrow', onclick: () => { d.close(); onPick(c); } }, h('b', { text: c.nome }), h('small', { text: ['cód. ' + c.cod, c.cidade ? c.cidade + '/' + (c.uf || '') : '', c.doc, c.telefone].filter(Boolean).join(' · ') }))) : [h('div', { class: 'sub', text: 'Nenhum cliente encontrado.' })]));
  }, 250);
  const campo = (k, rot, ph, max) => h('label', { class: 'avc' }, h('span', { text: rot }), h('input', { placeholder: ph || '', maxlength: max, autocomplete: 'off', oninput: e => { f[k] = e.target.value.trim(); busca(); } }));
  const sit = h('select', { onchange: e => { f.situacao = e.target.value; busca(); } }, [['', 'Qualquer'], ['andamento', 'Com OP em andamento'], ['pronta', 'Com OP pronta'], ['entregue', 'Com OP entregue'], ['sem', 'Sem nenhuma OP']].map(([v, t]) => h('option', { value: v, text: t })));
  const d = h('dialog', { class: 'avdlg' }, h('h3', { text: 'Consulta avançada de clientes' }),
    h('div', { class: 'avanc' }, campo('nome', 'Nome / razão social'), campo('cod', 'Código'), campo('doc', 'CPF / CNPJ', 'só números'), campo('tel', 'Telefone'), campo('cidade', 'Cidade'), campo('uf', 'UF', 'SP', 2), h('label', { class: 'avc' }, h('span', { text: 'Situação das OPs' }), sit)),
    info, res, h('div', { class: 'acts', style: { marginTop: '14px' } }, h('button', { class: 'btn', text: 'Fechar', onclick: () => d.close() })));
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); busca();
  d.querySelector('input').focus();
}

// ---------- ficha (formulario) ----------
function clienteAuto(E, desab, onPick) {
  const inp = h('input', { placeholder: 'Digite para buscar no Serp…', value: E.cliente_nome || '', disabled: desab, autocomplete: 'off' });
  const lst = h('div', { class: 'lst', hidden: true }), link = h('div', { class: 'linked' });
  const mostra = () => { const ok = !!E.cliente_cod; link.className = 'linked' + (ok ? ' ok' : ''); link.replaceChildren(ic(ok ? 'check' : 'info', 15), ok ? `Cliente do Serp · cód. ${E.cliente_cod}` : (E.cliente_nome ? 'Digitado manualmente (não vinculado ao Serp)' : 'Escolha um cliente da lista')); };
  const busca = debounce(async () => {
    E.cliente_nome = inp.value; E.cliente_cod = null; mostra(); if (onPick && !inp.value.trim()) onPick();
    if (inp.value.trim().length < 2) { lst.hidden = true; return; }
    const r = (await api('GET', '/api/clientes?limite=10&q=' + encodeURIComponent(inp.value.trim()))).linhas;
    lst.replaceChildren(...r.map(c => h('div', { onmousedown: e => { e.preventDefault(); E.cliente_cod = c.cod; E.cliente_nome = c.nome; inp.value = c.nome; lst.hidden = true; mostra(); if (onPick) onPick(); } }, c.nome, h('small', { text: [c.cidade ? c.cidade + '/' + (c.uf || '') : '', c.doc].filter(Boolean).join(' · ') }))));
    lst.hidden = !r.length;
  }, 200);
  inp.addEventListener('input', busca); inp.addEventListener('blur', () => setTimeout(() => (lst.hidden = true), 150)); mostra();
  return h('div', { class: 'ac' }, h('label', { class: 'field' }, h('span', { class: 'l', text: 'Cliente' }), h('div', { class: 'inp' + (desab ? ' dis' : '') }, desab ? ic('building', 18) : lupaClientes(c => { E.cliente_cod = c.cod; E.cliente_nome = c.nome; inp.value = c.nome; mostra(); if (onPick) onPick(); }), inp)), lst, link);
}
function campoCor(E, desab) {   // lista fixa de cores; se a OP antiga tem outra cor, ela continua aparecendo
  const extra = E.cor && !LISTA_CORES.some(c => c.toLowerCase() === String(E.cor).toLowerCase()) ? [E.cor] : [];
  const atual = LISTA_CORES.find(c => c.toLowerCase() === String(E.cor || '').toLowerCase()) || E.cor || '';
  return h('label', { class: 'field' }, h('span', { class: 'l', text: 'Cor' }), h('div', { class: 'inp' + (desab ? ' dis' : '') },
    h('select', { disabled: desab, onchange: e => { E.cor = e.target.value || null; } }, h('option', { value: '', text: '—' }), [...LISTA_CORES, ...extra].map(c => h('option', { value: c, text: c, selected: c === atual })))));
}
function tilesLitros(E, desab) {
  const el = h('div', { class: 'tiles' }); const pinta = () => el.replaceChildren(...CFG.litros.map(l => h('button', { type: 'button', disabled: desab, class: 'tile' + (E.litros === l ? ' on' : ''), onclick: () => { E.litros = E.litros === l ? null : l; pinta(); } }, h('big', { text: l }), h('small', { text: 'litros' }))));
  pinta(); return h('div', { class: 'opt' }, h('b', { text: 'Saco p/ lixo — capacidade' }), el);
}
function segmento(rot, lista, E, k, desab) {
  const el = h('div', { class: 'seg wrap' }); const pinta = () => el.replaceChildren(...lista.map(o => h('button', { type: 'button', disabled: desab, class: E[k] === o ? 'on' : '', text: o, onclick: () => { E[k] = E[k] === o ? null : o; pinta(); } })));
  pinta(); return h('div', { class: 'opt' }, h('b', { text: rot }), el);
}
function tilesFormato(E, desab) {
  const el = h('div', { class: 'tiles' }); const icones = { Capa: 'sheet', Sacola: 'bag', Bobina: 'roll' };
  const pinta = () => el.replaceChildren(...CFG.formatos.map(f => h('button', { type: 'button', disabled: desab, class: 'tile' + (E.formato === f ? ' on' : ''), onclick: () => { E.formato = E.formato === f ? null : f; pinta(); } }, ic(icones[f] || 'box', 24), h('span', { text: f }))));
  pinta(); return h('div', { class: 'opt', style: { marginBottom: 0 } }, h('b', { text: 'Formato' }), el);
}

async function viewOrdem(id, qs) {
  const nova = id === 'novo';
  const o = nova ? { data: hoje(), produto: 'Saco p/ lixo', status: 'Aberta', historico: [] } : await api('GET', '/api/ordens/' + id);
  if (nova && qs) { const c = new URLSearchParams(qs).get('cliente'); if (c) { try { const r = await api('GET', '/api/clientes/' + c); o.cliente_cod = r.cliente.cod; o.cliente_nome = r.cliente.nome; } catch { /* segue sem vincular */ } } }
  const irmas = !nova && o.grupo_n > 1 ? (await api('GET', '/api/ordens?grupo=' + o.grupo + '&limite=100')).linhas.reverse() : [];
  const prod = ehProd(), leitura = ME.papel === 'vendedor', bloq = leitura || (o.status === 'Cancelada' && ME.papel !== 'admin'), dEsc = prod || bloq;
  const dExt = bloq || (prod && o.status !== 'Em extrusão'), dCor = bloq || (prod && o.status !== 'Em corte e solda');   // producao preenche so a etapa em que a OP esta
  const E = { ...o };
  const campo = (rot, k, op = {}) => {
    const dis = op.dis !== undefined ? op.dis : dEsc;
    return h('label', { class: 'field' }, h('span', { class: 'l', text: rot }), h('div', { class: 'inp' + (dis ? ' dis' : '') },
      h('input', { type: 'text', inputMode: op.dec ? 'decimal' : (op.int ? 'numeric' : null), value: dec(E[k]), disabled: dis, oninput: e => { E[k] = e.target.value; atualiza(); } }), op.suf ? h('span', { class: 'suf', text: op.suf }) : null));
  };
  const progBar = h('i'), progLbl = h('div', { class: 'lbl' }), aparas = h('div', { class: 'sub', style: { marginTop: '10px' } });
  function atualiza() {
    const ped = pn(E.qtd_kg), pro = pn(E.corte_kg), pct = ped ? Math.min(100, Math.round((pro / ped) * 100)) : 0;
    progBar.style.width = pct + '%'; progLbl.replaceChildren(h('span', { text: `${kg(pro)} kg cortados` }), h('span', { text: `${pct}% de ${kg(ped)} kg` }));
    const ext = pn(E.ext_kg), ap = pn(E.corte_aparas_kg); aparas.textContent = ext && E.corte_aparas_kg !== '' && E.corte_aparas_kg != null ? `Aparas: ${num((ap / ext) * 100, 1)}% do que foi extrusado` : '';
  }
  async function salvar(extra = {}) {
    try {
      const corpo = { ...E, ...extra }; for (const k of ['historico', 'id', 'numero', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']) delete corpo[k];
      const r = nova ? await api('POST', '/api/ordens', corpo) : await api('PUT', '/api/ordens/' + id, corpo);
      if (!nova && prod && !ME.etapas.includes(r.status)) { toast(`OP ${r.numero} enviada para ${r.status}`); location.hash = '#/ordens'; return; }   // saiu das etapas do usuario: some da lista dele
      toast('OP ' + r.numero + ' salva'); if (nova) location.hash = '#/ordem/' + r.id; else viewOrdem(id);
    } catch (e) { toast(e.message, 'erro'); }
  }
  const grupoBanner = irmas.length > 1 ? h('div', { class: 'card grpcard' }, h('h3', {}, h('span', { class: 'ico' }, ic('link', 17)), 'Grupo ' + o.grupo, h('small', { text: irmas.length + ' OPs deste cliente' })),
    h('div', { class: 'grpchips' }, irmas.map(x => h('a', { class: 'grpchip st-' + slug(x.status) + (x.id === o.id ? ' on' : ''), href: '#/ordem/' + x.id }, h('b', { text: 'OP ' + x.numero }),
      h('span', { text: [x.litros ? x.litros + ' L' : '', x.qtd_pacote != null ? x.qtd_pacote + ' pct' : ''].filter(Boolean).join(' · ') || x.produto }), pill(x.status)))),
    h('div', { class: 'acts', style: { justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: '14px', flexDirection: 'row' } },
      h('button', { class: 'btn sm', onclick: () => dialogoFichas(irmas, 'Imprimir fichas do grupo ' + o.grupo) }, ic('print', 15), 'Imprimir fichas do grupo'),
      !podeEditar() ? null : h('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmar('Tirar esta OP do grupo?', 'Ela continua existindo; só deixa de ficar junto das outras.', 'Tirar do grupo')) { try { await api('POST', '/api/ordens/desagrupar', { id: o.id }); toast('OP fora do grupo'); viewOrdem(id); } catch (e) { toast(e.message, 'erro'); } } } }, 'Tirar do grupo'))) : null;
  const idx = ETAPAS.findIndex(e => e.s === o.status), cancelada = o.status === 'Cancelada';
  const stepper = h('div', {}, ETAPAS.map((e, i) => h('div', { class: `step st-${slug(e.s)} ${nova ? (i === 0 ? 'cur' : '') : (cancelada ? '' : i < idx ? 'done' : i === idx ? 'cur' : '')}` },
    h('div', { class: 'bub' }, (!nova && !cancelada && i < idx) ? ic('check', 16) : ic(e.i, 16)), h('div', {}, h('b', { text: e.s }), h('small', { text: !nova && i === idx ? 'Etapa atual' : '' })))));
  const prox = PROX[o.status];
  const stSel = h('select', { class: 'sel', disabled: bloq || nova, style: { width: '100%' }, onchange: e => (E.status = e.target.value) }, CFG.status.filter(s => !prod || s === o.status || (s === PROX[o.status] && podeAvancar(o)) || s === ANT[o.status]).map(s => h('option', { value: s, text: s, selected: s === E.status })));
  const savebar = leitura ? null : h('div', { class: 'savebar' },
    !nova && podeAvancar(o) ? h('button', { class: 'btn', disabled: bloq, onclick: () => salvar({ status: prox }) }, etapa(o.status).acao, ic('right', 17)) : null,
    h('button', { class: 'btn pri', disabled: bloq, onclick: () => salvar() }, ic('check', 18), 'Salvar'));
  const aside = h('aside', {},
    h('div', { class: 'card' }, h('h3', { text: 'Andamento' }), nova ? h('div', { class: 'sub', style: { marginBottom: '14px' }, text: 'A OP começa como "Aberta". O número é gerado ao salvar.' }) : null, stepper,
      cancelada ? h('div', { class: 'note warn', style: { marginTop: '14px', marginBottom: 0 } }, ic('alert', 18), 'OP cancelada.') : null,
      o.entregue_em ? h('div', { class: 'sub', style: { marginTop: '12px' }, text: 'Entregue em ' + dt(o.entregue_em) }) : null,
      h('div', { class: 'actions' },
        leitura ? null : h('button', { class: 'btn pri', disabled: bloq, onclick: () => salvar() }, ic('check', 18), 'Salvar'),
        !nova && podeAvancar(o) ? h('button', { class: 'btn', disabled: bloq, onclick: () => salvar({ status: prox }) }, etapa(o.status).acao, ic('right', 17)) : null,
        !nova && prod && ANT[o.status] ? h('button', { class: 'btn', onclick: () => salvar({ status: ANT[o.status] }) }, ic('left', 17), 'Voltar para ' + ANT[o.status].toLowerCase()) : null,
        !nova ? h('button', { class: 'btn', onclick: () => imprimeFicha({ ...E, numero: o.numero }) }, ic('print', 17), 'Imprimir ficha') : null,
        !nova && podeEditar() && o.status !== 'Cancelada' && o.status !== 'Entregue' ? h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmar('Cancelar esta OP?', `A OP ${o.numero} ficará como cancelada e deixará de entrar nos totais.`, 'Cancelar OP')) salvar({ status: 'Cancelada' }); } }, 'Cancelar OP') : null),
      !nova && !leitura ? h('label', { class: 'field', style: { marginTop: '16px' } }, h('span', { class: 'l', text: 'Alterar status manualmente' }), stSel) : null),
    h('div', { class: 'card' }, h('h3', { text: 'Resultado' }), h('div', { class: 'prog' }, h('div', { class: 'bar' }, progBar), progLbl), aparas),
    nova ? null : h('div', { class: 'card' }, h('h3', { text: 'Histórico' }), h('div', { class: 'hist' }, (o.historico || []).map(x => h('div', {}, h('b', { text: x.acao }), x.detalhe ? ' — ' + x.detalhe : '', h('br'), `${new Date(x.quando).toLocaleString('pt-BR')} · ${x.usuario || ''}`)))));
  shell('ordens', [
    pageHead(nova ? 'Nova ordem de produção' : 'OP nº ' + o.numero, nova ? 'Preencha como na ficha de papel.' : `${o.cliente_nome} · criada em ${dt(o.data)}`, nova ? [] : [pill(o.status), !podeEditar() ? null : h('a', { class: 'btn', href: '#/ordem/lote?copiar=' + o.id }, ic('copy', 17), 'Duplicar'), !podeEditar() ? null : h('button', { class: 'btn', onclick: () => compartilhar({ tipo: 'ordem', ref: o.id, clienteCod: o.cliente_cod, titulo: 'Enviar acompanhamento da OP ' + o.numero, mensagem: l => 'Olá! Acompanhe o andamento do seu pedido nº ' + o.numero + ' da ' + CFG.empresa + ' por este link: ' + l }) }, ic('chat', 17), 'Enviar ao cliente')], ['#/ordens', 'Ordens']),
    grupoBanner,
    prod ? h('div', { class: 'note' }, ic('info', 18), 'Perfil Produção: você preenche Extrusão e Corte e solda e avança a etapa.') : null,
    h('div', { class: 'sheet' + (prod ? ' prodrole' : '') }, h('div', { class: 'fcol' },   /* mobile2 */
      h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('clipboard', 17)), 'Pedido'),
        h('div', { class: 'row r3', style: { marginBottom: '14px' } }, h('label', { class: 'field' }, h('span', { class: 'l', text: 'Nº' }), h('div', { class: 'inp dis' }, h('input', { value: nova ? 'automático' : o.numero, disabled: true }))),
          h('label', { class: 'field' }, h('span', { class: 'l', text: 'Data' }), h('div', { class: 'inp' + (dEsc ? ' dis' : '') }, h('input', { type: 'date', value: E.data, disabled: dEsc, onchange: e => (E.data = e.target.value) }))), clienteAuto(E, dEsc))),
      h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('bag', 17)), 'Produto'), tilesLitros(E, dEsc), segmento('Reforço', CFG.reforcos, E, 'reforco', dEsc), tilesFormato(E, dEsc)),
      h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'ico' }, ic('weight', 17)), 'Medidas e quantidade'),
        h('div', { class: 'row' }, campo('Largura', 'largura', { dec: 1, suf: 'cm' }), campo('Comprimento', 'comprimento', { dec: 1, suf: 'cm' }), campo('Espessura', 'espessura', { dec: 1 }), campo('Gramatura', 'gramatura', { dec: 1 }), campoCor(E, dEsc),
          campo('Qnt de pacote', 'qtd_pacote', { int: 1, suf: 'pct' }), campo('Qnt de Kg', 'qtd_kg', { dec: 1, suf: 'kg' })),
        h('label', { class: 'field', style: { marginTop: '14px' } }, h('span', { class: 'l', text: 'Obs.' }), h('textarea', { class: 'ta', disabled: dEsc, oninput: e => (E.obs = e.target.value) }, E.obs || ''))),
      h('div', { class: 'card pcard' }, h('h3', {}, h('span', { class: 'ico' }, ic('layers', 17)), 'Extrusão'), h('div', { class: 'row' }, campo('Qnt de bobina', 'ext_bobinas', { int: 1, dis: dExt }), campo('Kg total', 'ext_kg', { dec: 1, suf: 'kg', dis: dExt }), campo('Extrusor', 'ext_extrusor', { dis: dExt }))),
      h('div', { class: 'card pcard' }, h('h3', {}, h('span', { class: 'ico' }, ic('scissors', 17)), 'Corte e solda'), h('div', { class: 'row' }, campo('Pacotes', 'corte_pacotes', { int: 1, suf: 'pct', dis: dCor }), campo('Kg total', 'corte_kg', { dec: 1, suf: 'kg', dis: dCor }), campo('Aparas', 'corte_aparas_kg', { dec: 1, suf: 'kg', dis: dCor })))), aside), savebar]);
  atualiza();
}

// ---------- resumo de producao ----------
const LISTA_CORES = ['Marrom', 'Amarelo', 'Azul', 'Verde', 'Preto', 'Vermelho', 'Leitoso', 'Branco', 'Laranja'];
const CORES = { leitoso: '#efe8d6', preto: '#1f2933', azul: '#2563eb', verde: '#16a34a', vermelho: '#dc2626', amarelo: '#eab308', branco: '#f8fafc', transparente: '#cbd5e1', cinza: '#94a3b8', laranja: '#f97316', rosa: '#ec4899', roxo: '#7c3aed', marrom: '#92400e' };
const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const isoLocal = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
function periodoRapido(tipo) {
  const d = new Date();
  if (tipo === 'mes') return { de: isoLocal(new Date(d.getFullYear(), d.getMonth(), 1)), ate: isoLocal(d) };
  if (tipo === 'anterior') return { de: isoLocal(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ate: isoLocal(new Date(d.getFullYear(), d.getMonth(), 0)) };
  if (tipo === '30') return { de: isoLocal(new Date(d.getTime() - 29 * 864e5)), ate: isoLocal(d) };
  return { de: '', ate: '' };
}
function tabelaGrupo(titulo, linhas, tot, tipo) {
  if (!linhas || !linhas.length) return null;
  const ord = tipo === 'litros' ? [...linhas].sort((a, b) => (parseInt(a.chave) || 9999) - (parseInt(b.chave) || 9999)) : linhas;
  const nome = r => tipo === 'cor' ? h('span', { class: 'cellrow' }, h('i', { class: 'sw', style: { background: CORES[r.chave] || 'transparent', borderColor: CORES[r.chave] ? 'transparent' : 'var(--bd2)' } }), cap(r.chave))
    : tipo === 'status' ? pill(r.chave) : tipo === 'clientes' ? r.chave : r.chave;
  const col = ['Item', 'OPs', 'Pacotes pedidos', 'Kg pedidos', 'Pacotes produzidos', 'Kg produzidos', 'Kg entregues', '% do total'];
  const itemR = (rotulo, r, pc, total) => h('div', { class: 'ri' + (total ? ' tot' : '') },
    h('div', { class: 'rh' }, h('b', {}, rotulo), h('span', { class: 'sub', text: num(r.ops) + (r.ops === 1 ? ' OP' : ' OPs') })),
    h('div', { class: 'rg' }, [['Pedido', r.kg_ped, r.pac_ped], ['Produzido', r.kg_prod, r.pac_prod], ['Entregue', r.kg_ent, r.pac_ent]].map(([t, k, p]) =>
      h('div', {}, h('small', { text: t }), h('b', { text: kg(k) + ' kg' }), h('span', { text: num(p) + ' pct' })))),
    total ? null : h('div', { class: 'share' }, h('div', { class: 'mini' }, h('i', { style: { width: Math.min(100, pc) + '%' } })), h('span', { text: num(pc, 0) + '% do total' })));
  const rl = h('div', { class: 'rl' }, itemR('Total', tot, 100, true), ord.map(r => itemR(nome(r), r, tot.kg_ped ? (r.kg_ped / tot.kg_ped) * 100 : 0, false)));
  return h('div', { class: 'card' }, h('h3', { text: titulo }), rl, h('div', { class: 'tw flat' }, h('table', {},
    h('thead', {}, h('tr', {}, col.map((t, i) => h('th', { class: i ? 'n' : '', text: t })))),
    h('tbody', {}, ord.map(r => { const pc = tot.kg_ped ? (r.kg_ped / tot.kg_ped) * 100 : 0;
      return h('tr', {}, h('td', {}, h('span', { class: 'main' }, nome(r))), h('td', { class: 'n', text: num(r.ops) }), h('td', { class: 'n', text: num(r.pac_ped) }), h('td', { class: 'n', text: kg(r.kg_ped) }),
        h('td', { class: 'n', text: num(r.pac_prod) }), h('td', { class: 'n', text: kg(r.kg_prod) }), h('td', { class: 'n', text: kg(r.kg_ent) }),
        h('td', { class: 'n' }, h('div', { class: 'share' }, h('div', { class: 'mini' }, h('i', { style: { width: Math.min(100, pc) + '%' } })), h('span', { text: num(pc, 0) + '%' })))); }),
      h('tr', { class: 'tot' }, h('td', { text: 'Total' }), h('td', { class: 'n', text: num(tot.ops) }), h('td', { class: 'n', text: num(tot.pac_ped) }), h('td', { class: 'n', text: kg(tot.kg_ped) }),
        h('td', { class: 'n', text: num(tot.pac_prod) }), h('td', { class: 'n', text: kg(tot.kg_prod) }), h('td', { class: 'n', text: kg(tot.kg_ent) }), h('td', { class: 'n', text: '100%' }))))));
}
function desenhaResumo(d) {
  const t = d.totais;
  if (!t.ops) return h('div', { class: 'card' }, vazio('Nenhuma ordem neste filtro', 'Escolha outro período ou outro cliente.'));
  const kpi = (rot, pac, kgv, ico, extra) => h('div', { class: 'kpi2' }, h('div', { class: 'ico' }, ic(ico, 20)), h('div', {}, h('span', { text: rot }), h('b', { text: kg(kgv) + ' kg' }), h('small', { text: extra || num(pac) + ' pacotes' })));
  const perda = t.kg_prod ? 'Perda de ' + num((t.aparas / t.kg_prod) * 100, 1) + '% do que foi cortado' : 'sem corte ainda';
  return h('div', {}, h('div', { class: 'kp4' }, kpi('Pedido (' + num(t.ops) + ' OPs)', t.pac_ped, t.kg_ped, 'clipboard'), kpi('Produzido', t.pac_prod, t.kg_prod, 'scissors'), kpi('Entregue', t.pac_ent, t.kg_ent, 'truck'), kpi('Aparas', 0, t.aparas, 'alert', perda)),
    tabelaGrupo('Por cor', d.cor, t, 'cor'), tabelaGrupo('Por litros', d.litros, t, 'litros'), tabelaGrupo('Por reforço', d.reforco, t, 'reforco'), tabelaGrupo('Por formato', d.formato, t, 'formato'),
    tabelaGrupo('Por cliente', d.clientes, t, 'clientes'), tabelaGrupo('Por etapa', d.status, t, 'status'));
}
// cfg.cliente(): codigo do cliente (ou null = todos). Retorna { el, carrega, dados, filtro }
function resumoProducao(cfg) {
  const f = { de: '', ate: '' }; let dados = null, ativo = 'tudo';
  const box = h('div'), chips = h('div', { class: 'chips', style: { marginBottom: '0' } });
  const de = h('input', { type: 'date', onchange: e => { f.de = e.target.value; ativo = ''; pinta(); carrega(); } }), ate = h('input', { type: 'date', onchange: e => { f.ate = e.target.value; ativo = ''; pinta(); carrega(); } });
  const params = () => { const p = new URLSearchParams(); const c = cfg.cliente(); if (c) p.set('cliente', c); if (f.de) p.set('de', f.de); if (f.ate) p.set('ate', f.ate); return p; };
  const pinta = () => chips.replaceChildren(...[['tudo', 'Tudo'], ['mes', 'Este mês'], ['anterior', 'Mês passado'], ['30', 'Últimos 30 dias']].map(([k, t]) =>
    h('button', { class: 'chip' + (ativo === k ? ' on' : ''), text: t, onclick: () => { ativo = k; Object.assign(f, periodoRapido(k)); de.value = f.de; ate.value = f.ate; pinta(); carrega(); } })));
  async function carrega() { dados = await api('GET', '/api/relatorio?' + params()); box.replaceChildren(desenhaResumo(dados)); if (cfg.aoCarregar) cfg.aoCarregar(params()); }
  pinta();
  const el = h('div', {}, h('div', { class: 'tools' }, chips, h('div', { class: 'grow' }), h('div', { class: 'inp' }, de), h('span', { class: 'sub', text: 'até' }), h('div', { class: 'inp' }, ate)), box);
  return { el, carrega, dados: () => dados, filtro: () => ({ ...f }), params };
}
/* relatorios-pdf */
// ---------- relatorios impressos (PDF) ----------
const agoraBR = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
function cabecalhoRel(titulo, linhas) {
  return h('header', { class: 'rp-h' }, h('div', { class: 'rp-logo' }, h('img', { src: '/logo.png', alt: CFG.empresa })),
    h('div', { class: 'rp-t' }, h('h1', { text: titulo }), linhas.filter(Boolean).map(l => h('div', { class: 'rp-s' }, l))),
    h('div', { class: 'rp-meta' }, 'Emitido em', h('b', { text: agoraBR() }), 'por ' + ((ME && ME.usuario) || '')));
}
const kpiRel = (rot, kgv, extra) => h('div', { class: 'rp-k' }, h('small', { text: rot }), h('b', { text: kg(kgv) + ' kg' }), h('span', { text: extra }));
function quadrosRel(t) {
  const perda = t.kg_prod ? num((t.aparas / t.kg_prod) * 100, 1) + '% do que foi cortado' : 'sem corte ainda';
  return h('div', { class: 'rp-ks' }, kpiRel('Pedido · ' + num(t.ops) + (t.ops === 1 ? ' OP' : ' OPs'), t.kg_ped, num(t.pac_ped) + ' pacotes'), kpiRel('Produzido', t.kg_prod, num(t.pac_prod) + ' pacotes'),
    kpiRel('Entregue', t.kg_ent, num(t.pac_ent) + ' pacotes'), kpiRel('Aparas', t.aparas, perda));
}
function itemRel(tipo, r) {
  if (tipo === 'cor') return h('span', {}, h('i', { class: 'dot', style: { background: CORES[r.chave] || '#fff', border: '1px solid #b8c4d2' } }), cap(r.chave));
  if (tipo === 'status') return h('span', {}, h('i', { class: 'dot st-' + slug(r.chave) }), r.chave);
  return r.chave;
}
function secaoRel(titulo, linhas, tot, tipo) {
  if (!linhas || !linhas.length) return null;
  const ord = tipo === 'litros' ? [...linhas].sort((a, b) => (parseInt(a.chave) || 9999) - (parseInt(b.chave) || 9999)) : linhas;
  const cab = [['Item', ''], ['OPs', 'n'], ['Pedido (kg)', 'n'], ['Pacotes', 'n'], ['Produzido (kg)', 'n'], ['Pacotes', 'n'], ['Entregue (kg)', 'n'], ['% do pedido', 'n']];
  const lin = (r, rot, total) => h('tr', { class: total ? 'tot' : '' }, h('td', {}, rot), h('td', { class: 'n', text: num(r.ops) }), h('td', { class: 'n', text: kg(r.kg_ped) }), h('td', { class: 'n', text: num(r.pac_ped) }),
    h('td', { class: 'n', text: kg(r.kg_prod) }), h('td', { class: 'n', text: num(r.pac_prod) }), h('td', { class: 'n', text: kg(r.kg_ent) }),
    h('td', { class: 'n' }, total ? '100%' : [h('span', { class: 'rp-bar' }, h('i', { style: { width: Math.min(100, tot.kg_ped ? (r.kg_ped / tot.kg_ped) * 100 : 0) + '%' } })), num(tot.kg_ped ? (r.kg_ped / tot.kg_ped) * 100 : 0, 0) + '%']));
  return h('section', { class: 'rp-sec' }, h('h2', { text: titulo }), h('table', {}, h('thead', {}, h('tr', {}, cab.map(([t, c]) => h('th', { class: c, text: t })))),
    h('tbody', {}, ord.map(r => lin(r, itemRel(tipo, r), false)), lin(tot, 'Total', true))));
}
function miniRel(titulo, linhas, tipo) {
  if (!linhas || !linhas.length) return null;
  const ord = tipo === 'litros' ? [...linhas].sort((a, b) => (parseInt(a.chave) || 9999) - (parseInt(b.chave) || 9999)) : linhas;
  return h('section', { class: 'rp-sec' }, h('h2', { text: titulo }), h('table', {}, h('thead', {}, h('tr', {}, [['Item', ''], ['OPs', 'n'], ['Pedido (kg)', 'n'], ['Produzido (kg)', 'n']].map(([t, c]) => h('th', { class: c, text: t })))),
    h('tbody', {}, ord.map(r => h('tr', {}, h('td', {}, itemRel(tipo, r)), h('td', { class: 'n', text: num(r.ops) }), h('td', { class: 'n', text: kg(r.kg_ped) }), h('td', { class: 'n', text: kg(r.kg_prod) }))))));
}
function imprimeResumo(titulo, sub, d) {
  const t = d.totais, partes = String(sub).split(' · ');
  const rel = h('div', { class: 'rp' }, cabecalhoRel(titulo, [h('b', { text: partes[0] }), partes[1] ? 'Período: ' + partes[1] : null]), quadrosRel(t),
    secaoRel('Por cor', d.cor, t, 'cor'), secaoRel('Por litros', d.litros, t, 'litros'), secaoRel('Por reforço', d.reforco, t, 'reforco'), secaoRel('Por formato', d.formato, t, 'formato'),
    secaoRel('Por cliente', d.clientes, t, 'clientes'), secaoRel('Por etapa', d.status, t, 'status'));
  document.getElementById('print-area').replaceChildren(rel); imprimir('rel', titulo);
}
async function viewRelatorio() {
  const E = { cliente_cod: null, cliente_nome: '' };
  const rp = resumoProducao({ cliente: () => E.cliente_cod, aoCarregar: p => (csv.href = '/api/export/relatorio.csv?' + p) });
  const csv = h('a', { class: 'btn', download: '' }, ic('download', 17), 'Exportar Excel');
  const sub = () => (E.cliente_cod ? E.cliente_nome : 'Todos os clientes') + ' · ' + ((rp.filtro().de || rp.filtro().ate) ? (dt(rp.filtro().de) || 'início') + ' a ' + (dt(rp.filtro().ate) || 'hoje') : 'todo o período');
  shell('relatorio', [pageHead('Relatório de produção', 'Somas automáticas: pedido, produzido e entregue, por cliente, cor, litros, reforço e formato.',
      [csv, h('button', { class: 'btn', onclick: () => rp.dados() && imprimeResumo('Resumo de produção', sub(), rp.dados()) }, ic('print', 17), 'Imprimir'),
        podeEditar() ? h('button', { class: 'btn', onclick: () => compartilhar(E.cliente_cod
          ? { tipo: 'cliente', ref: E.cliente_cod, de: rp.filtro().de, ate: rp.filtro().ate, clienteCod: E.cliente_cod, titulo: 'Enviar relatório a ' + E.cliente_nome, mensagem: l => 'Olá! Segue o relatório dos seus pedidos na ' + CFG.empresa + ': ' + l }
          : { tipo: 'resumo', de: rp.filtro().de, ate: rp.filtro().ate, titulo: 'Enviar resumo de produção', mensagem: l => 'Resumo de produção da ' + CFG.empresa + ' (' + sub() + '): ' + l }) }, ic('chat', 17), 'Enviar') : null]),
    h('div', { class: 'card', style: { maxWidth: '520px' } }, clienteAuto(E, false, () => rp.carrega())), rp.el]);
  await rp.carrega();
}

// ---------- impressao ----------
let regraPagina = null;
function imprimir(tipo, titulo) {          // define o tamanho da folha e abre a impressao
  const sh = [...document.styleSheets].find(s => s.href && s.href.endsWith('/style.css'));
  const rodape = (CFG.empresa + ' · ' + (titulo || 'Relatório')).replace(/["\\]/g, '');
  const margens = '@bottom-left { content: "' + rodape + '"; font: 8px Arial, sans-serif; color: #7a8899 } @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8px Arial, sans-serif; color: #7a8899 }';
  const cssBase = tipo === 'ficha' ? '@page { size: 210mm 148mm; margin: 0; }' : tipo === 'fichas2' ? '@page { size: 210mm 297mm; margin: 0; }' : tipo === 'rel-h' ? '@page { size: A4 landscape; margin: 11mm 11mm 14mm; ' + margens + ' }' : '@page { size: A4 portrait; margin: 12mm 12mm 15mm; ' + margens + ' }';
  if (sh) {
    if (regraPagina != null) { try { sh.deleteRule(regraPagina); } catch { /* ja removida */ } }
    try { regraPagina = sh.insertRule(cssBase, sh.cssRules.length); }
    catch { regraPagina = sh.insertRule(cssBase.replace(/ @bottom-left.*\} \}$/, ' }'), sh.cssRules.length); }
  }
  window.print();
}
function fichaEl(o) {
  const val = v => (v == null || v === '' ? '' : String(v).replace('.', ','));
  const fl = (rot, v) => h('span', { class: 'fl' }, h('b', { text: rot }), h('i', { text: val(v) }));
  const op = (txt, sel, cls) => h('span', { class: 'op' + (cls ? ' ' + cls : '') }, '(', h('u', { text: sel ? 'X' : '' }), ') ' + txt);
  const L = n => op(n + ' Lt', o.litros === n), R = n => op(n, o.reforco === n);
  const cl = (...k) => h('div', { class: 'cl' }, ...k);
  const flc = (rot, v, g) => h('span', { class: 'flc ' + g }, h('b', { text: rot }), h('i', { text: val(v) }));
  const canhoto = h('div', { class: 'canh' }, h('div', { class: 'cb' },
    cl(flc('Cliente:', o.cliente_nome, 'g2'), flc('Nº', o.numero, 'g1')),
    cl(flc('Data:', dt(o.data), 'g1'), flc('Obs.:', o.obs || (o.qtd_pacote != null ? o.qtd_pacote + ' pct' : ''), 'g2')),
    cl(h('b', { text: 'Saco p/ lixo' }), L(20), L(40), L(60)), cl(L(100), L(150), L(200), L(300)),
    cl(op('Capa', o.formato === 'Capa'), op('Sacola', o.formato === 'Sacola'), op('Bobina', o.formato === 'Bobina')),
    cl(flc('Assinatura:', '', 'g1'))));
  const ficha = h('div', { class: 'pf' }, canhoto, h('div', { class: 'pmain' },
    h('div', { class: 'nrow' }, 'Nº', h('span', { class: 'num', text: o.numero || '' })),
    h('div', { class: 'r1' }, h('div', { class: 'box head' }, logoImg('lgf'), h('h1', { text: 'Ordem de Produção' })), h('div', { class: 'box data' }, 'Data', h('i', { text: dt(o.data) }))),
    h('div', { class: 'r2' },
      h('div', { class: 'pcol' }, h('div', { class: 'box cli' }, 'Cliente', h('i', { text: o.cliente_nome || '' })),
        h('div', { class: 'box saco' }, h('div', { class: 'ln' }, 'Saco p/ lixo', L(20), L(40), L(60)), h('div', { class: 'ln' }, L(100), L(150), L(200), L(300)))),
      h('div', { class: 'box refo' }, h('div', { class: 'ln' }, R('Leve'), R('Médio'), R('Reforçado')), h('div', { class: 'ln' }, R('Sup. Reforçado'), R('Lonado')))),
    h('div', { class: 'box fmt' }, op('Capa', o.formato === 'Capa', 'capa'), op('Sacola', o.formato === 'Sacola', 'sac'), op('Bobina', o.formato === 'Bobina', 'bob')),
    h('div', { class: 'fields' }, fl('Largura:', o.largura), fl('Comprimento:', o.comprimento), fl('Espessura:', o.espessura), fl('Gramatura:', o.gramatura)),
    h('div', { class: 'fields b' }, fl('Cor:', o.cor), fl('Qnt de pacote:', o.qtd_pacote), fl('Qnt de Kg:', o.qtd_kg)),
    h('div', { class: 'box obs' }, 'Obs.: ', h('span', { text: o.obs || '' })),
    h('div', { class: 'secb' }, h('div', { class: 'sec first', text: 'EXTRUSÃO' }), h('div', { class: 'fields w' }, fl('Qnt de bobina:', o.ext_bobinas), fl('Kg Total:', o.ext_kg), fl('Extrusor:', o.ext_extrusor))),
    h('div', { class: 'secb' }, h('div', { class: 'sec', text: 'CORTE E SOLDA' }), h('div', { class: 'fields w' }, fl('Pacotes:', o.corte_pacotes), fl('Kg Total:', o.corte_kg), fl('Aparas(Kg):', o.corte_aparas_kg)))));
  return ficha;
}
/* lote */
// uma ficha (A5 deitada, como sempre foi)
function imprimeFicha(o) { document.getElementById('print-area').replaceChildren(h('div', { class: 'pf1' }, fichaEl(o))); imprimir('ficha'); }
// varias fichas: 2 por folha A4 (cada uma no mesmo formato e tamanho da ficha atual, 210x147mm) economiza papel
const FOLHA = () => (lsGet('op_fichas_folha') === '1' ? 1 : 2);
function imprimeFichas(lista, porFolha) {
  const l = lista.filter(o => o.status !== 'Cancelada'); if (!l.length) { toast('Nenhuma ficha para imprimir', 'erro'); return; }
  const paginas = [];
  if (porFolha === 2) for (let i = 0; i < l.length; i += 2) paginas.push(h('div', { class: 'pf2' }, h('div', { class: 'meia' }, fichaEl(l[i])), h('div', { class: 'meia' }, l[i + 1] ? fichaEl(l[i + 1]) : null)));
  else l.forEach(o => paginas.push(h('div', { class: 'pf1' }, fichaEl(o))));
  document.getElementById('print-area').replaceChildren(...paginas); imprimir(porFolha === 2 ? 'fichas2' : 'ficha');
}
function dialogoFichas(lista, titulo) {   // pergunta 1 ou 2 por folha e imprime; resolve quando a janela fecha
  return new Promise(fim => {
    const ativas = lista.filter(o => o.status !== 'Cancelada');
    if (!ativas.length) { toast('Nenhuma ficha para imprimir', 'erro'); return fim(); }
    let n = FOLHA();
    const info = h('p', { style: { marginBottom: '14px' } }), seg = h('div', { class: 'seg', style: { display: 'flex', width: '100%' } });
    const pinta = () => {
      seg.replaceChildren(...[[2, '2 por folha'], [1, '1 por folha']].map(([v, t]) => h('button', { type: 'button', class: v === n ? 'on' : '', style: { flex: '1', justifyContent: 'center' }, text: t, onclick: () => { n = v; pinta(); } })));
      const folhas = n === 2 ? Math.ceil(ativas.length / 2) : ativas.length;
      info.textContent = ativas.length + (ativas.length === 1 ? ' ficha' : ' fichas') + ' · ' + folhas + (folhas === 1 ? ' folha' : ' folhas') + (n === 2 ? ' A4 — economiza papel; recorte na linha tracejada.' : ' A5 deitada.');
    };
    const d = h('dialog', {}, h('h3', { text: titulo || 'Imprimir fichas' }), info, seg,
      h('div', { class: 'acts', style: { marginTop: '18px' } }, h('button', { class: 'btn', text: 'Agora não', onclick: () => d.close() }),
        h('button', { class: 'btn pri', onclick: () => { lsSet('op_fichas_folha', String(n)); d.close(); imprimeFichas(ativas, n); } }, ic('print', 17), 'Imprimir')));
    d.addEventListener('close', () => { d.remove(); fim(); }); document.body.append(d); pinta(); d.showModal();
  });
}

// ---------- clientes ----------
async function viewClientes(qs) {
  const par = new URLSearchParams(qs); let q = par.get('q') || '', so = par.get('comOrdens') !== '0';
  const box = h('div'), pagEl = h('div'), pg = { pagina: 0, limite: tamanhoSalvo() };
  const filtra = () => { pg.pagina = 0; carrega(); };
  const carrega = async () => {
    const res = await api('GET', `/api/clientes?limite=${pg.limite}&pagina=${pg.pagina}&comOrdens=${so ? 1 : 0}&q=${encodeURIComponent(q)}`); const r = res.linhas;
    pagEl.replaceChildren(pager(pg, res.total, () => { carrega(); window.scrollTo({ top: 0 }); }));
    box.replaceChildren(!r.length ? h('div', { class: 'tw' }, vazio(so ? 'Nenhum cliente com ordens ainda' : 'Nenhum cliente encontrado', so ? 'Desmarque "Só com ordens" para ver todos os clientes do Serp.' : 'Tente outro nome.')) :
      h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Cliente' }), h('th', { text: 'Cidade' }), h('th', { class: 'n', text: 'OPs' }), h('th', { class: 'n', text: 'Andamento' }), h('th', { class: 'n', text: 'Prontas' }), h('th', { class: 'n', text: 'Entregues' }), h('th', { class: 'n', text: 'Kg pedido' }), h('th', { text: 'Produzido' }))),
        h('tbody', {}, r.map(c => { const pct = c.kg_pedido ? Math.min(100, Math.round((c.kg_produzido / c.kg_pedido) * 100)) : 0;
          return h('tr', { class: 'click', onclick: () => (location.hash = '#/cliente/' + c.cod) }, h('td', {}, h('div', { class: 'cellrow' }, h('div', { class: 'initials', text: iniciais(c.nome) }), h('div', {}, h('span', { class: 'main', text: c.nome }), h('span', { class: 'sub2', text: 'cód. ' + c.cod })))),
            h('td', { text: c.cidade ? c.cidade + '/' + (c.uf || '') : '' }), h('td', { class: 'n', text: num(c.total) }), h('td', { class: 'n', text: num(c.andamento) }), h('td', { class: 'n', text: num(c.prontas) }), h('td', { class: 'n', text: num(c.entregues) }), h('td', { class: 'n', text: kg(c.kg_pedido) }),
            h('td', {}, c.kg_pedido ? h('div', { class: 'mini' }, h('i', { style: { width: pct + '%' } })) : '—')); })))));
  };
  const chk = h('input', { type: 'checkbox', checked: so, onchange: e => { so = e.target.checked; filtra(); } });
  shell('clientes', [pageHead('Clientes', 'Lista do Serp, somente para consulta. Clique para ver os pedidos.'),
    h('div', { class: 'tools' }, h('div', { class: 'inp search' }, lupaClientes(c => (location.hash = '#/cliente/' + c.cod)), h('input', { placeholder: 'Buscar cliente…', value: q, oninput: debounce(e => { q = e.target.value; filtra(); }) })), h('label', { class: 'sub', style: { display: 'flex', gap: '8px', alignItems: 'center' } }, chk, 'Só com ordens')), box, pagEl]);
  await carrega();
}
async function viewCliente(cod, pg) {
  pg = pg || { pagina: 0, limite: tamanhoSalvo() };
  const r = await api('GET', `/api/clientes/${cod}?limite=${pg.limite}&pagina=${pg.pagina}`); const c = r.cliente; const por = Object.fromEntries(r.porStatus.map(x => [x.status, x]));
  const resumoCli = resumoProducao({ cliente: () => c.cod });
  const nOrd = r.porStatus.reduce((a, x) => a + x.n, 0), totPed = r.porStatus.reduce((a, x) => a + x.kg, 0), totPro = r.porStatus.reduce((a, x) => a + x.prod, 0);
  shell('clientes', [
    pageHead(c.nome, null, [h('a', { class: 'btn', href: '#/precos?cliente=' + c.cod }, ic('tag', 17), 'Preços'), h('a', { class: 'btn', href: '/api/export/ordens.csv?cliente=' + c.cod, download: '' }, ic('download', 17), 'Excel'), h('button', { class: 'btn', onclick: async () => imprimeRelatorio(c, await api('GET', `/api/clientes/${cod}?limite=1000`), await api('GET', '/api/relatorio?cliente=' + cod)) }, ic('print', 17), 'Imprimir relatório'),
      podeEditar() ? h('button', { class: 'btn', onclick: () => compartilhar({ tipo: 'cliente', ref: c.cod, de: resumoCli.filtro().de, ate: resumoCli.filtro().ate, fone: c.telefone, titulo: 'Enviar relatório a ' + c.nome, mensagem: l => 'Olá! Segue o relatório dos seus pedidos na ' + CFG.empresa + ': ' + l }) }, ic('chat', 17), 'Enviar ao cliente') : null,
      podeEditar() ? h('a', { class: 'btn', href: '#/ordem/lote?cliente=' + c.cod }, ic('copy', 17), 'Lançar várias') : null,
      podeEditar() ? h('a', { class: 'btn pri', href: '#/ordem/novo?cliente=' + c.cod }, ic('plus', 18), 'Nova OP') : null], ['#/clientes', 'Clientes']),
    h('div', { class: 'card' }, h('div', { class: 'cli-head' }, h('div', { class: 'avatar lg', text: iniciais(c.nome) }), h('div', {}, h('b', { style: { fontSize: '17px' }, text: c.razao || c.nome }),
      h('div', { class: 'sub', text: [c.doc, c.telefone, c.cidade ? c.cidade + '/' + (c.uf || '') : ''].filter(Boolean).join(' · ') })))),
    h('div', { class: 'pipe', style: { marginBottom: '18px' } }, ETAPAS.map(e => h('div', { class: 'stage st-' + slug(e.s) }, h('div', { class: 't' }, ic(e.i, 18), e.s), h('b', { text: num((por[e.s] || {}).n || 0) }), h('small', { text: kg((por[e.s] || {}).kg || 0) + ' kg' })))),
    h('h3', { style: { margin: '4px 0 12px' }, text: 'Resumo de produção' }), resumoCli.el,
    h('h3', { style: { margin: '22px 0 12px' }, text: 'Pedidos do cliente' }), tabelaOrdens(r.linhas, { semCliente: true }), pager(pg, r.total, () => viewCliente(cod, pg))]);
  resumoCli.carrega();
}
function imprimeRelatorio(c, r, res) {
  const ativas = r.linhas.filter(o => o.status !== 'Cancelada'), t = res.totais;
  const lugar = [c.cidade ? c.cidade + (c.uf ? '/' + c.uf : '') : '', c.doc ? 'Doc.: ' + c.doc : '', c.telefone || ''].filter(Boolean).join('  ·  ');
  const soma = k => ativas.reduce((a, o) => a + (o[k] || 0), 0);
  const cab = [['OP', ''], ['Data', ''], ['Produto', ''], ['Medidas', ''], ['Cor', ''], ['Pedido', 'n'], ['Produzido', 'n'], ['Status', ''], ['Entrega', '']];
  const linhas = ativas.map(o => h('tr', {}, h('td', {}, h('b', { text: o.numero })), h('td', { text: dt(o.data) }), h('td', { text: produtoTxt(o) }), h('td', { text: medidas(o) }), h('td', { text: o.cor || '' }),
    h('td', { class: 'n', text: qtd(o.qtd_pacote, o.qtd_kg) }), h('td', { class: 'n', text: qtd(o.corte_pacotes, o.corte_kg) || '—' }),
    h('td', {}, h('span', { class: 'rp-st st-' + slug(o.status) }, h('i', { class: 'dot' }), o.status)), h('td', { text: dt(o.entregue_em) || '—' })));
  const rel = h('div', { class: 'rp' }, cabecalhoRel('Pedidos do cliente', [h('b', { text: c.razao || c.nome }), lugar]), quadrosRel(t),
    h('section', { class: 'rp-sec rp-livre' }, h('h2', { text: 'Pedidos (' + ativas.length + ')' }), h('table', {}, h('thead', {}, h('tr', {}, cab.map(([x, cl]) => h('th', { class: cl, text: x })))),
      h('tbody', {}, linhas, h('tr', { class: 'tot' }, h('td', { colspan: 5, text: 'Total (' + ativas.length + ' OPs)' }), h('td', { class: 'n', text: qtd(soma('qtd_pacote'), soma('qtd_kg')) }), h('td', { class: 'n', text: qtd(soma('corte_pacotes'), soma('corte_kg')) }), h('td', { colspan: 2 }))))),
    h('div', { class: 'rp-duas' }, miniRel('Por cor', res.cor, 'cor'), miniRel('Por litros', res.litros, 'litros'), miniRel('Por reforço', res.reforco, 'reforco'), miniRel('Por formato', res.formato, 'formato')));
  document.getElementById('print-area').replaceChildren(rel); imprimir('rel-h', 'Pedidos de ' + c.nome);
}

// ---------- precos praticados (ultimas vendas fechadas no Serp, 12 meses) ----------
const brl = v => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 1 ? 4 : 2 }));
const pctTxt = v => (v == null ? '—' : num(v, 1) + '%');
// venda: [data, qtd, preco, preco com desconto, custo]
const descPct = (preco, liq) => (preco > 0 && liq != null && liq < preco - 0.00005 ? (1 - liq / preco) * 100 : 0);
const margemPct = (liq, custo) => (custo > 0 && liq > 0 ? ((liq - custo) / liq) * 100 : null);
function precoCard(l, comCliente) {
  const und = (l.und || 'un').toLowerCase(), vendas = [[l.data, l.qtd, l.preco, l.preco_liq, l.custo], ...l.hist];
  const desc = descPct(l.preco, l.preco_liq), mg = margemPct(l.preco_liq, l.custo);
  const det = h('div', { class: 'prhist', hidden: true }, h('div', { class: 'prh cab' }, ['Data', 'Qtd', 'Preço', 'C/ desconto', 'Custo'].map(t => h('span', { text: t }))),
    vendas.map(v => h('div', { class: 'prh' }, h('span', { text: dt(v[0]) }), h('span', { text: num(v[1], v[1] % 1 ? 2 : 0) }), h('span', { text: brl(v[2]) }), h('span', { text: brl(v[3]) }), h('span', { text: brl(v[4]) }))));
  const mais = h('div', { class: 'prmais' }, ic('clock', 14), vendas.length > 1 ? `Ver as últimas ${vendas.length} vendas` : 'Ver detalhes da venda');
  return h('div', { class: 'card prcard', role: 'button', tabindex: 0, onclick: () => { det.hidden = !det.hidden; mais.lastChild.textContent = det.hidden ? (vendas.length > 1 ? `Ver as últimas ${vendas.length} vendas` : 'Ver detalhes da venda') : 'Esconder'; } },
    h('div', { class: 'prtop' },
      h('div', { class: 'grow' }, comCliente ? h('a', { class: 'prcli', href: '#/precos?cliente=' + l.cliente_cod, onclick: e => e.stopPropagation(), text: l.cliente_nome }) : null,
        h('b', { class: 'prnome', text: l.descricao }), h('div', { class: 'sub', text: `cód. ${l.produto_cod} · última venda ${dt(l.data)} (${diasTxt(dias(l.data))})` })),
      h('div', { class: 'prval' }, h('b', { text: brl(l.preco_liq ?? l.preco) }), h('small', { text: 'por ' + und + (desc ? ' · com desconto' : '') }))),
    h('div', { class: 'prinfo' }, [['Quantidade', num(l.qtd, l.qtd % 1 ? 2 : 0) + ' ' + und], ['Sem desconto', brl(l.preco)], ['Desconto', desc ? pctTxt(desc) : '—'], ['Custo', l.custo ? brl(l.custo) : '—'], ['Margem', pctTxt(mg)]]
      .map(([k, v]) => h('span', {}, k + ' ', h('b', { text: v })))), mais, det);
}
async function viewPrecos(qs) {
  const par = new URLSearchParams(qs), cod = Number(par.get('cliente')) || 0;
  if (cod) {   // produtos que o cliente comprou, o mais recente primeiro
    const r = await api('GET', '/api/precos?cliente=' + cod), c = r.cliente, lista = h('div');
    const pinta = t => {
      const f = t.trim().toLowerCase(), pal = f.split(/\s+/).filter(Boolean);
      const l = r.linhas.filter(x => !f || pal.every(w => x.descricao.toLowerCase().includes(w)) || String(x.produto_cod) === f);
      lista.replaceChildren(...(l.length ? l.map(x => precoCard(x)) : [h('div', { class: 'tw' }, vazio(r.linhas.length ? 'Nenhum produto com esse nome' : 'Nenhuma venda nos últimos 12 meses', r.linhas.length ? 'Tente outra palavra.' : 'Este cliente não tem pedido de venda fechado no Serp no último ano.'))]));
    };
    shell('precos', [pageHead(c.nome, `${r.linhas.length} ${r.linhas.length === 1 ? 'produto comprado' : 'produtos comprados'} nos últimos 12 meses · ${r.atualizado ? 'atualizado ' + atras(r.atualizado) : 'aguardando sincronização'}`,
      [h('a', { class: 'btn', href: '#/cliente/' + c.cod }, ic('building', 17), 'Pedidos de produção')], ['#/precos', 'Preços']),
      r.linhas.length > 3 ? h('div', { class: 'tools' }, h('div', { class: 'inp search prbusca' }, ic('search', 18), h('input', { placeholder: 'Filtrar produto…', oninput: e => pinta(e.target.value) }))) : null, lista]);
    pinta('');
    return;
  }
  let modo = par.get('modo') === 'produto' ? 'produto' : 'cliente', termo = par.get('q') || '';
  const box = h('div'), entrada = h('input', { placeholder: '', value: termo, autocomplete: 'off', enterKeyHint: 'search' });
  let seq = 0;
  const busca = async () => {
    const n = ++seq, t = entrada.value.trim();
    history.replaceState(null, '', '#/precos?modo=' + modo + (t ? '&q=' + encodeURIComponent(t) : ''));
    if (modo === 'produto') {
      if (t.length < 2) { box.replaceChildren(h('div', { class: 'sub', style: { padding: '6px 2px' }, text: 'Digite pelo menos 2 letras do produto (ex.: saco 100).' })); return; }
      const r = await api('GET', '/api/precos?produto=' + encodeURIComponent(t)); if (n !== seq) return;
      box.replaceChildren(...(r.linhas.length ? [h('div', { class: 'sub', style: { margin: '0 2px 10px' }, text: r.linhas.length >= 100 ? 'Mostrando as 100 vendas mais recentes — digite mais para refinar.' : r.linhas.length + (r.linhas.length === 1 ? ' resultado' : ' resultados') + ', a venda mais recente primeiro' }), ...r.linhas.map(x => precoCard(x, true))]
        : [h('div', { class: 'tw' }, vazio('Nenhum produto encontrado', 'Tente outra palavra ou o código do produto.'))]));
      return;
    }
    const l = await api('GET', '/api/precos/clientes?q=' + encodeURIComponent(t)); if (n !== seq) return;
    box.replaceChildren(...(l.length ? [t ? null : h('div', { class: 'sub', style: { margin: '0 2px 10px' }, text: 'Clientes que compraram por último:' }),
      h('div', { class: 'prclis' }, l.map(c => h('a', { class: 'card prclirow', href: '#/precos?cliente=' + c.cod }, h('div', { class: 'initials', text: iniciais(c.nome) }),
        h('div', { class: 'grow' }, h('b', { text: c.nome }), h('div', { class: 'sub', text: [c.cidade ? c.cidade + (c.uf ? '/' + c.uf : '') : '', num(c.produtos) + (c.produtos === 1 ? ' produto' : ' produtos'), 'última compra ' + dt(c.ultima)].filter(Boolean).join(' · ') })), ic('right', 18))))]
      : [h('div', { class: 'tw' }, vazio(t ? 'Nenhum cliente encontrado' : 'Ainda não há preços', t ? 'Confira o nome ou tente só uma parte dele.' : 'Os preços chegam do Serp junto com a sincronização do PC da cliente.'))]));
  };
  const seg = h('div', { class: 'seg' }, [['cliente', 'Por cliente', 'building'], ['produto', 'Por produto', 'box']].map(([m, t, i]) => h('button', { class: modo === m ? 'on' : '', onclick: () => {
    modo = m; seg.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', ['cliente', 'produto'][k] === m)); ph(); entrada.focus(); busca(); } }, ic(i, 16), t)));
  const ph = () => (entrada.placeholder = modo === 'produto' ? 'Digite o produto (ex.: saco 100 litros)' : 'Digite o nome da empresa');
  entrada.addEventListener('input', debounce(busca, 300)); ph();
  shell('precos', [pageHead('Preços praticados', 'Último preço vendido de cada produto para cada cliente, direto dos pedidos de venda do Serp (últimos 12 meses).'),
    h('div', { class: 'tools' }, seg), h('div', { class: 'inp search prbusca' }, ic('search', 20), entrada), box]);
  await busca();
}

/* compartilhar */
// ---------- compartilhar com o cliente: link publico (so leitura) + WhatsApp ----------
const foneWhats = t => { let d = String(t || '').replace(/\D/g, '').replace(/^0+/, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d; };
const AVISO_LINK = { ordem: 'Quem tiver o link vê só o andamento deste pedido: etapa, datas, produto e quantidade. Não mostra observações internas nem outros pedidos.',
  cliente: 'Quem tiver o link vê só os pedidos deste cliente (status, produto e quantidade).', resumo: 'Atenção: este link mostra os totais de TODOS os clientes. Use só para uso interno.' };
async function compartilhar(o) {   // o: { tipo, ref, de, ate, titulo, clienteCod | fone, mensagem: link => texto }
  let L;
  try { L = await api('POST', '/api/links', { tipo: o.tipo, ref: o.ref, de: o.de || undefined, ate: o.ate || undefined }); } catch (e) { toast(e.message, 'erro'); return; }
  let fone0 = o.fone || '';
  if (!fone0 && o.clienteCod) { try { fone0 = (await api('GET', '/api/clientes/' + o.clienteCod + '?limite=1')).cliente.telefone || ''; } catch { /* sem telefone */ } }
  const urlDe = l => location.origin + '/p/' + l.token;
  const link = h('input', { readOnly: true, onfocus: e => e.target.select() }), info = h('div', { class: 'sub', style: { margin: '8px 2px 0' } });
  const fone = h('input', { type: 'tel', inputMode: 'tel', placeholder: 'Telefone com DDD (opcional)', value: fone0 });
  const msg = h('textarea', { class: 'ta', rows: 4 });
  const pinta = () => {
    link.value = urlDe(L); msg.value = o.mensagem(urlDe(L));
    info.textContent = 'Válido até ' + dt(L.expira_em) + ' · aberto ' + (L.acessos || 0) + (L.acessos === 1 ? ' vez' : ' vezes') + (L.ultimo_acesso ? ' (último acesso ' + new Date(L.ultimo_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ')' : '');
  };
  const copia = async txt => { try { await navigator.clipboard.writeText(txt); } catch { const t = h('textarea', {}); t.value = txt; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); } toast('Copiado'); };
  const d = h('dialog', { style: { maxWidth: '500px' } }, h('h3', { text: o.titulo || 'Enviar ao cliente' }), h('p', { style: { marginBottom: '14px' }, text: AVISO_LINK[o.tipo] }),
    h('label', { class: 'field' }, h('span', { class: 'l', text: 'Link' }), h('div', { class: 'inp' }, link, h('button', { class: 'btn sm', style: { margin: '0 6px' }, onclick: () => copia(link.value) }, ic('link', 15), 'Copiar'))), info,
    h('label', { class: 'field', style: { marginTop: '14px' } }, h('span', { class: 'l', text: 'WhatsApp do cliente' }), h('div', { class: 'inp' }, fone)),
    h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'l', text: 'Mensagem' }), msg),
    h('button', { class: 'btn pri', style: { width: '100%', marginTop: '16px', minHeight: '46px' }, onclick: () => { window.open('https://wa.me/' + foneWhats(fone.value) + '?text=' + encodeURIComponent(msg.value), '_blank', 'noopener'); } }, ic('chat', 18), 'Enviar pelo WhatsApp'),
    h('div', { class: 'acts', style: { marginTop: '10px', flexDirection: 'row', justifyContent: 'space-between' } },
      h('a', { class: 'btn', target: '_blank', rel: 'noopener', style: { flex: '1' }, onclick: e => { e.currentTarget.href = urlDe(L); } }, 'Ver como o cliente vê'),
      h('button', { class: 'btn', style: { flex: '1' }, onclick: () => d.close() }, 'Fechar')),
    h('div', { class: 'acts', style: { marginTop: '10px', justifyContent: 'space-between', flexDirection: 'row' } },
      h('button', { class: 'btn sm ghost', onclick: async () => { try { L = await api('POST', '/api/links', { tipo: o.tipo, ref: o.ref, de: o.de || undefined, ate: o.ate || undefined, novo: true }); pinta(); toast('Novo link gerado (o anterior parou de funcionar)'); } catch (e) { toast(e.message, 'erro'); } } }, 'Gerar novo link'),
      h('button', { class: 'btn sm ghost danger', onclick: async () => { if (await confirmar('Desativar este link?', 'Quem recebeu o link deixa de conseguir abrir. Você pode gerar outro depois.', 'Desativar')) { try { await api('DELETE', '/api/links/' + L.id); toast('Link desativado'); d.close(); } catch (e) { toast(e.message, 'erro'); } } } }, 'Desativar link')));
  d.addEventListener('close', () => d.remove()); document.body.append(d); pinta(); d.showModal();
}

// ---------- lancar varias OPs de uma vez (e duplicar) ----------
async function viewLote(qs) {
  if (!podeEditar()) { location.hash = '#/ordens'; return; }
  const par = new URLSearchParams(qs);
  const E = { cliente_cod: null, cliente_nome: '', data: hoje() };
  const novoItem = (b = {}) => ({ litros: b.litros ?? null, reforco: b.reforco ?? null, formato: b.formato ?? null, largura: b.largura ?? null, comprimento: b.comprimento ?? null, espessura: b.espessura ?? null, gramatura: b.gramatura ?? null, cor: b.cor ?? '', qtd_pacote: b.qtd_pacote ?? null, qtd_kg: b.qtd_kg ?? null, obs: b.obs ?? '' });
  let itens = [novoItem()], origem = null;
  if (par.get('copiar')) { origem = await api('GET', '/api/ordens/' + Number(par.get('copiar'))); E.cliente_cod = origem.cliente_cod; E.cliente_nome = origem.cliente_nome; itens = [novoItem(origem)]; }
  else if (par.get('cliente')) { try { const r = await api('GET', '/api/clientes/' + Number(par.get('cliente'))); E.cliente_cod = r.cliente.cod; E.cliente_nome = r.cliente.nome; } catch { /* sem cliente */ } }
  const lista = h('div', { class: 'lote' }), resumoEl = h('div', { class: 'loteres' }), resumoEl2 = h('div', { class: 'loteres' });
  const campo = (rot, it, k, op = {}) => h('label', { class: 'field' }, h('span', { class: 'l', text: rot }), h('div', { class: 'inp' },
    h('input', { type: 'text', inputMode: op.dec ? 'decimal' : (op.int ? 'numeric' : null), value: dec(it[k]), oninput: e => { it[k] = e.target.value; soma(); } }), op.suf ? h('span', { class: 'suf', text: op.suf }) : null));
  const escolha = (rot, it, k, opcoes, fmt = x => x) => h('label', { class: 'field' }, h('span', { class: 'l', text: rot }), h('div', { class: 'inp' },
    h('select', { onchange: e => { const v = e.target.value; it[k] = v === '' ? null : (typeof opcoes[0] === 'number' ? Number(v) : v); } }, h('option', { value: '', text: '—' }), opcoes.map(x => h('option', { value: x, text: fmt(x), selected: it[k] === x })))));
  function soma() {
    const pct = itens.reduce((a, i) => a + pn(i.qtd_pacote), 0), kgt = itens.reduce((a, i) => a + pn(i.qtd_kg), 0);
    const t = [h('b', { text: itens.length + (itens.length === 1 ? ' OP' : ' OPs') }), ' · ' + num(pct) + ' pacotes · ' + kg(kgt) + ' kg'];
    resumoEl.replaceChildren(...t.map(x => (x.cloneNode ? x.cloneNode(true) : x))); resumoEl2.replaceChildren(...t.map(x => (x.cloneNode ? x.cloneNode(true) : x)));
  }
  function pinta() {
    lista.replaceChildren(...itens.map((it, i) => h('div', { class: 'card litem' },
      h('div', { class: 'lhead' }, h('b', { text: 'OP ' + (i + 1) }), h('div', { class: 'lacts' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => { itens.splice(i + 1, 0, { ...it }); pinta(); } }, ic('copy', 15), 'Duplicar'),
        itens.length > 1 ? h('button', { type: 'button', class: 'btn sm ghost danger', onclick: () => { itens.splice(i, 1); pinta(); } }, 'Remover') : null)),
      h('div', { class: 'row lrow' }, escolha('Litros', it, 'litros', CFG.litros, n => n + ' L'), escolha('Reforço', it, 'reforco', CFG.reforcos), escolha('Formato', it, 'formato', CFG.formatos)),
      h('div', { class: 'row lrow' }, campo('Largura', it, 'largura', { dec: 1, suf: 'cm' }), campo('Comprimento', it, 'comprimento', { dec: 1, suf: 'cm' }), campo('Espessura', it, 'espessura', { dec: 1 }), campo('Gramatura', it, 'gramatura', { dec: 1 }), campoCor(it, false)),
      h('div', { class: 'row lrow' }, campo('Qnt de pacote', it, 'qtd_pacote', { int: 1, suf: 'pct' }), campo('Qnt de Kg', it, 'qtd_kg', { dec: 1, suf: 'kg' }), campo('Obs.', it, 'obs')))));
    soma();
  }
  async function salvar(imprimirDepois) {
    if (!E.cliente_nome.trim()) { toast('Informe o cliente', 'erro'); return; }
    try {
      const r = await api('POST', '/api/ordens/lote', { cliente_cod: E.cliente_cod, cliente_nome: E.cliente_nome, data: E.data, grupo_de: origem ? origem.id : undefined, itens });
      toast(r.ordens.length === 1 ? 'OP ' + r.ordens[0].numero + ' criada' : r.ordens.length + ' OPs criadas (grupo ' + r.grupo + ')');
      if (imprimirDepois) await dialogoFichas(r.ordens, 'Imprimir as fichas');
      location.hash = r.grupo ? '#/ordens?grupo=' + r.grupo : '#/ordem/' + r.ordens[0].id;
    } catch (e) { toast(e.message, 'erro'); }
  }
  const botoes = () => [h('button', { class: 'btn', onclick: () => salvar(false) }, ic('check', 17), 'Salvar'), h('button', { class: 'btn pri', onclick: () => salvar(true) }, ic('print', 17), 'Salvar e imprimir fichas')];
  const mais = h('button', { class: 'btn', onclick: () => { itens.push(novoItem(itens[itens.length - 1] || {})); pinta(); lista.lastElementChild.scrollIntoView({ block: 'center' }); } }, ic('plus', 17), 'Adicionar OP');
  pinta();
  shell('ordens', [pageHead(origem ? 'Duplicar a OP ' + origem.numero : 'Lançar várias OPs', 'Escolha o cliente uma vez e preencha só o que muda em cada OP. Use Duplicar para copiar uma linha.', [], ['#/ordens', 'Ordens']),
    origem ? h('div', { class: 'note' }, ic('link', 18), 'As novas OPs ficam no mesmo grupo da OP ' + origem.numero + ' (' + origem.cliente_nome + ').') : null,
    h('div', { class: 'card' }, h('div', { class: 'row r3' }, h('label', { class: 'field' }, h('span', { class: 'l', text: 'Data' }), h('div', { class: 'inp' }, h('input', { type: 'date', value: E.data, onchange: e => (E.data = e.target.value) }))), clienteAuto(E, false))),
    lista, h('div', { style: { marginTop: '14px' } }, mais),
    h('div', { class: 'lotefoot' }, resumoEl, ...botoes()),
    h('div', { class: 'savebar' }, h('div', { class: 'loteres' }, resumoEl2), ...botoes())]);
}

// ---------- usuarios (admin) ----------
function definirSenha(u, depois) {
  const min = CFG.senhaMinima || 8;
  const a = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nova senha' }), b = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Repita a senha' });
  const err = h('div', { class: 'msg-err' });
  const d = h('dialog', {}, h('h3', { text: 'Senha de acesso de ' + u.usuario }), h('p', { text: 'Use no mínimo ' + min + ' caracteres, misturando letras e números. Essa senha vale só para este sistema e não altera a senha do Serp.' }),
    h('div', { class: 'inp', style: { marginBottom: '10px' } }, a), h('div', { class: 'inp' }, b), err,
    h('div', { class: 'acts', style: { marginTop: '16px' } }, h('button', { class: 'btn', text: 'Cancelar', onclick: () => d.close() }),
      h('button', { class: 'btn pri', text: 'Salvar', onclick: async () => {
        if (a.value.length < min) { err.textContent = 'A senha precisa ter pelo menos ' + min + ' caracteres.'; return; }
        if (a.value !== b.value) { err.textContent = 'As senhas não são iguais.'; return; }
        try { await api('PUT', '/api/usuarios/' + u.cod, { senha_web: a.value }); d.close(); toast('Senha de acesso salva'); depois(); } catch (x) { err.textContent = x.message; }
      } })));
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); a.focus();
}
async function viewUsuarios(pgIn) {
  const [todos, sy, seg] = await Promise.all([api('GET', '/api/usuarios'), api('GET', '/api/sync/status'), api('GET', '/api/seguranca').catch(() => null)]);
  const pg = pgIn || { pagina: 0, limite: tamanhoSalvo() }, us = todos.slice(pg.pagina * pg.limite, (pg.pagina + 1) * pg.limite);
  const msg = h('div', { class: 'sub', text: sy.pedido ? 'Pedido enviado — o PC da cliente atualiza em até 5 minutos depois de ligado.' : sy.erro ? '⚠ ' + sy.erro : `Última sincronização com o Serp: ${sy.ultimoOk ? new Date(sy.ultimoOk).toLocaleString('pt-BR') : '—'} · ${num(sy.clientes)} clientes` });
  const botao = h('button', { class: 'btn pri', onclick: async () => { botao.disabled = true; try { await api('POST', '/api/sync', {}); toast('Pedido enviado ao PC da cliente'); viewUsuarios(); } catch (e) { msg.textContent = '⚠ ' + e.message; } botao.disabled = false; } }, ic('refresh', 17), 'Pedir atualização ao Serp');
  const trocar = sy.origemTravada ? h('button', { class: 'btn', onclick: async () => { if (await confirmar('Trocar o banco do Serp?', 'Hoje o sistema só aceita dados do banco do Serp que sincronizou primeiro. Libere só se for trocar de verdade; a próxima sincronização define o novo banco.', 'Liberar troca')) { try { await api('POST', '/api/sync/origem', {}); toast('Troca liberada'); viewUsuarios(); } catch (e) { toast(e.message, 'erro'); } } } }, 'Trocar banco do Serp') : null;
  shell('usuarios', [pageHead('Usuários', 'Quem pode entrar e o que cada um pode fazer.', [trocar, botao]),
    h('div', { class: 'note' }, ic('info', 18), 'Usuários e clientes chegam do Serp pelo PC da cliente (somente leitura) sempre que ele está ligado. Aqui você define o papel e a senha de acesso. Se o PC estiver desligado, vale a última sincronização.'), h('div', { style: { marginBottom: '14px' } }, msg),
    h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Usuário', 'Grupo no Serp', 'Papel', 'Senha deste sistema', 'Ativo'].map(t => h('th', { text: t })))),
      h('tbody', {}, us.map(u => h('tr', {}, h('td', {}, h('div', { class: 'cellrow' }, h('div', { class: 'initials', text: iniciais(u.usuario) }), h('span', { class: 'main', text: u.usuario }))), h('td', { text: u.grupo ?? '' }),
        h('td', {}, h('select', { class: 'sel', onchange: async e => { try { await api('PUT', '/api/usuarios/' + u.cod, { papel: e.target.value }); toast('Papel atualizado'); viewUsuarios(pg); } catch (x) { toast(x.message, 'erro'); e.target.value = u.papel; } } },
          [['admin', 'Administrador'], ['escritorio', 'Escritório'], ['vendedor', 'Vendedor'], ['producao', 'Produção']].map(([v, t]) => h('option', { value: v, text: t, selected: v === u.papel }))),
          u.papel === 'producao' ? etapasPicker(u) : null),
        h('td', {}, u.senha_web ? h('span', { class: 'tag', text: 'própria' }) : h('span', { class: 'sub', text: u.papel === 'admin' ? 'do Serp (1º acesso)' : 'não definida' }),
          h('button', { class: 'btn sm', style: { marginLeft: '8px' }, text: u.senha_web ? 'Trocar' : 'Definir', onclick: () => definirSenha(u, () => viewUsuarios(pg)) }),
          u.senha_web ? h('button', { class: 'btn sm ghost', text: 'Remover', onclick: async () => { if (await confirmar('Remover a senha própria?', 'O acesso de ' + u.usuario + ' volta a usar a senha do Serp (quando permitido).', 'Remover')) { try { await api('PUT', '/api/usuarios/' + u.cod, { senha_web: '' }); toast('Senha própria removida'); viewUsuarios(pg); } catch (x) { toast(x.message, 'erro'); } } } }) : null),
        h('td', {}, h('input', { type: 'checkbox', checked: !!u.ativo, onchange: async e => { try { await api('PUT', '/api/usuarios/' + u.cod, { ativo: e.target.checked ? 1 : 0 }); } catch (x) { toast(x.message, 'erro'); e.target.checked = !e.target.checked; } } }))))))),
    pager(pg, todos.length, () => viewUsuarios(pg)),
    seg ? h('div', { class: 'card', style: { marginTop: '22px' } }, h('h3', {}, h('span', { class: 'ico' }, ic('shield', 17)), 'Segurança dos acessos', h('small', { text: 'últimas 24 h: ' + seg.resumo.ok + ' entradas · ' + seg.resumo.falhas + ' falhas · ' + seg.resumo.bloqueios + ' bloqueios' })),
      seg.recentes.length ? h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Quando', 'Usuário', 'IP', 'Resultado'].map(t => h('th', { text: t })))),
        h('tbody', {}, seg.recentes.slice(0, 20).map(a => h('tr', {}, h('td', { text: new Date(a.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) }), h('td', { text: a.login || '—' }), h('td', { text: a.ip }),
          h('td', {}, h('span', { class: 'pill ' + (a.ok ? 'st-Entregue' : 'st-Cancelada'), text: { ok: 'Entrou', senha: 'Senha errada', usuario: 'Usuário inexistente', vazia: 'Senha vazia', sem_acesso_web: 'Sem acesso liberado', bloqueado: 'Bloqueado', desafio: 'Verificação falhou', robo: 'Robô barrado' }[a.motivo] || a.motivo }))))))) : h('div', { class: 'sub', text: 'Nenhum acesso registrado ainda.' })) : null,
    h('p', { class: 'sub', text: 'Administrador: tudo. Escritório: cria e edita OPs. Vendedor: só consulta OPs, clientes e preços praticados, sem alterar nada. Produção: só vê a tela Ordens, apenas das etapas marcadas, e avança ou volta a OP uma etapa por vez.' })]);
}
// etapas que um funcionário do papel "Produção" enxerga e move (ex.: só Extrusão)
function etapasPicker(u) {
  const marcadas = new Set((u.etapas || '').split(',').filter(Boolean));
  return h('div', { class: 'etapasel' }, h('small', { class: marcadas.size ? '' : 'warn', text: marcadas.size ? 'Etapas que ele vê:' : 'Marque as etapas deste funcionário:' }),
    ETAPAS.map(e => h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: marcadas.has(e.s), onchange: async ev => {
      const nova = new Set(marcadas); ev.target.checked ? nova.add(e.s) : nova.delete(e.s);
      try { await api('PUT', '/api/usuarios/' + u.cod, { etapas: [...nova] }); marcadas.clear(); nova.forEach(x => marcadas.add(x)); toast('Etapas atualizadas'); } catch (x) { toast(x.message, 'erro'); ev.target.checked = !ev.target.checked; }
    } }), e.s)));
}

// ---------- roteador ----------
async function rota() {
  if (!ME) return;
  const [path, qs] = (location.hash.slice(1) || '/painel').split('?'); const p = path.split('/').filter(Boolean);
  try {
    if (ehProd() && p[0] !== 'ordens' && !(p[0] === 'ordem' && /^\d+$/.test(p[1] || ''))) { location.hash = '#/ordens'; return; }
    if (p[0] === 'ordens') return await viewOrdens(qs);
    if (p[0] === 'ordem' && p[1] === 'lote') return await viewLote(qs);
    if (p[0] === 'ordem' && p[1] === 'novo' && !podeEditar()) { location.hash = '#/ordens'; return; }
    if (p[0] === 'precos') return await viewPrecos(qs);
    if (p[0] === 'ordem') return await viewOrdem(p[1], qs);
    if (p[0] === 'clientes') return await viewClientes(qs);
    if (p[0] === 'relatorio') return await viewRelatorio();
    if (p[0] === 'cliente') return await viewCliente(p[1]);
    if (p[0] === 'usuarios' && ME.papel === 'admin') return await viewUsuarios();
    return await viewPainel();
  } catch (e) { if (ME) shell('', h('div', { class: 'note warn' }, ic('alert', 18), e.message)); }
}
async function boot() { try { ME = await api('GET', '/api/me'); } catch { ME = null; } ME ? rota() : renderLogin(); }
window.addEventListener('hashchange', rota);
(async () => { try { CFG = await api('GET', '/api/config'); } catch { CFG = { empresa: 'Ordem de Produção', status: [], litros: [], reforcos: [], formatos: [] }; } boot(); })();

/* mobile: rotulos das celulas (o CSS mostra as tabelas como cartoes em telas pequenas) */
(function () {
  const marca = t => {
    const ths = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()); if (!ths.length) return;
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (td.dataset.l === undefined) { td.dataset.l = ths[i] || ''; td.classList.add('c-' + slug(ths[i] || 'x').toLowerCase().replace(/[^a-z0-9_]/g, '')); } }));
  };
  let ag = 0;
  new MutationObserver(() => { if (ag) return; ag = requestAnimationFrame(() => { ag = 0; document.querySelectorAll('table').forEach(marca); }); }).observe(document.body, { childList: true, subtree: true });
})();
