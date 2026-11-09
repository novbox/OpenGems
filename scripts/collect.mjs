#!/usr/bin/env node
// 本地收藏台：浏览器里点「收藏」直接把候选写进 inbox/。
// 用法：node scripts/collect.mjs [--port 8899] [--no-open]
import { createServer } from 'node:http'
import { ROOT, DATA, dataPath, rootPath } from './paths.mjs'
import { scheduleSync, syncNow, syncStatus } from './sync.mjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import './env.mjs'
import { zhTitle, zhDesc, guessCategory } from './title.mjs'
import { mdToHtml } from './markdown.mjs'
import { join, extname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { spawn } from 'node:child_process'

const execFileAsync = promisify(execFile)
const args = process.argv.slice(2)
const portArg = args.indexOf('--port')
const PORT = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT || 8899)
const noOpen = args.includes('--no-open')
const today = () => new Date().toISOString().slice(0, 10)
const candidatesPath = dataPath('candidates', 'latest.json')

function readData() {
  return JSON.parse(readFileSync(candidatesPath, 'utf8'))
}

function inboxFile(fullName) {
  const [owner, repo] = String(fullName).split('/')
  return dataPath('inbox', `${owner}--${repo}`.toLowerCase() + '.md')
}

function saveItem(item, category) {
  const file = inboxFile(item.fullName)
  if (existsSync(file)) return { ok: false, reason: 'exists', file }
  mkdirSync(dataPath('inbox'), { recursive: true })
  const date = today()
  const description = String(item.description || '').replace(/\s+/g, ' ').trim()
  const why = description ? description.slice(0, 160) : '（待补：它好在哪里）'
  const content = `---
repo: ${item.url}
title: ${item.fullName}
title_zh: ${item.titleZh || ''}
license: ${item.license || ''}
language: ${item.language || ''}
stars: ${item.stars}
added: ${date}
last_reviewed: ${date}
status: candidate
category: ${category.id}
why: ${why}
---

## 它是什么

${description || '（仓库没有描述）'}

## 为什么值得收

（待补：一句话说明它好在哪）

## 观察记录

- ${date} 从 ${category.label} 推荐收录
`
  writeFileSync(file, content)
  return { ok: true, file }
}


function readSaved() {
  const dir = dataPath('inbox')
  const items = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || name === 'README.md') continue
    const text = readFileSync(join(dir, name), 'utf8')
    const meta = {}
    const block = /^---\n([\s\S]*?)\n---/.exec(text)
    if (block) {
      for (const line of block[1].split('\n')) {
        const kv = /^([\w-]+):\s*(.*)$/.exec(line)
        if (kv) meta[kv[1]] = kv[2]
      }
    }
    items.push({
      file: name,
      fullName: meta.title || name.replace(/--/, '/').replace(/\.md$/, ''),
      url: meta.repo || '',
      titleZh: meta.title_zh || '',
      descZh: meta.why || '',
      language: meta.language || '',
      license: meta.license || '',
      stars: Number(meta.stars || 0),
      category: meta.category || '',
      added: meta.added || '',
    })
  }
  return items.sort((a, b) => String(b.added).localeCompare(String(a.added)))
}



const REPO_CACHE_DIR = dataPath('cache', 'repos')

function repoCachePath(fullName) {
  return join(REPO_CACHE_DIR, String(fullName).replace('/', '__').toLowerCase() + '.json')
}

function readRepoCache(fullName) {
  try {
    const data = JSON.parse(readFileSync(repoCachePath(fullName), 'utf8'))
    if (!data || typeof data.savedAt !== 'number') return null
    return data
  } catch {
    return null
  }
}

function writeRepoCache(fullName, repo, readme) {
  try {
    mkdirSync(REPO_CACHE_DIR, { recursive: true })
    writeFileSync(repoCachePath(fullName), JSON.stringify({ savedAt: Date.now(), repo, readme }))
  } catch {}
}


async function fetchRawReadme(fullName) {
  const names = ['README.md', 'readme.md', 'README.MD', 'Readme.md']
  const branches = ['main', 'master']
  const urls = []
  for (const branch of branches) {
    for (const name of names) {
      urls.push(`https://cdn.jsdelivr.net/gh/${fullName}@${branch}/${name}`)
    }
  }
  for (const name of names) {
    urls.push(`https://ghproxy.net/https://raw.githubusercontent.com/${fullName}/HEAD/${name}`)
  }
  const attempts = urls.map(async (target) => {
    const response = await fetch(target, { headers: { 'user-agent': 'dsh-opengems' }, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('missing')
    const text = await response.text()
    if (!text.trim()) throw new Error('empty')
    return mdToHtml(text)
  })
  try {
    return await Promise.any(attempts)
  } catch {
    return ''
  }
}

function poolRepo(fullName) {
  const data = readData()
  for (const category of data.categories ?? []) {
    for (const item of category.items ?? []) {
      if (String(item.fullName).toLowerCase() === String(fullName).toLowerCase()) return item
    }
  }
  return null
}

function parseRepoUrl(input) {
  const text = String(input ?? '').trim()
  if (!text) return null
  const match = /github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i.exec(text) || /^([\w.-]+)\/([\w.-]+)$/.exec(text)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '')
  if (!owner || !repo) return null
  return { fullName: `${owner}/${repo}` }
}

async function fetchRepoUngh(fullName) {
  const response = await fetch(`https://ungh.cc/repos/${fullName}`, {
    headers: { 'user-agent': 'dsh-opengems' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`ungh ${response.status}`)
  const data = await response.json().catch(() => ({}))
  const repo = data.repo
  if (!repo?.repo) throw new Error('ungh empty')
  return {
    fullName: repo.repo,
    url: `https://github.com/${repo.repo}`,
    stars: repo.stars ?? 0,
    language: '',
    license: '',
    description: String(repo.description ?? '').trim(),
    topics: [],
    pushedAt: repo.pushedAt ?? '',
    homepage: '',
  }
}

async function fetchRepo(fullName) {
  try {
    return await fetchRepoApi(fullName)
  } catch (error) {
    try {
      return await fetchRepoUngh(fullName)
    } catch {
      throw error
    }
  }
}

async function fetchRepoApi(fullName) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dsh-opengems' }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`https://api.github.com/repos/${fullName}`, { headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${data.message ?? 'lookup failed'}`)
  return {
    fullName: data.full_name,
    url: data.html_url,
    stars: data.stargazers_count ?? 0,
    language: data.language ?? '',
    license: data.license?.spdx_id ?? '',
    description: String(data.description ?? '').trim(),
    topics: Array.isArray(data.topics) ? data.topics : [],
    pushedAt: data.pushed_at ?? '',
    homepage: data.homepage ?? '',
  }
}

function buildDraft(info) {
  const name = String(info.fullName).split('/')[1] ?? info.fullName
  const titleZh = zhTitle({ name, description: info.description, topics: info.topics })
  const descZh = zhDesc({ language: info.language, titleZh, topics: info.topics })
  return { ...info, name, titleZh, descZh, why: descZh, category: guessCategory({ name, description: info.description, topics: info.topics }) }
}

function writeInboxCard(info, draft) {
  const date = today()
  const file = `${info.fullName.replace('/', '--')}.md`.toLowerCase()
  const path = dataPath('inbox', file)
  const topicsLine = info.topics.slice(0, 5).join('、')
  const content = `---
repo: ${info.url}
title: ${info.fullName}
title_zh: ${draft.titleZh}
license: ${info.license}
language: ${info.language}
stars: ${info.stars}
added: ${date}
last_reviewed: ${date}
status: candidate
category: ${draft.category}
why: ${draft.why}
---

## 它是什么

${draft.descZh}${info.description ? `

原仓库描述：${info.description}` : ''}

## 为什么值得收

${draft.why}

## 观察记录

- ${date} 手动添加（${draft.category}）
${topicsLine ? `- 主题标签：${topicsLine}` : ''}${info.homepage ? `
- 官网：${info.homepage}` : ''}
`
  writeFileSync(path, content)
  return file
}

function upsertPool(info, draft) {
  const data = readData()
  const categoryId = draft.category
  let category = data.categories.find((entry) => entry.id === categoryId) || data.categories[0]
  const record = {
    id: info.fullName.toLowerCase(),
    fullName: info.fullName,
    url: info.url,
    stars: info.stars,
    language: info.language,
    license: info.license,
    description: info.description,
    topics: info.topics.slice(0, 5),
    pushedAt: info.pushedAt,
    titleZh: draft.titleZh,
    descZh: draft.descZh,
    discoveredAt: new Date().toISOString(),
    categoryId: category.id,
  }
  const existing = category.items.find((item) => item.id === record.id)
  if (existing) Object.assign(existing, record)
  else category.items.push(record)
  category.items.sort((a, b) => (b.stars || 0) - (a.stars || 0))
  let n = 0
  for (const entry of data.categories) for (const item of entry.items) item.n = ++n
  writeFileSync(candidatesPath, JSON.stringify(data, null, 2))
}


for (const name of ['inbox', 'topics', 'archive', 'reviews', 'candidates', 'data']) {
  mkdirSync(dataPath(name), { recursive: true })
}

const SUBS = ['图标', '动效', '组件库', '设计系统']
const subsFile = () => dataPath('data', 'subcategories.json')
function readSubs() {
  try { return JSON.parse(readFileSync(subsFile(), 'utf8')) } catch { return {} }
}
function writeSubs(value) {
  mkdirSync(dataPath('data'), { recursive: true })
  writeFileSync(subsFile(), JSON.stringify(value, null, 2) + '\n')
}

function json(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch { resolve({}) }
    })
  })
}

async function discover() {
  const { stdout } = await execFileAsync(process.execPath, [rootPath('scripts', 'discover.mjs')], { cwd: ROOT, env: { ...process.env, OPEN_GEMS_DATA: DATA }, timeout: 90000 })
  const match = /RESULT (\{.*\})/.exec(String(stdout ?? ''))
  return match ? JSON.parse(match[1]) : { added: 0, total: 0 }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  try {
    if (url.pathname === '/api/candidates') {
      const data = readData()
      const saved = []
      for (const category of data.categories) {
        for (const item of category.items) if (existsSync(inboxFile(item.fullName))) saved.push(item.fullName)
      }
      const config = (() => {
        for (const candidate of [dataPath('discover.json'), rootPath('discover.default.json')]) {
          try { return JSON.parse(readFileSync(candidate, 'utf8')) } catch {}
        }
        return {}
      })()
      const minStars = Number(config.minStars ?? 0)
      const categoryMin = Object.fromEntries((config.categories ?? []).map((category) => [category.id, Number(category.minStars ?? minStars)]))
      return json(res, 200, { ...data, saved, minStars, categoryMin })
    }
    if (url.pathname === '/api/save' && req.method === 'POST') {
      const body = await readBody(req)
      const n = Number(body.n)
      const data = readData()
      for (const category of data.categories) {
        const item = category.items.find((entry) => entry.n === n)
        if (!item) continue
        const result = saveItem(item, category)
        if (result.ok) scheduleSync()
        return json(res, 200, { ...result, fullName: item.fullName })
      }
      return json(res, 404, { ok: false, reason: 'not-found' })
    }
    if (url.pathname === '/api/discover' && req.method === 'POST') {
      try {
        const info = await discover()
        scheduleSync()
        return json(res, 200, { ok: true, added: info.added, total: info.total })
      } catch (error) {
        const stderr = String(error?.stderr ?? '')
        return json(res, 200, { ok: false, reason: stderr.includes('没有拿到任何候选') ? 'empty' : 'failed' })
      }
    }
    if (url.pathname === '/api/repo' && req.method === 'GET') {
      const parsed = parseRepoUrl(url.searchParams.get('name') ?? '')
      if (!parsed) return json(res, 400, { ok: false, reason: 'bad-name' })
      const cached = readRepoCache(parsed.fullName)
      const ttl = cached?.readme ? 24 * 3600 * 1000 : 10 * 60 * 1000
      if (cached && Date.now() - cached.savedAt < ttl) {
        return json(res, 200, { ok: true, repo: cached.repo, readme: cached.readme, cached: true, degraded: !cached.readme })
      }
      const repo = cached?.repo ?? poolRepo(parsed.fullName)
      let readme = cached?.readme ?? ''
      if (!readme) readme = await fetchRawReadme(parsed.fullName)
      let finalRepo = repo
      if (!finalRepo) {
        try {
          finalRepo = await fetchRepo(parsed.fullName)
        } catch {}
      }
      if (!finalRepo) return json(res, 200, { ok: false, reason: 'lookup-failed' })
      writeRepoCache(parsed.fullName, finalRepo, readme)
      return json(res, 200, { ok: true, repo: finalRepo, readme, degraded: !readme })
    }
    if (url.pathname === '/api/lookup' && req.method === 'POST') {
      const body = await readBody(req)
      const parsed = parseRepoUrl(body.url)
      if (!parsed) return json(res, 400, { ok: false, reason: 'bad-url' })
      try {
        const info = await fetchRepo(parsed.fullName)
        return json(res, 200, { ok: true, draft: buildDraft(info) })
      } catch (error) {
        return json(res, 200, { ok: false, reason: 'lookup-failed', message: String(error.message) })
      }
    }
    if (url.pathname === '/api/save-manual' && req.method === 'POST') {
      const body = await readBody(req)
      const parsed = parseRepoUrl(body.url)
      if (!parsed) return json(res, 400, { ok: false, reason: 'bad-url' })
      let info
      try {
        info = await fetchRepo(parsed.fullName)
      } catch (error) {
        return json(res, 200, { ok: false, reason: 'lookup-failed' })
      }
      if (body.language) info.language = String(body.language).trim().slice(0, 40)
      if (body.license) info.license = String(body.license).trim().slice(0, 40)
      if (body.topics) {
        info.topics = String(body.topics).split(/[,，]/).map((topic) => topic.trim()).filter(Boolean).slice(0, 6)
      }
      const base = buildDraft(info)
      const draft = {
        ...base,
        titleZh: String(body.titleZh ?? '').trim() || base.titleZh,
        descZh: String(body.descZh ?? '').trim() || base.descZh,
        why: String(body.why ?? '').trim() || base.why,
        category: ['design', 'creative', 'fun', 'tech'].includes(body.category) ? body.category : base.category,
      }
      const file = `${info.fullName.replace('/', '--')}.md`.toLowerCase()
      if (existsSync(dataPath('inbox', file))) return json(res, 200, { ok: false, reason: 'exists' })
      writeInboxCard(info, draft)
      upsertPool(info, draft)
      return json(res, 200, { ok: true, fullName: info.fullName, file })
    }
    if (url.pathname === '/api/subcategories' && req.method === 'GET') {
      return json(res, 200, { ok: true, items: readSubs(), options: SUBS })
    }
    if (url.pathname === '/api/subcategories' && req.method === 'POST') {
      const body = await readBody(req)
      const fullName = String(body.fullName || '')
      if (!fullName) return json(res, 400, { ok: false })
      const subs = Array.isArray(body.subs) ? body.subs.filter((sub) => SUBS.includes(sub)) : []
      const all = readSubs()
      if (subs.length) all[fullName] = subs
      else delete all[fullName]
      writeSubs(all)
      scheduleSync()
      return json(res, 200, { ok: true, items: all })
    }
    if (url.pathname === '/api/sync') {
      if (req.method === 'GET') return json(res, 200, { ok: true, ...syncStatus() })
      const result = await syncNow()
      return json(res, 200, { ok: result.ok, ...result, ...syncStatus() })
    }
    if (url.pathname === '/api/saved' && req.method === 'GET') {
      return json(res, 200, { ok: true, items: readSaved() })
    }
    if (url.pathname === '/api/unsave' && req.method === 'POST') {
      const body = await readBody(req)
      const file = String(body.file || '')
      if (!/^[A-Za-z0-9._-]+\.md$/.test(file) || file === 'README.md') return json(res, 400, { ok: false })
      try {
        unlinkSync(dataPath('inbox', file))
        scheduleSync()
        return json(res, 200, { ok: true })
      } catch {
        return json(res, 200, { ok: false })
      }
    }
    if (url.pathname.startsWith('/assets/')) {
      const name = url.pathname.slice('/assets/'.length)
      if (!/^[A-Za-z0-9._-]+$/.test(name)) { res.writeHead(404); return res.end('not found') }
      try {
        const file = rootPath('assets', name)
        const type = extname(file).toLowerCase() === '.svg' ? 'image/svg+xml; charset=utf-8' : 'application/octet-stream'
        const body = readFileSync(file)
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' })
        return res.end(body)
      } catch {
        res.writeHead(404)
        return res.end('not found')
      }
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = readFileSync(rootPath('scripts', 'collect.html'))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(html)
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end() }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
  } catch (error) {
    json(res, 500, { ok: false, reason: String(error?.message ?? error) })
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，可能收藏台已经开着了：http://127.0.0.1:${PORT}`)
    if (!noOpen) openBrowser()
    return
  }
  console.error(error)
  process.exit(1)
})

function openBrowser() {
  if (noOpen) return
  try { spawn('open', [`http://127.0.0.1:${PORT}`], { detached: true, stdio: 'ignore' }).unref() } catch {}
}

server.listen(PORT, '127.0.0.1', () => {
  syncNow({ pullOnly: true }).catch(() => {})
  console.log(`OpenGems · 收藏台：http://127.0.0.1:${PORT}`)
  console.log('按 Ctrl+C 停止。')
  openBrowser()
})
