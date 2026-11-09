# OpenGems · oss-picks

**探索值得收藏的开源世界。** 按主题收集 GitHub 上高星、质量好、说得出一句「它好在哪里」的项目——不要求马上用得上，但要有明确的收录理由。

零依赖的本地应用：一个 Node 进程 + 一个网页，数据是可读的 Markdown 卡片。

## 快速开始

要求 **Node.js 20+**，不需要 `npm install`：

```bash
git clone https://github.com/novbox/OpenGems.git
cd OpenGems
node scripts/collect.mjs
```

打开 <http://127.0.0.1:8899> 即可。macOS 也可以双击 `OpenGems.command` 启动。

| 场景 | 做法 |
| --- | --- |
| 换端口 | `node scripts/collect.mjs --port 8900` |
| 需要提高 GitHub 限额 | 在本机建 `.env`，写 `GITHUB_TOKEN=ghp_xxx` |
| 不想开终端 | 双击 `OpenGems.command` |
| 停止服务 | 终端里 `Ctrl+C`，或关掉窗口 |

## 界面与流程

1. **发现**：点「换一批」，按 `discover.json` 里的分类去搜 GitHub（分类自带查询与星标下限）
2. **收藏**：卡片上点「收藏」，写进 `inbox/`，同时按 topic 自动推导分类
3. **整理**：进详情页改分类——未收藏时是「待写入」的草稿，收藏后立即生效并同步
4. **回看**：切到「已收藏」，按分类筛选、搜索

分类有三条规则：

- 自动推导只认明确的 topic 映射（`design-systems` → 组件库、`animation` → 动效、`icons` → 图标）
- 未收藏时点分类只是草稿（虚线），点「收藏」才落盘
- 取消收藏用二次确认，卡片和分类一起删除

## 数据与同步

数据（`inbox/`、`candidates/`、`data/`、`discover.json`）默认与代码同目录。多机共用时用 `OPEN_GEMS_DATA` 指向独立的 Git 仓库：

```bash
git clone -b opengems git@github.com:novbox/DSH-Studio.git ~/YeeAIGC/opengems-data
export OPEN_GEMS_DATA=~/YeeAIGC/opengems-data
```

同步行为：

- 保存/取消收藏、改分类、跑「换一批」之后，2.5 秒去抖自动提交并推送
- 启动时先 `pull --rebase`
- 推送失败会拉一次重推一次，仍失败只记 `lastError`，不动本地文件
- `GET/POST /api/sync` 查状态、手动同步

## 目录

| 路径 | 作用 |
| --- | --- |
| `scripts/collect.mjs` | 主服务：静态页、API、写卡片、触发同步 |
| `scripts/collect.html` | 全部前端（单文件，无构建） |
| `scripts/discover.mjs` | GitHub 搜索与候选池 |
| `scripts/markdown.mjs` | README 与卡片的 Markdown 渲染 |
| `scripts/title.mjs` | 中文标题与摘要的规则生成 |
| `assets/` | logo、favicon |
| `discover.default.json` | 默认分类与查询（首次运行复制为 `discover.json`） |

数据侧（`OPEN_GEMS_DATA` 或仓库根目录）：

| 路径 | 作用 |
| --- | --- |
| `inbox/owner--repo.md` | 一张卡片一个文件，front matter 存 repo/category/tags/why |
| `candidates/latest.json` | 候选池缓存 |
| `data/subcategories.json` | 分类索引（从卡片派生） |
| `discover.json` | 分类与查询配置 |

## 收录原则

- `why` 必填：一句话说明它好在哪里，写不出就不收
- 星标只是线索，冷门但惊艳的照样收
- 只用链接 + 判断，不复制别人的代码或 README
- `license` 尽量记录，商用前以仓库当前声明为准

## 设计规范

样式只有一套刻度，token 定义在 `scripts/collect.html` 的 `:root`。**仅适用于 OpenGems 收藏页本身。**

| 项 | 取值 |
| --- | --- |
| 间距 | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64（8pt 网格） |
| 字号 | 11 / 12 / 13 / 14 / 15 / 20 / 24 / 56 |
| 行高 | 16 / 20 / 22 / 28 / 32 / 64 |
| 字重 | 400 正文 / 500 强调 / 600 标题 / 700 展示 |
| 圆角 | 6 / 8 / 12 / 16 / 999（按钮统一 8 + 超椭圆） |
| 控件高度 | 32px（搜索框、图标按钮、收藏按钮） |
| 图标 | `viewBox 0 0 16 16`、`stroke-width 1`、渲染 16px |
| 容器 | 1120px，左右留白 32（移动端 20） |

颜色同样走 token，**深浅两套必须同时改**：

| token | 深色 | 浅色 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#151517` | `#e2e6ec` | 页面底色 |
| `--panel` | `#232324` | `#ffffff` | 卡片、面板 |
| `--panel-2` | `#2c2c2e` | `#edf0f5` | chip、次级块 |
| `--line` | `rgba(255,255,255,.06)` | `rgba(15,23,42,.10)` | 描边 |
| `--text` | `#f9fafb` | `#0f1115` | 主文字 |
| `--muted` | `#adb2b8` | `#61666b` | 次要文字 |
| `--accent` | `#4d93f8` | `#2563eb` | 强调、选中 |
| `--ok` | `#22c55e` | `#22c55e` | 收藏、成功 |
| `--warn` | `#f59e0b` | `#f59e0b` | 星标 |
| `--danger` | `#ff453a` | `#ff3b30` | 取消、危险操作 |

## 维护

- `node scripts/review-report.mjs`：列出超期未回顾的卡片（90 天提示、180 天必须决定去留）
- 数据仓库每条提交都是一次可回滚的变更，冲突时 `rebase --abort` 保留本地，下次再同步
