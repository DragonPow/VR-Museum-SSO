CREATE TABLE IF NOT EXISTS visitor_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  visitor_id TEXT NOT NULL
);

-- Create indices to optimize query performance on timestamps and visitor IDs
CREATE INDEX IF NOT EXISTS idx_visitor_logs_timestamp ON visitor_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor ON visitor_logs(visitor_id);

CREATE TABLE IF NOT EXISTS guestbook_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guestbook_notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  signature TEXT,
  color_preset TEXT NOT NULL,
  rotation REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  is_pinned INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  event_tag TEXT,
  author_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_guestbook_notes_status ON guestbook_notes(status);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_pinned ON guestbook_notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_visible ON guestbook_notes(is_visible);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_priority ON guestbook_notes(priority);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_event ON guestbook_notes(event_tag);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_author ON guestbook_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_created ON guestbook_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_guestbook_notes_ip ON guestbook_notes(ip);
