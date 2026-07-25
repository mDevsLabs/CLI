#!/bin/bash
set -e

INSTALL_DIR="/usr/local/lib/mai"
BIN_LINK="/usr/local/bin/mai"

echo "Installing mAI CLI..."

if [ -d "$INSTALL_DIR" ]; then
  echo "Removing previous installation..."
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"

cp -R "$(dirname "$0")/../package.json" "$INSTALL_DIR/"
cp -R "$(dirname "$0")/../src" "$INSTALL_DIR/src"
cp -R "$(dirname "$0")/../bin" "$INSTALL_DIR/bin"
cp -R "$(dirname "$0")/../tsconfig.json" "$INSTALL_DIR/"

cd "$INSTALL_DIR"
npm install --production 2>&1 | tail -3
npm install tsx 2>&1 | tail -1

cat > "$INSTALL_DIR/bin/run.sh" << 'SCRIPT'
#!/bin/bash
exec npx --prefix /usr/local/lib/mai tsx /usr/local/lib/mai/src/entrypoints/cli.tsx "$@"
SCRIPT
chmod +x "$INSTALL_DIR/bin/run.sh"

rm -f "$BIN_LINK"
ln -s "$INSTALL_DIR/bin/run.sh" "$BIN_LINK"

echo ""
echo "mAI CLI installed successfully!"
echo "Run 'mai' from any terminal to start."
