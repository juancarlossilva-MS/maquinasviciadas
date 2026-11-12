const http = require('http');
const fs = require('fs');
const path = require('path');
const { rodarSimulacao } = require('./lib/simularCore');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/simular' && req.method === 'GET') {
    const estado = url.searchParams.get('estado');
    const cidade = url.searchParams.get('cidade');
    const zona = url.searchParams.get('zona');
    const secao = url.searchParams.get('secao');

    if (!estado || !cidade || !zona || !secao) {
      return sendJson(res, 400, {
        error: 'Parâmetros obrigatórios: estado, cidade, zona, secao'
      });
    }

    try {
      console.log(`Simulando ${estado}/${cidade}/${zona}/${secao}...`);
      const result = await rodarSimulacao(estado, cidade, zona, secao);
      console.log(`OK — loops com roubo: ${result.simulacao_com_roubo.loops_necessarios}, sem: ${result.simulacao_sem_roubo.loops_necessarios}`);
      return sendJson(res, 200, result);
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { error: err.message || String(err) });
    }
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
