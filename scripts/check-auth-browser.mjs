// Optional browser regression check. Install tooling into ignored .tools/browser.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '../.tools/browser/node_modules/playwright/index.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const executablePath = process.env.BROWSER_EXECUTABLE || (existsSync(windowsChrome) ? windowsChrome : undefined)
const origins = (process.env.AUTH_BROWSER_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',')
const browser = await chromium.launch({ headless: true, executablePath })

try {
  for (const origin of origins) {
    const email = `auth-smoke-${randomUUID().replaceAll('-', '')}@example.test`
    const password = `${randomUUID()}!demo`
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.goto(`${origin}/account`)
      await page.getByRole('button', { name: 'Create account', exact: true }).click()
      await page.getByLabel('Name', { exact: true }).fill('Browser Player')
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByLabel('Confirm password').fill(password)
      const [registration] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/register'),
        page.getByRole('button', { name: 'Create your account', exact: true }).click(),
      ])
      assert.equal(registration.status(), 201, 'Browser registration must succeed')
      await page.getByRole('heading', { name: 'Welcome, Browser Player' }).waitFor()
      const cookies = await context.cookies()
      const session = cookies.find(cookie => cookie.name === 'marketplace_session')
      const csrf = cookies.find(cookie => cookie.name === 'XSRF-TOKEN')
      assert.ok(session?.httpOnly, 'Session must be HttpOnly')
      assert.equal(session.domain, new URL(origin).hostname, 'Session must be host-only')
      assert.ok(csrf && !csrf.httpOnly, 'Browser must be able to read CSRF cookie')
      await page.reload()
      await page.getByRole('heading', { name: 'Welcome, Browser Player' }).waitFor()
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in to your account', exact: true }).click()
      await page.getByRole('heading', { name: 'Welcome, Browser Player' }).waitFor()
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByRole('button', { name: 'Sign in to your account', exact: true }).waitFor()
      console.log(`PASS ${origin}: browser registration, host-only cookies, reload, login and logout.`)
    } finally {
      await context.close()
      execFileSync('docker', ['compose', 'exec', '-T', '-e', `AUTH_SMOKE_EMAIL=${email}`, 'backend', 'php', 'tests/cleanup-smoke.php'], { cwd: root, stdio: 'pipe' })
    }
  }
} finally {
  await browser.close()
}
