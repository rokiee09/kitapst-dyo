use crate::error::AppError;
use rusqlite::Connection;

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    author TEXT,
    description TEXT,
    language TEXT NOT NULL DEFAULT 'tr',
    isbn TEXT,
    publisher TEXT,
    cover_asset_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapter (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    number TEXT,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES book(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES chapter(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_block (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    type TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    data TEXT NOT NULL,
    style TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    filename TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_version (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    version TEXT NOT NULL,
    changelog TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES book(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_settings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    autosave_ms INTEGER NOT NULL DEFAULT 800,
    last_opened_chapter_id TEXT,
    theme TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    FOREIGN KEY (last_opened_chapter_id) REFERENCES chapter(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chapter_book_parent_order
    ON chapter(book_id, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_block_chapter_order
    ON content_block(chapter_id, sort_order);
"#;

pub fn migrate(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(SCHEMA_SQL)?;
    ensure_migration(conn, 1)?;
    migrate_v2(conn)?;
    migrate_v3(conn)?;
    migrate_v4(conn)?;
    migrate_v5(conn)?;
    migrate_v6(conn)?;
    Ok(())
}

fn ensure_migration(conn: &Connection, version: i64) -> Result<(), AppError> {
    let applied: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
            [version],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if applied == 0 {
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, super::now()],
        )?;
    }
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({table})");
    let Ok(mut stmt) = conn.prepare(&sql) else {
        return false;
    };
    let Ok(mut rows) = stmt.query([]) else {
        return false;
    };
    while let Ok(Some(row)) = rows.next() {
        let name: String = row.get(1).unwrap_or_default();
        if name == column {
            return true;
        }
    }
    false
}

fn migrate_v2(conn: &Connection) -> Result<(), AppError> {
    if !column_exists(conn, "book_version", "snapshot") {
        conn.execute("ALTER TABLE book_version ADD COLUMN snapshot TEXT", [])?;
    }
    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS note (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    chapter_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chapter_template (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);
"#,
    )?;
    ensure_migration(conn, 2)?;
    Ok(())
}

fn migrate_v3(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS style_preset (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    block_type TEXT NOT NULL,
    style TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);
"#,
    )?;
    ensure_migration(conn, 3)?;
    Ok(())
}

fn migrate_v4(conn: &Connection) -> Result<(), AppError> {
    if !column_exists(conn, "book", "page_color") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN page_color TEXT NOT NULL DEFAULT '#ffffff'",
            [],
        )?;
    }
    if !column_exists(conn, "book", "ink_color") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN ink_color TEXT NOT NULL DEFAULT '#152033'",
            [],
        )?;
    }
    if !column_exists(conn, "book", "font_family") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN font_family TEXT NOT NULL DEFAULT 'Segoe UI'",
            [],
        )?;
    }
    ensure_migration(conn, 4)?;
    Ok(())
}

fn migrate_v5(conn: &Connection) -> Result<(), AppError> {
    if !column_exists(conn, "book", "page_numbers") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN page_numbers INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !column_exists(conn, "book", "page_number_align") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN page_number_align TEXT NOT NULL DEFAULT 'center'",
            [],
        )?;
    }
    if !column_exists(conn, "book", "page_number_start") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN page_number_start INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }
    ensure_migration(conn, 5)?;
    Ok(())
}

fn migrate_v6(conn: &Connection) -> Result<(), AppError> {
    if !column_exists(conn, "book", "line_height") {
        conn.execute(
            "ALTER TABLE book ADD COLUMN line_height REAL NOT NULL DEFAULT 1.15",
            [],
        )?;
    }
    ensure_migration(conn, 6)?;
    Ok(())
}
