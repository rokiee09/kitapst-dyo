use crate::database::{self, new_id, now};
use crate::error::AppError;
use crate::models::{
    Book, BookStats, BookVersion, Chapter, ContentBlock, CreateBlockPayload, CreateChapterPayload,
    CreateVersionPayload, ReorderBlocksPayload, ReorderChaptersPayload, UpdateBlockPayload,
    UpdateBookPayload, WorkspaceSnapshot,
};
use crate::state::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use std::collections::HashSet;

#[tauri::command]
pub fn get_workspace(state: tauri::State<AppState>) -> Result<WorkspaceSnapshot, AppError> {
    workspace_snapshot(&state)
}

pub fn workspace_snapshot(state: &AppState) -> Result<WorkspaceSnapshot, AppError> {
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let book = database::get_book(&conn)?;
    let chapters = database::list_chapters(&conn, &book.id)?;
    let settings = database::get_settings(&conn, &project.id)?;
    let versions = database::list_versions(&conn, &book.id)?;
    let selected_chapter_id = settings
        .last_opened_chapter_id
        .clone()
        .or_else(|| chapters.first().map(|chapter| chapter.id.clone()));
    let selected_blocks = match &selected_chapter_id {
        Some(id) => database::list_blocks(&conn, id)?,
        None => Vec::new(),
    };
    let stats = database::get_stats(&conn, &book.id)?;
    Ok(WorkspaceSnapshot {
        project,
        book,
        chapters,
        settings,
        versions,
        selected_chapter_id,
        selected_blocks,
        stats,
        is_demo: cfg!(debug_assertions),
    })
}

#[tauri::command]
pub fn update_book(
    state: tauri::State<AppState>,
    payload: UpdateBookPayload,
) -> Result<Book, AppError> {
    let conn = state.db()?;
    let book = database::get_book(&conn)?;
    let ts = now();
    conn.execute(
        "UPDATE book SET title = ?1, subtitle = ?2, author = ?3, description = ?4, language = ?5, isbn = ?6, publisher = ?7, cover_asset_id = ?8, page_color = ?9, ink_color = ?10, font_family = ?11, page_numbers = ?12, page_number_align = ?13, page_number_start = ?14, updated_at = ?15 WHERE id = ?16",
        params![
            payload.title.trim(),
            empty_to_none(payload.subtitle),
            empty_to_none(payload.author),
            empty_to_none(payload.description),
            payload.language.trim(),
            empty_to_none(payload.isbn),
            empty_to_none(payload.publisher),
            empty_to_none(payload.cover_asset_id),
            payload
                .page_color
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(&book.page_color),
            payload
                .ink_color
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(&book.ink_color),
            payload
                .font_family
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(&book.font_family),
            if payload.page_numbers.unwrap_or(book.page_numbers) {
                1
            } else {
                0
            },
            payload
                .page_number_align
                .as_deref()
                .map(str::trim)
                .filter(|value| matches!(*value, "left" | "center" | "right"))
                .unwrap_or(&book.page_number_align),
            payload.page_number_start.unwrap_or(book.page_number_start).clamp(0, 9999),
            ts,
            book.id
        ],
    )?;
    database::get_book(&conn)
}

#[tauri::command]
pub fn create_chapter(
    state: tauri::State<AppState>,
    payload: CreateChapterPayload,
) -> Result<Chapter, AppError> {
    let conn = state.db()?;
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(AppError::user(
            "Bölüm başlığı boş olamaz.",
            "empty chapter title",
        ));
    }
    if payload.parent_id.is_some() {
        let parent = database::get_chapter(&conn, payload.parent_id.as_deref().unwrap_or_default())?;
        if parent.book_id != payload.book_id {
            return Err(AppError::user(
                "Üst bölüm bu kitaba ait değil.",
                "parent book mismatch",
            ));
        }
    }
    let order = database::next_sibling_order(&conn, &payload.book_id, payload.parent_id.as_deref())?;
    let number = database::compute_chapter_number(
        &conn,
        &payload.book_id,
        payload.parent_id.as_deref(),
        order,
    )?;
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, payload.book_id, payload.parent_id, title, number, order, ts, ts],
    )?;
    let block_id = new_id();
    conn.execute(
        "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
         VALUES (?1, ?2, 'paragraph', 0, ?3, '{}', ?4, ?5)",
        params![block_id, id, default_paragraph_json(), ts, ts],
    )?;
    database::get_chapter(&conn, &id)
}

#[tauri::command]
pub fn rename_chapter(
    state: tauri::State<AppState>,
    id: String,
    title: String,
) -> Result<Chapter, AppError> {
    let conn = state.db()?;
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(AppError::user(
            "Bölüm başlığı boş olamaz.",
            "empty chapter title",
        ));
    }
    conn.execute(
        "UPDATE chapter SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![trimmed, now(), id],
    )?;
    database::get_chapter(&conn, &id)
}

#[tauri::command]
pub fn delete_chapter(state: tauri::State<AppState>, id: String) -> Result<(), AppError> {
    let conn = state.db()?;
    let chapter = database::get_chapter(&conn, &id)?;
    let remaining: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chapter WHERE book_id = ?1",
        [&chapter.book_id],
        |row| row.get(0),
    )?;
    if remaining <= 1 {
        return Err(AppError::user(
            "Kitapta en az bir bölüm bulunmalıdır.",
            "refusing to delete last chapter",
        ));
    }
    conn.execute("DELETE FROM chapter WHERE id = ?1", [&id])?;
    Ok(())
}

#[tauri::command]
pub fn duplicate_chapter(state: tauri::State<AppState>, id: String) -> Result<Chapter, AppError> {
    let conn = state.db()?;
    let source = database::get_chapter(&conn, &id)?;
    let new_chapter_id = new_id();
    let ts = now();
    let order = database::next_sibling_order(&conn, &source.book_id, source.parent_id.as_deref())?;
    let title = format!("{} (kopya)", source.title);
    let number = database::compute_chapter_number(
        &conn,
        &source.book_id,
        source.parent_id.as_deref(),
        order,
    )?;
    conn.execute(
        "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            new_chapter_id,
            source.book_id,
            source.parent_id,
            title,
            number,
            order,
            ts,
            ts
        ],
    )?;
    let blocks = database::list_blocks(&conn, &source.id)?;
    for block in blocks {
        let block_id = new_id();
        conn.execute(
            "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                block_id,
                new_chapter_id,
                block.block_type,
                block.order,
                block.data.to_string(),
                block.style.to_string(),
                ts,
                ts
            ],
        )?;
    }
    database::get_chapter(&conn, &new_chapter_id)
}

#[tauri::command]
pub fn move_chapter(
    state: tauri::State<AppState>,
    id: String,
    direction: String,
) -> Result<Vec<Chapter>, AppError> {
    let conn = state.db()?;
    let chapter = database::get_chapter(&conn, &id)?;
    let siblings = sibling_orders(&conn, &chapter.book_id, chapter.parent_id.as_deref())?;
    let index = siblings
        .iter()
        .position(|(sibling_id, _)| sibling_id == &id)
        .ok_or_else(|| AppError::user("Bölüm listesi okunamadı.", "sibling missing"))?;
    let swap_with = match direction.as_str() {
        "up" if index > 0 => Some(index - 1),
        "down" if index + 1 < siblings.len() => Some(index + 1),
        "up" | "down" => None,
        other => {
            return Err(AppError::user(
                "Geçersiz taşıma yönü.",
                format!("direction={other}"),
            ))
        }
    };
    if let Some(target) = swap_with {
        let (other_id, other_order) = &siblings[target];
        let current_order = chapter.order;
        conn.execute(
            "UPDATE chapter SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![other_order, now(), chapter.id],
        )?;
        conn.execute(
            "UPDATE chapter SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![current_order, now(), other_id],
        )?;
    }
    database::list_chapters(&conn, &chapter.book_id)
}

#[tauri::command]
pub fn reorder_chapters(
    state: tauri::State<AppState>,
    payload: ReorderChaptersPayload,
) -> Result<Vec<Chapter>, AppError> {
    let conn = state.db()?;
    let book = database::get_book(&conn)?;
    let siblings = sibling_orders(&conn, &book.id, payload.parent_id.as_deref())?;
    let existing_ids: HashSet<String> = siblings.iter().map(|(id, _)| id.clone()).collect();
    if existing_ids.len() != payload.ordered_ids.len()
        || payload
            .ordered_ids
            .iter()
            .any(|id| !existing_ids.contains(id))
    {
        return Err(AppError::user(
            "Bölüm sırası geçersiz.",
            "reorder chapter mismatch",
        ));
    }
    let ts = now();
    for (index, id) in payload.ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE chapter SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![index as i64, ts, id],
        )?;
    }
    database::list_chapters(&conn, &book.id)
}

#[tauri::command]
pub fn set_active_chapter(
    state: tauri::State<AppState>,
    chapter_id: String,
) -> Result<Vec<ContentBlock>, AppError> {
    let conn = state.db()?;
    let chapter = database::get_chapter(&conn, &chapter_id)?;
    let project = database::get_project(&conn)?;
    database::set_last_opened_chapter(&conn, &project.id, &chapter.id)?;
    database::list_blocks(&conn, &chapter.id)
}

#[tauri::command]
pub fn list_blocks(
    state: tauri::State<AppState>,
    chapter_id: String,
) -> Result<Vec<ContentBlock>, AppError> {
    let conn = state.db()?;
    database::list_blocks(&conn, &chapter_id)
}

#[tauri::command]
pub fn create_block(
    state: tauri::State<AppState>,
    payload: CreateBlockPayload,
) -> Result<ContentBlock, AppError> {
    if !database::allowed_block_type(&payload.block_type) {
        return Err(AppError::user(
            "Desteklenmeyen blok türü.",
            format!("type={}", payload.block_type),
        ));
    }
    let conn = state.db()?;
    let _chapter = database::get_chapter(&conn, &payload.chapter_id)?;
    let ts = now();
    let id = new_id();
    let order = if let Some(after_id) = payload.after_block_id.as_deref() {
        let after = database::get_block(&conn, after_id)?;
        conn.execute(
            "UPDATE content_block SET sort_order = sort_order + 1, updated_at = ?1
             WHERE chapter_id = ?2 AND sort_order > ?3",
            params![ts, payload.chapter_id, after.order],
        )?;
        after.order + 1
    } else {
        database::next_block_order(&conn, &payload.chapter_id)?
    };
    let data = payload
        .data
        .unwrap_or_else(|| default_block_data(&payload.block_type));
    conn.execute(
        "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6, ?7)",
        params![id, payload.chapter_id, payload.block_type, order, data.to_string(), ts, ts],
    )?;
    database::get_block(&conn, &id)
}

#[tauri::command]
pub fn update_block(
    state: tauri::State<AppState>,
    payload: UpdateBlockPayload,
) -> Result<ContentBlock, AppError> {
    let conn = state.db()?;
    let existing = database::get_block(&conn, &payload.id)?;
    if let Some(block_type) = payload.block_type.as_deref() {
        if !database::allowed_block_type(block_type) {
            return Err(AppError::user(
                "Desteklenmeyen blok türü.",
                format!("type={block_type}"),
            ));
        }
        conn.execute(
            "UPDATE content_block SET data = ?1, style = ?2, type = ?3, updated_at = ?4 WHERE id = ?5",
            params![
                payload.data.to_string(),
                payload.style.to_string(),
                block_type,
                now(),
                existing.id
            ],
        )?;
    } else {
        conn.execute(
            "UPDATE content_block SET data = ?1, style = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                payload.data.to_string(),
                payload.style.to_string(),
                now(),
                existing.id
            ],
        )?;
    }
    database::get_block(&conn, &payload.id)
}

#[tauri::command]
pub fn delete_block(state: tauri::State<AppState>, id: String) -> Result<(), AppError> {
    let conn = state.db()?;
    let block = database::get_block(&conn, &id)?;
    let remaining: i64 = conn.query_row(
        "SELECT COUNT(*) FROM content_block WHERE chapter_id = ?1",
        [&block.chapter_id],
        |row| row.get(0),
    )?;
    if remaining <= 1 {
        return Err(AppError::user(
            "Bölümde en az bir blok bulunmalıdır.",
            "refusing to delete last block",
        ));
    }
    conn.execute("DELETE FROM content_block WHERE id = ?1", [&id])?;
    Ok(())
}

#[tauri::command]
pub fn duplicate_block(state: tauri::State<AppState>, id: String) -> Result<ContentBlock, AppError> {
    let conn = state.db()?;
    let source = database::get_block(&conn, &id)?;
    let ts = now();
    conn.execute(
        "UPDATE content_block SET sort_order = sort_order + 1, updated_at = ?1
         WHERE chapter_id = ?2 AND sort_order > ?3",
        params![ts, source.chapter_id, source.order],
    )?;
    let new_id_value = new_id();
    conn.execute(
        "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            new_id_value,
            source.chapter_id,
            source.block_type,
            source.order + 1,
            source.data.to_string(),
            source.style.to_string(),
            ts,
            ts
        ],
    )?;
    database::get_block(&conn, &new_id_value)
}

#[tauri::command]
pub fn reorder_blocks(
    state: tauri::State<AppState>,
    payload: ReorderBlocksPayload,
) -> Result<Vec<ContentBlock>, AppError> {
    let conn = state.db()?;
    let existing = database::list_blocks(&conn, &payload.chapter_id)?;
    let existing_ids: HashSet<String> = existing.iter().map(|block| block.id.clone()).collect();
    if existing_ids.len() != payload.ordered_ids.len()
        || payload
            .ordered_ids
            .iter()
            .any(|id| !existing_ids.contains(id))
    {
        return Err(AppError::user(
            "Blok sırası geçersiz.",
            "reorder id mismatch",
        ));
    }
    let ts = now();
    for (index, id) in payload.ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE content_block SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![index as i64, ts, id],
        )?;
    }
    database::list_blocks(&conn, &payload.chapter_id)
}

#[tauri::command]
pub fn get_stats(state: tauri::State<AppState>, book_id: String) -> Result<BookStats, AppError> {
    let conn = state.db()?;
    database::get_stats(&conn, &book_id)
}

#[tauri::command]
pub fn create_book_version(
    state: tauri::State<AppState>,
    payload: CreateVersionPayload,
) -> Result<BookVersion, AppError> {
    let version = payload.version.trim();
    if version.is_empty() {
        return Err(AppError::user("Sürüm numarası boş olamaz.", "empty version"));
    }
    let conn = state.db()?;
    let id = new_id();
    let ts = now();
    let snapshot = crate::extras::collect_book_snapshot(&conn, &payload.book_id)?;
    conn.execute(
        "INSERT INTO book_version (id, book_id, version, changelog, created_at, snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, payload.book_id, version, empty_to_none(payload.changelog), ts, snapshot.to_string()],
    )?;
    conn.query_row(
        "SELECT id, book_id, version, changelog, created_at,
                CASE WHEN snapshot IS NOT NULL AND length(snapshot) > 2 THEN 1 ELSE 0 END
         FROM book_version WHERE id = ?1",
        [&id],
        |row| {
            let flag: i64 = row.get(5)?;
            Ok(BookVersion {
                id: row.get(0)?,
                book_id: row.get(1)?,
                version: row.get(2)?,
                changelog: row.get(3)?,
                created_at: row.get(4)?,
                has_snapshot: flag == 1,
            })
        },
    )
    .map_err(AppError::from)
}

#[tauri::command]
pub fn list_book_versions(
    state: tauri::State<AppState>,
    book_id: String,
) -> Result<Vec<BookVersion>, AppError> {
    let conn = state.db()?;
    database::list_versions(&conn, &book_id)
}

fn empty_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn default_paragraph_json() -> String {
    json!({ "content": { "type": "doc", "content": [{ "type": "paragraph" }] } }).to_string()
}

pub fn default_block_data(block_type: &str) -> serde_json::Value {
    match block_type {
        "heading" => json!({
            "level": 2,
            "content": {
                "type": "doc",
                "content": [{ "type": "heading", "attrs": { "level": 2 } }]
            }
        }),
        "infoBox" => json!({
            "icon": "info",
            "title": "ÖNEMLİ",
            "content": { "type": "doc", "content": [{ "type": "paragraph" }] },
            "variant": "info",
            "padding": "md"
        }),
        "warningBox" => json!({
            "icon": "warning",
            "title": "UYARI",
            "content": { "type": "doc", "content": [{ "type": "paragraph" }] },
            "variant": "warning",
            "padding": "md"
        }),
        "quote" => json!({
            "content": {
                "type": "doc",
                "content": [{ "type": "blockquote", "content": [{ "type": "paragraph" }] }]
            },
            "attribution": ""
        }),
        "orderedList" => json!({
            "content": {
                "type": "doc",
                "content": [{
                    "type": "orderedList",
                    "content": [
                        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Birinci madde" }] }] },
                        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "İkinci madde" }] }] }
                    ]
                }]
            }
        }),
        "unorderedList" => json!({
            "content": {
                "type": "doc",
                "content": [{
                    "type": "bulletList",
                    "content": [
                        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Birinci madde" }] }] },
                        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "İkinci madde" }] }] }
                    ]
                }]
            }
        }),
        "divider" => json!({ "style": "solid" }),
        "pageBreak" => json!({}),
        "image" => json!({
            "assetId": null,
            "relativePath": null,
            "alt": "",
            "caption": "",
            "captionCustom": false,
            "captionVisible": true,
            "description": "",
            "width": 100,
            "align": "center",
            "borderRadius": 8,
            "showInEpub": true,
            "showInPdf": true,
            "showInHtml": true
        }),
        "video" => json!({
            "sourceType": "external",
            "assetId": null,
            "relativePath": null,
            "title": "",
            "caption": "",
            "captionCustom": false,
            "captionVisible": true,
            "description": "",
            "url": "",
            "thumbnailAssetId": null,
            "thumbnailPath": null,
            "duration": "",
            "generateQr": false,
            "showInEpub": true,
            "showInPdf": true,
            "showInHtml": true,
            "previewAsPdf": false
        }),
        "qr" => json!({
            "target": "video",
            "mode": "url",
            "value": "",
            "chapterId": null,
            "title": "",
            "caption": "",
            "captionCustom": false,
            "captionVisible": true,
            "description": "",
            "size": 160,
            "errorCorrection": "M",
            "margin": 4
        }),
        "file" => json!({
            "assetId": null,
            "relativePath": null,
            "filename": ""
        }),
        "table" => json!({
            "rows": [["", "", ""], ["", "", ""], ["", "", ""]]
        }),
        "code" => json!({
            "language": "text",
            "code": ""
        }),
        _ => json!({ "content": { "type": "doc", "content": [{ "type": "paragraph" }] } }),
    }
}

fn sibling_orders(
    conn: &Connection,
    book_id: &str,
    parent_id: Option<&str>,
) -> Result<Vec<(String, i64)>, AppError> {
    let mut siblings = Vec::new();
    if let Some(parent) = parent_id {
        let mut stmt = conn.prepare(
            "SELECT id, sort_order FROM chapter WHERE book_id = ?1 AND parent_id = ?2 ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map(params![book_id, parent], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            siblings.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, sort_order FROM chapter WHERE book_id = ?1 AND parent_id IS NULL ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map(params![book_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            siblings.push(row?);
        }
    }
    Ok(siblings)
}
