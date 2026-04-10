# 🎬 TikTok Content Manager - "Ở đây…có yên?"

Quản lý nội dung cho TikTok channel "Ở đây…có yên?" - thiên nhiên, núi rừng, biển, hoàng hôn.

## Tính năng

- **📁 Sources Management:** Upload và quản lý video, hình ảnh, quotes
- **🎬 Video Management:** Track video drafts, scheduled, published
- **📅 Schedule/Lịch đăng:** Lên lịch đăng bài, track status
- **📊 Dashboard:** Tổng quan nhanh về channel

## Cài đặt

```bash
npm install
```

## Chạy local

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Truy cập: http://localhost:3000

**Default auth:** `admin` / `tiktok2026`

Đổi auth qua environment variables:
```bash
AUTH_USER=myuser AUTH_PASS=mypass npm start
```

## Share qua HTTPS

```bash
# Cài localtunnel (lần đầu)
npm install -g localtunnel

# Chạy app trước
npm start &

# Share ra ngoài
./scripts/ngrok-share.sh
```

Tunnel tự đóng sau 1h.

## Database

SQLite local: `data/content.db`

## Tech Stack

- Express.js
- SQLite (better-sqlite3)
- EJS templates
- Tailwind CSS (CDN)
- Multer (file upload)

## Cấu trúc

```
├── src/
│   ├── server.js          # Express server + API + routes
│   ├── views/             # EJS templates
│   │   ├── layout.ejs
│   │   ├── dashboard.ejs
│   │   ├── sources.ejs
│   │   ├── videos.ejs
│   │   └── schedule.ejs
│   └── public/            # Static files
├── scripts/
│   └── ngrok-share.sh     # Share localhost qua HTTPS
├── data/
│   └── content.db         # SQLite database
├── uploads/               # Uploaded files
│   ├── videos/
│   └── images/
└── package.json
```
