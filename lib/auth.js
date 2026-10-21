const crypto = require('crypto');

function hashSenha(senha, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(String(senha), salt, 32).toString('hex');
}
function confereSenha(senha, guardado) {
  if (!guardado || !guardado.includes(':')) return false;
  const [s, h] = guardado.split(':');
  const calc = crypto.scryptSync(String(senha), Buffer.from(s, 'hex'), 32);
  const esperado = Buffer.from(h, 'hex');
  return esperado.length === calc.length && crypto.timingSafeEqual(calc, esperado);
}
const HASH_FALSO = hashSenha('x');   // gasta o mesmo tempo quando o usuario nao existe (nao revela quem existe)
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const iguais = (a, b) => { const x = Buffer.from(sha(a)), y = Buffer.from(sha(b)); return crypto.timingSafeEqual(x, y); };

// ---- bloqueio contra tentativa de senha (guardado no banco: vale para todas as instancias da nuvem) ----
// Cada erro conta em 3 chaves: IP+usuario, so o IP e so o usuario (ataque vindo de varios IPs). O bloqueio CRESCE a cada reincidencia (x3, ate o teto).
const LIMITES = {
  iu: { max: 5, base: 5 * 60e3, teto: 6 * 3600e3 },    // 5 erros do mesmo IP no mesmo usuario: 5 min, 15 min, 45 min...
  i: { max: 25, base: 15 * 60e3, teto: 6 * 3600e3 },   // 25 erros do mesmo IP (varios usuarios)
  u: { max: 20, base: 10 * 60e3, teto: 3600e3 },       // 20 erros no mesmo usuario vindos de qualquer IP
};
const chavesLogin = (ip, login) => [['iu', 'iu|' + ip + '|' + login.toLowerCase()], ['i', 'i|' + ip], ['u', 'u|' + login.toLowerCase()]];
async function segundosBloqueado(db, chaves) {   // chaves: [chave, ...]
  let mais = 0;
  for (const c of chaves) { const f = await db.um('SELECT ate FROM tentativas WHERE chave=?', c); if (f && Number(f.ate) > Date.now()) mais = Math.max(mais, Math.ceil((Number(f.ate) - Date.now()) / 1000)); }
  return mais;
}
async function registraFalha(db, chave, lim = LIMITES.iu) {
  const f = await db.um('SELECT n, ate, nivel, ult FROM tentativas WHERE chave=?', chave);
  const agora = Date.now();
  let n = f ? f.n : 0, nivel = f ? f.nivel : 0, ate = f ? Number(f.ate) : 0;
  if (f && ate < agora && agora - Number(f.ult || 0) > 3600e3) { n = 0; nivel = 0; }   // 1 hora sem erro: esquece
  n++;
  if (n >= lim.max) { ate = agora + Math.min(lim.base * 3 ** nivel, lim.teto); n = 0; nivel++; }
  await db.roda('INSERT INTO tentativas(chave,n,ate,nivel,ult) VALUES (?,?,?,?,?) ON CONFLICT(chave) DO UPDATE SET n=EXCLUDED.n, ate=EXCLUDED.ate, nivel=EXCLUDED.nivel, ult=EXCLUDED.ult', chave, n, ate, nivel, agora);
}
const limpaFalha = (db, chave) => db.roda('DELETE FROM tentativas WHERE chave=?', chave);
// compatibilidade com as chamadas simples (links publicos e agente): uma chave so
const bloqueado = (db, chave) => segundosBloqueado(db, [chave]);
// dificuldade do desafio "nao sou robo": sobe quando o IP vem errando
async function bitsPara(db, ip, base = 18) {
  const f = await db.um('SELECT n, nivel, ate FROM tentativas WHERE chave=?', 'i|' + ip);
  return base + (f ? Math.min(2 * f.nivel + Math.floor(f.n / 5), 6) : 0);
}

// ---- sessao: token aleatorio (so o hash fica no banco), expira por tempo total e por inatividade ----
async function novaSessao(db, usuarioCod, horas) {
  const token = crypto.randomBytes(32).toString('hex');
  const agora = new Date(), exp = new Date(agora.getTime() + horas * 3600 * 1000);
  await db.roda('INSERT INTO sessoes(token,usuario_cod,criado_em,expira_em,ultimo_uso) VALUES (?,?,?,?,?)', sha(token), usuarioCod, agora.toISOString(), exp.toISOString(), agora.toISOString());
  // no maximo 5 sessoes abertas por usuario: as mais antigas caem
  await db.roda('DELETE FROM sessoes WHERE usuario_cod=? AND token NOT IN (SELECT token FROM sessoes WHERE usuario_cod=? ORDER BY criado_em DESC LIMIT 5)', usuarioCod, usuarioCod);
  return { token, maxAge: horas * 3600 };
}
async function sessaoDe(db, token, ociosoMs) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const agora = Date.now(), hash = sha(token);
  const r = await db.um(`SELECT u.cod, u.usuario, u.papel, u.grupo, u.etapas, s.ultimo_uso, s.criado_em FROM sessoes s JOIN usuarios u ON u.cod = s.usuario_cod
                         WHERE s.token = ? AND s.expira_em > ? AND u.ativo = 1`, hash, new Date().toISOString());
  if (!r) return null;
  const visto = Date.parse(r.ultimo_uso || r.criado_em);
  if (ociosoMs && agora - visto > ociosoMs) { await db.roda('DELETE FROM sessoes WHERE token=?', hash); return null; }
  if (agora - visto > Math.min(60e3, (ociosoMs || 60e3) / 4)) await db.roda('UPDATE sessoes SET ultimo_uso=? WHERE token=?', new Date().toISOString(), hash);
  return { cod: r.cod, usuario: r.usuario, papel: r.papel, grupo: r.grupo, etapas: r.etapas ? r.etapas.split(',') : [] };
}
const encerraSessao = (db, token) => db.roda('DELETE FROM sessoes WHERE token = ?', sha(token));
async function limpaSessoes(db) {
  await db.roda('DELETE FROM sessoes WHERE expira_em < ?', new Date().toISOString());
  await db.roda('DELETE FROM desafios WHERE expira < ?', Date.now());
  await db.roda('DELETE FROM login_log WHERE quando < ?', new Date(Date.now() - 60 * 864e5).toISOString());
  await db.roda('DELETE FROM tentativas WHERE ate < ? AND ult < ?', Date.now(), Date.now() - 24 * 3600e3);
}

// ---- politica de senha do acesso web ----
const COMUNS = ['1234567890', '12345678910', '0123456789', 'senha12345', 'senha123456', 'password123', 'password1234', 'qwertyuiop', 'qwerty12345', 'abc1234567', 'admin12345', 'administrador', 'brasil12345', 'mudar12345', 'trocar12345', 'serp123456', '1q2w3e4r5t', 'q1w2e3r4t5'];
function senhaFraca(senha, usuario, minimo = 10) {
  const s = String(senha);
  if (s.length < minimo) return `A senha precisa ter pelo menos ${minimo} caracteres`;
  if (s.length > 100) return 'Senha muito longa';
  const classes = [/[a-zà-ÿ]/i, /\d/, /[^a-zà-ÿ\d]/i].filter(r => r.test(s)).length;
  if (classes < 2) return 'Misture letras com números ou símbolos';
  const baixa = s.toLowerCase();
  if (COMUNS.some(c => baixa.includes(c))) return 'Essa senha é muito comum. Escolha outra';
  if (usuario && baixa.includes(String(usuario).toLowerCase()) && String(usuario).length >= 3) return 'A senha não pode conter o nome do usuário';
  if (/^(.)\1+$/.test(s)) return 'Escolha uma senha menos repetitiva';
  return null;
}

module.exports = { hashSenha, confereSenha, HASH_FALSO, sha, iguais, LIMITES, chavesLogin, segundosBloqueado, registraFalha, limpaFalha, bloqueado, bitsPara, novaSessao, sessaoDe, encerraSessao, limpaSessoes, senhaFraca };
