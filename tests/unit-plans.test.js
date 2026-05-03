import test from 'node:test'
import assert from 'node:assert/strict'
// Run with: node --experimental-strip-types --test tests/unit-plans.test.js
import { normalizePlan, planForUserPlan, todayDateKey, PLAN_POLICIES } from '../src/lib/plans.ts'

// ── normalizePlan ─────────────────────────────────────────────────────────────

test('normalizePlan returns free for undefined', () => {
  assert.equal(normalizePlan(undefined), 'free')
})

test('normalizePlan returns free for null', () => {
  assert.equal(normalizePlan(null), 'free')
})

test('normalizePlan normalizes trial to free', () => {
  assert.equal(normalizePlan('trial'), 'free')
  assert.equal(normalizePlan('Trial'), 'free')
})

test('normalizePlan handles starter alias', () => {
  assert.equal(normalizePlan('starter'), 'plano1')
  assert.equal(normalizePlan('Starter'), 'plano1')
  assert.equal(normalizePlan('plano1'), 'plano1')
})

test('normalizePlan handles pro alias', () => {
  assert.equal(normalizePlan('pro'), 'plano2')
  assert.equal(normalizePlan('Pro'), 'plano2')
  assert.equal(normalizePlan('plano2'), 'plano2')
})

test('normalizePlan handles escritorio', () => {
  assert.equal(normalizePlan('escritorio'), 'escritorio')
})

test('normalizePlan handles enterprise alias', () => {
  assert.equal(normalizePlan('enterprise'), 'start')
  assert.equal(normalizePlan('start'), 'start')
})

test('normalizePlan falls back to free for unknown values', () => {
  assert.equal(normalizePlan('gold'), 'free')
  assert.equal(normalizePlan(''), 'free')
})

// ── planForUserPlan ───────────────────────────────────────────────────────────

test('planForUserPlan returns full policy object for plano1', () => {
  const p = planForUserPlan('plano1')
  assert.equal(p.id, 'plano1')
  assert.ok(p.limits.docsPerDay > 0)
  assert.ok(p.limits.allowExpandTribunais, 'plano1 must allow expand')
})

test('free plan does NOT allow expand tribunais', () => {
  const p = planForUserPlan('free')
  assert.equal(p.limits.allowExpandTribunais, false)
})

test('all paid plans allow expand tribunais', () => {
  for (const id of ['plano1', 'plano2', 'escritorio', 'start']) {
    const p = planForUserPlan(id)
    assert.ok(p.limits.allowExpandTribunais, `${id} should allow expand`)
  }
})

test('docsPerDay increases with plan tier', () => {
  const free = planForUserPlan('free')
  const p1   = planForUserPlan('plano1')
  const p2   = planForUserPlan('plano2')
  assert.ok(p1.limits.docsPerDay > free.limits.docsPerDay)
  assert.ok(p2.limits.docsPerDay > p1.limits.docsPerDay)
})

// ── PLAN_POLICIES completeness ────────────────────────────────────────────────

test('all plan policies have required fields', () => {
  for (const [id, policy] of Object.entries(PLAN_POLICIES)) {
    assert.ok(policy.name, `${id} must have a name`)
    assert.ok(policy.priceLabel, `${id} must have a priceLabel`)
    assert.ok(typeof policy.limits.docsPerDay === 'number', `${id} docsPerDay must be number`)
    assert.ok(typeof policy.limits.maxUsers === 'number', `${id} maxUsers must be number`)
  }
})

// ── todayDateKey ──────────────────────────────────────────────────────────────

test('todayDateKey returns YYYY-MM-DD format', () => {
  const key = todayDateKey()
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/)
})

test('todayDateKey is deterministic for the same date', () => {
  const d = new Date('2024-06-15T12:00:00Z')
  assert.equal(todayDateKey(d), '2024-06-15')
})
