#!/bin/bash
echo "🚀 Starting DUEL RXVVX..."

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

node bot.js
