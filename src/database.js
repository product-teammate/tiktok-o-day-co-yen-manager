'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Đường dẫn đến file database
const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');

// Đảm bảo thư mục data tồn tại
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Khởi tạo database
const db = new Database(DB_PATH);

// Tắt WAL mode cho đơn giản
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tạo schema
db.exec(`
  -- Bảng nguồn content (video clip, ảnh, quote)
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('video', 'image', 'quote')),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT,
    content TEXT,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Bảng video TikTok
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    source_ids TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'scheduled')),
    publish_date DATETIME,
    tiktok_url TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Bảng lịch đăng bài
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
    scheduled_date DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'posted', 'skipped')),
    caption TEXT,
    hashtags TEXT DEFAULT '[]',
    posted_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
