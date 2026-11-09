#!/bin/zsh
# 双击启动「OpenGems」收藏台；关闭终端窗口即停止。
cd "$(dirname "$0")"
NODE_BIN="$(command -v node 2>/dev/null)"
if [ -z "$NODE_BIN" ] && [ -x "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node" ]; then
  NODE_BIN="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"
fi
if [ -z "$NODE_BIN" ]; then
  echo "没找到 node，请先安装 Node.js，或在 DSH 里让我跑。"
  read -r "?按回车关闭…"
  exit 1
fi
exec "$NODE_BIN" scripts/collect.mjs
