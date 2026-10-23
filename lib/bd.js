// Banco proprio da producao (Postgres). Em producao: Supabase (DATABASE_URL). Local/demo: PGlite (Postgres embutido, sem instalar nada).
// Nada aqui toca no banco do Serp - o Serp so e lido no PC da cliente, pelo agente.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS clientes (            -- copia somente-leitura do cliente do Serp
  cod INTEGER PRIMARY KEY, nome TEXT NOT NULL, razao TEXT, doc TEXT, telefone TEXT,
  cidade TEXT, uf TEXT, ativo INTEGER NOT NULL DEFAULT 1, sincronizado_em TEXT
);
CREATE TABLE IF NOT EXISTS usuarios (            -- usuarios do Serp (a senha chega e fica so como hash)
  cod INTEGER PRIMARY KEY, usuario TEXT NOT NULL, senha_hash TEXT, senha_web_hash TEXT, grupo INTEGER,
  papel TEXT NOT NULL DEFAULT 'escritorio', ativo INTEGER NOT NULL DEFAULT 1,
  origem TEXT NOT NULL DEFAULT 'serp', sincronizado_em TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_usuario ON usuarios(lower(usuario));
CREATE TABLE IF NOT EXISTS sessoes (             -- guarda so o hash do token
  token TEXT PRIMARY KEY, usuario_cod INTEGER NOT NULL, criado_em TEXT NOT NULL, expira_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ordens (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  data TEXT NOT NULL,
  cliente_cod INTEGER, cliente_nome TEXT NOT NULL,
  produto TEXT NOT NULL DEFAULT 'Saco p/ lixo', litros INTEGER, reforco TEXT, formato TEXT,
  largura DOUBLE PRECISION, comprimento DOUBLE PRECISION, espessura DOUBLE PRECISION, gramatura DOUBLE PRECISION, cor TEXT,
  qtd_pacote INTEGER, qtd_kg DOUBLE PRECISION, obs TEXT,
  ext_bobinas INTEGER, ext_kg DOUBLE PRECISION, ext_extrusor TEXT,
  corte_pacotes INTEGER, corte_kg DOUBLE PRECISION, corte_aparas_kg DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'Aberta', entregue_em TEXT,
  criado_por TEXT, criado_em TEXT NOT NULL, atualizado_por TEXT, atualizado_em TEXT
);
CREATE INDEX IF NOT EXISTS ix_ordens_cliente ON ordens(cliente_cod);
CREATE INDEX IF NOT EXISTS ix_ordens_status ON ordens(status);
CREATE INDEX IF NOT EXISTS ix_ordens_data ON ordens(data);
-- grupo: OPs do mesmo cliente lancadas juntas (= numero da 1a OP do grupo)
ALTER TABLE ordens ADD COLUMN IF NOT EXISTS grupo INTEGER;
CREATE INDEX IF NOT EXISTS ix_ordens_grupo ON ordens(grupo);
CREATE TABLE IF NOT EXISTS historico (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ordem_id INTEGER NOT NULL REFERENCES ordens(id),
  quando TEXT NOT NULL, usuario TEXT, acao TEXT NOT NULL, detalhe TEXT
);
CREATE INDEX IF NOT EXISTS ix_hist_ordem ON historico(ordem_id);
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS links (               -- links publicos (acompanhamento pelo cliente, so leitura)
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, token TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, ref INTEGER, de TEXT, ate TEXT,
  criado_por TEXT, criado_em TEXT NOT NULL, expira_em TEXT NOT NULL, revogado INTEGER NOT NULL DEFAULT 0, acessos INTEGER NOT NULL DEFAULT 0, ultimo_acesso TEXT
);
CREATE TABLE IF NOT EXISTS tentativas (chave TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, ate BIGINT NOT NULL DEFAULT 0);
-- login: bloqueio crescente, sessao por inatividade, desafio "nao sou robo" (cada um so vale 1 vez) e registro de acessos
ALTER TABLE tentativas ADD COLUMN IF NOT EXISTS nivel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tentativas ADD COLUMN IF NOT EXISTS ult BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS ultimo_uso TEXT;
-- etapas liberadas para o papel 'producao' (nomes separados por virgula)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS etapas TEXT;
-- precos praticados: ultima venda (12 meses) de cada produto para cada cliente, lida do Serp; 'hist' = ate 4 vendas anteriores em JSON
-- (1 linha por cliente x produto: ocupa pouco espaco no plano gratis)
CREATE TABLE IF NOT EXISTS precos (
  cliente_cod INTEGER NOT NULL, produto_cod INTEGER NOT NULL, descricao TEXT NOT NULL, und TEXT, data TEXT NOT NULL,
  qtd DOUBLE PRECISION, preco DOUBLE PRECISION, preco_liq DOUBLE PRECISION, custo DOUBLE PRECISION, hist TEXT,
  PRIMARY KEY (cliente_cod, produto_cod)
);
CREATE TABLE IF NOT EXISTS desafios (id TEXT PRIMARY KEY, expira BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS login_log (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, quando TEXT NOT NULL, login TEXT, ip TEXT, ok INTEGER NOT NULL, motivo TEXT);
CREATE INDEX IF NOT EXISTS ix_login_log_quando ON login_log(quando);
-- Seguranca: com RLS ligado e sem nenhuma policy, a API publica do Supabase (chave anon) NAO enxerga nada destas tabelas.
-- O sistema acessa por conexao direta (DATABASE_URL), que nao e afetada.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos ENABLE ROW LEVEL SECURITY;
`;

const SCHEMA_V = '6';   // aumente quando mudar o SCHEMA (use CREATE ... IF NOT EXISTS / ALTER ... IF NOT EXISTS)
const traduz =sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };   // "?" -> $1, $2...

function interface_(exec) {
  const f = {
    todos: async (sql, ...p) => (await exec(traduz(sql), p)).rows,
    um: async (sql, ...p) => (await f.todos(sql, ...p))[0],
    roda: (sql, ...p) => exec(traduz(sql), p),
  };
  return f;
}

async function abrirPg(url) {
  const pg = require('pg');
  pg.types.setTypeParser(20, Number);       // bigint (COUNT/SUM) -> numero
  const ssl = process.env.DB_CA ? { ca: process.env.DB_CA } : (/localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false });
  const pool = new pg.Pool({ connectionString: url, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000, ssl });
  const base = interface_((sql, p) => pool.query(sql, p));
  base.tx = async fn => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(interface_((sql, p) => c.query(sql, p)));
      await c.query('COMMIT'); return r;
    } catch (e) { try { await c.query('ROLLBACK'); } catch { } throw e; } finally { c.release(); }
  };
  return base;
}

async function abrirLocal(pasta) {
  const nome = '@electric-sql/pglite';       // so no teste local; fora do pacote que vai para a nuvem
  const { PGlite } = require(nome);
  const d = new PGlite(pasta || undefined);
  await d.waitReady;
  const base = interface_((sql, p) => d.query(sql, p));
  base.tx = fn => d.transaction(t => fn(interface_((sql, p) => t.query(sql, p))));
  base.exec = sql => d.exec(sql);
  return base;
}

let aberto = null;
function bd(opcoes = {}) {
  if (!aberto) aberto = (async () => {
    const db = process.env.DATABASE_URL ? await abrirPg(process.env.DATABASE_URL) : await abrirLocal(opcoes.pasta);
    // estrutura: so roda quando muda a versao (evita travar tabelas a cada partida a frio da funcao)
    const existe = (await db.um("SELECT to_regclass('public.config') AS t")).t;
    const pronto = existe && ((await db.um("SELECT valor FROM config WHERE chave='schema_v'")) || {}).valor === SCHEMA_V;
    if (!pronto) await db.tx(async t => {
      await t.roda('SELECT pg_advisory_xact_lock(7000)');
      for (const cmd of SCHEMA.split(/;\s*\n/)) if (cmd.replace(/--.*$/gm, '').trim()) await t.roda(cmd);
      await t.roda("INSERT INTO config(chave,valor) VALUES ('schema_v',?) ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor", SCHEMA_V);
    });
    return db;
  })().catch(e => { aberto = null; throw e; });
  return aberto;
}

module.exports = { bd, SCHEMA, SCHEMA_V };
