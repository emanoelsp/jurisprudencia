import { test as base, Page } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_EMAIL    || 'test@iurisprudentia.com.br'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'test123456'

export async function loginAs(page: Page, email = E2E_EMAIL, password = E2E_PASSWORD) {
  await page.goto('/')
  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 })
}

// Extend base test with a pre-logged-in page fixture
export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await loginAs(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
