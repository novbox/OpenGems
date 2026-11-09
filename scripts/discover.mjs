#!/usr/bin/env node
// 按分类抓 GitHub 高星仓库，生成候选清单：candidates/<日期>.json 和 <日期>.md。
// 用法：node scripts/discover.mjs [--per-category N] [--include-seen]
// 可选环境变量 GITHUB_TOKEN（不设也能跑，未认证搜索限 10 次/分钟）。
import './env.mjs'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { zhTitle, zhDesc } from './title.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = existsSync(join(ROOT, 'discover.json'))
  ? join(ROOT, 'discover.json')
  : join(ROOT, 'discover.default.json')
const OUT_DIR = join(ROOT, 'candidates')
const SEEN_PATH = join(OUT_DIR, 'seen.json')
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

const args = process.argv.slice(2)
const includeSeen = args.includes('--include-seen')
const perCategoryArg = args.indexOf('--per-category')
const perCategoryOverride = perCategoryArg >= 0 ? Number(args[perCategoryArg + 1]) : undefined

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const data = {}
  if (!match) return data
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (kv) data[kv[1]] = kv[2].trim()
  }
  return data
}

function walk(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSyncSafe(dir)) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(path))
    else if (entry.name.endsWith('.md')) out.push(path)
  }
  return out
}

function readdirSyncSafe(dir) {
  try {
    return readFileSync ? requireDir(dir) : []
  } catch {
    return []
  }
}

function requireDir(dir) {
  return []
}

function libraryIds() {
  const ids = new Set()
  const dirs = ['topics', 'inbox', 'archive'].map((name) => join(ROOT, name))
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const meta = frontMatter(readFileSync(file, 'utf8'))
      const match = /github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i.exec(String(meta.repo ?? ''))
      if (match) ids.add(`${match[1]}/${match[2]}`.replace(/\.git$/i, '').toLowerCase())
    }
  }
  return ids
}

async function search(query, perPage) {
  const url = new URL('https://api.github.com/search/repositories')
  url.searchParams.set('q', query)
  url.searchParams.set('sort', 'stars')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', String(perPage))
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'dsh-oss-picks',
  }
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`
  const response = await fetch(url, { headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${data.message ?? 'search failed'}`)
  }
  return Array.isArray(data.items) ? data.items : []
}

const config = readJson(CONFIG_PATH, null)
if (!config || !Array.isArray(config.categories)) {
  console.error('缺少 discover.json 或 categories 配置')
  process.exit(1)
}
const perCategory = perCategoryOverride ?? config.perCategory ?? 8
const minStars = config.minStars ?? 0
const seen = new Set(includeSeen ? [] : readJson(SEEN_PATH, []))
const library = libraryIds()
const previous = readJson(join(OUT_DIR, 'latest.json'), null)
const previousItems = []
if (previous?.categories) {
  for (const category of previous.categories) {
    for (const item of category.items ?? []) previousItems.push({ ...item, categoryId: category.id })
  }
}

mkdirSync(OUT_DIR, { recursive: true })
const date = new Date().toISOString().slice(0, 10)
const result = { generatedAt: new Date().toISOString(), perCategory, categories: [] }
let number = 0

for (const category of config.categories) {
  const label = category.label ?? category.id
  let items = []
  try {
    items = await search(category.query, Math.max(perCategory * 6, 50))
  } catch (error) {
    console.error(`[${label}] ${error.message}`)
    result.categories.push({ id: category.id, label, error: error.message, items: [] })
    continue
  }
  const floor = Number(category.minStars ?? minStars)
  const picked = []
  for (const item of items) {
    const id = String(item.full_name ?? '').toLowerCase()
    if (!id || library.has(id)) continue
    if (item.archived || item.fork) continue
    if (Number(item.stargazers_count ?? 0) < floor) continue
    const existing = previousItems.find((entry) => entry.id === id)
    if (existing) {
      existing.stars = item.stargazers_count
      existing.language = item.language ?? ''
      existing.license = item.license?.spdx_id ?? ''
      existing.description = String(item.description ?? '').trim()
      existing.topics = Array.isArray(item.topics) ? item.topics.slice(0, 5) : []
      existing.pushedAt = item.pushed_at ?? ''
      continue
    }
    if (picked.length >= perCategory) continue
    const record = {
      n: 0,
      id,
      fullName: item.full_name,
      url: item.html_url,
      stars: item.stargazers_count,
      language: item.language ?? '',
      license: item.license?.spdx_id ?? '',
      description: String(item.description ?? '').trim(),
      topics: Array.isArray(item.topics) ? item.topics.slice(0, 5) : [],
      pushedAt: item.pushed_at ?? '',
    }
    record.titleZh = zhTitle(record)
    record.descZh = zhDesc(record)
    picked.push(record)
  }
  result.categories.push({ id: category.id, label, items: picked })
  await new Promise((resolve) => setTimeout(resolve, 1200))
}

const previousIds = new Set(previousItems.map((item) => item.id))
const now = new Date().toISOString()
let added = 0

for (const category of result.categories) {
  category.items = category.items.filter((item) => !previousIds.has(item.id))
  for (const item of category.items) {
    item.discoveredAt = now
    item.categoryId = category.id
    added += 1
  }
}

if (added === 0) {
  console.error('没有拿到任何新候选（可能都已看过，或 GitHub 限流），保留现有列表。')
  process.exit(1)
}

const labels = new Map(config.categories.map((category) => [category.id, category.label ?? category.id]))
const merged = config.categories.map((category) => {
  const freshItems = result.categories.find((entry) => entry.id === category.id)?.items ?? []
  const oldItems = previousItems.filter((item) => item.categoryId === category.id)
  const ids = new Set()
  const items = []
  for (const item of [...freshItems, ...oldItems]) {
    if (ids.has(item.id)) continue
    ids.add(item.id)
    if (!item.discoveredAt) item.discoveredAt = now
    items.push(item)
  }
  items.sort((a, b) => (b.stars || 0) - (a.stars || 0))
  return { id: category.id, label: labels.get(category.id), items }
})

let total = 0
for (const category of merged) category.items = category.items.map((item) => ({ n: ++total, ...item }))

const mergedPayload = { generatedAt: now, perCategory, categories: merged }
for (const category of merged) for (const item of category.items) seen.add(item.id)

writeFileSync(join(OUT_DIR, `${date}.json`), JSON.stringify(mergedPayload, null, 2))
writeFileSync(join(OUT_DIR, 'latest.json'), JSON.stringify(mergedPayload, null, 2))
writeFileSync(SEEN_PATH, JSON.stringify([...seen].sort(), null, 2))

const lines = [`# 候选清单 ${date}`, '']
for (const category of merged) {
  lines.push(`## ${category.label}（${category.id}）`)
  for (const item of category.items) {
    lines.push(`- **${item.n}. [${item.fullName}](${item.url})** ⭐ ${item.stars} · ${item.language || '—'} · ${item.license || '无协议'}`)
    if (item.description) lines.push(`  ${item.description}`)
  }
  lines.push('')
}
writeFileSync(join(OUT_DIR, `${date}.md`), lines.join('\n'))

for (const category of merged) {
  console.log(`\n## ${category.label}`)
  for (const item of category.items) console.log(`  ${item.n}. ${item.fullName}  ⭐${item.stars}`)
}
console.log(`RESULT ${JSON.stringify({ added, total })}`)
console.log(`新增 ${added} 个，当前共 ${total} 个候选。`)
