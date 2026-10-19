use crate::database::{self, new_id, now};
use crate::error::AppError;
use crate::extras;
use rusqlite::{params, Connection};
use serde_json::json;

const FRONT_PAGES: [(&str, &str); 3] = [
    ("Önsöz", "builtin-onsoz"),
    ("Giriş", "builtin-giris"),
    ("İçindekiler", "builtin-icindekiler"),
];

/// Yeni üst düzey bölümde Önsöz, Giriş ve İçindekiler alt sayfalarını oluşturur.
pub fn ensure_chapter_front_pages(
    conn: &Connection,
    book_id: &str,
    parent_chapter_id: &str,
) -> Result<(), AppError> {
    for (title, template_id) in FRONT_PAGES {
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chapter WHERE book_id = ?1 AND parent_id = ?2 AND title = ?3",
            params![book_id, parent_chapter_id, title],
            |row| row.get(0),
        )?;
        if exists > 0 {
            continue;
        }
        let order = database::next_sibling_order(conn, book_id, Some(parent_chapter_id))?;
        let number = database::compute_chapter_number(conn, book_id, Some(parent_chapter_id), order)?;
        let id = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, book_id, parent_chapter_id, title, number, order, ts, ts],
        )?;
        extras::insert_template_blocks(conn, &id, template_id)?;
    }
    refresh_chapter_toc(conn, book_id, parent_chapter_id)?;
    Ok(())
}

/// Kitap kökünde Kapak / Önsöz / Giriş / İçindekiler yoksa ekler (yeni kitap tohumu).
pub fn seed_book_front_matter(conn: &Connection, book_id: &str) -> Result<String, AppError> {
    let pages = [
        ("Kapak", "builtin-kapak"),
        ("Önsöz", "builtin-onsoz"),
        ("İçindekiler", "builtin-icindekiler"),
        ("Giriş", "builtin-giris"),
    ];
    let mut first_id = String::new();
    for (index, (title, template_id)) in pages.iter().enumerate() {
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chapter WHERE book_id = ?1 AND parent_id IS NULL AND title = ?2",
            params![book_id, title],
            |row| row.get(0),
        )?;
        if exists > 0 {
            if first_id.is_empty() {
                if let Ok(id) = conn.query_row(
                    "SELECT id FROM chapter WHERE book_id = ?1 AND parent_id IS NULL AND title = ?2 LIMIT 1",
                    params![book_id, title],
                    |row| row.get::<_, String>(0),
                ) {
                    first_id = id;
                }
            }
            continue;
        }
        let order = index as i64;
        let id = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
             VALUES (?1, ?2, NULL, ?3, NULL, ?4, ?5, ?6)",
            params![id, book_id, title, order, ts, ts],
        )?;
        extras::insert_template_blocks(conn, &id, template_id)?;
        if first_id.is_empty() {
            first_id = id;
        }
    }
    refresh_book_toc(conn, book_id)?;
    Ok(first_id)
}

pub fn refresh_book_toc(conn: &Connection, book_id: &str) -> Result<(), AppError> {
    let toc_id: Option<String> = conn
        .query_row(
            "SELECT id FROM chapter WHERE book_id = ?1 AND parent_id IS NULL AND title = 'İçindekiler' LIMIT 1",
            [book_id],
            |row| row.get(0),
        )
        .ok();
    let Some(toc_id) = toc_id else {
        return Ok(());
    };
    write_toc_list(conn, book_id, &toc_id, None)
}

pub fn refresh_chapter_toc(conn: &Connection, book_id: &str, parent_id: &str) -> Result<(), AppError> {
    let toc_id: Option<String> = conn
        .query_row(
            "SELECT id FROM chapter WHERE book_id = ?1 AND parent_id = ?2 AND title = 'İçindekiler' LIMIT 1",
            params![book_id, parent_id],
            |row| row.get(0),
        )
        .ok();
    let Some(toc_id) = toc_id else {
        return Ok(());
    };
    write_toc_list(conn, book_id, &toc_id, Some(parent_id))
}

fn write_toc_list(
    conn: &Connection,
    book_id: &str,
    toc_chapter_id: &str,
    parent_id: Option<&str>,
) -> Result<(), AppError> {
    let chapters = database::list_chapters(conn, book_id)?;
    let items: Vec<_> = chapters
        .iter()
        .filter(|chapter| {
            if chapter.id == toc_chapter_id {
                return false;
            }
            match parent_id {
                Some(parent) => {
                    chapter.parent_id.as_deref() == Some(parent)
                        && !matches!(chapter.title.as_str(), "Önsöz" | "Giriş" | "İçindekiler")
                }
                None => {
                    chapter.parent_id.is_none()
                        && !matches!(
                            chapter.title.as_str(),
                            "Kapak" | "Önsöz" | "Giriş" | "İçindekiler"
                        )
                }
            }
        })
        .collect();

    let list_items: Vec<_> = items
        .iter()
        .map(|chapter| {
            let label = match &chapter.number {
                Some(number) if !number.is_empty() => format!("{number} {}", chapter.title),
                _ => chapter.title.clone(),
            };
            json!({
                "type": "listItem",
                "content": [{
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": label }]
                }]
            })
        })
        .collect();

    let content = if list_items.is_empty() {
        json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{ "type": "text", "text": "Henüz listelenecek bölüm yok." }]
            }]
        })
    } else {
        json!({
            "type": "doc",
            "content": [{
                "type": "orderedList",
                "content": list_items
            }]
        })
    };

    let heading = json!({
        "level": 1,
        "content": {
            "type": "doc",
            "content": [{
                "type": "heading",
                "attrs": { "level": 1, "textAlign": "center" },
                "content": [{ "type": "text", "text": "İçindekiler" }]
            }]
        }
    });

    conn.execute(
        "DELETE FROM content_block WHERE chapter_id = ?1",
        [toc_chapter_id],
    )?;
    let ts = now();
    conn.execute(
        "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
         VALUES (?1, ?2, 'heading', 0, ?3, ?4, ?5, ?6)",
        params![
            new_id(),
            toc_chapter_id,
            heading.to_string(),
            json!({ "align": "center" }).to_string(),
            ts,
            ts
        ],
    )?;
    conn.execute(
        "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
         VALUES (?1, ?2, 'orderedList', 1, ?3, '{}', ?4, ?5)",
        params![
            new_id(),
            toc_chapter_id,
            json!({ "content": content }).to_string(),
            ts,
            ts
        ],
    )?;
    Ok(())
}
