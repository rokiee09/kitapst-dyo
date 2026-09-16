pub mod schema;
pub mod seed;

use crate::error::AppError;
use crate::filesystem;
use crate::models::{
    Book, BookStats, BookVersion, Chapter, ContentBlock, Project, ProjectSettings,
};
use crate::state::AppState;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use tauri::AppHandle;

pub fn initialize(app: &AppHandle) -> Result<AppState, AppError> {
    let project_root = filesystem::resolve_or_create_project(app)?;
    let db_path = project_root.join("project.sqlite");
    let conn = open_project_connection(&db_path)?;
    seed::ensure_default_content(&conn, &project_root)?;
    Ok(AppState {
        db: std::sync::Mutex::new(conn),
        project_root: std::sync::Mutex::new(project_root),
    })
}

pub fn open_project_connection(db_path: &Path) -> Result<Connection, AppError> {
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    schema::migrate(&conn)?;
    Ok(conn)
}

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn get_project(conn: &Connection) -> Result<Project, AppError> {
    conn.query_row(
        "SELECT id, name, root_path, created_at, updated_at FROM project LIMIT 1",
        [],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(AppError::from)
}

pub fn get_book(conn: &Connection) -> Result<Book, AppError> {
    conn.query_row(
        "SELECT id, project_id, title, subtitle, author, description, language, isbn, publisher, cover_asset_id, page_color, ink_color, font_family, page_numbers, page_number_align, page_number_start, created_at, updated_at
         FROM book LIMIT 1",
        [],
        map_book,
    )
    .map_err(AppError::from)
}

pub fn map_book(row: &rusqlite::Row<'_>) -> rusqlite::Result<Book> {
    Ok(Book {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        subtitle: row.get(3)?,
        author: row.get(4)?,
        description: row.get(5)?,
        language: row.get(6)?,
        isbn: row.get(7)?,
        publisher: row.get(8)?,
        cover_asset_id: row.get(9)?,
        page_color: row.get(10).unwrap_or_else(|_| "#ffffff".to_string()),
        ink_color: row.get(11).unwrap_or_else(|_| "#152033".to_string()),
        font_family: row.get(12).unwrap_or_else(|_| "Segoe UI".to_string()),
        page_numbers: row.get::<_, i64>(13).unwrap_or(0) != 0,
        page_number_align: row.get(14).unwrap_or_else(|_| "center".to_string()),
        page_number_start: row.get(15).unwrap_or(1),
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

pub fn list_chapters(conn: &Connection, book_id: &str) -> Result<Vec<Chapter>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, book_id, parent_id, title, number, sort_order, created_at, updated_at
         FROM chapter WHERE book_id = ?1 ORDER BY sort_order ASC",
    )?;
    let rows = stmt.query_map([book_id], |row| {
        Ok(Chapter {
            id: row.get(0)?,
            book_id: row.get(1)?,
            parent_id: row.get(2)?,
            title: row.get(3)?,
            number: row.get(4)?,
            order: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    let mut chapters = Vec::new();
    for row in rows {
        chapters.push(row?);
    }
    Ok(chapters)
}

pub fn get_chapter(conn: &Connection, id: &str) -> Result<Chapter, AppError> {
    conn.query_row(
        "SELECT id, book_id, parent_id, title, number, sort_order, created_at, updated_at
         FROM chapter WHERE id = ?1",
        [id],
        |row| {
            Ok(Chapter {
                id: row.get(0)?,
                book_id: row.get(1)?,
                parent_id: row.get(2)?,
                title: row.get(3)?,
                number: row.get(4)?,
                order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|_| AppError::user("Bölüm bulunamadı.", format!("missing chapter {id}")))
}

pub fn list_blocks(conn: &Connection, chapter_id: &str) -> Result<Vec<ContentBlock>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, chapter_id, type, sort_order, data, style, created_at, updated_at
         FROM content_block WHERE chapter_id = ?1 ORDER BY sort_order ASC",
    )?;
    let rows = stmt.query_map([chapter_id], map_block)?;
    let mut blocks = Vec::new();
    for row in rows {
        blocks.push(row?);
    }
    Ok(blocks)
}

pub fn get_block(conn: &Connection, id: &str) -> Result<ContentBlock, AppError> {
    conn.query_row(
        "SELECT id, chapter_id, type, sort_order, data, style, created_at, updated_at
         FROM content_block WHERE id = ?1",
        [id],
        map_block,
    )
    .map_err(|_| AppError::user("Blok bulunamadı.", format!("missing block {id}")))
}

fn map_block(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentBlock> {
    let data: String = row.get(4)?;
    let style: String = row.get(5)?;
    Ok(ContentBlock {
        id: row.get(0)?,
        chapter_id: row.get(1)?,
        block_type: row.get(2)?,
        order: row.get(3)?,
        data: serde_json::from_str(&data).unwrap_or(serde_json::json!({})),
        style: serde_json::from_str(&style).unwrap_or(serde_json::json!({})),
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub fn get_settings(conn: &Connection, project_id: &str) -> Result<ProjectSettings, AppError> {
    conn.query_row(
        "SELECT id, project_id, autosave_ms, last_opened_chapter_id, theme, created_at, updated_at
         FROM project_settings WHERE project_id = ?1",
        [project_id],
        |row| {
            Ok(ProjectSettings {
                id: row.get(0)?,
                project_id: row.get(1)?,
                autosave_ms: row.get(2)?,
                last_opened_chapter_id: row.get(3)?,
                theme: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(AppError::from)
}

pub fn list_versions(conn: &Connection, book_id: &str) -> Result<Vec<BookVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, book_id, version, changelog, created_at,
                CASE WHEN snapshot IS NOT NULL AND length(snapshot) > 2 THEN 1 ELSE 0 END
         FROM book_version WHERE book_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([book_id], |row| {
        let flag: i64 = row.get(5)?;
        Ok(BookVersion {
            id: row.get(0)?,
            book_id: row.get(1)?,
            version: row.get(2)?,
            changelog: row.get(3)?,
            created_at: row.get(4)?,
            has_snapshot: flag == 1,
        })
    })?;
    let mut versions = Vec::new();
    for row in rows {
        versions.push(row?);
    }
    Ok(versions)
}

pub fn set_last_opened_chapter(
    conn: &Connection,
    project_id: &str,
    chapter_id: &str,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE project_settings SET last_opened_chapter_id = ?1, updated_at = ?2 WHERE project_id = ?3",
        params![chapter_id, now(), project_id],
    )?;
    Ok(())
}

pub fn next_sibling_order(
    conn: &Connection,
    book_id: &str,
    parent_id: Option<&str>,
) -> Result<i64, AppError> {
    let order: i64 = match parent_id {
        Some(parent) => conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM chapter WHERE book_id = ?1 AND parent_id = ?2",
            params![book_id, parent],
            |row| row.get(0),
        )?,
        None => conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM chapter WHERE book_id = ?1 AND parent_id IS NULL",
            [book_id],
            |row| row.get(0),
        )?,
    };
    Ok(order + 1)
}

pub fn next_block_order(conn: &Connection, chapter_id: &str) -> Result<i64, AppError> {
    let order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM content_block WHERE chapter_id = ?1",
        [chapter_id],
        |row| row.get(0),
    )?;
    Ok(order + 1)
}

pub fn compute_chapter_number(
    conn: &Connection,
    book_id: &str,
    parent_id: Option<&str>,
    order: i64,
) -> Result<Option<String>, AppError> {
    if let Some(parent) = parent_id {
        let parent_number: Option<String> = conn
            .query_row(
                "SELECT number FROM chapter WHERE id = ?1",
                [parent],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        let index = sibling_index(conn, book_id, Some(parent), order)? + 1;
        return Ok(Some(match parent_number {
            Some(prefix) if !prefix.is_empty() => format!("{prefix}.{index}"),
            _ => index.to_string(),
        }));
    }

    let index = sibling_index(conn, book_id, None, order)? + 1;
    Ok(Some(index.to_string()))
}

fn sibling_index(
    conn: &Connection,
    book_id: &str,
    parent_id: Option<&str>,
    order: i64,
) -> Result<i64, AppError> {
    let count: i64 = match parent_id {
        Some(parent) => conn.query_row(
            "SELECT COUNT(*) FROM chapter WHERE book_id = ?1 AND parent_id = ?2 AND sort_order <= ?3",
            params![book_id, parent, order],
            |row| row.get(0),
        )?,
        None => conn.query_row(
            "SELECT COUNT(*) FROM chapter WHERE book_id = ?1 AND parent_id IS NULL AND sort_order <= ?2",
            params![book_id, order],
            |row| row.get(0),
        )?,
    };
    Ok(count)
}

#[allow(dead_code)]
pub fn descendant_ids(conn: &Connection, chapter_id: &str) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE descendants AS (
            SELECT id FROM chapter WHERE id = ?1
            UNION ALL
            SELECT c.id FROM chapter c JOIN descendants d ON c.parent_id = d.id
         )
         SELECT id FROM descendants",
    )?;
    let rows = stmt.query_map([chapter_id], |row| row.get::<_, String>(0))?;
    let mut ids = Vec::new();
    for row in rows {
        ids.push(row?);
    }
    Ok(ids)
}

pub fn get_stats(conn: &Connection, book_id: &str) -> Result<BookStats, AppError> {
    let chapter_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chapter WHERE book_id = ?1",
        [book_id],
        |row| row.get(0),
    )?;
    let image_count: i64 = count_blocks(conn, book_id, "image")?;
    let video_count: i64 = count_blocks(conn, book_id, "video")?;
    let qr_count: i64 = count_blocks(conn, book_id, "qr")?;
    let file_count: i64 = count_blocks(conn, book_id, "file")?;

    let mut stmt = conn.prepare(
        "SELECT data FROM content_block cb
         JOIN chapter c ON c.id = cb.chapter_id
         WHERE c.book_id = ?1",
    )?;
    let rows = stmt.query_map([book_id], |row| row.get::<_, String>(0))?;
    let mut word_count = 0_i64;
    let mut character_count = 0_i64;
    for row in rows {
        let raw = row?;
        let text = extract_plain_text(&raw);
        character_count += text.chars().filter(|ch| !ch.is_whitespace()).count() as i64;
        word_count += text.split_whitespace().filter(|part| !part.is_empty()).count() as i64;
    }

    let estimated_pages = if word_count == 0 {
        0
    } else {
        ((word_count as f64) / 250.0).ceil() as i64
    };
    Ok(BookStats {
        chapter_count,
        word_count,
        character_count,
        image_count,
        video_count,
        qr_count,
        file_count,
        estimated_pages,
    })
}

fn count_blocks(conn: &Connection, book_id: &str, block_type: &str) -> Result<i64, AppError> {
    conn.query_row(
        "SELECT COUNT(*) FROM content_block cb
         JOIN chapter c ON c.id = cb.chapter_id
         WHERE c.book_id = ?1 AND cb.type = ?2",
        params![book_id, block_type],
        |row| row.get(0),
    )
    .map_err(AppError::from)
}

fn extract_plain_text(raw_json: &str) -> String {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw_json) else {
        return String::new();
    };
    let mut out = String::new();
    collect_text(&value, &mut out);
    out
}

fn collect_text(value: &serde_json::Value, out: &mut String) {
    match value {
        serde_json::Value::String(text) => {
            if !out.is_empty() {
                out.push(' ');
            }
            out.push_str(text);
        }
        serde_json::Value::Array(items) => {
            for item in items {
                collect_text(item, out);
            }
        }
        serde_json::Value::Object(map) => {
            if let Some(serde_json::Value::String(text)) = map.get("text") {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push_str(text);
            }
            for (key, nested) in map {
                if key != "text" {
                    collect_text(nested, out);
                }
            }
        }
        _ => {}
    }
}

pub fn allowed_block_type(block_type: &str) -> bool {
    matches!(
        block_type,
        "heading"
            | "paragraph"
            | "image"
            | "video"
            | "qr"
            | "infoBox"
            | "warningBox"
            | "quote"
            | "orderedList"
            | "unorderedList"
            | "table"
            | "divider"
            | "file"
            | "pageBreak"
            | "code"
    )
}
