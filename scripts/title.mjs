// 供 discover.mjs 与本地服务共用：按仓库描述/话题生成中文标题、简介、分类猜测。

const TYPE_RULES = [
  [/ui kit|ui component|ui library|component library|component set/i, 'UI 组件库'],
  [/design language|design system/i, '设计系统'],
  [/icon set|icon pack|icons?/i, '图标集'],
  [/css framework|utility-first/i, 'CSS 框架'],
  [/framework/i, '开发框架'],
  [/command[- ]line|cli\b|terminal/i, '命令行工具'],
  [/code editor|\bide\b|editor for/i, '编辑器'],
  [/database|key-value store|storage engine/i, '数据库'],
  [/motion|animation|transition/i, '动效工具'],
  [/agent|agentic|llm|prompt|\bskill\b/i, 'AI 工具'],
  [/awesome|curated list|collection of|list of/i, '资源清单'],
  [/game engine|engine/i, '引擎'],
  [/game|puzzle|arcade/i, '游戏'],
  [/\bfont\b|typeface/i, '字体'],
  [/template|boilerplate|starter/i, '模板'],
  [/extension|plugin|addon/i, '插件'],
  [/http client|api client|rest client/i, 'API 工具'],
  [/bundler|build tool|compiler/i, '构建工具'],
  [/test runner|testing library/i, '测试工具'],
  [/browser|web app|web application/i, '网页应用'],
  [/file manager/i, '文件管理器'],
  [/downloader|download manager/i, '下载工具'],
  [/note[- ]taking|notes app/i, '笔记应用'],
  [/rss|feed reader/i, '订阅阅读器'],
  [/monitor|observability|metrics/i, '监控工具'],
]

const TRAIT_RULES = [
  [/accessib/i, '注重可访问性'],
  [/self[- ]host/i, '可自托管'],
  [/headless/i, '无头组件'],
  [/zero[- ]config/i, '零配置'],
  [/offline/i, '可离线使用'],
  [/lightweight|tiny|small/i, '轻量'],
  [/dark mode|theme/i, '支持主题定制'],
  [/typescript/i, 'TypeScript 编写'],
  [/rust/i, 'Rust 编写'],
  [/go\b|golang/i, 'Go 编写'],
]

function pick(rules, text) {
  for (const [pattern, label] of rules) if (pattern.test(text)) return label
  return ''
}

/**
 * 标题默认就用仓库名：项目名本身就是最好的标识，
 * 用「UI 组件库」「开源项目」这类通用词会让多张卡片撞名。
 */
export function zhTitle(item) {
  return String(item.name ?? '').trim() || String(item.fullName ?? '').split('/').pop() || ''
}

/**
 * 生成一句可读的中文简介：类型 + 语言 + 用途/特点。
 * 没有把握时返回空串，由界面回退到仓库原始描述。
 */
export function zhDesc(item) {
  const description = String(item.description ?? '')
  const topics = item.topics ?? []
  const text = `${item.name ?? ''} ${description} ${topics.join(' ')}`
  const type = pick(TYPE_RULES, text)
  const language = item.language ? String(item.language) : ''
  const trait = pick(TRAIT_RULES, `${topics.join(' ')} ${description}`)

  // 描述本身信息量足够时，宁可显示原文，也不要输出没有信息量的类型句
  if (String(description).trim().length >= 40) return ''
  if (!type) return ''
  const glue = /^[A-Za-z]/.test(type) ? ' ' : ''
  const clauses = []
  if (language) clauses.push(`以 ${language} 编写的${glue}${type}`)
  else clauses.push(type)
  if (trait && !(language && trait.startsWith(language))) clauses.push(trait)

  if (!clauses.length) return ''
  const sentence = clauses.join('，')
  return sentence.endsWith('。') ? sentence : sentence + '。'
}

export function guessCategory(item) {
  const text = `${item.name ?? ''} ${item.description ?? ''} ${(item.topics ?? []).join(' ')}`.toLowerCase()
  if (/game|godot|unity|arcade|puzzle/.test(text)) return 'fun'
  if (/ui kit|component library|design system|figma|icon set|css framework/.test(text)) return 'design'
  if (/creative coding|generative|three\.?js|webgl|canvas|svg animation|motion graphics|video|animation/.test(text)) return 'creative'
  return 'tech'
}
