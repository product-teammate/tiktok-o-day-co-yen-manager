#!/bin/bash
# share.sh - Share TikTok Content Manager qua HTTPS
# Dùng localtunnel (free, không cần tài khoản)
# Auto expire sau 1h
# Basic auth đã được config sẵn trong app

set -e

PORT=${PORT:-3000}
TIMEOUT=${TIMEOUT:-3600}  # 1h

echo "🔗 TikTok Content Manager - Share URL"
echo "======================================"
echo "📡 Local: http://localhost:${PORT}"
echo "⏱️  Timeout: $((TIMEOUT / 60)) phút"
echo "🔐 Auth: admin / tiktok2026"
echo ""
echo "⚠️  Lưu ý: localtunnel có thể yêu cầu click 'click to continue' lần đầu"
echo ""

if ! command -v lt &> /dev/null; then
    echo "❌ localtunnel chưa cài. Chạy: npm install -g localtunnel"
    exit 1
fi

echo "🚀 Starting tunnel..."
timeout ${TIMEOUT} lt --port ${PORT} 2>&1 || {
    echo ""
    echo "⏰ Tunnel đã đóng."
}
