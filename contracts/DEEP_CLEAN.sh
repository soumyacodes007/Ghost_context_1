#!/bin/bash
# Deep clean script to fix persistent duplicate module errors

echo "🧹 Performing deep clean of all build artifacts..."

# Remove build directory completely
echo "  - Removing build directory..."
rm -rf build

# Remove lock file
echo "  - Removing Move.lock..."
rm -f Move.lock

# Remove any hidden Sui cache (if exists)
echo "  - Cleaning Sui cache..."
rm -rf ~/.sui/sui_config/client.yaml.bak 2>/dev/null || true

# Check Sui version
echo ""
echo "📋 Checking Sui CLI version..."
sui --version

echo ""
echo "🔨 Rebuilding from scratch..."
sui move build --skip-fetch-latest-git-deps

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📦 Ready to deploy. Run:"
    echo "   sui client publish --gas-budget 100000000"
else
    echo ""
    echo "❌ Build failed."
    echo ""
    echo "💡 Try these additional steps:"
    echo "   1. Update Sui CLI: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
    echo "   2. Check Sui version matches: sui --version"
    echo "   3. Try: sui move build --skip-fetch-latest-git-deps"
    exit 1
fi

