/**
 * Böngészős (végponttól végpontig tartó) tesztek beállítása: npm run test:e2e
 *
 * A tesztek előtt a Playwright maga indítja el a backendet (127.0.0.1:8000) és a
 * frontend fejlesztői szerverét (localhost:5173), majd egy valódi Chromium böngészőben
 * kattintja végig a fő funkciókat. Ha a két szerver már fut, azokat használja.
 * A backend Python-értelmezőjét a PYTHON környezeti változó adhatja meg
 * (alapból a backend/.venv-ben lévő, Windows alatt a Scripts mappából).
 */
import { defineConfig, devices } from '@playwright/test'

const python = process.env.PYTHON ?? (process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python')

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'off', locale: 'hu-HU' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: `${python} -m uvicorn main:app --port 8000`, cwd: '../backend', url: 'http://127.0.0.1:8000/datasets', reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
})
