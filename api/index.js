// Funcao unica da Vercel: atende tudo que comeca com /api/
const { tratar } = require('../lib/nucleo');
module.exports = (req, res) => tratar(req, res);
