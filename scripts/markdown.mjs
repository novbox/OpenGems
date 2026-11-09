// 极简 Markdown → HTML，仅用于 GitHub API 限流时渲染 raw README。
function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(text) {
  let out = escapeHtml(text)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img alt="$1" src="$2">')
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  return out
}

export function mdToHtml(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let paragraph = []
  let list = null
  let fence = null
  let fenced = []
  let htmlBlock = null

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push('<p>' + inline(paragraph.join(' ')) + '</p>')
      paragraph = []
    }
  }
  const closeList = () => {
    if (list) { out.push('</' + list + '>'); list = null }
  }

  for (const line of lines) {
    if (htmlBlock !== null) {
      if (!line.trim()) { out.push(htmlBlock.join('\n')); htmlBlock = null }
      else htmlBlock.push(line)
      continue
    }
    if (fence) {
      if (/^```/.test(line)) { out.push('<pre><code>' + escapeHtml(fenced.join('\n')) + '</code></pre>'); fence = null; fenced = [] }
      else fenced.push(line)
      continue
    }
    if (/^```/.test(line)) { flushParagraph(); closeList(); fence = line.slice(3).trim(); fenced = []; continue }
    if (!line.trim()) { flushParagraph(); closeList(); continue }
    if (/^\s*<(?!http)[a-zA-Z!/]/.test(line)) {
      flushParagraph(); closeList(); htmlBlock = [line]; continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; out.push(`<h${level}>` + inline(heading[2]) + `</h${level}>`); continue }
    if (/^---+$/.test(line.trim())) { flushParagraph(); closeList(); out.push('<hr>'); continue }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { flushParagraph(); closeList(); out.push('<blockquote>' + inline(quote[1]) + '</blockquote>'); continue }
    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    if (bullet) { flushParagraph(); if (list !== 'ul') { closeList(); list = 'ul'; out.push('<ul>') } out.push('<li>' + inline(bullet[1]) + '</li>'); continue }
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (ordered) { flushParagraph(); if (list !== 'ol') { closeList(); list = 'ol'; out.push('<ol>') } out.push('<li>' + inline(ordered[1]) + '</li>'); continue }
    closeList()
    paragraph.push(line.trim())
  }
  if (htmlBlock !== null) out.push(htmlBlock.join('\n'))
  if (fence) out.push('<pre><code>' + escapeHtml(fenced.join('\n')) + '</code></pre>')
  flushParagraph()
  closeList()
  return out.join('\n')
}
