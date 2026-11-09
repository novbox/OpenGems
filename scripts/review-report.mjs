#!/usr/bin/env node
// 回顾体检：统计主题与状态，列出超过 90 天未回顾、超过 180 天需决定去留、缺字段和 inbox 积压。
// 零依赖，Node 18+ 可直接运行：node scripts/review-report.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STALE_DAYS = 90
const DECIDE_DAYS = 180
const REQUIRED = ['repo', 'title', 'status', 'added', 'last_reviewed', 'why']

function readDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

function walk(dir) {
  const out = []
  for (const entry of readDir(dir)) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(path))
    else if (entry.name.endsWith('.md') && entry.name !== 'README.md') out.push(path)
  }
  return out
}

function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const data = {}
  if (!match) return data
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (!kv) continue
    data[kv[1]] = kv[2].trim()
  }
  return data
}

function daysSince(iso) {
  const time = Date.parse(String(iso ?? ''))
  if (Number.isNaN(time)) return Infinity
  return Math.floor((Date.now() - time) / 86400000)
}

const topics = readDir(join(ROOT, 'topics'))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const cards = []
for (const topic of topics) {
  for (const file of walk(join(ROOT, 'topics', topic))) {
    cards.push({ file: file.slice(ROOT.length + 1), topic, meta: frontMatter(readFileSync(file, 'utf8')) })
  }
}

const inbox = walk(join(ROOT, 'inbox'))
const statusCount = {}
for (const card of cards) {
  const status = String(card.meta.status ?? 'missing')
  statusCount[status] = (statusCount[status] ?? 0) + 1
}

const stale = []
const decide = []
const incomplete = []
for (const card of cards) {
  const missing = REQUIRED.filter((key) => card.meta[key] === undefined || card.meta[key] === '')
  if (missing.length) incomplete.push({ file: card.file, missing })
  const age = daysSince(card.meta.last_reviewed)
  if (age > DECIDE_DAYS) decide.push({ file: card.file, age, last: card.meta.last_reviewed })
  else if (age > STALE_DAYS) stale.push({ file: card.file, age, last: card.meta.last_reviewed })
}

console.log(`# OpenGems · 回顾体检 ${new Date().toISOString().slice(0, 10)}\n`)
console.log(`卡片总数: ${cards.length}（主题 ${topics.length} 个）`)
console.log(`inbox 积压: ${inbox.length}\n`)

console.log('## 状态分布')
if (cards.length === 0) console.log('- （还没有卡片）')
for (const [status, count] of Object.entries(statusCount).sort()) console.log(`- ${status}: ${count}`)

console.log('\n## 各主题')
if (topics.length === 0) console.log('- （还没有主题；同类攒够 5 条再建）')
for (const topic of topics) {
  const list = cards.filter((card) => card.topic === topic)
  const byStatus = {}
  for (const card of list) byStatus[card.meta.status ?? 'missing'] = (byStatus[card.meta.status ?? 'missing'] ?? 0) + 1
  const detail = Object.entries(byStatus).map(([key, value]) => `${key} ${value}`).join(', ')
  console.log(`- ${topic}: ${list.length}${detail ? `（${detail}）` : ''}`)
}

console.log(`\n## 超过 ${STALE_DAYS} 天未回顾`)
if (stale.length === 0) console.log('- 无')
for (const item of stale.sort((a, b) => b.age - a.age)) {
  console.log(`- ${item.file} — 最后回顾 ${item.last ?? '缺失'}（${item.age} 天）`)
}

console.log(`\n## 超过 ${DECIDE_DAYS} 天，需决定去留`)
if (decide.length === 0) console.log('- 无')
for (const item of decide.sort((a, b) => b.age - a.age)) {
  console.log(`- ${item.file} — 最后回顾 ${item.last ?? '缺失'}（${item.age} 天）`)
}

console.log('\n## 缺字段')
if (incomplete.length === 0) console.log('- 无')
for (const item of incomplete) console.log(`- ${item.file} — 缺 ${item.missing.join(', ')}`)

console.log('\n## inbox 待清理')
if (inbox.length === 0) console.log('- 无')
for (const file of inbox) console.log(`- ${file.slice(ROOT.length + 1)}`)
