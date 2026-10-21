// Ordem de Producao (nuvem) - API. Roda como funcao serverless na Vercel e tambem em node:http (local.js).
// O banco do Serp NUNCA e acessado daqui: o agente no PC da cliente le o Serp (somente leitura) e envia clientes/usuarios.
const crypto = require('crypto');
const { bd } = require('./bd');
const A = require('./auth');
const D = require('./desafio');

const VERSAO = require('../package.json').version;
const cfg = {
  empresa: process.env.EMPRESA || 'WS Plásticos',
  numeroInicial: Number(process.env.NUMERO_INICIAL) || 2170,
  sessaoHoras: Number(process.env.SESSAO_HORAS) || 12,
  gruposAdmin: String(process.env.GRUPOS_ADMIN || '1').split(',').map(Number).filter(Number.isFinite),
  // senha do Serp no site: 'admin' (padrao: so o administrador no 1o acesso, para criar as senhas de acesso), 'todos' (nao recomendado) ou 'nenhum'
  aceitarSenhaSerp: { '1': 'todos', todos: 'todos', '0': 'nenhum', nenhum: 'nenhum' }[String(process.env.ACEITAR_SENHA_SERP || '').toLowerCase()] || 'admin',
  senhaMinima: Math.max(10, Number(process.env.SENHA_MINIMA) || 10),
  ociosoMin: Number(process.env.SESSAO_OCIOSA_MIN) || 120,                 // sai sozinho depois de X minutos sem usar
  intervaloMin: Number(process.env.SYNC_INTERVALO_MIN) || 10,
};
const NUVEM = !!process.env.VERCEL;
const SID = NUVEM ? '__Host-sid' : 'sid';   // __Host-: o navegador so aceita com Secure, Path=/ e sem Domain (nao da para outro subdominio sobrescrever)

const STATUS = ['Aberta', 'Em extrusão', 'Em corte e solda', 'Pronta', 'Entregue', 'Cancelada'];
const LITROS = [20, 40, 60, 100, 150, 200, 300];
const REFORCOS = ['Leve', 'Médio', 'Reforçado', 'Sup. Reforçado', 'Lonado'];
const FORMATOS = ['Capa', 'Sacola', 'Bobina'];
const CAMPOS = {
  cliente_cod: 'int', cliente_nome: 'str', data: 'date', produto: 'str', litros: 'int', reforco: 'str', formato: 'str',
  largura: 'num', comprimento: 'num', espessura: 'num', gramatura: 'num', cor: 'str',
  qtd_pacote: 'int', qtd_kg: 'num', obs: 'str', ext_bobinas: 'int', ext_kg: 'num', ext_extrusor: 'str',
  corte_pacotes: 'int', corte_kg: 'num', corte_aparas_kg: 'num', entregue_em: 'date'
};
const FLUXO = STATUS.slice(0, 5);   // etapas em ordem; o papel 'producao' so enxerga as liberadas e anda uma etapa para frente ou para tras
// campos que o papel 'producao' preenche, conforme a etapa em que a OP esta
const CAMPOS_ETAPA = { 'Em extrusão': ['ext_bobinas', 'ext_kg', 'ext_extrusor'], 'Em corte e solda': ['corte_pacotes', 'corte_kg', 'corte_aparas_kg'] };
const ROTAS_PRODUCAO = /^(GET \/api\/(me|resumo|ordens)|(GET|PUT) \/api\/ordens\/\d+) /;

class ErroHttp extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = msg => new ErroHttp(400, msg);

// ---------------- util ----------------
const hoje = () => new Date().toISOString().slice(0, 10);
const agora = () => new Date().toISOString();
function resp(res, code, obj, extra = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
}
const erro = (res, code, msg) => resp(res, code, { erro: msg });
function corpo(req, max = 200000) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);   // Vercel ja leu
  return new Promise((ok, falha) => {
    let b = '';
    if (typeof req.body === 'string') b = req.body;
    if (req.readableEnded || b) { try { return ok(b ? JSON.parse(b) : {}); } catch { return falha(bad('JSON invalido')); } }
    req.on('data', c => { b += c; if (b.length > max) { falha(bad('corpo grande')); req.destroy(); } });
    req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { falha(bad('JSON invalido')); } });
  });
}
function cookie(req, nome) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(nome + '='));
  return m ? m.slice(nome.length + 1) : null;
}
function coage(tipo, v) {
  if (v === '' || v == null) return null;
  if (tipo === 'int') { const n = Math.round(Number(String(v).replace(',', '.'))); if (!Number.isFinite(n) || n < 0 || n > 1e9) throw bad('numero invalido'); return n; }
  if (tipo === 'num') { const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < 0 || n > 1e9) throw bad('numero invalido'); return Math.round(n * 1000) / 1000; }
  if (tipo === 'date') { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad('data invalida'); return v; }
  return String(v).trim().slice(0, 1000);
}
function origem(req) {   // IP do visitante; na Vercel o proxy deles e quem preenche estes cabecalhos
  const h = req.headers;
  const ip = NUVEM ? String(h['x-real-ip'] || h['x-forwarded-for'] || '').split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || '';
  return { ip: ip || '?', https: NUVEM || String(h['x-forwarded-proto'] || '') === 'https' };
}
const cfgGet = async (db, k) => ((await db.um('SELECT valor FROM config WHERE chave=?', k)) || {}).valor || null;
const cfgSet = (db, k, v) => db.roda('INSERT INTO config(chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor', k, v);

// ---------------- sincronizacao (dados enviados pelo agente) ----------------
async function statusSync(db) {
  const ok = await cfgGet(db, 'sync_ok');
  return {
    nuvem: true, ativo: !!(ok || await cfgGet(db, 'sync_visto')), ultimoOk: ok, visto: await cfgGet(db, 'sync_visto'), erro: await cfgGet(db, 'sync_erro'),
    pedido: await cfgGet(db, 'sync_pedido'), resumo: JSON.parse((await cfgGet(db, 'sync_resumo')) || 'null'),
    clientes: (await db.um('SELECT COUNT(*) n FROM clientes WHERE ativo=1')).n, origemTravada: !!(await cfgGet(db, 'serp_origem'))
  };
}
const txt = (v, n = 200) => (v == null ? '' : String(v)).trim().slice(0, n);

async function agenteAutorizado(db, req, res) {
  const esperado = process.env.AGENTE_TOKEN;
  const chave = 'agente|' + origem(req).ip;
  const esp = await A.bloqueado(db, chave); if (esp) { erro(res, 429, 'Aguarde ' + esp + 's'); return false; }
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!esperado || esperado.length < 24 || !m || !A.iguais(m[1], esperado)) { await A.registraFalha(db, chave); erro(res, 401, 'Nao autorizado'); return false; }
  await A.limpaFalha(db, chave);
  return true;
}

// Trava: so aceita dados do MESMO banco do Serp que sincronizou primeiro (o agente manda uma impressao digital do banco, nunca o endereco)
async function origemOk(db, res, origem, grava) {
  const atual = await cfgGet(db, 'serp_origem');
  if (atual && atual !== origem) {
    await cfgSet(db, 'sync_erro', agora() + ' | Bloqueado: um agente ligado a OUTRO banco do Serp tentou sincronizar. Nada foi alterado. Se a troca for intencional, o administrador libera em Usuários.');
    resp(res, 409, { erro: 'Este agente aponta para outro banco do Serp. Sincronização bloqueada.' }); return false;
  }
  if (!atual && grava && /^[0-9a-f]{32}$/.test(String(origem || ''))) await cfgSet(db, 'serp_origem', origem);
  return true;
}

async function agentePing(db, req, res) {
  const dp = await corpo(req).catch(() => ({}));
  if (!(await origemOk(db, res, dp.origem, false))) return;
  await cfgSet(db, 'sync_visto', agora());
  const pedido = await cfgGet(db, 'sync_pedido');
  const tent = await cfgGet(db, 'sync_tentativa');
  const vencido = !tent || Date.now() - Date.parse(tent) > cfg.intervaloMin * 60 * 1000;
  return resp(res, 200, { precisa: !!(pedido || vencido), motivo: pedido ? 'pedido' : vencido ? 'intervalo' : null, versao: VERSAO });
}

async function agenteSync(db, d, res) {
  if (!(await origemOk(db, res, d.origem, !d.erro))) return;
  const t = agora();
  await cfgSet(db, 'sync_tentativa', t); await cfgSet(db, 'sync_visto', t);
  await db.roda("DELETE FROM config WHERE chave='sync_pedido'");
  if (d.erro) { await cfgSet(db, 'sync_erro', t + ' | ' + txt(d.erro, 300)); return resp(res, 200, { ok: true }); }
  if (d.semMudancas) { await cfgSet(db, 'sync_ok', t); await db.roda("DELETE FROM config WHERE chave='sync_erro'"); return resp(res, 200, { ok: true, semMudancas: true }); }

  const cl = Array.isArray(d.clientes) ? d.clientes : null, us = Array.isArray(d.usuarios) ? d.usuarios : null;
  if (!cl || !us || cl.length > 60000 || us.length > 2000) throw bad('dados invalidos');
  // clientes: vale o que chegou; quem sumiu do Serp fica inativo
  const C = cl.filter(c => Number.isInteger(c.cod) && txt(c.nome));
  const U = us.filter(u => Number.isInteger(u.cod) && txt(u.usuario) && /^[0-9a-f]{32}:[0-9a-f]{64}$/.test(String(u.hash || '')));
  const antes = await db.um('SELECT (SELECT COUNT(*) FROM clientes) c, (SELECT COUNT(*) FROM usuarios WHERE origem=\'serp\') u');
  await db.tx(async tx => {
    if (C.length) {
      await tx.roda(`INSERT INTO clientes(cod,nome,razao,doc,telefone,cidade,uf,ativo,sincronizado_em)
        SELECT * FROM unnest(?::int[], ?::text[], ?::text[], ?::text[], ?::text[], ?::text[], ?::text[], ?::int[], ?::text[])
        ON CONFLICT(cod) DO UPDATE SET nome=EXCLUDED.nome, razao=EXCLUDED.razao, doc=EXCLUDED.doc, telefone=EXCLUDED.telefone, cidade=EXCLUDED.cidade, uf=EXCLUDED.uf, ativo=EXCLUDED.ativo, sincronizado_em=EXCLUDED.sincronizado_em`,
        C.map(c => c.cod), C.map(c => txt(c.nome)), C.map(c => txt(c.razao)), C.map(c => txt(c.doc, 30)), C.map(c => txt(c.telefone, 40)), C.map(c => txt(c.cidade, 80)), C.map(c => txt(c.uf, 4)),
        C.map(c => (c.ativo === 0 ? 0 : 1)), C.map(() => t));
      await tx.roda('UPDATE clientes SET ativo=0 WHERE cod <> ALL(?::int[]) AND ativo=1', C.map(c => c.cod));
    }
    if (U.length) {
      // papel e senha de acesso web definidos aqui no sistema NAO sao sobrescritos; usuario novo vira admin so se o grupo estiver em GRUPOS_ADMIN
      await tx.roda(`INSERT INTO usuarios(cod,usuario,senha_hash,grupo,papel,ativo,origem,sincronizado_em)
        SELECT cod, usuario, hash, grupo, CASE WHEN grupo = ANY(?::int[]) THEN 'admin' ELSE 'escritorio' END, 1, 'serp', ? FROM unnest(?::int[], ?::text[], ?::text[], ?::int[]) AS x(cod, usuario, hash, grupo)
        ON CONFLICT(cod) DO UPDATE SET usuario=EXCLUDED.usuario, senha_hash=EXCLUDED.senha_hash, grupo=EXCLUDED.grupo, ativo=1, sincronizado_em=EXCLUDED.sincronizado_em`,
        cfg.gruposAdmin, t, U.map(u => u.cod), U.map(u => txt(u.usuario, 60)), U.map(u => u.hash), U.map(u => (Number.isInteger(u.grupo) ? u.grupo : null)));
      await tx.roda("UPDATE usuarios SET ativo=0 WHERE origem='serp' AND cod <> ALL(?::int[]) AND ativo=1", U.map(u => u.cod));
    }
    await cfgSet(tx, 'sync_ok', t);
    await tx.roda("DELETE FROM config WHERE chave='sync_erro'");
  });
  const r = { clientes: C.length, usuarios: U.length, novosClientes: Math.max(0, C.length - antes.c), novosUsuarios: Math.max(0, U.length - antes.u), em: t };
  await cfgSet(db, 'sync_resumo', JSON.stringify(r));
  return resp(res, 200, { ok: true, ...r });
}

// ---------------- ordens ----------------
const COLS_RESUMO = `id, numero, data, cliente_cod, cliente_nome, produto, litros, reforco, formato, largura, comprimento, espessura, gramatura, cor,
  qtd_pacote, qtd_kg, obs, ext_bobinas, ext_kg, ext_extrusor, corte_pacotes, corte_kg, corte_aparas_kg, status, entregue_em, criado_por, criado_em, atualizado_por, atualizado_em,
  grupo, (CASE WHEN grupo IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM ordens g WHERE g.grupo = ordens.grupo) END) AS grupo_n`;
function filtroOrdens(q, etapas) {
  const w = [], p = [];
  if (etapas) { w.push(etapas.length ? `status IN (${etapas.map(() => '?').join(',')})` : 'FALSE'); p.push(...etapas); }
  if (q.cliente) { w.push('cliente_cod = ?'); p.push(Number(q.cliente) || 0); }
  if (q.grupo) { w.push('grupo = ?'); p.push(Number(q.grupo) || 0); }
  if (q.ids) { const l = String(q.ids).split(',').map(Number).filter(Number.isInteger).slice(0, 100); w.push(l.length ? `id IN (${l.map(() => '?').join(',')})` : 'FALSE'); p.push(...l); }
  if (q.status) { const l = String(q.status).split(',').filter(s => STATUS.includes(s)); if (l.length) { w.push(`status IN (${l.map(() => '?').join(',')})`); p.push(...l); } }
  if (q.de) { w.push('data >= ?'); p.push(String(q.de)); }
  if (q.ate) { w.push('data <= ?'); p.push(String(q.ate)); }
  if (q.q) { const t = '%' + String(q.q).trim() + '%'; w.push('(cliente_nome ILIKE ? OR CAST(numero AS TEXT) ILIKE ? OR cor ILIKE ? OR obs ILIKE ?)'); p.push(t, t, t, t); }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}
async function listaOrdens(db, q, etapas) {
  const f = filtroOrdens(q, etapas);
  const lim = Math.min(Math.max(Number(q.limite) || 20, 1), 1000), off = Math.max(Number(q.pagina) || 0, 0) * lim;
  const total = await db.um(`SELECT COUNT(*) n, COALESCE(SUM(qtd_kg),0) kg, COALESCE(SUM(corte_kg),0) prod FROM ordens ${f.where}`, ...f.params);
  const linhas = await db.todos(`SELECT ${COLS_RESUMO} FROM ordens ${f.where} ORDER BY numero DESC LIMIT ? OFFSET ?`, ...f.params, lim, off);
  return { total: total.n, kgPedido: total.kg, kgProduzido: total.prod, linhas };
}
const hist = (t, ordemId, user, acao, detalhe) => t.roda('INSERT INTO historico(ordem_id,quando,usuario,acao,detalhe) VALUES (?,?,?,?,?)', ordemId, agora(), user, acao, detalhe || null);
function validaOrdem(d, permitidos, parcial) {
  const out = {};
  for (const [k, t] of Object.entries(CAMPOS)) {
    if (!(k in d)) continue;
    if (permitidos && !permitidos.includes(k)) continue;
    out[k] = coage(t, d[k]);
  }
  if ('litros' in out && out.litros != null && !LITROS.includes(out.litros)) throw bad('litragem invalida');
  if ('reforco' in out && out.reforco && !REFORCOS.includes(out.reforco)) throw bad('reforco invalido');
  if ('formato' in out && out.formato && !FORMATOS.includes(out.formato)) throw bad('formato invalido');
  if (!parcial) {
    if (!out.cliente_nome) throw bad('Informe o cliente');
    if (!out.data) out.data = hoje();
    out.produto = out.produto || 'Saco p/ lixo';
  } else if ('cliente_nome' in out && !out.cliente_nome) throw bad('Informe o cliente');
  return out;
}
const proximoNumero = async t => { await t.roda('SELECT pg_advisory_xact_lock(7001)'); return Math.max(((await t.um('SELECT MAX(numero) m FROM ordens')).m || 0) + 1, cfg.numeroInicial); };   // numeracao sem repetir, mesmo com dois usuarios criando ao mesmo tempo
async function inserirOrdem(t, v, numero, user, grupo) {
  const cols = Object.keys(v);
  const r = await t.um(`INSERT INTO ordens(numero, status, criado_por, criado_em, grupo, ${cols.join(',')}) VALUES (?, 'Aberta', ?, ?, ?, ${cols.map(() => '?').join(',')}) RETURNING id`, numero, user, agora(), grupo, ...cols.map(c => v[c]));
  await hist(t, r.id, user, 'Criada', 'OP ' + numero + (grupo ? ' (grupo ' + grupo + ')' : ''));
  return t.um(`SELECT ${COLS_RESUMO} FROM ordens WHERE id=?`, r.id);
}
async function criaOrdem(db, d, user) {
  const v = validaOrdem(d, null, false);
  return db.tx(async t => inserirOrdem(t, v, await proximoNumero(t), user, null));
}
// varias OPs do mesmo cliente de uma vez; ficam no mesmo grupo (tambem quando "duplica" uma OP existente: grupo_de)
async function criaLote(db, d, user) {
  const itens = Array.isArray(d.itens) ? d.itens : [];
  if (!itens.length || itens.length > 30) throw bad('Informe de 1 a 30 itens');
  const vs = itens.map(it => validaOrdem({ ...it, cliente_cod: d.cliente_cod, cliente_nome: d.cliente_nome, data: d.data }, null, false));
  return db.tx(async t => {
    let base = null;
    if (d.grupo_de) { base = await t.um('SELECT id, numero, grupo FROM ordens WHERE id=? FOR UPDATE', Number(d.grupo_de)); if (!base) throw new ErroHttp(404, 'OP de origem nao encontrada'); }
    let numero = await proximoNumero(t);
    const grupo = base ? (base.grupo || base.numero) : (vs.length > 1 ? numero : null);
    if (base && !base.grupo) { await t.roda('UPDATE ordens SET grupo=? WHERE id=?', base.numero, base.id); await hist(t, base.id, user, 'Agrupada', 'grupo ' + base.numero); }
    const ordens = [];
    for (const v of vs) ordens.push((await inserirOrdem(t, v, numero++, user, grupo)).id);
    return { grupo, ordens: await t.todos(`SELECT ${COLS_RESUMO} FROM ordens WHERE id = ANY(?::int[]) ORDER BY numero`, ordens) };   // le de novo: o tamanho do grupo so fica certo no fim
  });
}
// juntar OPs ja existentes em um grupo (junta tambem os grupos que elas ja tinham)
async function agrupaOrdens(db, ids, user) {
  ids = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))];
  if (ids.length < 2 || ids.length > 50) throw bad('Escolha de 2 a 50 OPs');
  return db.tx(async t => {
    const l = await t.todos('SELECT id, numero, grupo FROM ordens WHERE id = ANY(?::int[])', ids);
    if (l.length !== ids.length) throw new ErroHttp(404, 'OP nao encontrada');
    const grupos = [...new Set(l.map(x => x.grupo).filter(Boolean))];
    const grupo = grupos.length ? Math.min(...grupos) : Math.min(...l.map(x => x.numero));
    await t.roda('UPDATE ordens SET grupo=? WHERE id = ANY(?::int[]) OR grupo = ANY(?::int[])', grupo, ids, grupos.length ? grupos : [0]);
    for (const x of l) if (x.grupo !== grupo) await hist(t, x.id, user, 'Agrupada', 'grupo ' + grupo);
    return { grupo };
  });
}
async function desagrupaOrdem(db, id, user) {
  return db.tx(async t => {
    const o = await t.um('SELECT id, grupo FROM ordens WHERE id=?', id); if (!o) throw new ErroHttp(404, 'OP nao encontrada');
    if (!o.grupo) return { ok: true };
    await t.roda('UPDATE ordens SET grupo=NULL WHERE id=?', id); await hist(t, id, user, 'Desagrupada', 'saiu do grupo ' + o.grupo);
    const resto = await t.todos('SELECT id FROM ordens WHERE grupo=?', o.grupo);
    if (resto.length === 1) await t.roda('UPDATE ordens SET grupo=NULL WHERE id=?', resto[0].id);   // grupo de uma OP so nao faz sentido
    return { ok: true };
  });
}
async function mudaStatus(t, id, novo, eu) {
  const user = eu.usuario;
  if (!STATUS.includes(novo)) throw bad('status invalido');
  const o = await t.um('SELECT status, entregue_em FROM ordens WHERE id=?', id);
  if (!o) throw new ErroHttp(404, 'OP nao encontrada');
  if (o.status === novo) return;
  if (eu.papel === 'producao') {
    const i = FLUXO.indexOf(o.status), j = FLUXO.indexOf(novo);
    if (i < 0 || j < 0 || Math.abs(i - j) !== 1) throw bad('Você só pode avançar ou voltar uma etapa');
    if (novo === 'Entregue' && !eu.etapas.includes('Entregue')) throw new ErroHttp(403, 'Sem permissão para entregar');
  }
  await t.roda('UPDATE ordens SET status=?, entregue_em=?, atualizado_por=?, atualizado_em=? WHERE id=?',
    novo, novo === 'Entregue' ? (o.entregue_em || hoje()) : (o.status === 'Entregue' ? null : o.entregue_em), user, agora(), id);
  await hist(t, id, user, 'Status', `${o.status} → ${novo}`);
}
async function atualizaOrdem(db, id, d, eu) {
  const user = eu.usuario, prod = eu.papel === 'producao';
  return db.tx(async t => {
    const atual = await t.um('SELECT * FROM ordens WHERE id=? FOR UPDATE', id);
    if (!atual) throw new ErroHttp(404, 'OP nao encontrada');
    if (prod && !eu.etapas.includes(atual.status)) throw new ErroHttp(403, 'Esta OP não está em uma etapa liberada para você');
    if (eu.papel !== 'admin' && atual.status === 'Cancelada') throw bad('OP cancelada nao pode ser editada');
    const v = validaOrdem(d, prod ? CAMPOS_ETAPA[atual.status] || [] : null, true);
    const mudou = Object.keys(v).filter(k => String(v[k] ?? '') !== String(atual[k] ?? ''));
    if (mudou.length) {
      await t.roda(`UPDATE ordens SET ${mudou.map(c => c + '=?').join(',')}, atualizado_por=?, atualizado_em=? WHERE id=?`, ...mudou.map(c => v[c]), user, agora(), id);
      await hist(t, id, user, 'Editada', mudou.join(', '));
    }
    if (d.status && d.status !== atual.status) await mudaStatus(t, id, d.status, eu);
    return t.um(`SELECT ${COLS_RESUMO} FROM ordens WHERE id=?`, id);
  });
}

// ---------------- resumo de producao (somas por cliente / cor / litros / reforco / formato) ----------------
async function relatorio(db, q) {
  const w = ["status <> 'Cancelada'"], p = [];
  if (q.cliente) { w.push('cliente_cod = ?'); p.push(Number(q.cliente) || 0); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.de || '')) { w.push('data >= ?'); p.push(q.de); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.ate || '')) { w.push('data <= ?'); p.push(q.ate); }
  const onde = 'WHERE ' + w.join(' AND ');
  const agg = `COUNT(*) AS ops, COALESCE(SUM(qtd_pacote),0) AS pac_ped, COALESCE(SUM(qtd_kg),0) AS kg_ped,
    COALESCE(SUM(corte_pacotes),0) AS pac_prod, COALESCE(SUM(corte_kg),0) AS kg_prod, COALESCE(SUM(corte_aparas_kg),0) AS aparas,
    COALESCE(SUM(CASE WHEN status='Entregue' THEN qtd_pacote END),0) AS pac_ent, COALESCE(SUM(CASE WHEN status='Entregue' THEN qtd_kg END),0) AS kg_ent`;
  const grupo = expr => db.todos(`SELECT ${expr} AS chave, ${agg} FROM ordens ${onde} GROUP BY 1 ORDER BY kg_ped DESC, ops DESC`, ...p);
  const [totais, status, cor, litros, reforco, formato, clientes] = await Promise.all([
    db.um(`SELECT ${agg} FROM ordens ${onde}`, ...p),
    grupo('status'),
    grupo("COALESCE(NULLIF(LOWER(TRIM(cor)), ''), '(não informado)')"),
    grupo("CASE WHEN litros IS NULL THEN '(não informado)' ELSE litros::text || ' L' END"),
    grupo("COALESCE(NULLIF(TRIM(reforco), ''), '(não informado)')"),
    grupo("COALESCE(NULLIF(TRIM(formato), ''), '(não informado)')"),
    q.cliente ? [] : grupo('cliente_nome')
  ]);
  return { totais, status, cor, litros, reforco, formato, clientes: clientes.slice(0, 50) };
}
async function csvRelatorio(db, d, q) {
  const esc = v => { v = v == null ? '' : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const n = v => (v == null ? '' : String(v).replace('.', ','));
  const cli = q.cliente ? ((await db.um('SELECT nome FROM clientes WHERE cod=?', Number(q.cliente) || 0)) || {}).nome || q.cliente : 'Todos os clientes';
  const lin = (g, k, o) => [g, k, o.ops, o.pac_ped, n(o.kg_ped), o.pac_prod, n(o.kg_prod), o.pac_ent, n(o.kg_ent), n(o.aparas)].map(esc).join(';');
  const out = ['Resumo de produção', 'Cliente;' + esc(cli), 'Período;' + (q.de || 'início') + ';' + (q.ate || 'hoje'), '',
    ['Agrupamento', 'Item', 'OPs', 'Pacotes pedidos', 'Kg pedidos', 'Pacotes produzidos', 'Kg produzidos', 'Pacotes entregues', 'Kg entregues', 'Aparas kg'].join(';'), lin('Total', 'Todas as OPs', d.totais)];
  for (const [g, rot] of [['cor', 'Cor'], ['litros', 'Litros'], ['reforco', 'Reforço'], ['formato', 'Formato'], ['status', 'Etapa'], ['clientes', 'Cliente']]) for (const r of d[g]) out.push(lin(rot, r.chave, r));
  return '﻿' + out.join('\r\n');
}
function csv(linhas) {
  const cab = ['OP', 'Data', 'Cliente', 'Produto', 'Litros', 'Reforço', 'Formato', 'Largura', 'Comprimento', 'Espessura', 'Gramatura', 'Cor', 'Qnt pacote', 'Qnt Kg', 'Obs', 'Qnt bobina', 'Extrusão Kg', 'Extrusor', 'Corte pacotes', 'Corte Kg', 'Aparas Kg', 'Status', 'Entregue em'];
  const esc = v => { v = v == null ? '' : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const num = v => (v == null ? '' : String(v).replace('.', ','));
  const rows = linhas.map(o => [o.numero, o.data, o.cliente_nome, o.produto, o.litros, o.reforco, o.formato, num(o.largura), num(o.comprimento), num(o.espessura), num(o.gramatura), o.cor, o.qtd_pacote, num(o.qtd_kg), o.obs, o.ext_bobinas, num(o.ext_kg), o.ext_extrusor, o.corte_pacotes, num(o.corte_kg), num(o.corte_aparas_kg), o.status, o.entregue_em].map(esc).join(';'));
  return '﻿' + [cab.join(';'), ...rows].join('\r\n');
}

// ---------------- links publicos (o cliente acompanha o pedido sem login) ----------------
const TIPOS_LINK = { ordem: 60, cliente: 30, resumo: 7 };   // validade padrao, em dias
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const COLS_LINK = 'id, token, tipo, ref, de, ate, criado_por, criado_em, expira_em, revogado, acessos, ultimo_acesso';
async function criaLink(db, d, user) {
  const tipo = String(d.tipo || ''); if (!(tipo in TIPOS_LINK)) throw bad('tipo invalido');
  let ref = null;
  if (tipo === 'ordem') { ref = Number(d.ref); if (!(await db.um('SELECT 1 AS x FROM ordens WHERE id=?', ref))) throw new ErroHttp(404, 'OP nao encontrada'); }
  if (tipo === 'cliente') { ref = Number(d.ref); if (!(await db.um('SELECT 1 AS x FROM clientes WHERE cod=?', ref))) throw new ErroHttp(404, 'Cliente nao encontrado'); }
  const de = DATA.test(d.de || '') ? d.de : null, ate = DATA.test(d.ate || '') ? d.ate : null;
  const dias = Math.min(Math.max(parseInt(d.dias) || TIPOS_LINK[tipo], 1), 90);
  const igual = 'tipo=? AND ref IS NOT DISTINCT FROM ?::int AND de IS NOT DISTINCT FROM ?::text AND ate IS NOT DISTINCT FROM ?::text AND revogado=0';
  if (!d.novo) {   // mesmo pedido/relatorio => mesmo link (nao multiplica links por engano)
    const ex = await db.um(`SELECT ${COLS_LINK} FROM links WHERE ${igual} AND expira_em > ? ORDER BY id DESC LIMIT 1`, tipo, ref, de, ate, agora());
    if (ex) return ex;
  } else await db.roda(`UPDATE links SET revogado=1 WHERE ${igual}`, tipo, ref, de, ate);   // "gerar novo" invalida o anterior
  const exp = new Date(Date.now() + dias * 864e5).toISOString();
  return db.um(`INSERT INTO links(token,tipo,ref,de,ate,criado_por,criado_em,expira_em) VALUES (?,?,?,?,?,?,?,?) RETURNING ${COLS_LINK}`,
    crypto.randomBytes(24).toString('base64url'), tipo, ref, de, ate, user, agora(), exp);
}
async function listaLinks(db, q) {
  const tipo = String(q.tipo || ''); if (!(tipo in TIPOS_LINK)) throw bad('tipo invalido');
  return db.todos(`SELECT ${COLS_LINK} FROM links WHERE tipo=? AND ref IS NOT DISTINCT FROM ?::int AND revogado=0 AND expira_em > ? ORDER BY id DESC LIMIT 5`, tipo, q.ref ? Number(q.ref) || 0 : null, agora());
}
async function publico(db, req, res, token) {
  const chave = 'pub|' + origem(req).ip;
  const esp = await A.bloqueado(db, chave); if (esp) return erro(res, 429, 'Muitas tentativas. Aguarde alguns minutos.');
  const l = /^[A-Za-z0-9_-]{32}$/.test(token) ? await db.um('SELECT * FROM links WHERE token=?', token) : null;
  if (!l || l.revogado || l.expira_em <= agora()) { await A.registraFalha(db, chave); return resp(res, 404, { erro: 'Link inválido ou expirado. Peça um novo link à empresa.' }, { 'X-Robots-Tag': 'noindex' }); }
  await db.roda('UPDATE links SET acessos=acessos+1, ultimo_acesso=? WHERE id=?', agora(), l.id);
  const base = { empresa: cfg.empresa, tipo: l.tipo, atualizado: agora(), expira_em: l.expira_em, de: l.de, ate: l.ate };
  // so o que o cliente precisa ver: nada de usuario, observacao interna, extrusor, aparas
  const seguro = o => ({ numero: o.numero, data: o.data, produto: o.produto, litros: o.litros, reforco: o.reforco, formato: o.formato, largura: o.largura, comprimento: o.comprimento, espessura: o.espessura, cor: o.cor,
    qtd_pacote: o.qtd_pacote, qtd_kg: o.qtd_kg, corte_pacotes: o.corte_pacotes, corte_kg: o.corte_kg, status: o.status, entregue_em: o.entregue_em, progresso: o.qtd_kg ? Math.min(100, Math.round(((o.corte_kg || 0) / o.qtd_kg) * 100)) : 0 });
  let out;
  if (l.tipo === 'ordem') {
    const o = await db.um(`SELECT ${COLS_RESUMO} FROM ordens WHERE id=?`, l.ref); if (!o) return erro(res, 404, 'Pedido não encontrado.');
    const hs = await db.todos('SELECT quando, acao, detalhe FROM historico WHERE ordem_id=? ORDER BY id', l.ref);
    const etapas = {};
    for (const x of hs) { if (x.acao === 'Criada') etapas['Aberta'] = x.quando; else if (x.acao === 'Status') etapas[String(x.detalhe || '').split('→').pop().trim()] = x.quando; }
    if (o.entregue_em && o.status === 'Entregue') etapas['Entregue'] = etapas['Entregue'] || o.entregue_em;
    out = { ...base, ordem: { ...seguro(o), cliente_nome: o.cliente_nome }, etapas };
  } else if (l.tipo === 'cliente') {
    const c = await db.um('SELECT nome, cidade, uf FROM clientes WHERE cod=?', l.ref); if (!c) return erro(res, 404, 'Cliente não encontrado.');
    const filtro = { cliente: l.ref, de: l.de || undefined, ate: l.ate || undefined };
    const [rel, lista] = await Promise.all([relatorio(db, filtro), listaOrdens(db, { ...filtro, limite: 300 })]);
    const t = rel.totais; delete t.aparas;
    out = { ...base, cliente: { nome: c.nome, cidade: c.cidade, uf: c.uf }, totais: t, ordens: lista.linhas.filter(o => o.status !== 'Cancelada').map(seguro) };
  } else {
    out = { ...base, ...(await relatorio(db, { de: l.de || undefined, ate: l.ate || undefined })) };
  }
  return resp(res, 200, out, { 'X-Robots-Tag': 'noindex' });
}

// ---------------- login (endurecido) ----------------
const GENERICO = 'Usuário ou senha incorretos, ou acesso ainda não liberado. Fale com o administrador se o problema continuar.';
const logAcesso = (db, login, ip, ok, motivo) => db.roda('INSERT INTO login_log(quando, login, ip, ok, motivo) VALUES (?,?,?,?,?)', agora(), String(login).slice(0, 60), ip, ok ? 1 : 0, motivo).catch(() => { });
const tempoTxt = s => (s >= 3600 ? Math.ceil(s / 3600) + ' h' : s >= 60 ? Math.ceil(s / 60) + ' min' : s + ' s');
async function login(db, req, res, o) {
  const d = await corpo(req); const usuario = String(d.usuario || '').trim().slice(0, 60), senha = String(d.senha || '').slice(0, 200);
  const chaves = A.chavesLogin(o.ip, usuario);
  const esp = await A.segundosBloqueado(db, chaves.map(c => c[1]));
  if (esp) { await logAcesso(db, usuario, o.ip, false, 'bloqueado'); return resp(res, 429, { erro: 'Muitas tentativas. Aguarde ' + tempoTxt(esp) + ' e tente de novo.', espera: esp }, { 'Retry-After': String(esp) }); }
  // 1) isca para robos: campo escondido que pessoas nao preenchem
  if (d.site) { await A.registraFalha(db, 'i|' + o.ip, A.LIMITES.i); await logAcesso(db, usuario, o.ip, false, 'robo'); return erro(res, 400, 'Verificação de segurança falhou. Recarregue a página.'); }
  // 2) desafio "nao sou um robo" (prova de trabalho): obrigatorio, vale 1 vez, dificuldade sobe se o IP vem errando
  const id = D.confere(d.desafio, d.nonce, await A.bitsPara(db, o.ip));
  if (!id || !(await D.consome(db, id))) { await A.registraFalha(db, 'i|' + o.ip, A.LIMITES.i); await logAcesso(db, usuario, o.ip, false, 'desafio'); return resp(res, 400, { erro: 'A verificação de segurança expirou. Marque "Não sou um robô" de novo.', desafio: true }); }
  // 3) credenciais: mesma mensagem e mesmo tempo para usuario inexistente, senha errada e acesso nao liberado
  const u = await db.um('SELECT * FROM usuarios WHERE lower(usuario)=lower(?) AND ativo=1', usuario);
  let ok = false, motivo = 'senha';
  if (u && senha) {
    if (u.senha_web_hash) ok = A.confereSenha(senha, u.senha_web_hash);                                                        // senha propria do sistema web
    else if (cfg.aceitarSenhaSerp === 'todos' || (cfg.aceitarSenhaSerp === 'admin' && u.papel === 'admin')) ok = A.confereSenha(senha, u.senha_hash);   // senha do Serp (so primeiro acesso do admin)
    else { A.confereSenha(senha, A.HASH_FALSO); motivo = 'sem_acesso_web'; }
  } else { A.confereSenha(senha, A.HASH_FALSO); motivo = u ? 'vazia' : 'usuario'; }
  if (!ok) {
    await Promise.all([A.registraFalha(db, chaves[0][1], A.LIMITES.iu), A.registraFalha(db, chaves[1][1], A.LIMITES.i), A.registraFalha(db, chaves[2][1], A.LIMITES.u)]);
    await logAcesso(db, usuario, o.ip, false, motivo);
    return erro(res, 401, GENERICO);
  }
  await A.limpaFalha(db, chaves[0][1]);
  await logAcesso(db, u.usuario, o.ip, true, 'ok');
  const s = await A.novaSessao(db, u.cod, cfg.sessaoHoras);
  return resp(res, 200, { usuario: u.usuario, papel: u.papel }, { 'Set-Cookie': `${SID}=${s.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${s.maxAge}${o.https ? '; Secure' : ''}` });
}

// ---------------- rotas ----------------
async function api(db, req, res, url) {
  const m = req.method, p = url.pathname, q = Object.fromEntries(url.searchParams);
  if (m !== 'GET' && m !== 'HEAD' && req.headers.origin) {   // defesa extra contra CSRF (alem do cookie SameSite=Strict): o Origin tem que ser este mesmo site
    let ok = false; try { ok = new URL(req.headers.origin).host === String(req.headers.host || '').toLowerCase(); } catch { /* origem invalida */ }
    if (!ok) return erro(res, 403, 'Origem não permitida');
  }
  if (m !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json') && m !== 'DELETE') return erro(res, 415, 'Use application/json');
  if (m === 'GET' && p === '/api/config') return resp(res, 200, { empresa: cfg.empresa, litros: LITROS, reforcos: REFORCOS, formatos: FORMATOS, status: STATUS, senhaMinima: cfg.senhaMinima, versao: VERSAO });

  // --- pagina publica de acompanhamento (link com token, sem login) ---
  let pb;
  if (m === 'GET' && (pb = p.match(/^\/api\/publico\/([A-Za-z0-9_-]{1,64})$/))) return publico(db, req, res, pb[1]);

  // --- agente do PC da cliente (token proprio, sem sessao) ---
  if (p === '/api/agente/ping' && m === 'POST') { if (!(await agenteAutorizado(db, req, res))) return; return agentePing(db, req, res); }
  if (p === '/api/agente/sync' && m === 'POST') { if (!(await agenteAutorizado(db, req, res))) return; return agenteSync(db, await corpo(req, 4000000), res); }

  const o = origem(req);
  if (m === 'GET' && p === '/api/desafio') { const bits = await A.bitsPara(db, o.ip); return resp(res, 200, D.emite(bits)); }
  if (m === 'POST' && p === '/api/login') return login(db, req, res, o);
  const token = cookie(req, SID); const eu = await A.sessaoDe(db, token, cfg.ociosoMin * 60e3);
  if (m === 'POST' && p === '/api/logout') { if (token) await A.encerraSessao(db, token); return resp(res, 200, { ok: true }, { 'Set-Cookie': SID + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' + (NUVEM ? '; Secure' : '') }); }
  if (!eu) return erro(res, 401, 'Sessão expirada');
  const admin = eu.papel === 'admin', prod = eu.papel === 'producao', podeEditar = !prod;
  if (prod && !ROTAS_PRODUCAO.test(m + ' ' + p + ' ')) return erro(res, 403, 'Sem permissão');   // producao: so ve e move as OPs das etapas liberadas

  if (m === 'GET' && p === '/api/me') return resp(res, 200, { usuario: eu.usuario, papel: eu.papel, etapas: prod ? eu.etapas : null });

  if (m === 'GET' && p === '/api/resumo') {
    if (prod) return resp(res, 200, { porStatus: await db.todos('SELECT status, COUNT(*) n FROM ordens WHERE status = ANY(?::text[]) GROUP BY status', eu.etapas) });
    const mes = hoje().slice(0, 7);
    const [por, doMes, ent, sync] = await Promise.all([
      db.todos('SELECT status, COUNT(*) n, COALESCE(SUM(qtd_kg),0) kg FROM ordens GROUP BY status'),
      db.um("SELECT COALESCE(SUM(corte_kg),0) kg, COALESCE(SUM(corte_pacotes),0) pac, COALESCE(SUM(corte_aparas_kg),0) aparas FROM ordens WHERE data LIKE ? AND status<>'Cancelada'", mes + '%'),
      db.um('SELECT COUNT(*) n FROM ordens WHERE entregue_em LIKE ?', mes + '%'),
      statusSync(db)]);
    return resp(res, 200, { porStatus: por, mes: { ...doMes, entregues: ent.n }, sync });
  }
  if (m === 'GET' && p === '/api/atividade') {
    const lim = Math.min(Math.max(Number(q.limite) || 5, 1), 30);
    return resp(res, 200, await db.todos('SELECT h.quando, h.usuario, h.acao, h.detalhe, o.id AS ordem_id, o.numero, o.cliente_nome FROM historico h JOIN ordens o ON o.id = h.ordem_id ORDER BY h.id DESC LIMIT ?', lim));
  }
  if (m === 'GET' && p === '/api/relatorio') return resp(res, 200, await relatorio(db, q));
  if (m === 'GET' && p === '/api/export/relatorio.csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="resumo_producao_${hoje()}.csv"`, 'Cache-Control': 'no-store' });
    return res.end(await csvRelatorio(db, await relatorio(db, q), q));
  }
  if (m === 'GET' && p === '/api/clientes') {
    const t = q.q ? '%' + q.q + '%' : null;
    const lim = Math.min(Math.max(Number(q.limite) || 20, 1), 200), off = Math.max(Number(q.pagina) || 0, 0) * lim;
    const onde = `c.ativo=1 ${t ? 'AND (c.nome ILIKE ? OR c.razao ILIKE ? OR c.doc ILIKE ?)' : ''}
      ${q.comOrdens === '1' ? "AND EXISTS (SELECT 1 FROM ordens x WHERE x.cliente_cod=c.cod AND x.status<>'Cancelada')" : ''}`;
    const pb = t ? [t, t, t] : [];
    const total = (await db.um(`SELECT COUNT(*) n FROM clientes c WHERE ${onde}`, ...pb)).n;
    const linhas = await db.todos(`SELECT c.cod, c.nome, c.cidade, c.uf, c.doc, c.telefone, COUNT(o.id) total,
        COUNT(*) FILTER (WHERE o.status IN ('Aberta','Em extrusão','Em corte e solda')) andamento, COUNT(*) FILTER (WHERE o.status='Pronta') prontas,
        COUNT(*) FILTER (WHERE o.status='Entregue') entregues, COALESCE(SUM(o.qtd_kg),0) kg_pedido, COALESCE(SUM(o.corte_kg),0) kg_produzido
      FROM clientes c LEFT JOIN ordens o ON o.cliente_cod=c.cod AND o.status<>'Cancelada'
      WHERE ${onde} GROUP BY c.cod ORDER BY c.nome LIMIT ? OFFSET ?`, ...pb, lim, off);
    return resp(res, 200, { total, linhas });
  }
  let mm;
  if (m === 'GET' && (mm = p.match(/^\/api\/clientes\/(\d+)$/))) {
    const c = await db.um('SELECT cod,nome,razao,doc,telefone,cidade,uf FROM clientes WHERE cod=?', Number(mm[1]));
    if (!c) return erro(res, 404, 'Cliente não encontrado');
    const [ord, por] = await Promise.all([listaOrdens(db, { cliente: c.cod, limite: q.limite || 20, pagina: q.pagina || 0 }),
      db.todos("SELECT status, COUNT(*) n, COALESCE(SUM(qtd_kg),0) kg, COALESCE(SUM(corte_kg),0) prod FROM ordens WHERE cliente_cod=? AND status<>'Cancelada' GROUP BY status", c.cod)]);
    return resp(res, 200, { cliente: c, porStatus: por, ...ord });
  }

  if (m === 'GET' && p === '/api/ordens') return resp(res, 200, await listaOrdens(db, q, prod ? eu.etapas : null));
  if (m === 'GET' && p === '/api/export/ordens.csv') {
    const l = (await listaOrdens(db, { ...q, limite: 1000 })).linhas;
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ordens_${hoje()}.csv"`, 'Cache-Control': 'no-store' });
    return res.end(csv(l));
  }
  if (m === 'POST' && p === '/api/ordens') { if (!podeEditar) return erro(res, 403, 'Sem permissão'); return resp(res, 201, await criaOrdem(db, await corpo(req), eu.usuario)); }
  if (m === 'POST' && p === '/api/ordens/lote') { if (!podeEditar) return erro(res, 403, 'Sem permissão'); return resp(res, 201, await criaLote(db, await corpo(req, 600000), eu.usuario)); }
  if (m === 'POST' && p === '/api/ordens/agrupar') { if (!podeEditar) return erro(res, 403, 'Sem permissão'); return resp(res, 200, await agrupaOrdens(db, (await corpo(req)).ids, eu.usuario)); }
  if (m === 'POST' && p === '/api/ordens/desagrupar') { if (!podeEditar) return erro(res, 403, 'Sem permissão'); return resp(res, 200, await desagrupaOrdem(db, Number((await corpo(req)).id), eu.usuario)); }
  if ((mm = p.match(/^\/api\/ordens\/(\d+)$/))) {
    const id = Number(mm[1]);
    if (m === 'GET') {
      const [ord, h] = await Promise.all([db.um(`SELECT ${COLS_RESUMO} FROM ordens WHERE id=?`, id), db.todos('SELECT quando, usuario, acao, detalhe FROM historico WHERE ordem_id=? ORDER BY id DESC', id)]);
      if (!ord || (prod && !eu.etapas.includes(ord.status))) return erro(res, 404, 'OP não encontrada');
      return resp(res, 200, { ...ord, historico: h });
    }
    if (m === 'PUT') return resp(res, 200, await atualizaOrdem(db, id, await corpo(req), eu));
  }

  if (admin && m === 'GET' && p === '/api/usuarios') return resp(res, 200, await db.todos('SELECT cod, usuario, grupo, papel, etapas, ativo, origem, sincronizado_em, CASE WHEN senha_web_hash IS NOT NULL THEN 1 ELSE 0 END AS senha_web FROM usuarios ORDER BY usuario'));
  if (admin && m === 'PUT' && (mm = p.match(/^\/api\/usuarios\/(\d+)$/))) {
    const d = await corpo(req); const cod = Number(mm[1]);
    if (d.papel && !['admin', 'escritorio', 'producao'].includes(d.papel)) return erro(res, 400, 'Papel inválido');
    if (cod === eu.cod && (d.papel && d.papel !== 'admin' || d.ativo === 0)) return erro(res, 400, 'Você não pode remover seu próprio acesso de administrador');
    if ('etapas' in d && !(Array.isArray(d.etapas) && d.etapas.every(e => FLUXO.includes(e)))) return erro(res, 400, 'Etapas inválidas');
    let hash;
    if ('senha_web' in d && d.senha_web !== '' && d.senha_web != null) {
      const sw = String(d.senha_web), alvo = await db.um('SELECT usuario FROM usuarios WHERE cod=?', cod);
      const fraca = A.senhaFraca(sw, alvo && alvo.usuario, cfg.senhaMinima); if (fraca) return erro(res, 400, fraca);
      hash = A.hashSenha(sw);
    }
    await db.tx(async t => {
      if (d.papel) await t.roda('UPDATE usuarios SET papel=? WHERE cod=?', d.papel, cod);
      if ('etapas' in d) await t.roda('UPDATE usuarios SET etapas=? WHERE cod=?', FLUXO.filter(e => d.etapas.includes(e)).join(',') || null, cod);
      if ('ativo' in d) await t.roda('UPDATE usuarios SET ativo=? WHERE cod=?', d.ativo ? 1 : 0, cod);
      if ('senha_web' in d) {   // senha propria do acesso web (so o hash e guardado); vazio = volta a usar a senha do Serp (quando permitido)
        await t.roda('UPDATE usuarios SET senha_web_hash=? WHERE cod=?', hash || null, cod);
        if (cod !== eu.cod) await t.roda('DELETE FROM sessoes WHERE usuario_cod=?', cod);   // derruba as sessoes antigas do usuario
      }
    });
    return resp(res, 200, { ok: true });
  }
  if (m === 'GET' && p === '/api/links') return resp(res, 200, await listaLinks(db, q));
  if (m === 'POST' && p === '/api/links') { if (!podeEditar) return erro(res, 403, 'Sem permissão'); return resp(res, 200, await criaLink(db, await corpo(req), eu.usuario)); }
  if (m === 'DELETE' && (mm = p.match(/^\/api\/links\/(\d+)$/))) { if (!podeEditar) return erro(res, 403, 'Sem permissão'); await db.roda('UPDATE links SET revogado=1 WHERE id=?', Number(mm[1])); return resp(res, 200, { ok: true }); }
  if (admin && m === 'POST' && p === '/api/sync/origem') { await db.roda("DELETE FROM config WHERE chave IN ('serp_origem','sync_erro')"); return resp(res, 200, { ok: true }); }
  if (admin && m === 'GET' && p === '/api/seguranca') {   // acessos recentes e tentativas suspeitas
    const [recentes, r] = await Promise.all([db.todos('SELECT quando, login, ip, ok, motivo FROM login_log ORDER BY id DESC LIMIT 60'),
      db.um("SELECT COUNT(*) FILTER (WHERE ok=1) AS ok, COUNT(*) FILTER (WHERE ok=0) AS falhas, COUNT(*) FILTER (WHERE motivo='bloqueado') AS bloqueios FROM login_log WHERE quando > ?", new Date(Date.now() - 864e5).toISOString())]);
    return resp(res, 200, { recentes, resumo: r });
  }
  if (m === 'GET' && p === '/api/sync/status') return resp(res, 200, await statusSync(db));
  if (admin && m === 'POST' && p === '/api/sync') {   // "pedido": o agente atende assim que o PC da cliente estiver ligado
    await cfgSet(db, 'sync_pedido', agora());
    return resp(res, 200, { pedido: true, mensagem: 'Pedido registrado. O PC da cliente atende em até 2 minutos depois de ligado.' });
  }
  return erro(res, 404, 'Rota não encontrada');
}

let limpou = 0;
async function tratar(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const db = await bd();
    if (Date.now() - limpou > 3600e3) { limpou = Date.now(); A.limpaSessoes(db).catch(() => { }); }
    return await api(db, req, res, url);
  } catch (e) {
    if (res.headersSent) return;
    const code = e instanceof ErroHttp ? e.code : 500;
    if (code === 500) console.error('erro:', e && e.stack || e);
    erro(res, code, code === 500 ? 'Erro interno' : e.message);
  }
}

module.exports = { tratar, cfg, bd, A };
