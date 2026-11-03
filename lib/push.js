// Notificacoes push (Web Push / VAPID). Falha de envio NUNCA desfaz nem atrasa muito uma OP: tudo aqui engole o erro.
const webpush = require('web-push');

const LIMITE_MS = 4000;   // tempo maximo esperando os avisos (a funcao da Vercel encerra quando a resposta sai)

// chaves geradas na 1a vez e guardadas em config (nao precisa configurar variavel na Vercel)
async function chaves(db) {
  const le = async () => Object.fromEntries((await db.todos("SELECT chave, valor FROM config WHERE chave IN ('vapid_pub','vapid_priv')")).map(r => [r.chave, r.valor]));
  let c = await le();
  if (!c.vapid_pub || !c.vapid_priv) {
    const k = webpush.generateVAPIDKeys();
    await db.roda("INSERT INTO config(chave,valor) VALUES ('vapid_pub',?),('vapid_priv',?) ON CONFLICT(chave) DO NOTHING", k.publicKey, k.privateKey);
    c = await le();   // se duas chamadas geraram ao mesmo tempo, vale a que gravou primeiro
  }
  return { pub: c.vapid_pub, priv: c.vapid_priv };
}

// quem recebe: administradores + papel Producao que tem a etapa liberada; quem fez a acao nao recebe
function paraQuem(usuarios, etapa, excluirCod) {
  return usuarios.filter(u => u.cod !== excluirCod && (u.papel === 'admin' || (u.papel === 'producao' && String(u.etapas || '').split(',').includes(etapa)))).map(u => u.cod);
}

async function inscricoesDe(db, etapa, excluirCod) {
  const us = await db.todos("SELECT cod, papel, etapas FROM usuarios WHERE ativo=1 AND papel IN ('admin','producao')");
  const cods = paraQuem(us, etapa, excluirCod);
  if (!cods.length) return [];
  return db.todos('SELECT id, endpoint, p256dh, auth FROM push_inscricoes WHERE usuario_cod = ANY(?::int[])', cods);
}

// envia para uma lista de inscricoes e devolve o resultado de cada uma ({ ok, status, erro }); remove as que nao existem mais
async function enviaPara(db, subs, aviso, enviar = webpush.sendNotification.bind(webpush)) {
  const k = await chaves(db);
  const op = { vapidDetails: { subject: process.env.VAPID_CONTATO || 'mailto:ordem-producao@example.com', publicKey: k.pub, privateKey: k.priv }, TTL: 6 * 3600, timeout: 3500 };
  const carga = JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo, tag: aviso.tag, url: '/' });
  return Promise.all(subs.map(async s => {
    try { await enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, op); return { ok: true, status: 201 }; }
    catch (e) {
      const status = (e && e.statusCode) || 0, erro = String((e && (e.body || e.message)) || e).slice(0, 200);
      if (status === 404 || status === 410) await db.roda('DELETE FROM push_inscricoes WHERE id=?', s.id);   // aparelho que nao existe mais
      console.error('push falhou', status, new URL(s.endpoint).host, erro);   // aparece nos logs da Vercel
      return { ok: false, status, erro };
    }
  }));
}

// aviso = { etapa, titulo, corpo, tag, excluirCod }; "enviar" so existe para os testes trocarem o envio real
async function avisa(db, aviso, enviar) {
  try {
    const trabalho = (async () => {
      const subs = await inscricoesDe(db, aviso.etapa, aviso.excluirCod);
      if (subs.length) await enviaPara(db, subs, aviso, enviar);
    })();
    await Promise.race([trabalho.catch(e => console.error('push erro', e && e.message)), new Promise(r => setTimeout(r, LIMITE_MS))]);
  } catch (e) { console.error('push erro', e && e.message); }   // o aviso e opcional
}

// teste para o proprio usuario: manda uma notificacao para os aparelhos dele e diz o que aconteceu com cada um
async function teste(db, usuarioCod, enviar) {
  const subs = await db.todos('SELECT id, endpoint, p256dh, auth FROM push_inscricoes WHERE usuario_cod=?', usuarioCod);
  return { aparelhos: subs.length, resultados: await enviaPara(db, subs, { titulo: 'Notificações ativadas', corpo: 'Você vai receber os avisos das OPs neste aparelho.', tag: 'teste' }, enviar) };
}

module.exports = { chaves, avisa, paraQuem, teste };
