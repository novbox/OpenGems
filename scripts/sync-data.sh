#!/bin/bash
# 同步 OpenGems 数据仓库：提交本地改动 → 拉取远端（rebase）→ 推送。
# 由 launchd 定时调用；也可手动执行。失败只写日志，不改动本地状态。
set -u
DATA="${OPEN_GEMS_DATA:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG="${OPEN_GEMS_SYNC_LOG:-$HOME/Library/Logs/opengems-sync.log}"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }

cd "$DATA" 2>/dev/null || { log "data dir missing: $DATA"; exit 1; }
[ -d .git ] || { log "not a git repo: $DATA"; exit 1; }

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  git add -A || { log "git add failed"; exit 1; }
  if git -c user.name="${GIT_AUTHOR_NAME:-opengems}" -c user.email="${GIT_AUTHOR_EMAIL:-opengems@localhost}" \
       commit -q -m "data: $(date '+%Y-%m-%d %H:%M') @ $(hostname -s)"; then
    log "committed local changes"
  else
    log "commit failed"; exit 1
  fi
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  log "no remote configured; local only"
  exit 0
fi

if ! git pull --rebase --autostash --quiet; then
  git rebase --abort 2>/dev/null
  log "pull failed (conflict or offline); local changes kept, nothing pushed"
  exit 2
fi

if ! git push --quiet; then
  log "push failed; will retry next run"
  exit 3
fi
log "synced"
