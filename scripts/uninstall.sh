#!/bin/bash
set -e

echo "🔧 Uninstalling mAI CLI..."

rm -f /usr/local/bin/mai
rm -rf /usr/local/lib/mai

echo "✅ mAI CLI uninstalled."
echo "  Config at ~/.mai/ was kept. Delete it manually if you want."
