require('express-async-errors');
const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const multer = require('multer');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DATA_DIR = path.join(__dirname, '..', 'data');
['videos', 'images'].forEach(d => {
  const dir = path.join(UPLOADS_DIR, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Database
const db = new Database(path.join(DATA_DIR, 'content.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('video', 'image', 'quote')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    file_path TEXT,
    content TEXT,
    tags TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    source_ids TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'published')),
    publish_date DATETIME,
    tiktok_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    scheduled_date DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'posted', 'skipped')),
    caption TEXT DEFAULT '',
    hashtags TEXT DEFAULT '',
    posted_at DATETIME,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id)
  );

  CREATE TRIGGER IF NOT EXISTS update_video_timestamp
  AFTER UPDATE ON videos
  BEGIN
    UPDATE videos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// Prepared statements
const stmts = {
  sources: {
    list: db.prepare('SELECT * FROM sources ORDER BY created_at DESC'),
    byType: db.prepare('SELECT * FROM sources WHERE type = ? ORDER BY created_at DESC'),
    getOne: db.prepare('SELECT * FROM sources WHERE id = ?'),
    create: db.prepare('INSERT INTO sources (type, title, description, file_path, content, tags) VALUES (?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE sources SET title = ?, description = ?, tags = ? WHERE id = ?'),
    delete: db.prepare('DELETE FROM sources WHERE id = ?'),
  },
  videos: {
    listAll: db.prepare('SELECT * FROM videos ORDER BY created_at DESC'),
    byStatus: db.prepare('SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC'),
    get: db.prepare('SELECT * FROM videos WHERE id = ?'),
    create: db.prepare('INSERT INTO videos (title, description, source_ids, status, publish_date, notes) VALUES (?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE videos SET title = ?, description = ?, source_ids = ?, status = ?, publish_date = ?, tiktok_url = ?, notes = ? WHERE id = ?'),
    delete: db.prepare('DELETE FROM videos WHERE id = ?'),
    count: db.prepare('SELECT status, COUNT(*) as count FROM videos GROUP BY status'),
  },
  posts: {
    listAll: db.prepare('SELECT posts.*, videos.title as video_title FROM posts LEFT JOIN videos ON posts.video_id = videos.id ORDER BY posts.scheduled_date DESC'),
    byStatus: db.prepare('SELECT posts.*, videos.title as video_title FROM posts LEFT JOIN videos ON posts.video_id = videos.id WHERE posts.status = ? ORDER BY posts.scheduled_date'),
    get: db.prepare('SELECT posts.*, videos.title as video_title FROM posts LEFT JOIN videos ON posts.video_id = videos.id WHERE posts.id = ?'),
    create: db.prepare('INSERT INTO posts (video_id, scheduled_date, caption, hashtags, notes) VALUES (?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE posts SET video_id = ?, scheduled_date = ?, status = ?, caption = ?, hashtags = ?, posted_at = ?, notes = ? WHERE id = ?'),
    delete: db.prepare('DELETE FROM posts WHERE id = ?'),
    upcoming: db.prepare("SELECT posts.*, videos.title as video_title FROM posts LEFT JOIN videos ON posts.video_id = videos.id WHERE posts.status = 'planned' AND posts.scheduled_date >= datetime('now') ORDER BY posts.scheduled_date LIMIT 10"),
  },
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Basic Auth (configurable via env)
const authUser = process.env.AUTH_USER || 'admin';
const authPass = process.env.AUTH_PASS || 'tiktok2026';
const useAuth = process.env.USE_AUTH !== 'false';

if (useAuth) {
  app.use(basicAuth({
    users: { [authUser]: authPass },
    challenge: true,
    realm: 'TikTok Content Manager',
  }));
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVideo = file.mimetype.startsWith('video/');
    const dir = path.join(UPLOADS_DIR, isVideo ? 'videos' : 'images');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// ==================== API ROUTES ====================

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const videoCounts = stmts.videos.count.all();
  const totalSources = stmts.sources.list.all().length;
  const upcomingPosts = stmts.posts.upcoming.all();
  const stats = { draft: 0, scheduled: 0, published: 0 };
  videoCounts.forEach(v => { stats[v.status] = v.count; });
  res.json({ ...stats, totalSources, upcomingPosts: upcomingPosts.length, upcomingList: upcomingPosts });
});

// Sources API
app.get('/api/sources', (req, res) => {
  const { type } = req.query;
  res.json(type ? stmts.sources.byType.all(type) : stmts.sources.list.all());
});

app.get('/api/sources/:id', (req, res) => {
  const source = stmts.sources.getOne.get(req.params.id);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  res.json(source);
});

app.post('/api/sources', (req, res) => {
  const { type, title, description, content, tags } = req.body;
  const result = stmts.sources.create.run(type, title, description || '', null, content || '', tags || '');
  res.json({ id: result.lastInsertRowid, message: 'Source created' });
});

app.put('/api/sources/:id', (req, res) => {
  const { title, description, tags } = req.body;
  stmts.sources.update.run(title, description || '', tags || '', req.params.id);
  res.json({ message: 'Source updated' });
});

app.delete('/api/sources/:id', (req, res) => {
  stmts.sources.delete.run(req.params.id);
  res.json({ message: 'Source deleted' });
});

// Upload API
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { type, title, description, tags } = req.body;
  const fileType = type || (req.file.mimetype.startsWith('video/') ? 'video' : 'image');
  const relPath = path.relative(path.join(__dirname, '..'), req.file.path);
  const result = stmts.sources.create.run(fileType, title || req.file.originalname, description || '', relPath, null, tags || '');
  res.json({ id: result.lastInsertRowid, file_path: relPath, message: 'File uploaded' });
});

// Videos API
app.get('/api/videos', (req, res) => {
  const { status } = req.query;
  res.json(status ? stmts.videos.byStatus.all(status) : stmts.videos.listAll.all());
});

app.get('/api/videos/:id', (req, res) => {
  const video = stmts.videos.get.get(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  video.source_ids = JSON.parse(video.source_ids);
  res.json(video);
});

app.post('/api/videos', (req, res) => {
  const { title, description, source_ids, status, publish_date, notes } = req.body;
  const sources = source_ids ? JSON.stringify(source_ids) : '[]';
  const result = stmts.videos.create.run(title, description || '', sources, status || 'draft', publish_date || null, notes || '');
  res.json({ id: result.lastInsertRowid, message: 'Video created' });
});

app.put('/api/videos/:id', (req, res) => {
  const { title, description, source_ids, status, publish_date, tiktok_url, notes } = req.body;
  const sources = source_ids ? (Array.isArray(source_ids) ? JSON.stringify(source_ids) : source_ids) : '[]';
  stmts.videos.update.run(title, description || '', sources, status || 'draft', publish_date || null, tiktok_url || '', notes || '', req.params.id);
  res.json({ message: 'Video updated' });
});

app.delete('/api/videos/:id', (req, res) => {
  stmts.videos.delete.run(req.params.id);
  res.json({ message: 'Video deleted' });
});

// Posts API
app.get('/api/posts', (req, res) => {
  const { status } = req.query;
  res.json(status ? stmts.posts.byStatus.all(status) : stmts.posts.listAll.all());
});

app.get('/api/posts/upcoming', (req, res) => {
  res.json(stmts.posts.upcoming.all());
});

app.get('/api/posts/:id', (req, res) => {
  const post = stmts.posts.get.get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

app.post('/api/posts', (req, res) => {
  const { video_id, scheduled_date, caption, hashtags, notes } = req.body;
  const result = stmts.posts.create.run(video_id, scheduled_date, caption || '', hashtags || '', notes || '');
  res.json({ id: result.lastInsertRowid, message: 'Post scheduled' });
});

app.put('/api/posts/:id', (req, res) => {
  const { video_id, scheduled_date, status, caption, hashtags, posted_at, notes } = req.body;
  stmts.posts.update.run(video_id, scheduled_date, status || 'planned', caption || '', hashtags || '', posted_at || null, notes || '', req.params.id);
  res.json({ message: 'Post updated' });
});

app.delete('/api/posts/:id', (req, res) => {
  stmts.posts.delete.run(req.params.id);
  res.json({ message: 'Post deleted' });
});

// ==================== WEB VIEWS ====================

// Dashboard
app.get('/', (req, res) => {
  const videoCounts = stmts.videos.count.all();
  const stats = { draft: 0, scheduled: 0, published: 0 };
  videoCounts.forEach(v => { stats[v.status] = v.count; });
  stats.totalSources = stmts.sources.list.all().length;
  stats.totalVideos = stmts.videos.listAll.all().length;
  stats.totalPosts = stmts.posts.listAll.all().length;
  stats.upcoming = stmts.posts.upcoming.all();
  res.render('dashboard', { stats });
});

// Sources page
app.get('/sources', (req, res) => {
  const { type } = req.query;
  const sources = type ? stmts.sources.byType.all(type) : stmts.sources.list.all();
  res.render('sources', { sources, type: type || 'all' });
});

// Videos page
app.get('/videos', (req, res) => {
  const { status } = req.query;
  const videos = status ? stmts.videos.byStatus.all(status) : stmts.videos.listAll.all();
  videos.forEach(v => { v.source_ids = JSON.parse(v.source_ids); });
  res.render('videos', { videos, status: status || 'all', sources: stmts.sources.list.all() });
});

// Posts/Schedule page
app.get('/schedule', (req, res) => {
  const posts = stmts.posts.listAll.all();
  const videos = stmts.videos.listAll.all();
  res.render('schedule', { posts, videos });
});

// 404
app.use((req, res) => res.status(404).send('Not found'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🎬 TikTok Content Manager running on http://localhost:${PORT}`);
  console.log(`🔐 Auth: ${authUser}:${'*'.repeat(authPass.length)}`);
  console.log(`📁 Uploads: ${UPLOADS_DIR}`);
  console.log(`💾 Database: ${path.join(DATA_DIR, 'content.db')}`);
});
