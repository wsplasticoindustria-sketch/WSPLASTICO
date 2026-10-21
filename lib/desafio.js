// Desafio "nao sou um robo" (prova de trabalho, sem servico externo): o navegador gasta uns instantes de processamento para achar um numero
// (nonce) tal que SHA-256(prefixo + ":" + nonce) comece com N bits zero. Para uma pessoa e quase imperceptivel; para um robo tentando
// milhares de senhas, cada tentativa fica cara. Cada desafio assinado vale 1 vez e expira em 5 minutos.
const crypto = require('crypto');

const segredo = () => process.env.AUTH_SECRET || crypto.createHash('sha256').update('op|' + (process.env.AGENTE_TOKEN || '') + '|' + (process.env.DATABASE_URL || 'local')).digest('hex');
const assina = base => crypto.createHmac('sha256', segredo()).update(base).digest('base64url').slice(0, 22);

function emite(bits) {
  const prefixo = crypto.randomBytes(16).toString('base64url');   // 22 caracteres
  const base = [prefixo, Date.now() + 5 * 60e3, bits].join('.');
  return { token: base + '.' + assina(base), bits };
}
function bitsZero(buf) { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; }

// devolve o id do desafio se a solucao estiver correta (assinatura, validade, dificuldade minima e conta); senao null
function confere(token, nonce, bitsMinimos) {
  const p = String(token || '').split('.');
  if (p.length !== 4 || !/^[A-Za-z0-9_-]{22}$/.test(p[0]) || !/^\d{1,10}$/.test(String(nonce || ''))) return null;
  const base = p.slice(0, 3).join('.'), esperado = Buffer.from(assina(base)), recebido = Buffer.from(p[3]);
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  if (Number(p[1]) < Date.now() || Number(p[2]) < bitsMinimos) return null;
  return bitsZero(crypto.createHash('sha256').update(p[0] + ':' + nonce).digest()) >= Number(p[2]) ? p[0] : null;
}
// cada desafio so vale uma vez
async function consome(db, id) {
  const r = await db.um('INSERT INTO desafios(id, expira) VALUES (?, ?) ON CONFLICT(id) DO NOTHING RETURNING id', id, Date.now() + 10 * 60e3);
  return !!r;
}

module.exports = { emite, confere, consome };
