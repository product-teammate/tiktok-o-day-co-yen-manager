'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database');

// Lấy danh sách videos
router.get('/', (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    where += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM videos WHERE ${where}`).get(...params).count;
  const items = db.prepare(`SELECT * FROM videos WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  const videos = items.map(v => ({
    ...v,
    source_ids: JSON.parse(v.source_ids || '[]'),
  }));

  res.json({ success: true, data: videos, total, page: +page, limit: +limit });
});

// Lấy chi tiết video
router.get('/:id', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ success: false, error: 'Không tìm thấy video' });

  video.source_ids = JSON.parse(video.source_ids || '[]');

  // Lấy thông tin sources
  if (video.source_ids.length > 0) {
    const placeholders = video.source_ids.map(() => '?').join(',');
    video.sources = db.prepare(`SELECT * FROM sources WHERE id IN (${placeholders})`).all(...video.source_ids);
  } else {
    video.sources = [];
  }

  res.json({ success: true, data: video });
});

// Tạo video mới
router.post('/', (req, res) => {
  const { title, description, source_ids, status, publish_date, tiktok_url, notes } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Thiếu title' });
  }

  const sourceIdsJson = JSON.stringify(Array.isArray(source_ids) ? source_ids : []);

  const result = db.prepare(
    `INSERT INTO videos (title, description, source_ids, status, publish_date, tiktok_url, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description || null, sourceIdsJson, status || 'draft', publish_date || null, tiktok_url || null, notes || null);

  const created = db.prepare('SELECT * FROM videos WHERE id = ?').get(result.lastInsertRowid);
  created.source_ids = JSON.parse(created.source_ids);
  res.status(201).json({ success: true, data: created });
});

// Cập nhật video
router.put('/:id', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ success: false, error: 'Không tìm thấy video' });

  const { title, description, source_ids, status, publish_date, tiktok_url, notes } = req.body;

  const sourceIdsJson = source_ids !== undefined
    ? JSON.stringify(Array.isArray(source_ids) ? source_ids : [])
    : video.source_ids;

  db.prepare(
    `UPDATE videos SET title=?, description=?, source_ids=?, status=?, publish_date=?,
     tiktok_url=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(
    title ?? video.title,
    description ?? video.description,
    sourceIdsJson,
    status ?? video.status,
    publish_date ?? video.publish_date,
    tiktok_url ?? video.tiktok_url,
    notes ?? video.notes,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  updated.source_ids = JSON.parse(updated.source_ids);
  res.json({ success: true, data: updated });
});

// Xoá video
router.delete('/:id', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ success: false, error: 'Không tìm thấy video' });

  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Đã xoá video' });
});

module.exports = router;
