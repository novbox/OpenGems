<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/opengems-horizontal-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/opengems-horizontal-light.svg">
  <img src="assets/opengems-horizontal-light.svg" height="44" alt="OpenGems">
</picture>

`v0.1` · 探索值得收藏的开源世界。按主题收集 GitHub 上高星、质量好的项目，并为每个项目写下一句“它好在哪里”。

零依赖的本地应用：一个 Node 进程 + 一个网页，数据是可读的 Markdown 卡片。

![界面](assets/screenshot.png)

最新版本：[Releases](https://github.com/novbox/OpenGems/releases) · 下载源码包或查看版本说明

## 快速开始

需要 Node.js 20+，无需安装依赖：

```bash
git clone https://github.com/novbox/OpenGems.git
cd OpenGems
node scripts/collect.mjs
```

打开 <http://127.0.0.1:8899>。macOS 也可双击 `OpenGems.command`。

- 换端口：`node scripts/collect.mjs --port 8900`
- 提高 GitHub 限额：复制 `.env.example` 为 `.env`，填 `GITHUB_TOKEN`

## 用法

1. **换一批**：按 `discover.json` 的分类查询 GitHub，结果进入候选池
2. **收藏**：点卡片上的「收藏」，写入 `inbox/`，并按仓库 topic 自动归类
3. **整理**：详情页可改分类——未收藏时是草稿，收藏后立即生效
4. **回看**：切到「已收藏」，按分类或关键词筛选

自动归类只认明确的 topic：`design-systems` / `ui-kit` / `component-library` → 组件库，`animation` / `motion` → 动效，`icons` / `icon-set` → 图标。

## 数据

默认与代码同目录（`inbox/`、`candidates/`、`data/`、`discover.json`）。多机共用时，用 `OPEN_GEMS_DATA` 指向一个 Git 仓库：

```bash
git clone <your-data-repo> ~/opengems-data
export OPEN_GEMS_DATA=~/opengems-data
node scripts/collect.mjs
```

收藏、取消收藏、改分类、换一批之后，2.5 秒去抖自动提交并推送；启动时先 `pull --rebase`，冲突时 `rebase --abort` 保留本地改动。

| 路径 | 内容 |
| --- | --- |
| `inbox/owner--repo.md` | 一张卡片一个文件（front matter 含 repo / category / tags / why） |
| `candidates/latest.json` | 候选池缓存 |
| `data/subcategories.json` | 分类索引（从卡片派生） |
| `discover.json` | 分类与查询配置 |

## 配置

`discover.json` 定义分类与查询：

```json
[
  { "id": "design", "label": "设计", "query": "topic:ui-kit stars:>5000", "minStars": 8000 }
]
```

`query` 使用 GitHub 搜索语法，`minStars` 是展示下限；改完点「换一批」生效。

## 开发

没有构建步骤：改 `scripts/collect.html` 后刷新页面，服务端改动重启进程。

```
scripts/collect.mjs        服务：静态页、API、写卡片、触发同步
scripts/collect.html       前端（单文件）
scripts/discover.mjs       GitHub 搜索与候选池
scripts/markdown.mjs       Markdown 渲染
scripts/title.mjs          中文标题与摘要生成
```

## License

[MIT](LICENSE)
