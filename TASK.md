# Task: Build TikTok Content Manager

## Context
Đọc file `../context.md` để hiểu về channel "Ở đây…có yên?"

## Tech Stack (đã có package.json)
- Express.js + SQLite (better-sqlite3)
- Multer cho upload
- Express Basic Auth
- EJS templates cho UI
- Tailwind CDN cho styling

## Requirements

### Database Schema (SQLite)
1. **sources** - Quản lý nguồn content
   - id, type (video/image/quote), title, description, file_path (nếu media), content (nếu quote), tags, created_at
2. **videos** - Quản lý video
   - id, title, description, source_ids (JSON), status (draft/published/scheduled), publish_date, tiktok_url, notes, created_at, updated_at
3. **posts** - Lịch đăng bài
   - id, video_id, scheduled_date, status (planned/posted/skipped), caption, hashtags, posted_at, notes

### API Endpoints
- CRUD cho sources, videos, posts
- Upload endpoint (POST /api/upload) - hỗ trợ video + image
- List với pagination và filter

### Web UI (EJS)
- Dashboard: tổng quan (số lượng draft, scheduled, published, sources)
- Sources page: list + upload + add quote
- Videos page: list theo status, tạo video mới từ sources
- Posts/Schedule page: lịch đăng, tạo post từ video

### Scripts
- `scripts/ngrok-share.sh` - Script share localhost qua ngrok/ngrokl/nport.link
  - Tạo HTTPS tunnel
  - Basic auth (user/pass từ env hoặc prompt)
  - Auto expire sau 1h
  - In ra URL để share

## Steps
1. Cài đặt dependencies (npm install)
2. Tạo SQLite database và schema
3. Tạo Express server với API routes
4. Tạo EJS templates cho UI
5. Tạo upload handler
6. Tạo ngrok-share script
7. Tạo README với hướng dẫn
8. Git commit
9. Tạo GitHub repo và push

## Lưu ý
- UI đơn giản, functional, responsive
- Code sạch, có comments tiếng Việt
- Error handling đầy đủ
- Upload files vào `uploads/` directory
