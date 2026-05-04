import { test, expect } from '@playwright/test'

const TEST_EMAIL    = process.env.E2E_EMAIL    || 'test@iurisprudentia.com.br'
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'test123456'

test.describe('Autenticação', () => {
  test('login com e-mail e senha', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/IURISPRUDENTIA/i)

    await page.fill('[placeholder*="e-mail"], [type="email"]', TEST_EMAIL)
    await page.fill('[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.locator('text=Visão Geral')).toBeVisible()
  })

  test('logout redireciona para login', async ({ page }) => {
    await page.goto('/dashboard')
    // Aguarda sidebar carregar
    await expect(page.locator('text=Sair')).toBeVisible({ timeout: 10_000 })
    await page.click('text=Sair')
    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })

  test('acesso direto ao dashboard sem login redireciona', async ({ page }) => {
    await page.goto('/dashboard/processos')
    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })
})
