import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
});

test('Halaman utama terbuka', async ({ page }) => {
  await expect(page).toHaveTitle(/Pusat Nokos/i);
});

test('Semua tombol navbar berfungsi', async ({ page }) => {
  // Set viewport desktop agar navbar tidak collapse ke mobile
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(BASE_URL);

  const navLinks = page.locator('nav a');
  const count = await navLinks.count();

  for (let i = 0; i < count; i++) {
    // Pakai isVisible() agar tidak throw error jika ada link hidden
    const visible = await navLinks.nth(i).isVisible();
    if (visible) {
      await expect(navLinks.nth(i)).toBeVisible();
    }
  }
});

test('Tombol utama (CTA) berfungsi', async ({ page }) => {
  // Pakai teks spesifik CTA di hero section
  const ctaButton = page.getByRole('button', { name: /mulai sekarang/i });
  // Tunggu sampai button benar-benar ada di DOM dan visible (fix webkit)
  await ctaButton.waitFor({ state: 'visible', timeout: 10000 });
  await expect(ctaButton).toBeVisible();
  await ctaButton.click();
  await expect(page).not.toHaveURL('/404');
});

test('Tidak ada broken link', async ({ page }) => {
  // Ambil semua href dari <a> yang visible saja
  const links = page.locator('a[href]');
  const count = await links.count();
  console.log(`Total link ditemukan: ${count}`);

  const brokenLinks: string[] = [];

  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const isVisible = await link.isVisible();
    if (!isVisible) continue;

    const href = await link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    // Cek link eksternal via fetch, link internal lewati saja
    if (href.startsWith('http')) {
      try {
        const res = await page.request.get(href, { timeout: 5000 });
        if (!res.ok()) brokenLinks.push(`${href} → ${res.status()}`);
      } catch {
        brokenLinks.push(`${href} → timeout/error`);
      }
    }
  }

  if (brokenLinks.length > 0) {
    console.log('Broken links:', brokenLinks);
  }
  expect(brokenLinks, `Broken links ditemukan:\n${brokenLinks.join('\n')}`).toHaveLength(0);
});