import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#view-dashboard')).toHaveClass(/active-view/);
});

test('Memories navigation and page title use the released name', async ({ page }) => {
  const memoriesNav = page.locator('.nav-button[data-view="drives"]');

  await expect(memoriesNav).toContainText('Memories');
  await expect(memoriesNav).not.toContainText('Moments');
  await memoriesNav.click();

  await expect(page).toHaveURL(/#drives$/);
  await expect(page.locator('#view-drives')).toHaveClass(/active-view/);
  await expect(page.locator('#momentsPageTitle')).toHaveText('MEMORIES');
  await expect(page.locator('#momentsPageTitle')).toBeVisible();
});

test('Every navigable content page uses the matching uniform title', async ({ page }) => {
  const pages = [
    ['live', 'LIVE'],
    ['drives', 'MEMORIES'],
    ['graph', 'ATLAS'],
    ['timeline', 'TIMELINE'],
    ['music', 'MUSIC'],
    ['statistics', 'STATISTICS'],
  ] as const;

  for (const [view, title] of pages) {
    await page.locator(`.nav-button[data-view="${view}"]`).click();
    await expect(page.locator(`#view-${view} .cinematic-page-heading h2`).first()).toHaveText(title);
  }

  await expect(page.locator('#view-health .cinematic-page-heading h2')).toHaveText('DATA HEALTH');
});

test('Overview hero keeps one brand and promotes the vehicle name', async ({ page }) => {
  await expect(page.locator('.topbar .brand')).toHaveCount(1);
  await expect(page.locator('.ref-brand-lockup')).toHaveCount(0);
  await expect(page.locator('.ref-title-lockup span')).toHaveText('TESLA MODEL 3');
  await expect(page.locator('.ref-title-lockup em')).toHaveText('Eloise');

  const modelTitle = page.locator('.ref-title-lockup span');
  const modelTitleStyle = await modelTitle.evaluate(element => getComputedStyle(element));
  expect(Number.parseFloat(modelTitleStyle.fontSize)).toBeGreaterThanOrEqual(50);
  expect(modelTitleStyle.whiteSpace).toBe('nowrap');
});

test('Desktop dashboard expands to the available viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.reload();
  await expect(page.locator('#view-dashboard')).toHaveClass(/active-view/);

  const shell = await page.locator('.app-shell').boundingBox();
  expect(shell).not.toBeNull();
  expect(1920 - ((shell?.x || 0) + (shell?.width || 0))).toBeLessThanOrEqual(22);
});

test('Timeline renders live mock data and exposes working map zoom controls', async ({ page }) => {
  await page.locator('.nav-button[data-view="timeline"]').click();

  await expect(page).toHaveURL(/#timeline$/);
  await expect(page.locator('#timelineDriveCount')).not.toHaveText('--');
  await expect(page.locator('#timelineHeroMapSvg')).toHaveAttribute('aria-label', /Routes travelled/);

  const zoomLevel = page.locator('#timelineMapZoomLevel');
  const initialZoom = await zoomLevel.textContent();
  await page.getByRole('button', { name: 'Zoom journey map in' }).click();
  await expect(zoomLevel).not.toHaveText(initialZoom || '');
});

test('Mobile journeys expose pull-to-refresh and a native share-card flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  await expect(page.locator('#pullRefreshIndicator')).toHaveCSS('display', 'flex');
  await expect(page.locator('#pullRefreshText')).toHaveText('Pull to refresh');
  await expect(page.locator('.topbar-right')).toBeHidden();

  await page.locator('[data-reference-drive="0"]').click();
  await expect(page.getByRole('button', { name: /Share journey/ })).toBeVisible();
  await expect(page.locator('#shareCardNativeButton')).toHaveText('Share card');
});

test('Mobile content pages hide the desktop utility strip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  for (const view of ['drives', 'graph', 'music', 'statistics'] as const) {
    await page.locator(`.nav-button[data-view="${view}"]`).evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator(`#view-${view}`)).toHaveClass(/active-view/);
    await expect(page.locator('.topbar-right')).toBeHidden();
  }
});

test('Music page renders its cinematic hero and live archived play', async ({ page }) => {
  await page.locator('.nav-button[data-view="music"]').click();

  await expect(page).toHaveURL(/#music$/);
  await expect(page.locator('#musicLifeHeading')).toContainText('YOUR LIFE HAS A');
  await expect(page.locator('#musicLifeHeading')).toContainText('SOUNDTRACK');
  await expect(page.locator('#musicPlayerKicker')).toHaveText('Spotify in JourneyDeck');
  const player = page.locator('#musicSpotifyEmbed iframe');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('src', /^https:\/\/open\.spotify\.com\/embed\/track\//);
  expect((await player.boundingBox())?.width || 0).toBeGreaterThanOrEqual(300);
  await expect(page.locator('.music-metric-icon svg')).toHaveCount(4);
  await expect(page.locator('#topTracks [data-music-uri]').first()).toHaveAttribute('data-music-uri', /^spotify:track:/);
});

test('Statistics Option 1 renders live journey analysis and interactive ranges', async ({ page }) => {
  await page.locator('.nav-button[data-view="statistics"]').click();

  await expect(page).toHaveURL(/#statistics$/);
  await expect(page.locator('#view-statistics .cinematic-page-heading h2')).toHaveText('STATISTICS');
  await expect(page.locator('#statDriveCount')).toHaveText('10');
  await expect(page.locator('#statMiles')).toHaveText('300.0');
  await expect(page.locator('#statEfficiency')).toHaveText('193');
  await expect(page.locator('#statEnergy')).toHaveText('58.0');
  await expect(page.locator('#statBattery')).toHaveText('100');
  await expect(page.locator('#statSongs')).toHaveText('40');
  await expect(page.locator('#statisticsScore')).not.toHaveText('--');
  await expect(page.locator('.statistics-kpi')).toHaveCount(7);
  await expect(page.locator('#statAutopilot')).toHaveText('203.9');
  await expect(page.locator('#statAutopilotShare')).toHaveText('68% of Tessie-recorded miles');
  for (const metric of ['autopilot', 'journeys', 'miles', 'efficiency', 'energy', 'battery', 'songs']) {
    await expect(page.locator(`[data-stat-spark="${metric}"] polyline`)).toHaveAttribute('points', /\d/);
  }
  await expect(page.locator('.statistics-comparison-row')).toHaveCount(4);
  await expect(page.locator('#statisticsTrendChart .statistics-chart-line')).toHaveCount(2);

  const weekly = page.getByRole('button', { name: 'Weekly' });
  await weekly.click();
  await expect(weekly).toHaveClass(/active/);

  const longestCard = page.locator('.statistics-longest');
  await expect(longestCard).toHaveClass(/is-interactive/);
  await longestCard.click();
  await expect(page.locator('#driveModal')).toHaveClass(/open/);
  await page.locator('#driveModal .modal-close').click();
  await expect(page.locator('#driveModal')).not.toHaveClass(/open/);

  await page.getByRole('button', { name: /View monthly archive/ }).click();
  await expect(page.locator('#statisticsMonthlyArchive')).toBeVisible();
});
