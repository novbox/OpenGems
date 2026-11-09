// 供 discover.mjs 与本地服务共用：按仓库描述/话题生成中文标题、简介、分类猜测。
const ZH_RULES = [
  [/ui kit|ui component|component library|design system|icon set/i, 'UI 组件库'],
  [/game engine/i, '游戏引擎'],
  [/creative coding|generative art/i, '创意编程工具'],
  [/awesome|curated list|collection of/i, '资源清单'],
  [/game/i, '游戏'],
  [/agent|llm|prompt/i, 'AI / Agent 工具'],
  [/framework/i, '开发框架'],
  [/cli|command[- ]line/i, '命令行工具'],
  [/api|http client/i, 'API 工具'],
]

export function zhTitle(item) {
  const text = `${item.name ?? ''} ${item.description ?? ''} ${(item.topics ?? []).join(' ')}`
  for (const [pattern, label] of ZH_RULES) if (pattern.test(text)) return label
  return '开源项目'
}

export function zhDesc(item) {
  const parts = []
  if (item.language) parts.push(item.language)
  parts.push(item.titleZh || '开源项目')
  const topics = (item.topics ?? []).slice(0, 2)
  if (topics.length) parts.push(`涵盖 ${topics.join('、')}`)
  return parts.join(' · ')
}

export function guessCategory(item) {
  const text = `${item.name ?? ''} ${item.description ?? ''} ${(item.topics ?? []).join(' ')}`.toLowerCase()
  if (/game|godot|unity|arcade|puzzle/.test(text)) return 'fun'
  if (/ui kit|component library|design system|figma|icon set|css framework/.test(text)) return 'design'
  if (/creative coding|generative|three\.?js|webgl|canvas|svg animation|motion graphics|video|animation/.test(text)) return 'creative'
  return 'tech'
}
