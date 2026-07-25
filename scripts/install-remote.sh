#!/bin/bash
set -e

REPO="https://github.com/mDevsLabs/mAI-CLI.git"
TMP_DIR=$(mktemp -d)

echo ""
echo "  🔧 Installing mAI CLI (remote)..."
echo ""

if ! command -v git &>/dev/null; then
  echo "  ⚠️ Git not found. Installing..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y git 2>/dev/null
  elif command -v pacman &>/dev/null; then
    sudo pacman -S git --noconfirm 2>/dev/null
  else
    echo "  Please install git first."
    exit 1
  fi
fi

echo "  📥 Cloning repository..."
git clone --depth 1 "$REPO" "$TMP_DIR/mai" 2>/dev/null

bash "$TMP_DIR/mai/scripts/install-user.sh"

rm -rf "$TMP_DIR"

echo ""
echo "  ✅ Installation complete!"
