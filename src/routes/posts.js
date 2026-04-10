'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database');

// Lấy danh sách posts với filter
router.get('/', (req, res) => {
  const { status, page = 1, limit = 50, from, to } = req.query;
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];

  if (status) {
    where += ' AND p.status = ?';
    params.push(status);
  }

  if (from) {
    where += ' AND p.scheduled_date >= ?';
    params.push(from);
  }

  if (to) {
    where += ' AND p.scheduled_date <= ?';
    params.push(to);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM posts p WHERE ${where}`).get(...params).count;

  const items = db.prepare(`
    SELECT p.*, v.title as video_title, v.status as video_status, v.tiktok_url
    FROM posts p
    LEFT JOIN videos v ON p.video_id = v.id
    WHERE ${where}
    ORDER BY p.scheduled_date ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const posts = items.map(p => ({
    ...p,
    hashtags: JSON.parse(p.hashtags || '[]'),
  }));

  res.json({ success: true, data: posts, total, page: +page, limit: +limit });
});

// Lấy chi tiết post
router.get('/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, v.title as video_title, v.tiktok_url
    FROM posts p
    LEFT JOIN videos v ON p.video_id = v.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy post' });

  post.hashtags = JSON.parse(post.hashtags || '[]');
  res.json({ success: true, data: post });
});

// Tạo post mới
router.post('/', (req, res) => {
  const { video_id, scheduled_date, status, caption, hashtags, notes } = req.body;

  if (!scheduled_date) {
    return res.status(400).json({ success: false, error: 'Thiếu scheduled_date' });
  }

  const hashtagsJson = JSON.stringify(Array.isArray(hashtags) ? hashtags : (hashtags ? hashtags.split(/[\s,]+/).filter(Boolean) : []));

  const result = db.prepare(
    `INSERT INTO posts (video_id, scheduled_date, status, caption, hashtags, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(video_id || null, scheduled_date, status || 'planned', caption || null, hashtagsJson, notes || null);

  const created = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  created.hashtags = JSON.parse(created.hashtags);
  res.status(201).json({ success: true, data: created });
});

// Cập nhật post
router.put('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy post' });

  const { video_id, scheduled_date, status, caption, hashtags, notes, posted_at } = req.body;

  const hashtagsJson = hashtags !== undefined
    ? JSON.stringify(Array.isArray(hashtags) ? hashtags : hashtags.split(/[\s,]+/).filter(Boolean))
    : post.hashtags;

  // Nếu đánh dấu đã đăng, lưu thời gian thực
  const actualPostedAt = status === 'posted' ? (posted_at || new Date().toISOString()) : (posted_at ?? post.posted_at);

  db.prepare(
    `UPDATE posts SET video_id=?, scheduled_date=?, status=?, caption=?, hashtags=?, notes=?, posted_at=?
     WHERE id=?`
  ).run(
    video_id ?? post.video_id,
    scheduled_date ?? post.scheduled_date,
    status ?? post.status,
    caption ?? post.caption,
    hashtagsJson,
    notes ?? post.notes,
    actualPostedAt,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  updated.hashtags = JSON.parse(updated.hashtags);
  res.json({ success: true, data: updated });
});

// Xoá post
router.delete('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy post' });

  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Đã xoá post' });
});

module.exports = router;
