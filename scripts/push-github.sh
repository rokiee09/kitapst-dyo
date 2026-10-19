#!/usr/bin/env bash
# GitHub'a main branch'i push eder ve (varsa) Actions durumunu gösterir.
set -euo pipefail

REPO_SLUG="${GITHUB_REPO:-rokiee09/kitapst-dyo}"
BRANCH="${GITHUB_BRANCH:-main}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN yok."
  echo "Cursor → Cloud Agents → Secrets içine GITHUB_TOKEN ekle,"
  echo "veya bu oturumda: export GITHUB_TOKEN=ghp_..."
  exit 1
fi

REMOTE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git"

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$REMOTE_URL"
else
  git remote add github "$REMOTE_URL"
fi

echo "Push → https://github.com/${REPO_SLUG} (${BRANCH})"
git push -u github "HEAD:${BRANCH}"

echo "Tamam. Actions: https://github.com/${REPO_SLUG}/actions"
echo "Bitince artifact: Kitap-Studyosu-Kurulum (Kurulum.exe)"
