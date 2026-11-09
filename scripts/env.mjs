// 读取本地 .env（不依赖第三方库），供 discover / 本地服务共用。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, ROOT } from './paths.mjs'


try {
  let text = ''
  for (const candidate of [join(DATA, '.env'), join(ROOT, '.env')]) {
    try { text = readFileSync(candidate, 'utf8'); break } catch {}
  }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value
  }
} catch {}
