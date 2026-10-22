import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const liveExpectations = JSON.parse(fs.readFileSync('tools/verify-live/expectations.json', 'utf8'));

function staticHtmlPath(pathname) {
  if (pathname === '/') return '/beta.html';
  if (pathname === liveExpectations.appStore.notFoundPath) return '/404.html';
  return `${pathname}.html`;
}

test('homepage and Tesla page show annual Plus pricing', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/beta.html');
    const membership = page.locator('#membership');
    await membership.scrollIntoViewIfNeeded();
    await expect(membership).toContainText('$39.99/yr');
    await expect(membership).not.toContainText('$39.99/year');
    await expect(membership).toContainText('7-day free trial');
    await expect(membership).toContainText('Free to record');
    await expect(membership).not.toContainText('annual only');
    await expect(membership).not.toContainText('0.99');
    await expect(membership).not.toContainText('24.99');
    await expect(membership).not.toContainText('3-day');
    await expect(page.locator('.membership-card-plus h3 + p')).toHaveText('Plus is $39.99/yr, with a 7-day free trial.');
    await expect(page.locator('.membership-card:not(.membership-card-plus) h3 + p')).toHaveText('Free to record. No account required.');
    await page.goto('/tesla-drive-journal.html');
    const plusCard = page.locator('article.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Plus' }) });
    await expect(plusCard).toContainText('JourneyDeck Plus, $39.99/yr, 7-day free trial for new subscribers.');
    await expect(plusCard).toContainText('Plus keeps your full history and Atlas, and adds automatic drive and charging history.');
    await expect(page.locator('h1')).toHaveText('The trip, later');
    await expect(page.locator('main')).not.toContainText('$39.99/year');
    await expect(page.locator('main')).not.toContainText('0.99');
    await expect(page.locator('main')).not.toContainText('2.99');
    await expect(page.locator('main')).not.toContainText('3-day');
    await expect(page.locator('main')).not.toContainText('monthly');
    await expect(page.locator('figcaption').first()).toHaveText('A trip replay in JourneyDeck. Not a Tesla drive.');
    await expect(page.locator('figure img').first()).toHaveAttribute('loading', 'lazy');
  }
});

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
  await expect(page.locator('.header-actions .button')).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=home&mt=8');
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

test('Studio nav link is gold until the existing hover and focus styles apply', async ({ page }) => {
  const gold = 'rgb(212, 177, 90)';
  const ivory = 'rgb(246, 240, 226)';
  const mobileHover = 'rgb(234, 212, 161)';
  for (const path of ['/beta.html', '/road-trip-journal-app.html', '/tesla-drive-journal.html']) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    const studio = page.locator('.desktop-nav a.nav-studio');
    await expect(studio).toBeVisible();
    await expect(studio).toHaveAttribute('href', 'https://studio.journeydeck.me');
    await expect(studio.locator('span[aria-hidden="true"]')).toHaveText('↗');
    await expect(studio).toHaveCSS('color', gold);
    await expect(studio).toHaveCSS('font-weight', '500');
    await studio.focus();
    await expect(studio).toHaveCSS('color', gold);
    await expect(studio).toHaveCSS('outline-style', 'solid');
    await studio.hover();
    await expect(studio).toHaveCSS('color', ivory);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await page.locator('.mobile-menu summary').click();
    const mobileStudio = page.locator('.mobile-menu nav a.nav-studio');
    await expect(mobileStudio).toBeVisible();
    await expect(mobileStudio).toHaveCSS('color', gold);
    await expect(mobileStudio).toHaveCSS('font-weight', '500');
    await mobileStudio.hover();
    await expect(mobileStudio).toHaveCSS('color', mobileHover);
  }
});

test('public footers omit the login link', async ({ page }) => {
  for (const path of ['/beta.html', '/support.html', '/privacy.html', '/terms.html', '/tesla-drive-journal.html', '/apple-music-soundtrack.html', '/road-trip-journal-app.html', '/landing.html', '/404.html']) {
    await page.goto(path);
    await expect(page.locator('footer a[href="/login"]'), path).toHaveCount(0);
  }
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
    const studioTemplates = page.getByRole('link', { name: 'From the studio: Road Trip templates', exact: true });
    await expect(studioTemplates).toHaveCount(1);
    await expect(studioTemplates).toHaveAttribute('href', 'https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink');
    await expect(studioTemplates).not.toHaveAttribute('target', /.+/);
    await expect(page.locator('footer a[href="/login"]')).toHaveCount(0);
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

test('static HTML App Store links carry pt and a per-page ct', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const pages = [
    ...liveExpectations.publicPages.map((pathname) => [staticHtmlPath(pathname), liveExpectations.appStore.pageCampaigns[pathname]]),
    ['/404.html', liveExpectations.appStore.pageCampaigns[liveExpectations.appStore.notFoundPath]]
  ];
  try {
    for (const [path, ct] of pages) {
      const response = await page.goto(path);
      expect(response?.ok(), path).toBe(true);
      const hrefs = await page.locator('a[href*="apps.apple.com/us/app/journeydeck/id6806502526"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
      expect(hrefs.length, path).toBeGreaterThan(0);
      for (const href of hrefs) {
        const url = new URL(href);
        expect(url.searchParams.get('pt'), href).toBe(liveExpectations.appStore.providerToken);
        expect(url.searchParams.get('ct'), `${path} ${href}`).toBe(ct);
        expect(url.searchParams.get('mt'), href).toBe(liveExpectations.appStore.mediaType);
        expect(url.searchParams.getAll('pt'), href).toHaveLength(1);
        expect(url.searchParams.getAll('ct'), href).toHaveLength(1);
        expect(url.searchParams.getAll('mt'), href).toHaveLength(1);
      }
      if (path === '/beta.html') expect(hrefs.some((href) => href.includes('see-all=reviews'))).toBe(true);
    }
  } finally {
    await context.close();
  }
});

test('X bio traffic rewrites App Store ct to xbio without dropping pt', async ({ page }) => {
  await page.addInitScript(() => {
    window.__umami = [];
    window.umami = {
      track(name, detail) {
        window.__umami.push({ name, detail });
      }
    };
  });
  await page.goto('/beta.html?utm_source=x&utm_campaign=bio');
  const header = page.locator('.header-actions .button');
  const reviews = page.locator('a[href*="see-all=reviews"]');
  await expect(header).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=xbio&mt=8');
  await expect(reviews).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526?see-all=reviews&pt=129344416&ct=xbio&mt=8');
  await header.evaluate((anchor) => anchor.addEventListener('click', (event) => event.preventDefault()));
  await header.click();
  await expect.poll(() => page.evaluate(() => window.__umami)).toEqual([{
    name: 'appstore_click',
    detail: {
      page: '/beta.html',
      source: 'x',
      campaign: 'bio',
      href: 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=xbio&mt=8'
    }
  }]);
});

test('tesla page keeps utm_campaign=tesla on App Store clicks', async ({ page }) => {
  await page.addInitScript(() => {
    window.__umami = [];
    window.umami = {
      track(name, detail) {
        window.__umami.push({ name, detail });
      }
    };
  });
  await page.goto('/tesla-drive-journal.html?utm_campaign=tesla');
  const header = page.locator('.header-actions .button');
  await expect(header).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=tesla&mt=8');
  await page.goto('/tesla-drive-journal.html?utm_source=x&utm_campaign=tesla');
  await expect(header).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=x-tesla&mt=8');
  await page.goto('/tesla-drive-journal.html?utm_source=reddit&utm_campaign=tesla');
  await expect(header).toHaveAttribute('href', 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=reddit-tesla&mt=8');
  await header.evaluate((anchor) => anchor.addEventListener('click', (event) => event.preventDefault()));
  await header.click();
  await expect.poll(() => page.evaluate(() => window.__umami)).toEqual([{
    name: 'appstore_click',
    detail: {
      page: '/tesla-drive-journal.html',
      source: 'reddit',
      campaign: 'tesla',
      href: 'https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=reddit-tesla&mt=8'
    }
  }]);
});

test('homepage templates fit at 390 and 1280, and Tesla pitches Plus once', async ({ page }) => {
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/beta.html');
    const templates = page.locator('#templates');
    await templates.scrollIntoViewIfNeeded();
    await expect(templates).toBeVisible();
    await expect(templates.locator('.eyebrow')).toHaveText('FROM THE STUDIO');
    await expect(templates.locator('#templates-title')).toContainText('Plan the next one.');
    await expect(templates.locator('#templates-title .gold')).toHaveText('Road Trip templates.');
    const link = templates.getByRole('link', { name: 'See the templates' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink');
    await expect(link).toHaveAttribute('data-umami-event', 'templates-click');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `home overflow at ${width}`).toBe(true);

    await page.goto('/tesla-drive-journal.html');
    await expect(page.locator('.plus-trial-banner')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Try the free trial of JourneyDeck Plus, then $39.99/yr.');
    const annual = page.locator('#plus-annual');
    await annual.scrollIntoViewIfNeeded();
    await expect(annual).toContainText('Plus is $39.99/yr.');
    await expect(annual.getByRole('link', { name: 'Start your free trial' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `tesla overflow at ${width}`).toBe(true);
  }
});

test('every public footer links the FollowX badge without overflowing', async ({ page }) => {
  const href = 'https://followx.today/b/journeydeck.me';
  const paths = [...liveExpectations.publicPages.map(staticHtmlPath), '/404.html'];
  for (const path of paths) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const link = page.locator(`footer a[href="${href}"]`);
    await expect(link, path).toHaveCount(1);
    await expect(link, path).toHaveAttribute('rel', 'noopener');
    await expect(link, path).toHaveAttribute('target', '_blank');
    const img = link.locator('img');
    await expect(img, path).toHaveAttribute('src', 'https://followx.today/api/badge/journeydeck.me.svg?theme=dark&v=live');
    await expect(img, path).toHaveAttribute('alt', 'Featured on FollowX.today');
    await expect(img, path).toHaveAttribute('width', '250');
    await expect(img, path).toHaveAttribute('height', '54');
    await expect(img, path).toHaveAttribute('loading', 'lazy');
  }
  for (const path of ['/beta.html', '/tesla-drive-journal.html']) {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(path);
      const badge = page.locator('footer .followx-badge');
      await badge.scrollIntoViewIfNeeded();
      const badgeBox = await badge.boundingBox();
      const footerBox = await page.locator('footer').boundingBox();
      const imgBox = await badge.locator('img').boundingBox();
      expect(badgeBox, `${path} ${viewport.width}`).toBeTruthy();
      expect(footerBox, `${path} ${viewport.width}`).toBeTruthy();
      expect(imgBox, `${path} ${viewport.width}`).toBeTruthy();
      expect(imgBox.x).toBeGreaterThanOrEqual(-1);
      expect(imgBox.x + imgBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(Math.abs(imgBox.width - 200), `${path} ${viewport.width}`).toBeLessThan(1);
      expect(Math.abs(imgBox.height - (200 * 54 / 250)), `${path} ${viewport.width}`).toBeLessThan(1);
      if (path === '/beta.html') {
        const launchBox = await page.locator('footer img[alt="Featured on Launch"]').boundingBox();
        expect(launchBox, `${path} ${viewport.width}`).toBeTruthy();
        expect(Math.abs(imgBox.width - launchBox.width), `${path} ${viewport.width}`).toBeLessThan(1);
      }
      const imageCenter = imgBox.x + (imgBox.width / 2);
      const footerCenter = footerBox.x + (footerBox.width / 2);
      expect(Math.abs(imageCenter - footerCenter), `${path} ${viewport.width}`).toBeLessThan(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} ${viewport.width}`).toBe(true);
    }
  }
});

test('Plus annual block keeps the page App Store link and fits at 390 and 1280', async ({ page }) => {
  const pages = [
    { path: '/beta.html', ct: 'home', content: 'home' },
    { path: '/tesla-drive-journal.html', ct: 'tesla_page', content: 'tesla-drive-journal' },
    { path: '/driving-history-app.html', ct: 'driving_history', content: 'driving-history-app' }
  ];
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const item of pages) {
      await page.goto(item.path);
      const block = page.locator('#plus-annual');
      await block.scrollIntoViewIfNeeded();
      await expect(block).toBeVisible();
      await expect(block.locator('h2')).toHaveText('JourneyDeck Plus annual');
      await expect(block).toContainText('You can keep recording for free and view today’s journeys.');
      await expect(block).toContainText('Plus is $39.99/yr.');
      await expect(block).not.toContainText('7-day');
      await expect(block).not.toContainText('3-day');
      await expect(block).not.toContainText('weekly');
      const cta = block.getByRole('link', { name: 'Start your free trial' });
      await expect(cta).toHaveAttribute('data-umami-event', 'plus-annual-click');
      await expect(cta).toHaveClass(/button/);
      await expect(cta).toHaveAttribute('href', `https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=${item.ct}&mt=8&utm_source=journeydeck.me&utm_medium=site&utm_campaign=plus_annual&utm_content=${item.content}`);
      const box = await cta.boundingBox();
      expect(box, `${item.path} ${viewport.width}`).toBeTruthy();
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      if (viewport.width === 390) {
        const arrowFit = await cta.evaluate((el) => {
          const span = el.querySelector('span[aria-hidden="true"]');
          const range = document.createRange();
          range.setStart(el, 0);
          range.setEndBefore(span);
          const textBox = range.getBoundingClientRect();
          const arrowBox = span.getBoundingClientRect();
          const buttonBox = el.getBoundingClientRect();
          return {
            between: arrowBox.left - textBox.right,
            sideDelta: Math.abs((textBox.left - buttonBox.left) - (buttonBox.right - arrowBox.right))
          };
        });
        expect(arrowFit.between, `${item.path} arrow gap`).toBeGreaterThanOrEqual(5);
        expect(arrowFit.between, `${item.path} arrow gap`).toBeLessThan(12);
        expect(arrowFit.sideDelta, `${item.path} arrow centering`).toBeLessThan(8);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${item.path} ${viewport.width}`).toBe(true);
    }
  }
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
