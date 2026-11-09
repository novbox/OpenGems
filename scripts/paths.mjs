// 统一解析「代码目录」与「数据目录」。
// 数据默认和代码同目录；多机同步时用 OPEN_GEMS_DATA 指向一个独立的数据仓库。
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA = process.env.OPEN_GEMS_DATA ? join(process.env.OPEN_GEMS_DATA) : ROOT
export const dataPath = (...parts) => join(DATA, ...parts)
export const rootPath = (...parts) => join(ROOT, ...parts)
