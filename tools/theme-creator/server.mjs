import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const allowed = new Set(['index.html', 'style.css', 'app.js', 'screens.js', 'model.js', ...['home','recording','memory','journey','music'].map(n => `assets/${n}.png`)]);
http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
    if (!allowed.has(name)) { res.writeHead(404).end('Not found'); return; }
    const bytes = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(name)] || 'application/octet-stream'}`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(bytes);
  } catch { res.writeHead(404).end('File not found. See README for screenshot setup.'); }
}).listen(4317, '127.0.0.1', () => console.log('JourneyDeck Theme Creator: http://127.0.0.1:4317'));
