#!/bin/bash
# ngrok-share.sh - Share localhost via HTTPS tunnel
# Supports: localtunnel (free, no account), ngrok (if installed)
# Timeout: 1h auto-close
# Basic Auth: configurable

set -e

PORT=${PORT:-3000}
TIMEOUT=${TIMEOUT:-3600}  # 1 hour in seconds
AUTH_USER=${AUTH_USER:-admin}
AUTH_PASS=${AUTH_PASS:-tiktok2026}

echo "🔗 TikTok Content Manager - Share URL"
echo "======================================"
echo "📡 Local: http://localhost:${PORT}"
echo "⏱️  Timeout: $((TIMEOUT / 60)) minutes"
echo "🔐 Auth: ${AUTH_USER}:********"
echo ""

# Check if localtunnel is installed
if command -v lt &> /dev/null; then
    echo "🚀 Using localtunnel..."
    echo "⚠️  Note: localtunnel requires basic auth to be handled by the app (already configured)"
    echo ""
    echo "Starting tunnel... (Ctrl+C to stop)"
    timeout ${TIMEOUT} lt --port ${PORT} --subdomain "tiktok-${RANDOM}" 2>&1 || {
        echo ""
        echo "⏰ Tunnel closed after timeout or manually stopped."
    }
elif command -v ngrok &> /dev/null; then
    echo "🚀 Using ngrok..."
    echo "Starting tunnel with basic auth and 1h timeout..."
    timeout ${TIMEOUT} ngrok http ${PORT} --basic-auth "${AUTH_USER}:${AUTH_PASS}" 2>&1 || {
        echo ""
        echo "⏰ Tunnel closed after timeout or manually stopped."
    }
else
    echo "❌ No tunnel tool found!"
    echo ""
    echo "Install one of these:"
    echo ""
    echo "  Option 1 (Free, no account):"
    echo "    npm install -g localtunnel"
    echo ""
    echo "  Option 2 (ngrok - needs account):"
    echo "    brew install ngrok"
    echo "    ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    echo "  Option 3 (Cloudflare - free):"
    echo "    brew install cloudflared"
    echo "    cloudflared tunnel --url http://localhost:${PORT}"
    echo ""
    exit 1
fi
