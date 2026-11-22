import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '../.tools/browser/node_modules/playwright/index.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
const origins = (process.env.MARKETPLACE_BROWSER_ORIGINS || 'http://127.0.0.1:5173,http://localhost:8080').split(',')
mkdirSync(new URL('../.tools/screenshots/', import.meta.url), { recursive: true })
try {
  for (const [index, origin] of origins.entries()) {
    const email = `auth-smoke-${randomUUID().replaceAll('-', '')}@example.test`
    const password = `${randomUUID()}!demo`
    const context = await browser.newContext({ viewport: index ? { width: 390, height: 844 } : { width: 1440, height: 1000 } })
    try {
      const page = await context.newPage(); const errors = []
      page.setDefaultTimeout(25000)
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(origin)
      await page.getByRole('heading', { name: 'Bestselling games', exact: true }).waitFor()
      await page.locator('.product-card').first().waitFor()
      await page.evaluate(async () => {
        const images = [...document.querySelectorAll('img')]
        for (const image of images) image.loading = 'eager'
        await Promise.all(images.map(image => image.decode().catch(() => {})))
      })
      assert.ok(await page.locator('.product-card').count() >= 16)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal page overflow')
      await page.screenshot({ path: new URL(`../.tools/screenshots/home-${index ? 'mobile' : 'desktop'}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
      const search = page.getByRole('textbox', { name: 'Search for games', exact: true })
      await search.fill('eldn'); await search.press('Enter')
      await page.getByRole('link', { name: /^ELDEN RING,/ }).waitFor()
      await page.goto(`${origin}/store?platform=xbox&region=europe`)
      await page.getByRole('heading', { name: 'No games found', exact: true }).waitFor()
      await page.goto(`${origin}/products/elden-ring`)
      await page.getByRole('heading', { name: 'ELDEN RING', exact: true }).waitFor()
      await page.locator('.offer-row').first().waitFor()
      assert.ok(await page.locator('.offer-row').count() >= 3)
      await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click()
      await page.getByRole('link', { name: /Cart, 1 items/ }).click()
      await page.getByRole('link', { name: 'Sign in to checkout', exact: true }).click()
      await page.getByRole('button', { name: 'Create account', exact: true }).click()
      await page.getByLabel('Name', { exact: true }).fill('Browser Buyer')
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByLabel('Confirm password').fill(password)
      await page.getByRole('button', { name: 'Create your account', exact: true }).click()
      await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor()
      await page.getByRole('radio', { name: /Declined payment/ }).check()
      await page.getByRole('button', { name: /^Pay .*Demo$/ }).click()
      await page.getByRole('heading', { name: 'Payment declined', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Reveal demo keys', exact: true }).count(), 0)
      await page.getByRole('link', { name: 'Try checkout again', exact: true }).click()
      await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor()
      await page.getByRole('button', { name: /^Pay .*Demo$/ }).click()
      await page.getByRole('heading', { name: 'Thanks for your order!', exact: true }).waitFor()
      const orderPath = new URL(page.url()).pathname
      await page.getByRole('button', { name: 'Reveal demo keys', exact: true }).click()
      await page.locator('.key-row code').first().waitFor()
      assert.ok((await page.locator('.key-row code').first().innerText()).startsWith('DEMO-'))
      await page.getByRole('button', { name: 'Hide demo keys', exact: true }).click()
      await page.screenshot({ path: new URL(`../.tools/screenshots/order-${index ? 'mobile' : 'desktop'}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
      await page.getByRole('link', { name: 'View all orders', exact: true }).click()
      await page.getByRole('heading', { name: 'My orders', exact: true }).waitFor()
      await page.locator('.order-list-item').first().waitFor()
      assert.equal(await page.locator('.order-list-item').count(), 2)
      await page.getByRole('link', { name: 'Account: Browser Buyer', exact: true }).click()
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByRole('button', { name: 'Sign in to your account', exact: true }).waitFor()
      const response = await page.request.get(`${origin}/api/v1${orderPath}/keys`)
      assert.equal(response.status(), 401, 'Logged-out key access is denied')
      assert.deepEqual(errors, [], 'No uncaught browser errors')
      console.log(`PASS ${origin}: responsive home, typo search, filters, seller offers, guest cart, registration/merge, declined/successful checkout, demo keys, order history and logout protection.`)
    } finally {
      await context.close()
      execFileSync('docker', ['compose', 'exec', '-T', '-e', `AUTH_SMOKE_EMAIL=${email}`, 'backend', 'php', 'tests/cleanup-smoke.php'], { cwd: root, stdio: 'pipe' })
    }
  }
} finally { await browser.close() }
