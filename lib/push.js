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

// aviso = { etapa, titulo, corpo, tag, excluirCod }; "enviar" so existe para os testes trocarem o envio real
async function avisa(db, aviso, enviar = webpush.sendNotification.bind(webpush)) {
  try {
    const trabalho = (async () => {
      const subs = await inscricoesDe(db, aviso.etapa, aviso.excluirCod);
      if (!subs.length) return;
      const k = await chaves(db);
      const op = { vapidDetails: { subject: process.env.VAPID_CONTATO || 'mailto:ordem-producao@example.com', publicKey: k.pub, privateKey: k.priv }, TTL: 6 * 3600, timeout: 3500 };
      const carga = JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo, tag: aviso.tag, url: '/' });
      await Promise.all(subs.map(async s => {
        try { await enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, op); }
        catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.roda('DELETE FROM push_inscricoes WHERE id=?', s.id); }   // aparelho que nao existe mais
      }));
    })();
    await Promise.race([trabalho.catch(() => { }), new Promise(r => setTimeout(r, LIMITE_MS))]);
  } catch { /* o aviso e opcional */ }
}

module.exports = { chaves, avisa, paraQuem };
