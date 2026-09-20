const { chromium } = await import(process.env.THEME_CREATOR_PLAYWRIGHT || '@playwright/test');
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { defaults, roles, builtinPresets } from './model.js';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1100}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317');
 await page.waitForFunction(()=>document.querySelector('#preview-journey image[href^="data:image"]'));
 assert.equal(await page.locator('.screen-frame>svg').count(),5);
 const protectedBefore=await page.locator('[data-protected-media]').evaluateAll(els=>els.map(e=>e.outerHTML));
 for(const [key] of roles){await page.locator(`[data-role="${key}"]`).click();await page.locator('#hex').fill('#f217c9');await page.waitForFunction(()=>document.querySelector('#screens').innerHTML.includes('#f217c9'));assert.ok((await page.locator('#screens').innerHTML()).includes('#f217c9'));await page.locator('#hex').fill(defaults[key]);await page.waitForTimeout(70);}
 assert.deepEqual(await page.locator('[data-protected-media]').evaluateAll(els=>els.map(e=>e.outerHTML)),protectedBefore);
 await page.locator('[data-role="base"]').click();await page.locator('#hex').fill('#123456');
 await page.locator('#preset-name').fill('Test <img src=x onerror=alert(1)>');await page.locator('#save-form button').click();
 assert.equal(await page.locator('#preset-list img').count(),0);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#preview-journey image[href^="data:image"]'));
 assert.equal(await page.locator('#hex').inputValue(),'#123456');
 assert.equal(await page.locator('.builtin-preset').count(),5);
 for(const preset of builtinPresets){
  await page.locator(`[data-theme="${preset.id}"]`).click();
  assert.equal(await page.locator('#hex').inputValue(),preset.palette.base.toUpperCase());
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('journeydeck-theme-creator-v1')).palette),preset.palette);
  await page.waitForFunction(color=>document.querySelector('#preview-home>svg>rect').getAttribute('fill')===color,preset.palette.base);
 }
 await page.locator('#hex').fill('#111111');
 assert.equal(await page.locator('[data-theme="sakura"]').getAttribute('aria-pressed'),'false');
 await page.locator('[data-theme="sakura"]').click();
 assert.equal(await page.locator('#hex').inputValue(),builtinPresets.find(p=>p.id==='sakura').palette.base.toUpperCase());
 await page.reload();await page.waitForFunction(()=>document.querySelector('#preview-journey image[href^="data:image"]'));
 assert.equal(await page.locator('[data-theme="sakura"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#preset-list .preset-row').count(),1);
 await page.locator('#reset').click();assert.equal(await page.locator('#hex').inputValue(),defaults.base.toUpperCase());
 await page.locator('.preset-row button').first().click();assert.equal(await page.locator('#hex').inputValue(),'#123456');
 await page.locator('#sv').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await page.locator('#hex').inputValue(),'#123456');
 const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent;const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.format,'journeydeck-theme-creator');assert.equal(Object.keys(exported.palette).length,10);
 await page.locator('#import').setInputFiles({name:'palette.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({name:'Imported',palette:{...defaults,base:'#abcdef'}}))});await page.waitForFunction(()=>document.querySelector('#hex').value==='#ABCDEF');
 await page.locator('#import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"palette":{"base":"red"}}')});await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Import failed'));assert.equal(await page.locator('#hex').inputValue(),'#ABCDEF');
 await page.locator('#compare').click();assert.equal(await page.locator('.screen-frame>img').count(),5);await page.locator('#compare').click();assert.equal(await page.locator('.screen-frame>svg').count(),5);
 await page.locator('#reset').click();
 await mkdir('.cache/theme-creator-review',{recursive:true});
 await page.screenshot({path:'.cache/theme-creator-review/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.cache/theme-creator-review/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);
 const traversal=await page.request.get('http://127.0.0.1:4317/GEMINI.md');assert.equal(traversal.status(),404);
 console.log('PASS: five previews, 10 roles, protected media, persistence, preset recall, safe names, keyboard picker, JSON export/import, invalid import, originals, mobile layout, local file allowlist, and no browser errors.');
} finally {await browser.close();}

