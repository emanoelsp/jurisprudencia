import { test, expect } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_EMAIL    || 'test@iurisprudentia.com.br'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'test123456'

test.describe('Autenticação', () => {
  test('login redireciona para dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/IURISPRUDENTIA/i)

    await page.fill('[type="email"]', E2E_EMAIL)
    await page.fill('[type="password"]', E2E_PASSWORD)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.locator('text=Visão Geral')).toBeVisible()
  })

  test('rota protegida sem login redireciona para /', async ({ page }) => {
    await page.goto('/dashboard/processos')
    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })

  test('rota protegida de análise sem login redireciona para /', async ({ page }) => {
    await page.goto('/dashboard/analisar/fake-id')
    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })

  test('logout retorna para /', async ({ page }) => {
    await page.goto('/')
    await page.fill('[type="email"]', E2E_EMAIL)
    await page.fill('[type="password"]', E2E_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

    await page.click('button:has-text("Sair"), a:has-text("Sair")')
    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })
})
