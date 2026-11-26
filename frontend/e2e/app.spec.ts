/**
 * Böngészős tesztek: a manuális tesztesetek (M1–M13) fontosabb lépései automatizálva,
 * valamint akadálymentességi ellenőrzés (axe-core, WCAG 2.1 A és AA szabályok) minden oldalon.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Magyar felülettel, a megadott témával nyitja meg az oldalt. */
async function open(page: Page, hash: string, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    window.localStorage.setItem('ekg-lang', 'hu')
    window.localStorage.setItem('ekg-theme', t)
  }, theme)
  await page.goto(`/${hash}`)
  await expect(page.getByText('Adatbázisok betöltése…')).toHaveCount(0)
}

const catalogRows = (page: Page) => page.locator('.catalog-results tbody tr')

test('M1–M3: a katalógus betöltődik, a gyorsszűrő és a szűrők törlése működik', async ({ page }) => {
  await open(page, '#/catalog')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('21')
  await expect(catalogRows(page)).toHaveCount(21)

  await page.getByRole('group', { name: 'Gyorsszűrők' }).getByRole('button', { name: '12 elvezetéses' }).click()
  await expect(catalogRows(page)).toHaveCount(4)

  await page.getByRole('button', { name: 'Minden szűrő törlése' }).click()
  await expect(catalogRows(page)).toHaveCount(21)
})

test('M5–M6: adatlap közvetlen hivatkozással, jelrészlettel; a Vissza gomb bezárja', async ({ page }) => {
  await open(page, '#/catalog')
  await page.getByRole('button', { name: 'PTB-XL', exact: true }).click()
  await expect(page).toHaveURL(/dataset=2$/)
  // 1440 képpont szélességben az adatlap felugró panelként (párbeszédablak) nyílik meg.
  const dialog = page.getByRole('dialog', { name: 'PTB-XL' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg.ecg-strip')).toBeVisible()

  await page.goBack()
  await expect(page).not.toHaveURL(/dataset=/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(catalogRows(page)).toHaveCount(21)
})

test('M7: legfeljebb négy adatbázis jelölhető ki összehasonlításra', async ({ page }) => {
  await open(page, '#/catalog')
  const boxes = page.locator('.catalog-results tbody input[type="checkbox"]')
  for (let i = 0; i < 4; i++) await boxes.nth(i).check()
  await expect(boxes.nth(4)).toBeDisabled()
  await expect(page.getByRole('link', { name: /Összehasonlítás/ })).toContainText('4')
})

test('Áttekintés: a grafikonok a katalógusból számolnak, rámutatáskor látszanak az adatbázisok', async ({ page }) => {
  await open(page, '#/stats')
  await expect(page.getByRole('heading', { level: 1, name: 'A katalógus áttekintése' })).toBeVisible()
  await expect(page.locator('.chart')).toHaveCount(6)

  const leads = page.locator('.chart', { has: page.getByRole('heading', { name: 'Elvezetések száma' }) })
  const twelve = leads.getByRole('row', { name: /^12 / })
  await expect(twelve).toContainText('4')
  await twelve.hover()
  await expect(leads.locator('.chart-detail')).toContainText('PTB-XL')
})

test('M11–M12: a nyelv és a sötét mód újratöltés után is megmarad', async ({ page }) => {
  await page.goto('/#/catalog')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('link', { name: 'Catalog' })).toBeVisible()
})

test('M13: 390 képpont széles kijelzőn nincs vízszintes görgetés', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const hash of ['#/catalog', '#/stats', '#/choose', '#/compare', '#/methodology']) {
    await open(page, hash)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, hash).toBeLessThanOrEqual(0)
  }
})

for (const theme of ['light', 'dark'] as const) {
  for (const hash of ['#/catalog', '#/catalog?dataset=2', '#/stats', '#/choose', '#/compare', '#/methodology']) {
    test(`Akadálymentesség (${theme}): ${hash}`, async ({ page }) => {
      await open(page, hash, theme)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} elem`)).toEqual([])
    })
  }
}
