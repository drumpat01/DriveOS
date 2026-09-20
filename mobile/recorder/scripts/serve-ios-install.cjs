// Temporary, token-scoped registered-device installer. Never serves a directory.
const http = require('node:http');
const fs = require('node:fs');
const { resolve } = require('node:path');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function createInstaller(config) {
  if (!/^[a-f0-9]{48}$/.test(config.token) || !/^\d+\.\d+\.\d+$/.test(config.version)
    || !/^\d+$/.test(config.build) || !config.ipa.endsWith('.ipa')) throw Error('Invalid installer configuration');
  const size = fs.statSync(config.ipa).size, prefix = '/' + config.token;
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { res.writeHead(400); res.end(); return; }
    if (![prefix, prefix + '/', prefix + '/manifest.plist', prefix + '/JourneyDeckV3.ipa'].includes(pathname)) { res.writeHead(404); res.end('Not found'); return; }
    if (pathname.endsWith('.ipa')) {
      let start = 0, end = size - 1;
      if (req.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        if (!match || +match[1] >= size || (match[2] && +match[2] < +match[1])) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
        start = +match[1]; end = match[2] ? Math.min(+match[2], size - 1) : end;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      }
      res.writeHead(req.headers.range ? 206 : 200, { 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(config.ipa, { start, end });
      stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res); return;
    }
    let origin;
    try {
      origin = fs.readFileSync(config.originFile, 'utf8').trim();
      if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) throw Error('Origin not ready');
    } catch { res.writeHead(503); res.end('Installation link is being prepared.'); return; }
    const base = origin + prefix;
    let content, type;
    if (pathname.endsWith('.plist')) {
      type = 'application/xml; charset=utf-8';
      content = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>${escape(base + '/JourneyDeckV3.ipa')}</string></dict></array><key>metadata</key><dict><key>bundle-identifier</key><string>com.journeydeck.recorder.v3</string><key>bundle-version</key><string>${escape(config.build)}</string><key>kind</key><string>software</string><key>title</key><string>JourneyDeck V3</string></dict></dict></array></dict></plist>`;
    } else {
      type = 'text/html; charset=utf-8';
      const install = 'itms-services://?action=download-manifest&url=' + encodeURIComponent(base + '/manifest.plist');
      content = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install JourneyDeck V3</title><style>body{margin:0;background:#102010;color:#fff;font:17px/1.6 system-ui}main{max-width:520px;margin:auto;padding:48px 24px}small{color:#ffb52e;letter-spacing:.12em}h1{font-size:36px;line-height:1.15}a{display:block;text-align:center;padding:17px;background:#ffa600;color:#081832;text-decoration:none;border-radius:16px;font-weight:750;margin:28px 0}p,li{color:#d1dccf}.card{padding:20px;border:1px solid #6b843d;border-radius:18px}footer{font-size:13px;color:#aab7a9;margin-top:32px}</style><main><small>JOURNEYDECK · INTERNAL PREVIEW</small><h1>Your next chapter.<br>Now with Siri AI.</h1><p>Version ${escape(config.version)} · Build ${escape(config.build)}<br>Signed for your registered iPhone.</p><a href="${escape(install)}">Install JourneyDeck V3</a><div class="card"><ol><li>Open this page in Safari on your iPhone.</li><li>Tap Install, confirm the iOS prompt, and wait for JourneyDeck V3 to finish installing on your Home Screen.</li><li>Open JourneyDeck V3 → Ask JourneyDeck → Open Siri AI testing.</li><li>Run the 13-question sample first.</li></ol></div><p>This updates the existing V3 app. Keep it installed to retain its local archive.</p><footer>This temporary installation link requires this computer to remain online. Only registered devices can install this build.</footer></main></html>`;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(content) });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}
if (require.main === module) {
  const config = JSON.parse(fs.readFileSync(resolve(process.argv[2]), 'utf8'));
  createInstaller(config).listen(config.port || 4391, '127.0.0.1', () => console.log('JourneyDeck installer is listening on localhost.'));
}
module.exports = { createInstaller };
