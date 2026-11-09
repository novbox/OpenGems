# OpenGems · oss-picks

**探索值得收藏的开源世界。** 按主题收集 GitHub 上好的开源内容：**星标高、质量好、说得出一句“它好在哪里”**，不要求马上用得上。

## 主题怎么定

**不预设分类**。主题从条目里长出来：同一类攒够 5 条再建目录，不足 5 条先放 `inbox/`。
常见的候选有设计、创意、趣味、技术、学习资源等（见 `topics/README.md`），但以实际收进来的内容为准，可以随时合并、拆分、改名。

## 怎么用

1. **收**：看到好仓库，在 `inbox/` 建一张卡片（复制 `templates/entry.md`），10 秒内只写 `repo` + `why` 也行。
2. **归**：每周清一次 `inbox/`，按主题挪进 `topics/<主题>/`，顺手更新该主题的 `README.md` 索引。
3. **回顾**：每月第一个周六跑一遍下面的流程，30 分钟。

## 数据与同步

数据（`inbox/`、`topics/`、`candidates/`、`data/`、`discover.json`）默认和代码同目录；多机共用一份时，用 `OPEN_GEMS_DATA` 把数据指到独立目录，那个目录是一个 Git 仓库：

```bash
# 数据仓库：novbox/DSH-Studio 的 opengems 分支
git clone -b opengems git@github.com:novbox/DSH-Studio.git ~/YeeAIGC/opengems-data
export OPEN_GEMS_DATA=~/YeeAIGC/opengems-data
```

- 保存收藏、取消收藏、改子分类、跑「换一批」之后，2.5 秒去抖自动提交并推送
- 启动时先 `pull --rebase` 拉一次
- 推送失败会拉一次重推一次，仍失败只记 `lastError`，不动本地文件
- 冲突时 `rebase --abort`，保留本地改动，等下一次或手动处理
- `GET/POST /api/sync` 可查状态、手动同步

## 目录

| 路径 | 作用 |
| --- | --- |
| `inbox/` | 未分类的临时收件箱，每周清空 |
| `topics/<主题>/` | 主题目录，`README.md` 是该主题索引 |
| `topics/<主题>/owner--repo.md` | 一个仓库一张卡片 |
| `reviews/` | 月度回顾 `YYYY-MM.md` |
| `archive/` | 已剔除的卡片 |
| `templates/` | 卡片与主题索引模板 |
| `scripts/review-report.mjs` | 回顾体检脚本，零依赖 |

## 收录规则

- `why` 必填：一句话说明“它好在哪里”，写不出就不收。
- 卡片中文标题由 `discover.mjs` 按仓库描述/话题自动匹配；收录后可以改成更准确的说法。
- 星标只是线索，不是唯一标准；冷门但惊艳的照样收。
- 不要求自己用过，也不要求可用；但要有明确的收录理由。
- `status` 三态：`candidate`（刚收，待确认）→ `kept`（确认保留）/ `dropped`（剔除，移入 `archive/`）。
- 不把 README 和代码复制进库，只留链接 + 我的判断；要读代码就 clone 到库外。
- `license` 尽量记录，商用前以仓库当前声明为准。

## 推荐流：网页里一键收藏

1. 双击 `OpenGems.command`（或终端运行 `node scripts/collect.mjs`），自动打开 http://127.0.0.1:8899
2. 按分类卡片浏览候选，点「收藏」直接写进 `inbox/`；「换一批」会重新搜 GitHub 高星项目
3. 关掉终端窗口即停止服务

候选来自 `discover.json` 的分类与查询，改完点「换一批」生效。收藏的卡片 `why` 先用仓库描述占位，回顾时改成自己的判断。

## 拷到另一台电脑（公司 / 临时环境）

零依赖，不需要 `npm install`：

1. 复制整个目录（**不要**带 `.env`、`screenshots/`、`cache/`、`logs/`）；
2. 目标机器装 Node 20+（或使用 DSH 自带的 node）；
3. 在目录里执行 `node scripts/collect.mjs`，打开 http://127.0.0.1:8899 ；
4. 需要 GitHub Token 时，在本机新建 `.env`：`GITHUB_TOKEN=...`；
5. 端口冲突可加 `--port 8900`；
6. 不想开终端就双击 `OpenGems.command`。

`candidates/` 和 `inbox/` 一起复制，候选与收藏原样带走；`.env` 不要跟着拷。

## 收藏页设计规范

样式只有一套刻度，后续改动一律沿用（token 定义在 `scripts/collect.html` 的 `:root`）。**本标准仅适用于 OpenGems 收藏页本身，不外推到其他项目。**

| 项 | 取值 |
| --- | --- |
| 间距 | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64（8pt 网格，微调只用 4） |
| 字号 | 11 / 12 / 13 / 15 / 20 / 24 / 56 |
| 行高 | 16 / 20 / 22 / 28 / 32 / 64（正文 14/22） |
| 字重 | 400 正文 / 500 强调 / 600 标题 / 700 展示 |
| 圆角 | 6 / 8 / 12 / 16 / 999 |
| 容器 | 1120px，左右留白 32（移动端 20） |

颜色同样走 token，**深色与浅色两套必须同时改**（定义在 `scripts/collect.html` 的 `:root` 与 `:root[data-theme="light"]`）：

| token | 深色 | 浅色 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#151517` | `#e9edf3` | 页面底色 |
| `--panel` | `#232324` | `#ffffff` | 卡片、面板 |
| `--panel-2` | `#2c2c2e` | `#edf0f5` | chip、次级块 |
| `--line` | `rgba(255,255,255,.06)` | `rgba(15,23,42,.10)` | 描边（重要边界） |
| `--line-soft` | `rgba(255,255,255,.04)` | `rgba(15,23,42,.06)` | 分隔线 |
| `--text` | `#f9fafb` | `#0f1115` | 主文字 |
| `--muted` | `#adb2b8` | `#61666b` | 次要文字 |
| `--accent` | `#4d93f8` | `#2563eb` | 强调、选中态 |
| `--ok` | `#22c55e` | `#22c55e` | 成功、收藏 |
| `--warn` | `#f59e0b` | `#f59e0b` | 星标 |
| `--danger` | `#ff453a` | `#ff3b30` | 取消、危险操作 |

浅色模式额外给卡片补一层柔和投影（`--shadow`），否则白卡在浅底上边界太弱。

## 回顾

每月第一个周六，30 分钟：

1. `node scripts/review-report.mjs` 看体检结果；
2. 清空 `inbox/`；
3. 给被回顾的卡片更新 `last_reviewed`，该改 `status` 的改；
4. 更新各主题 `README.md` 的索引表；
5. 写 `reviews/YYYY-MM.md`：本月新增、剔除、状态变化、值得重看的。

去留线：

- 超过 **90 天**没回顾 → 脚本会列出来，这次要过一眼；
- 超过 **180 天**没回顾 → 必须做出去留决定：保留就跑一遍并更新日期，不要了移进 `archive/`；
- 每季度顺手合并重复主题、核对 license 是否变过。
