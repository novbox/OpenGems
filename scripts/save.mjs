#!/usr/bin/env node
// 把最近一次候选清单里的编号收进 inbox/：node scripts/save.mjs 3 7 12
// 生成 inbox/<owner>--<repo>.md，why 先用仓库描述占位，回顾时补。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { DATA, dataPath } from './paths.mjs'
import { join } from 'node:path'

const LATEST = dataPath('candidates', 'latest.json')
const INBOX = dataPath('inbox')
const date = new Date().toISOString().slice(0, 10)

const nums = process.argv.slice(2).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
if (nums.length === 0) {
  console.error('用法：node scripts/save.mjs 3 7 12')
  process.exit(1)
}
if (!existsSync(LATEST)) {
  console.error('没有 candidates/latest.json，先运行 node scripts/discover.mjs')
  process.exit(1)
}

const data = JSON.parse(readFileSync(LATEST, 'utf8'))
const all = data.categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.label, categoryId: category.id })))
mkdirSync(INBOX, { recursive: true })

let saved = 0
for (const n of nums) {
  const item = all.find((entry) => entry.n === n)
  if (!item) {
    console.error(`跳过 ${n}：候选里没有这个编号`)
    continue
  }
  const [owner, repo] = String(item.fullName).split('/')
  const file = join(INBOX, `${owner}--${repo}.md`.toLowerCase())
  if (existsSync(file)) {
    console.error(`跳过 ${n}：${file.replace(DATA + '/', '')} 已存在`)
    continue
  }
  const why = item.description ? item.description.replace(/\s+/g, ' ').slice(0, 160) : '（待补：它好在哪里）'
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
category: ${item.categoryId}
why: ${why}
---

## 它是什么

${item.description || '（仓库没有描述）'}

## 为什么值得收

（待补：一句话说明它好在哪）

## 观察记录

- ${date} 从 ${item.category} 推荐收录（候选编号 ${n}）
`
  writeFileSync(file, content)
  saved += 1
  console.log(`已收藏 ${item.fullName} → inbox/${owner}--${repo}.md`)
}
console.log(`\n共收藏 ${saved} 个；下一步在回顾或手动归类时补 why 并移到 topics/<主题>/。`)
