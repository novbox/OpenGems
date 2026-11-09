// 数据同步：和备忘录 / 书签同一个思路——数据放 Git 分支，
// 保存后去抖自动提交推送，启动时先拉一次，冲突只记录不覆盖。
import { execFile } from 'node:child_process'
import { hostname } from 'node:os'
import { DATA } from './paths.mjs'

let chain = Promise.resolve()
let timer = null
const state = { lastSyncAt: '', lastError: '', lastDetail: '', syncing: false }

function git(args, timeout = 30000) {
  return new Promise((resolve) => {
    execFile('git', ['-C', DATA, ...args], { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, out: String(stdout || ''), err: String(stderr || error?.message || '') })
    })
  })
}

async function ready() {
  if (process.env.OPEN_GEMS_SYNC === '0') return { ok: false, error: 'sync-disabled' }
  const remote = await git(['remote', 'get-url', 'origin'])
  if (!remote.ok) return { ok: false, error: 'no-remote' }
  const head = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = head.ok ? head.out.trim() : ''
  if (!branch || branch === 'HEAD') return { ok: false, error: 'no-branch' }
  return { ok: true, branch }
}

async function commitLocal() {
  await git(['add', '-A'])
  const dirty = await git(['status', '--porcelain'])
  if (!dirty.out.trim()) return false
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const result = await git([
    '-c', 'user.name=opengems', '-c', 'user.email=opengems@localhost',
    'commit', '-q', '-m', `data: ${stamp} @ ${hostname()}`,
  ])
  return result.ok
}

async function perform({ pullOnly = false } = {}) {
  const info = await ready()
  if (!info.ok) return { ok: false, error: info.error }
  if (!pullOnly) await commitLocal()
  const pull = await git(['pull', '--rebase', '--autostash', '--quiet'])
  if (!pull.ok) {
    await git(['rebase', '--abort'])
    return { ok: false, error: 'pull-conflict' }
  }
  if (!pullOnly) {
    let push = await git(['push', '--quiet'])
    if (!push.ok) {
      // 偶发的远端锁 / 网络抖动：拉一次再推一次，仍失败才报错。
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await git(['pull', '--rebase', '--autostash', '--quiet'])
      push = await git(['push', '--quiet'])
    }
    if (!push.ok) {
      const detail = push.err.split('\n').filter(Boolean).slice(-2).join(' ')
      console.error(`[opengems-sync] push failed: ${detail}`)
      return { ok: false, error: 'push-failed', detail }
    }
  }
  return { ok: true, branch: info.branch, at: new Date().toISOString() }
}

/** Serialised sync; never throws, callers can ignore the promise. */
export function syncNow(options) {
  const task = chain.then(async () => {
    state.syncing = true
    try {
      const result = await perform(options)
      if (result.ok) {
        state.lastSyncAt = result.at
        state.lastError = ''
      } else {
        state.lastError = result.error
        state.lastDetail = result.detail || ''
      }
      return result
    } finally {
      state.syncing = false
    }
  })
  chain = task.then(() => undefined, () => undefined)
  return task
}

/** Debounced push after a local edit. */
export function scheduleSync(delay = 2500) {
  if (process.env.OPEN_GEMS_SYNC === '0') return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    syncNow().catch(() => {})
  }, delay)
  timer.unref?.()
}

export function syncStatus() {
  return { dir: DATA, ...state }
}
