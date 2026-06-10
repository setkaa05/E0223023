import Database from 'better-sqlite3'
import path from 'path'
import { Log } from '../../lib/logger'

const DB_PATH = path.join(__dirname, '../../data/notifications.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    try {
      db = new Database(DB_PATH)
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      initSchema()
      Log('backend', 'info', 'db', `connected to db at ${DB_PATH}`)
    } catch (err) {
      Log('backend', 'fatal', 'db', `db init failed: ${err}`)
      throw err
    }
  }
  return db
}

function initSchema() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        roll_no    TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id          TEXT PRIMARY KEY,
        student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        type        TEXT NOT NULL CHECK(type IN ('Placement', 'Event', 'Result')),
        message     TEXT NOT NULL,
        is_read     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notif_student
        ON notifications(student_id);

      CREATE INDEX IF NOT EXISTS idx_notif_student_unread
        ON notifications(student_id, created_at)
        WHERE is_read = 0;

      CREATE INDEX IF NOT EXISTS idx_notif_type
        ON notifications(type);

      -- seed a few test students if the table is empty
      INSERT OR IGNORE INTO students (id, name, email, roll_no) VALUES
        ('stu-001', 'Arun Kumar', 'arun@college.edu', 'CS2021001'),
        ('stu-002', 'Priya Sharma', 'priya@college.edu', 'CS2021002'),
        ('stu-003', 'Ravi Patel', 'ravi@college.edu', 'CS2021003');
    `)
    Log('backend', 'debug', 'db', 'schema ready, seed students in place')
  } catch (err) {
    Log('backend', 'error', 'db', `schema init error: ${err}`)
    throw err
  }
}
