// Pagina publica de acompanhamento (o cliente abre pelo link do WhatsApp). So leitura, sem login.
(function () {
  const $app = document.getElementById('app');
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'style') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(2)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const IC = {
    'Aberta': '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    'Em extrusão': '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    'Em corte e solda': '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 18M8.6 16.4L20 6"/>',
    'Pronta': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    'Entregue': '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    'Cancelada': '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    'clip': '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>', 'print': '<path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    'alert': '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', 'bldg': '<path d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M2 21h20M8 8h2M8 12h2M8 16h2"/>'
  };
  const ic = (n, s = 22) => { const e = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); e.setAttribute('viewBox', '0 0 24 24'); e.setAttribute('width', s); e.setAttribute('height', s); e.setAttribute('class', 'ic'); e.innerHTML = IC[n] || ''; return e; };
  const num = (v, d = 0) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const kg = v => num(v, 1);
  const dt = s => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const dth = s => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
  const CORES = { preto: '#1f2933', azul: '#2563eb', verde: '#16a34a', vermelho: '#dc2626', amarelo: '#eab308', branco: '#f8fafc', transparente: '#cbd5e1', cinza: '#94a3b8', laranja: '#f97316', rosa: '#ec4899', roxo: '#7c3aed', marrom: '#92400e' };
  const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const pill = st => h('span', { class: 'pill st-' + slug(st), text: st });
  const ETAPAS = ['Aberta', 'Em extrusão', 'Em corte e solda', 'Pronta', 'Entregue'];
  const TITULO = { 'Aberta': 'Pedido recebido', 'Em extrusão': 'Em produção', 'Em corte e solda': 'Quase pronto', 'Pronta': 'Pronto para entrega', 'Entregue': 'Entregue', 'Cancelada': 'Pedido cancelado' };
  const MSG = {
    'Aberta': 'Recebemos o seu pedido. Ele aguarda o início da produção.', 'Em extrusão': 'Seu pedido está sendo produzido (extrusão).',
    'Em corte e solda': 'Seu pedido está na etapa final: corte e solda.', 'Pronta': 'Seu pedido está pronto e aguardando entrega.',
    'Entregue': 'Seu pedido foi entregue. Obrigado pela preferência!', 'Cancelada': 'Este pedido foi cancelado. Em caso de dúvida, fale com a empresa.'
  };
  const logo = () => h('div', { class: 'lg publ' }, h('img', { class: 'n', src: '/logo.png', alt: 'Logo' }));
  const topo = d => h('div', { class: 'pubtop' }, h('div', {}, logo(), h('small', {}, d && d.empresa ? h('b', { text: d.empresa }) : '', h('br'), 'Acompanhamento de pedido')));
  const rodape = d => h('footer', { class: 'pubf' }, h('div', { text: 'Atualizado em ' + dth(d.atualizado) + ' · link válido até ' + dt(d.expira_em) }),
    h('div', { text: 'Dúvidas? Fale com a ' + d.empresa + '.' }), h('button', { class: 'pubbtn noprint', onclick: () => window.print() }, ic('print', 17), 'Salvar em PDF / imprimir'));
  const produto = o => [o.litros ? o.litros + ' L' : null, o.reforco, o.formato].filter(Boolean).join(' · ') || o.produto;
  const medidas = o => [o.largura, o.comprimento].filter(x => x != null).map(x => num(x, x % 1 ? 1 : 0)).join(' × ');
  const qtd = (p, k) => [p != null ? num(p) + ' pct' : '', k != null ? kg(k) + ' kg' : ''].filter(Boolean).join(' · ');
  const barra = pct => h('div', { class: 'prog' }, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })), h('div', { class: 'lbl' }, h('span', { text: 'Produção concluída' }), h('b', { text: pct + '%' })));
  const quadro = (rot, valor, extra) => h('div', {}, h('small', { text: rot }), h('b', { text: valor }), extra ? h('span', { text: extra }) : null);

  function viewOrdem(d) {
    const o = d.ordem, cancel = o.status === 'Cancelada', idx = ETAPAS.indexOf(o.status);
    const hero = h('section', { class: 'pubhero st-' + slug(o.status) },
      h('div', { class: 'toprow' }, h('span', { class: 'kick', text: 'Seu pedido' }), h('span', { class: 'hp', text: o.status })),
      h('h1', { text: 'OP nº ' + o.numero }), h('div', { class: 'who', text: o.cliente_nome + ' · feito em ' + dt(o.data) }),
      h('div', { class: 'pubstat' }, h('div', { class: 'ico' }, ic(o.status, 24)), h('div', {}, h('b', { text: TITULO[o.status] || o.status }),
        h('span', { text: o.status === 'Entregue' && o.entregue_em ? 'Entregue em ' + dt(o.entregue_em) + '. Obrigado pela preferência!' : MSG[o.status] || '' }))),
      !cancel && o.status !== 'Entregue' && o.status !== 'Pronta' && o.progresso > 0 ? barra(o.progresso) : null);
    const passos = h('div', { class: 'psteps' }, ETAPAS.map((e, i) => {
      const feito = !cancel && i < idx, atual = !cancel && i === idx, quando = (feito || atual) ? d.etapas[e] : null;
      return h('div', { class: 'ps st-' + slug(e) + (feito ? ' done' : atual ? ' cur' : ' todo') }, h('div', { class: 'dotc' }, feito ? '✓' : atual ? ic(e, 18) : String(i + 1)),
        h('div', { class: 'pt' }, h('b', { text: e }), h('small', { text: quando ? dt(quando) : (atual ? 'Etapa atual' : feito ? 'Concluída' : (cancel ? '' : 'Próxima etapa')) })));
    }));
    const det = [['Produto', produto(o)], medidas(o) ? ['Medidas', medidas(o) + ' cm'] : null, o.espessura != null ? ['Espessura', num(o.espessura, 2)] : null, o.cor ? ['Cor', cap(o.cor)] : null,
      ['Quantidade', qtd(o.qtd_pacote, o.qtd_kg) || '—'], ['Data do pedido', dt(o.data)]].filter(Boolean);
    return [hero, cancel ? null : h('section', { class: 'pcard' }, h('h2', { text: 'Andamento do pedido' }), passos),
      h('section', { class: 'pcard' }, h('h2', { text: 'Detalhes do pedido' }), h('div', { class: 'pdet' }, det.map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: v })))))];
  }

  function viewCliente(d) {
    const t = d.totais, c = d.cliente;
    const periodo = d.de || d.ate ? 'Período: ' + (dt(d.de) || 'início') + ' a ' + (dt(d.ate) || 'hoje') : 'Todos os pedidos';
    const hero = h('section', { class: 'pubhero marca' }, h('div', { class: 'toprow' }, h('span', { class: 'kick', text: 'Relatório de pedidos' })),
      h('h1', { class: 'menor', text: c.nome }), h('div', { class: 'who', text: [c.cidade ? c.cidade + (c.uf ? '/' + c.uf : '') : '', periodo].filter(Boolean).join(' · ') }),
      h('div', { class: 'pubk' }, quadro('Pedidos', num(t.ops), 'OPs'), quadro('Pedido', kg(t.kg_ped) + ' kg', num(t.pac_ped) + ' pacotes'), quadro('Produzido', kg(t.kg_prod) + ' kg', num(t.pac_prod) + ' pacotes'), quadro('Entregue', kg(t.kg_ent) + ' kg', num(t.pac_ent) + ' pacotes')));
    return [hero, h('div', { class: 'publ2' }, d.ordens.length ? d.ordens.map(o => h('div', { class: 'pcard pubop st-' + slug(o.status) },
      h('div', { class: 'pubtit' }, h('div', {}, h('b', { class: 'opn', text: 'OP ' + o.numero }), h('span', { class: 'sub', text: ' · ' + dt(o.data) })), pill(o.status)),
      h('div', { class: 'main', text: produto(o) }), h('div', { class: 'sub', text: [medidas(o) ? medidas(o) + ' cm' : '', o.cor ? cap(o.cor) : ''].filter(Boolean).join(' · ') }),
      h('div', { class: 'pubq' }, h('span', {}, h('small', { text: 'Pedido' }), qtd(o.qtd_pacote, o.qtd_kg) || '—'), h('span', {}, h('small', { text: 'Produzido' }), qtd(o.corte_pacotes, o.corte_kg) || '—'), h('span', {}, h('small', { text: o.entregue_em ? 'Entregue em' : 'Entrega' }), o.entregue_em ? dt(o.entregue_em) : '—')),
      o.status !== 'Entregue' && o.progresso > 0 ? h('div', { class: 'mini', style: { marginTop: '12px' } }, h('i', { style: { width: o.progresso + '%' } })) : null))
      : h('div', { class: 'pcard', text: 'Nenhum pedido neste período.' }))];
  }

  function viewResumo(d) {
    const t = d.totais, periodo = d.de || d.ate ? (dt(d.de) || 'início') + ' a ' + (dt(d.ate) || 'hoje') : 'todo o período';
    const sec = (titulo, linhas, tipo) => !linhas || !linhas.length ? null : h('section', { class: 'pcard' }, h('h2', { text: titulo }), h('div', { class: 'rl' }, (tipo === 'litros' ? [...linhas].sort((a, b) => (parseInt(a.chave) || 9999) - (parseInt(b.chave) || 9999)) : linhas).map(r => {
      const pc = t.kg_ped ? Math.min(100, (r.kg_ped / t.kg_ped) * 100) : 0;
      const nome = tipo === 'cor' ? h('span', { class: 'cellrow' }, h('i', { class: 'sw', style: { background: CORES[r.chave] || 'transparent', borderColor: CORES[r.chave] ? 'transparent' : '#cfd8e3' } }), cap(r.chave)) : tipo === 'status' ? pill(r.chave) : r.chave;
      return h('div', { class: 'ri' }, h('div', { class: 'rh' }, h('b', {}, nome), h('span', { class: 'sub', text: num(r.ops) + (r.ops === 1 ? ' OP' : ' OPs') })),
        h('div', { class: 'rg' }, [['Pedido', r.kg_ped, r.pac_ped], ['Produzido', r.kg_prod, r.pac_prod], ['Entregue', r.kg_ent, r.pac_ent]].map(([x, k, p]) => h('div', {}, h('small', { text: x }), h('b', { text: kg(k) + ' kg' }), h('span', { text: num(p) + ' pct' })))),
        h('div', { class: 'share' }, h('div', { class: 'mini' }, h('i', { style: { width: pc + '%' } })), h('span', { text: num(pc, 0) + '% do total' })));
    })));
    const hero = h('section', { class: 'pubhero marca' }, h('div', { class: 'toprow' }, h('span', { class: 'kick', text: 'Resumo de produção' })), h('h1', { class: 'menor', text: 'Todos os clientes' }), h('div', { class: 'who', text: 'Período: ' + periodo }),
      h('div', { class: 'pubk' }, quadro('Pedido · ' + num(t.ops) + ' OPs', kg(t.kg_ped) + ' kg', num(t.pac_ped) + ' pacotes'), quadro('Produzido', kg(t.kg_prod) + ' kg', num(t.pac_prod) + ' pacotes'), quadro('Entregue', kg(t.kg_ent) + ' kg', num(t.pac_ent) + ' pacotes'), quadro('Aparas', kg(t.aparas) + ' kg', t.kg_prod ? num((t.aparas / t.kg_prod) * 100, 1) + '% do cortado' : '')));
    return [hero, sec('Por cor', d.cor, 'cor'), sec('Por litros', d.litros, 'litros'), sec('Por reforço', d.reforco, 'reforco'), sec('Por formato', d.formato, 'formato'), sec('Por cliente', d.clientes, 'clientes'), sec('Por etapa', d.status, 'status')];
  }

  const monta = (d, conteudo) => $app.replaceChildren(topo(d), h('main', { class: 'pub' }, ...conteudo, d && d.atualizado ? rodape(d) : null));
  function erro(msg) { monta(null, [h('section', { class: 'pcard vazio' }, h('div', { class: 'ico' }, ic('alert', 28)), h('h2', { text: 'Não foi possível abrir' }), h('p', { class: 'sub', text: msg }))]); }
  async function boot() {
    const m = location.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
    if (!m) return erro('Link inválido.');
    try {
      const r = await fetch('/api/publico/' + m[1], { headers: { Accept: 'application/json' }, referrerPolicy: 'no-referrer' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return erro(d.erro || 'Link inválido ou expirado.');
      document.title = d.tipo === 'ordem' ? 'Pedido ' + d.ordem.numero + ' · ' + d.empresa : 'Acompanhamento · ' + d.empresa;
      monta(d, d.tipo === 'ordem' ? viewOrdem(d) : d.tipo === 'cliente' ? viewCliente(d) : viewResumo(d));
    } catch { erro('Sem conexão. Tente de novo em instantes.'); }
  }
  boot();
})();
