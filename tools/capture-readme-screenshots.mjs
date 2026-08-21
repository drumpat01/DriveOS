import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imageRoot = path.join(projectRoot, 'docs', 'images');
const baseUrl = 'http://127.0.0.1:8790';
const server = spawn(process.execPath, ['tests/mock-web-server.mjs'], {
  cwd: projectRoot,
  env: { ...process.env, DRIVEOS_TEST_PORT: '8790' },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('The JourneyDeck mock server did not start.');
}

async function waitForJourneyDeck(page) {
  // The cinematic loader is attached after the initial document becomes ready,
  // so allow its full deterministic demo sequence to finish before capture.
  await page.waitForTimeout(7_000);
  await page.locator('.app-shell').waitFor({ state: 'visible' });
}

const recorderMarkup = `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:900px;height:1000px;overflow:hidden;background:radial-gradient(circle at 18% 14%,#30113b 0,transparent 33%),radial-gradient(circle at 88% 82%,#402009 0,transparent 31%),#08070d;color:#f8f5ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.stage{height:100%;display:flex;align-items:center;justify-content:center;gap:54px;padding:48px}.phone{width:394px;height:884px;padding:16px 13px 20px;border:2px solid #5c496c;border-radius:58px;background:#020205;box-shadow:0 28px 90px #000,0 0 60px #9b3aff2b}.screen{height:100%;overflow:hidden;border-radius:43px;background:#08070d;padding:24px 20px 20px}.statusbar{display:flex;justify-content:space-between;padding:0 8px 25px;font-size:12px;font-weight:700}.brand{display:flex;align-items:center;gap:13px;margin-bottom:24px}.logo{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:#ff7b54;color:#fff;font-size:25px;font-weight:900;box-shadow:0 0 24px #ff7b5470}.eyebrow,.metric span,.warning strong,.copy-kicker{font-weight:900;letter-spacing:1.8px;text-transform:uppercase}.eyebrow{color:#8d869c;font-size:10px}.brand h1{margin:2px 0 0;font-size:27px;letter-spacing:-1px}.status{padding:30px 18px;text-align:center;border:1px solid #2d604f;border-radius:26px;background:#121019}.dot{width:12px;height:12px;margin:0 auto 12px;border-radius:50%;background:#43e6ae;box-shadow:0 0 18px #43e6ae}.status h2{margin:0;color:#43e6ae;font-size:27px}.status p{margin:7px 0 0;color:#8f879b;font-size:14px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);margin-top:16px;overflow:hidden;border-radius:20px;background:#121019}.metric{padding:17px 5px;text-align:center;border-right:1px solid #302a3a}.metric:last-child{border:0}.metric span{display:block;color:#766f83;font-size:8px}.metric b{display:block;margin-top:7px;font-size:18px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:16px}.button{display:grid;min-height:58px;place-items:center;border:1px solid #3c324c;border-radius:17px;background:#1c1726;font-size:16px;font-weight:800}.button.primary{border-color:#ff7b54;background:#ff7b54;color:#160a06}.warning{margin-top:17px;padding:15px;border-left:3px solid #9b7cff;border-radius:12px;background:#17121b}.warning strong{color:#c2b3ff;font-size:9px}.warning p{margin:6px 0 0;color:#9c94a8;font-size:12px;line-height:1.45}.foot{margin-top:16px;color:#5e5868;font-size:10px;text-align:center}.copy{width:330px}.copy-kicker{color:#ff8b61;font-size:11px}.copy h2{margin:13px 0 18px;font-size:50px;line-height:.98;letter-spacing:-2px}.copy h2 span{color:#ff714f}.copy>p{color:#aaa2b8;font-size:18px;line-height:1.55}.checks{display:grid;gap:16px;margin-top:30px}.check{display:flex;align-items:center;gap:12px;color:#d9d2e3;font-size:15px}.check i{width:29px;height:29px;display:grid;place-items:center;border-radius:50%;background:#43e6ae1c;color:#43e6ae;font-style:normal;font-weight:900}.private{margin-top:35px;padding-top:20px;border-top:1px solid #30263d;color:#756d81;font-size:12px;line-height:1.5}
</style></head><body><main class="stage"><section class="phone"><div class="screen"><div class="statusbar"><span>9:41</span><span>● ● ●</span></div><div class="brand"><div class="logo">J</div><div><div class="eyebrow">JourneyDeck</div><h1>Recorder</h1></div></div><div class="status"><div class="dot"></div><h2>Recording</h2><p>You can lock your phone</p></div><div class="metrics"><div class="metric"><span>Time</span><b>08:42</b></div><div class="metric"><span>Points</span><b>38</b></div><div class="metric"><span>Queued</span><b>0</b></div></div><div class="actions"><div class="button">Pause</div><div class="button primary">Finish</div></div><div class="warning"><strong>Keep the Recorder running</strong><p>Locking your iPhone is fine. Force-quitting stops background location until you reopen it.</p></div><div class="foot">Private single-iPhone recorder · Connected</div></div></section><section class="copy"><div class="copy-kicker">JourneyDeck Recorder</div><h2>Any car.<br><span>Every journey.</span></h2><p>Turn an iPhone into a private, background GPS recorder—no Tesla or Tessie required.</p><div class="checks"><div class="check"><i>✓</i> Works while the phone is locked</div><div class="check"><i>✓</i> Queues safely when offline</div><div class="check"><i>✓</i> Sends completed trips to Timeline</div></div><div class="private">Demo screen with fictional recording metrics. Recorder credentials stay in iOS Keychain.</div></section></main></body></html>`;

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark', timezoneId: 'America/Chicago' });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/#dashboard`);
  await waitForJourneyDeck(page);
  await page.locator('[data-reference-drive="0"]').waitFor();
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.data = walker.currentNode.data.replaceAll('Eloise', 'Aurora');
  });
  await page.screenshot({ path: path.join(imageRoot, 'journeydeck-overview-demo.png') });

  await page.locator('.nav-button[data-view="drives"]').click();
  await page.locator('#momentsPageTitle').waitFor();
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: path.join(imageRoot, 'journeydeck-memories-demo.png') });

  const recorderPage = await context.newPage();
  await recorderPage.setViewportSize({ width: 900, height: 1000 });
  await recorderPage.setContent(recorderMarkup);
  await recorderPage.screenshot({ path: path.join(imageRoot, 'journeydeck-recorder-demo.png') });
} finally {
  await browser?.close();
  server.kill();
}
