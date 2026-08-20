import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await SQLite.openDatabaseAsync('pyqdeck.db');

  // Initialize tables
  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Cache metadata & hash fingerprint tracking
    CREATE TABLE IF NOT EXISTS cache_meta (
      key TEXT PRIMARY KEY,
      hash TEXT,
      last_checked INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Semesters table
    CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      subject_count INTEGER DEFAULT 0,
      cached_at INTEGER NOT NULL
    );

    -- Subjects table
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      semester_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      question_count INTEGER DEFAULT 0,
      meta_json TEXT,
      cached_at INTEGER NOT NULL
    );

    -- Questions table
    CREATE TABLE IF NOT EXISTS questions (
      question_id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      q_number TEXT,
      chapter TEXT,
      marks INTEGER,
      text TEXT NOT NULL,
      text_preview TEXT,
      text_html TEXT,
      type TEXT,
      has_solution INTEGER DEFAULT 0,
      cached_at INTEGER NOT NULL
    );

    -- Solutions table
    CREATE TABLE IF NOT EXISTS solutions (
      question_id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      content TEXT NOT NULL,
      content_html TEXT,
      type TEXT,
      votes INTEGER DEFAULT 0,
      is_verified INTEGER,
      cached_at INTEGER NOT NULL
    );

    -- Recent search queries
    CREATE TABLE IF NOT EXISTS recent_searches (
      query TEXT PRIMARY KEY,
      searched_at INTEGER NOT NULL
    );

    -- Small generic key/value store for app-level state (e.g. review-prompt tracking)
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return dbInstance;
}
