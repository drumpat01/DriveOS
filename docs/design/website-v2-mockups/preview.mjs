import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/cinematic.html' : pathname));
    if (!file.startsWith(root + sep) || !mime[extname(file)]) { response.writeHead(404).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)], 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(4318, '127.0.0.1', () => console.log('JourneyDeck concepts: http://127.0.0.1:4318/cinematic.html'));
