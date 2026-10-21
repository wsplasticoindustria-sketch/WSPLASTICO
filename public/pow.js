// Worker do "Não sou um robô": procura um número (nonce) tal que SHA-256(prefixo + ":" + nonce) comece com N bits zero.
// A mensagem tem menos de 56 bytes, então cabe num único bloco do SHA-256. As constantes saem dos primos (como na especificação).
const K = new Uint32Array(64), H0 = new Uint32Array(8);
(function () {
  const primos = []; for (let n = 2; primos.length < 64; n++) if (primos.every(p => n % p)) primos.push(n);
  const frac = x => x - Math.floor(x);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(frac(Math.cbrt(primos[i])) * 4294967296);
  for (let i = 0; i < 8; i++) H0[i] = Math.floor(frac(Math.sqrt(primos[i])) * 4294967296);
})();
const w = new Uint32Array(64);
function sha256Inicio(s) {   // devolve as 2 primeiras palavras do hash (o bastante para contar bits zero)
  w.fill(0, 0, 16);
  const n = s.length;
  for (let i = 0; i < n; i++) w[i >> 2] |= s.charCodeAt(i) << (24 - (i & 3) * 8);
  w[n >> 2] |= 0x80 << (24 - (n & 3) * 8);
  w[15] = n * 8;
  for (let i = 16; i < 64; i++) {
    const a = w[i - 15], b = w[i - 2];
    w[i] = (w[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) | 0;
  }
  let a = H0[0], b = H0[1], c = H0[2], d = H0[3], e = H0[4], f = H0[5], g = H0[6], h = H0[7];
  for (let i = 0; i < 64; i++) {
    const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
    const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  return [(H0[0] + a) >>> 0, (H0[1] + b) >>> 0];
}
onmessage = ev => {
  const { prefixo, bits, inicio, passo } = ev.data;
  for (let nonce = inicio; ; nonce += passo) {
    const [x, y] = sha256Inicio(prefixo + ':' + nonce);
    if ((x ? Math.clz32(x) : 32 + Math.clz32(y)) >= bits) { postMessage(String(nonce)); return; }
  }
};
