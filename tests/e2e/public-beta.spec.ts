import { expect, test } from '@playwright/test';

test('public feature tour starts with Today and keeps its copy with the selected screenshot', async ({ page }) => {
  await page.goto('/beta.html');
  await expect(page.locator('.tour-slide:visible')).toHaveAttribute('data-feature', 'Today');
  await expect(page.locator('#feature-label')).toHaveText('01 / TODAY');
  await page.getByRole('button', { name: 'Next screenshot' }).click();
  await expect(page.locator('#feature-label')).toHaveText('02 / SOUNDTRACK');
  await expect(page.locator('.tour-slide:visible')).toHaveCount(1);
  await expect(page.locator('.tour-slide:visible')).toHaveAttribute('data-feature', 'Soundtrack');
  await expect(page.locator('#feature-description')).toContainText('Apple Music');
  await page.getByRole('button', { name: 'Show Ask JourneyDeck', exact: true }).click();
  await page.getByRole('button', { name: 'Show Memories', exact: true }).click();
  await expect(page.locator('#feature-label')).toHaveText('03 / MEMORIES');
  await expect(page.locator('.tour-slide:visible')).toHaveCount(1);
  await expect(page.locator('.tour-slide:visible')).toHaveAttribute('data-feature', 'Memories');
  await expect(page.locator('.tour-slide:visible')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#feature-description')).toContainText('photos');
  await page.locator('.tour-visual').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#feature-label')).toHaveText('01 / TODAY');
  await expect(page.locator('.tour-slide:visible')).toHaveCount(1);
  await expect(page.locator('.tour-slide:visible')).toHaveAttribute('data-feature', 'Today');
  await expect(page.getByRole('button', { name: 'Show Today', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('phone layout offers medallions in place and preserves download, social and legal links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/beta.html');
  await page.getByRole('link', { name: 'Play with the medallions' }).click();
  await expect(page).toHaveURL(/#medallions$/);
  await expect(page.locator('#medallion-theme')).toHaveValue('redline');
  await expect(page.locator('#medallion-select option')).toHaveCount(10);
  await page.locator('#medallion-select').selectOption('memory-maker');
  await page.locator('#medallion-theme').selectOption('light');
  await expect(page.locator('#medallion-title')).toHaveText('Memory Maker');
  await expect(page.locator('#medallion-how')).toHaveText('Create your first Memory.');
  await expect(page.locator('.medallion-explorer')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.header-actions .button')).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526');
  await page.locator('.mobile-menu summary').click();
  await expect(page.getByRole('link', { name: 'Follow @JourneyDeck on X', exact: true })).toHaveAttribute('href', 'https://x.com/JourneyDeck');
  await expect(page.getByRole('link', { name: 'Apple Terms of Use', exact: true })).toHaveAttribute('href', 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  for (const href of ['/privacy', '/terms', '/support']) await expect(page.locator(`footer a[href="${href}"]`)).toHaveCount(1);
  await expect(page.locator('footer img[alt="Featured on Launch"]')).toHaveAttribute('src', 'https://tools.launchllama.co/featured-badge-white.jpg?v=5');
  await expect(page.locator('footer img[alt="Featured on Launch"]')).toHaveAttribute('width', '200');
  await expect(page.locator('footer img[alt="Featured on Launch"]')).toHaveAttribute('height', '52');
  await expect(page.locator('footer a[href="https://tools.launchllama.co/products/journeydeck?utm_source=badge&utm_medium=referral"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Launch MCP', exact: true })).toHaveAttribute('href', 'https://launchmcp.co/?utm_source=badge&utm_medium=referral');
});

test('homepage footer centers the Launch Llama badge at 390 and 1280', async ({ page }) => {
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/beta.html');
    const badge = page.locator('footer .footer-badge > span');
    await badge.scrollIntoViewIfNeeded();
    await expect(badge).toBeVisible();
    const box = await badge.boundingBox();
    expect(box, `badge box at ${width}`).toBeTruthy();
    const center = (box?.x ?? 0) + ((box?.width ?? 0) / 2);
    expect(Math.abs(center - (width / 2))).toBeLessThan(12);
  }
});

test('reduced motion keeps all content visible and the feature tour manually usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/beta.html');
  await expect(page.locator('.tour-play')).toBeHidden();
  await expect(page.locator('#closing-title')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Previous screenshot' }).click();
  await expect(page.locator('.tour-slide:visible')).toHaveCount(1);
  await expect(page.locator('.tour-slide:visible')).toHaveAttribute('data-feature', 'Atlas');
  await expect(page.locator('#feature-label')).toHaveText('05 / ATLAS');
  expect(await page.locator('.tour-slide:visible').evaluate(element => element.getAnimations().length)).toBe(0);
});

test('the page remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 740 } });
  const page = await context.newPage();
  try {
    await page.goto('/beta.html');
    await expect(page.locator('.tour-slide:visible')).toHaveAttribute('data-feature', 'Today');
    await expect(page.locator('.tour-controls')).toBeHidden();
    await page.locator('#medallion-fallback').scrollIntoViewIfNeeded();
    await expect(page.locator('#medallion-fallback')).toBeVisible();
    await expect(page.locator('#closing-title')).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
