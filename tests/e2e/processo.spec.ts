import { test, expect, loginAs } from './fixtures'
import { Page } from '@playwright/test'

test.describe('Navegação do dashboard', () => {
  test.beforeEach(async ({ loggedInPage: page }) => {
    // page already logged in via fixture
  })

  test('sidebar mostra links principais', async ({ loggedInPage: page }) => {
    await expect(page.locator('text=Visão Geral')).toBeVisible()
    await expect(page.locator('text=Processos')).toBeVisible()
    await expect(page.locator('text=Base de Conhecimento')).toBeVisible()
    await expect(page.locator('text=Planos')).toBeVisible()
  })

  test('página de processos carrega', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/processos')
    await expect(page.locator('h1, [class*="section-title"]').filter({ hasText: /Processos/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button:has-text("Novo Processo")')).toBeVisible()
  })

  test('modal de novo processo abre', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/processos')
    await page.click('button:has-text("Novo Processo")')
    await expect(page.locator('text=Numero CNJ')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Cliente / Parte Autora')).toBeVisible()
  })

  test('página de planos carrega', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/planos')
    await expect(page.locator('text=Trial')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Starter')).toBeVisible()
    await expect(page.locator('text=Pro')).toBeVisible()
  })

  test('página de perfil carrega', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/perfil')
    await expect(page.locator('text=Meu Perfil').first()).toBeVisible({ timeout: 10_000 })
  })

  test('página de templates carrega (plano free mostra paywall)', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/templates')
    // Either shows templates list or paywall
    await expect(
      page.locator('text=Templates de Análise').or(page.locator('text=Recurso disponível'))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('base de conhecimento carrega', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/base-conhecimento')
    await expect(page.locator('h1, [class*="section-title"]').filter({ hasText: /Base/i })).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Fluxo de processo', () => {
  test('criar processo com metadados manuais', async ({ page }) => {
    await loginAs(page)
    await page.goto('/dashboard/processos')

    // Open modal
    await page.click('button:has-text("Novo Processo")')
    await expect(page.locator('text=Numero CNJ')).toBeVisible({ timeout: 5_000 })

    // Fill form (no PDF upload — manual only)
    await page.fill('[placeholder*="número"], [placeholder*="numero"], .font-mono.input', '5099999-88.2025.8.26.0001')
    await page.fill('[placeholder*="cliente"], [placeholder*="Cliente"]', 'Cliente E2E Automático')
    await page.fill('[placeholder*="natureza"], [placeholder*="Natureza"]', 'Ação de Indenização por Danos Morais')

    // Save — wait for redirect or success toast
    await page.click('button:has-text("Salvar e Analisar"), button:has-text("Salvar")')

    // Should redirect to analyze page or show the processo in the list
    await Promise.race([
      page.waitForURL(/\/dashboard\/analisar\//, { timeout: 15_000 }),
      page.locator('text=Processo salvo').waitFor({ timeout: 15_000 }),
      page.locator('text=Cliente E2E Automático').waitFor({ timeout: 15_000 }),
    ])
  })

  test('página de análise tem botão de analisar', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard/processos')

    const analisarLinks = page.locator('a:has-text("Analisar"), [href*="/dashboard/analisar/"]').first()
    const count = await analisarLinks.count()

    if (count > 0) {
      await analisarLinks.first().click()
      await expect(page.locator('button:has-text("Analisar com IURISPRUDENTIA")')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('button:has-text("Salvar"), button:has-text("Aprovar")')).toBeVisible()
    } else {
      test.skip()
    }
  })
})

test.describe('Onboarding', () => {
  test('visão geral mostra conteúdo de boas-vindas ou processos recentes', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    const hasOnboarding = await page.locator('text=Envie um Processo').isVisible({ timeout: 5_000 }).catch(() => false)
    const hasProcessos  = await page.locator('text=Processos Recentes').isVisible({ timeout: 5_000 }).catch(() => false)
    expect(hasOnboarding || hasProcessos).toBeTruthy()
  })
})
