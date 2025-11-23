#!/bin/bash
# Clean and rebuild script for GhostContext contracts
# This fixes duplicate module errors

echo "🧹 Cleaning old build artifacts and lock file..."
rm -rf build
rm -f Move.lock

echo "🔨 Building contracts..."
sui move build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📦 Ready to deploy. Run:"
    echo "   sui client publish --gas-budget 100000000"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi

