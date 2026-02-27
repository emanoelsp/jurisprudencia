import fs from 'node:fs'
import path from 'node:path'

const MIN_CASES = 100
const MAX_CASES = 300
const MIN_ACCURACY = Number(process.env.GOLD_MIN_ACCURACY || 0.8)
const MAX_HALLUCINATION_RATE = Number(process.env.GOLD_MAX_HALLUCINATION_RATE || 0.02)

const corpus = [
  { label: 'civil', text: 'responsabilidade civil dano moral negativacao indevida nome indenizacao' },
  { label: 'tributario', text: 'tributario imposto renda deducao glosa fiscal receita federal' },
  { label: 'consumidor', text: 'consumidor clausula abusiva contrato revisao multa moratoria cdc' },
  { label: 'processual', text: 'tutela urgencia fumus boni iuris periculum in mora agravo' },
  { label: 'administrativo', text: 'administrativo servidor publico licenca premio aposentadoria direito adquirido' },
]

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\W+/)
    .filter(Boolean)
}

function scoreOverlap(query, doc) {
  const q = new Set(tokenize(query))
  if (q.size === 0) return 0
  const d = new Set(tokenize(doc))
  let hit = 0
  for (const t of q) if (d.has(t)) hit += 1
  return hit / q.size
}

function evaluateCase(item) {
  const scored = corpus
    .map(doc => ({ ...doc, score: scoreOverlap(item.query, doc.text) }))
    .sort((a, b) => b.score - a.score)
  const top = scored[0]
  const abstain = top.score < 0.2
  if (abstain) {
    return { correct: false, abstain: true, hallucination: false }
  }
  const correct = top.label === item.expectedLabel
  const hallucination = !correct && top.score >= 0.35
  return { correct, abstain: false, hallucination }
}

function main() {
  const filePath = path.resolve(process.cwd(), 'tests/gold-cases.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const dataset = JSON.parse(raw)

  if (!Array.isArray(dataset)) {
    throw new Error('Dataset inválido: esperado array')
  }
  if (dataset.length < MIN_CASES || dataset.length > MAX_CASES) {
    throw new Error(`Dataset deve ter entre ${MIN_CASES} e ${MAX_CASES} casos. Atual: ${dataset.length}`)
  }

  let correct = 0
  let abstained = 0
  let hallucinations = 0

  for (const item of dataset) {
    const result = evaluateCase(item)
    if (result.correct) correct += 1
    if (result.abstain) abstained += 1
    if (result.hallucination) hallucinations += 1
  }

  const accuracy = correct / dataset.length
  const abstainRate = abstained / dataset.length
  const hallucinationRate = hallucinations / dataset.length

  console.log('[gold-eval] metrics', {
    total: dataset.length,
    accuracy: Number(accuracy.toFixed(4)),
    abstainRate: Number(abstainRate.toFixed(4)),
    hallucinationRate: Number(hallucinationRate.toFixed(4)),
    thresholds: {
      MIN_ACCURACY,
      MAX_HALLUCINATION_RATE,
    },
  })

  if (accuracy < MIN_ACCURACY) {
    console.error(`[gold-eval] FAILED: accuracy ${accuracy.toFixed(4)} < ${MIN_ACCURACY}`)
    process.exit(1)
  }
  if (hallucinationRate > MAX_HALLUCINATION_RATE) {
    console.error(`[gold-eval] FAILED: hallucinationRate ${hallucinationRate.toFixed(4)} > ${MAX_HALLUCINATION_RATE}`)
    process.exit(1)
  }

  console.log('[gold-eval] PASS')
}

main()
