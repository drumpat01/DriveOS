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

test('Music page renders its cinematic hero and live archived play', async ({ page }) => {
  await page.locator('.nav-button[data-view="music"]').click();

  await expect(page).toHaveURL(/#music$/);
  await expect(page.locator('#musicLifeHeading')).toContainText('YOUR LIFE HAS A');
  await expect(page.locator('#musicLifeHeading')).toContainText('SOUNDTRACK');
  await expect(page.locator('#musicPlayerKicker')).toHaveText('Latest archived play');
  await expect(page.locator('#musicPlayerTrack')).not.toHaveText('Connect Spotify to play');
});
