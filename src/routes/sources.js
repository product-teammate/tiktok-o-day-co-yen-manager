'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database');

// Lấy danh sách sources với pagination và filter
router.get('/', (req, res) => {
  const { type, page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];

  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }

  if (search) {
    where += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM sources WHERE ${where}`).get(...params).count;
  const items = db.prepare(`SELECT * FROM sources WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  // Parse JSON fields
  const sources = items.map(s => ({
    ...s,
    tags: JSON.parse(s.tags || '[]'),
  }));

  res.json({ success: true, data: sources, total, page: +page, limit: +limit });
});

// Lấy chi tiết source
router.get('/:id', (req, res) => {
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ success: false, error: 'Không tìm thấy source' });

  source.tags = JSON.parse(source.tags || '[]');
  res.json({ success: true, data: source });
});

// Tạo source mới (quote hoặc dùng chung không có file)
router.post('/', (req, res) => {
  const { type, title, description, content, tags, file_path } = req.body;

  if (!type || !title) {
    return res.status(400).json({ success: false, error: 'Thiếu type hoặc title' });
  }

  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []));

  const result = db.prepare(
    'INSERT INTO sources (type, title, description, content, tags, file_path) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, title, description || null, content || null, tagsJson, file_path || null);

  const created = db.prepare('SELECT * FROM sources WHERE id = ?').get(result.lastInsertRowid);
  created.tags = JSON.parse(created.tags);

  res.status(201).json({ success: true, data: created });
});

// Cập nhật source
router.put('/:id', (req, res) => {
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ success: false, error: 'Không tìm thấy source' });

  const { title, description, content, tags } = req.body;
  const tagsJson = tags !== undefined
    ? JSON.stringify(Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()))
    : source.tags;

  db.prepare(
    'UPDATE sources SET title=?, description=?, content=?, tags=? WHERE id=?'
  ).run(
    title ?? source.title,
    description ?? source.description,
    content ?? source.content,
    tagsJson,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  updated.tags = JSON.parse(updated.tags);
  res.json({ success: true, data: updated });
});

// Xoá source
router.delete('/:id', (req, res) => {
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ success: false, error: 'Không tìm thấy source' });

  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Đã xoá source' });
});

module.exports = router;
