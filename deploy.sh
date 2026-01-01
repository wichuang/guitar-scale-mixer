#!/bin/bash

# 確保腳本在錯誤時停止
set -e

echo "🚀 開始部署流程..."

# 檢查是否有未提交的變更
if [[ -z $(git status -s) ]]; then
  echo "✅ 工作目錄乾淨，沒有需要提交的變更。"
  read -p "是否要強制推送空 commit 來觸發重新部署？ (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
  git commit --allow-empty -m "Trigger deployment"
else
  # 顯示狀態
  git status
  
  # 詢問 Commit 訊息
  echo ""
  read -p "📝 請輸入 Commit 訊息: " commit_message
  
  if [ -z "$commit_message" ]; then
    echo "❌ 錯誤：Commit 訊息不能為空"
    exit 1
  fi

  # 執行 Git 操作
  echo "📦 加入檔案..."
  git add .
  
  echo "💾 提交變更..."
  git commit -m "$commit_message"
fi

echo "⬆️ 推送到 GitHub..."
git push origin main

echo "✅ 推送完成！GitHub Actions 將開始自動部署。"
echo "🔗 查看進度：https://github.com/wichuang/guitar-scale-mixer/actions"
