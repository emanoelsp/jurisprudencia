import { test, expect, Page } from '@playwright/test'
import path from 'path'

const TEST_EMAIL    = process.env.E2E_EMAIL    || 'test@iurisprudentia.com.br'
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'test123456'

async function login(page: Page) {
  await page.goto('/')
  await page.fill('[type="email"]', TEST_EMAIL)
  await page.fill('[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}

test.describe('Fluxo de processo', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('criar processo aparece na lista', async ({ page }) => {
    await page.goto('/dashboard/processos')
    await page.click('text=Novo Processo')

    // Preenche o formulário
    await page.fill('[placeholder*="número"]', '5012345-67.2025.8.24.0001')
    await page.fill('[placeholder*="cliente"]', 'Cliente E2E Teste')

    // Seleciona natureza se houver
    const naturezaSelect = page.locator('select[name="natureza"], [placeholder*="natureza"]').first()
    if (await naturezaSelect.isVisible()) await naturezaSelect.fill('Cível')

    await page.click('button[type="submit"], button:has-text("Criar"), button:has-text("Salvar")')

    // Deve aparecer na lista ou redirecionar para análise
    await expect(page.locator('text=Cliente E2E Teste').or(page.locator('text=5012345'))).toBeVisible({ timeout: 10_000 })
  })

  test('página de análise carrega corretamente', async ({ page }) => {
    await page.goto('/dashboard/processos')

    // Clica no primeiro processo disponível
    const analisarLink = page.locator('a:has-text("Analisar"), button:has-text("Analisar")').first()
    if (await analisarLink.isVisible()) {
      await analisarLink.click()
      await expect(page.locator('text=Analisar com IURISPRUDENTIA')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('text=Editor da Peca Final, text=Editor')).toBeVisible({ timeout: 5_000 })
    }
  })
})

test.describe('Onboarding', () => {
  test('visão geral mostra onboarding para novo usuário', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    // Se não há processos, mostra o card de onboarding
    const onboarding = page.locator('text=Bem-vindo').or(page.locator('text=Criar primeiro processo'))
    const processos  = page.locator('text=Processos Recentes')
    await expect(onboarding.or(processos)).toBeVisible({ timeout: 10_000 })
  })
})
