use crate::database::{self, new_id, now};
use crate::error::AppError;
use crate::models::{
    ApplyTemplatePayload, ChapterTemplate, Note, SaveStylePresetPayload, SaveTemplatePayload,
    StylePreset, UpsertNotePayload,
};
use crate::state::AppState;
use rusqlite::params;
use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn open_folder(state: tauri::State<AppState>, app: AppHandle, which: String) -> Result<String, AppError> {
    let root = state.project_root()?;
    let path = match which.as_str() {
        "project" => root,
        "exports" => root.join("exports"),
        "html" => root.join("exports").join("html"),
        "epub" => root.join("exports").join("epub"),
        "pdf" => root.join("exports").join("pdf"),
        "mobile" => root.join("exports").join("mobile"),
        "backups" => root.join("backups"),
        other => {
            return Err(AppError::user(
                "Bilinmeyen klasör.",
                format!("which={other}"),
            ))
        }
    };
    std::fs::create_dir_all(&path)?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| AppError::user("Klasör açılamadı.", err.to_string()))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_notes(state: tauri::State<AppState>) -> Result<Vec<Note>, AppError> {
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, chapter_id, title, body, created_at, updated_at
         FROM note WHERE project_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([&project.id], |row| {
        Ok(Note {
            id: row.get(0)?,
            project_id: row.get(1)?,
            chapter_id: row.get(2)?,
            title: row.get(3)?,
            body: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    let mut notes = Vec::new();
    for row in rows {
        notes.push(row?);
    }
    Ok(notes)
}

#[tauri::command]
pub fn upsert_note(state: tauri::State<AppState>, payload: UpsertNotePayload) -> Result<Note, AppError> {
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(AppError::user("Not başlığı boş olamaz.", "empty note title"));
    }
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let ts = now();
    let id = payload.id.clone().filter(|value| !value.trim().is_empty()).unwrap_or_else(new_id);
    conn.execute(
        "INSERT INTO note (id, project_id, chapter_id, title, body, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET chapter_id = excluded.chapter_id, title = excluded.title,
           body = excluded.body, updated_at = excluded.updated_at",
        params![
            id,
            project.id,
            payload.chapter_id,
            title,
            payload.body,
            ts,
            ts
        ],
    )?;
    conn.query_row(
        "SELECT id, project_id, chapter_id, title, body, created_at, updated_at FROM note WHERE id = ?1",
        [&id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                project_id: row.get(1)?,
                chapter_id: row.get(2)?,
                title: row.get(3)?,
                body: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(AppError::from)
}

#[tauri::command]
pub fn delete_note(state: tauri::State<AppState>, id: String) -> Result<(), AppError> {
    let conn = state.db()?;
    conn.execute("DELETE FROM note WHERE id = ?1", [&id])?;
    Ok(())
}

#[tauri::command]
pub fn list_templates(state: tauri::State<AppState>) -> Result<Vec<ChapterTemplate>, AppError> {
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let mut items = builtin_templates();
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, payload, created_at
         FROM chapter_template WHERE project_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([&project.id], |row| {
        let payload: String = row.get(4)?;
        Ok(ChapterTemplate {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            payload: serde_json::from_str(&payload).unwrap_or(json!([])),
            created_at: row.get(5)?,
            builtin: false,
        })
    })?;
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

#[tauri::command]
pub fn save_template(
    state: tauri::State<AppState>,
    payload: SaveTemplatePayload,
) -> Result<ChapterTemplate, AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::user("Şablon adı boş olamaz.", "empty template name"));
    }
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO chapter_template (id, project_id, name, description, payload, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            project.id,
            name,
            payload.description,
            payload.payload.to_string(),
            ts
        ],
    )?;
    Ok(ChapterTemplate {
        id,
        project_id: project.id,
        name: name.to_string(),
        description: payload.description,
        payload: payload.payload,
        created_at: ts,
        builtin: false,
    })
}

#[tauri::command]
pub fn apply_template(
    state: tauri::State<AppState>,
    payload: ApplyTemplatePayload,
) -> Result<Vec<crate::models::ContentBlock>, AppError> {
    let conn = state.db()?;
    let _chapter = database::get_chapter(&conn, &payload.chapter_id)?;
    let blocks_spec = if payload.template_id.starts_with("builtin-") {
        builtin_templates()
            .into_iter()
            .find(|item| item.id == payload.template_id)
            .map(|item| item.payload)
            .ok_or_else(|| AppError::user("Şablon bulunamadı.", payload.template_id.clone()))?
    } else {
        let raw: String = conn.query_row(
            "SELECT payload FROM chapter_template WHERE id = ?1",
            [&payload.template_id],
            |row| row.get(0),
        )?;
        serde_json::from_str(&raw)?
    };
    let specs = blocks_spec.as_array().cloned().unwrap_or_default();
    insert_specs(&conn, &payload.chapter_id, &specs)?;
    database::list_blocks(&conn, &payload.chapter_id)
}

pub fn insert_template_blocks(
    conn: &rusqlite::Connection,
    chapter_id: &str,
    template_id: &str,
) -> Result<(), AppError> {
    let blocks_spec = builtin_templates()
        .into_iter()
        .find(|item| item.id == template_id)
        .map(|item| item.payload)
        .ok_or_else(|| AppError::user("Şablon bulunamadı.", template_id.to_string()))?;
    let specs = blocks_spec.as_array().cloned().unwrap_or_default();
    insert_specs(conn, chapter_id, &specs)
}

fn insert_specs(
    conn: &rusqlite::Connection,
    chapter_id: &str,
    specs: &[serde_json::Value],
) -> Result<(), AppError> {
    for spec in specs {
        let block_type = spec
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or("paragraph");
        if !database::allowed_block_type(block_type) {
            continue;
        }
        let data = spec.get("data").cloned().unwrap_or_else(|| crate::commands::default_block_data(block_type));
        let style = spec.get("style").cloned().unwrap_or_else(|| serde_json::json!({}));
        let ts = now();
        let order = database::next_block_order(conn, chapter_id)?;
        conn.execute(
            "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![new_id(), chapter_id, block_type, order, data.to_string(), style.to_string(), ts, ts],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_template(state: tauri::State<AppState>, id: String) -> Result<(), AppError> {
    if id.starts_with("builtin-") {
        return Err(AppError::user(
            "Hazır şablon silinemez.",
            id,
        ));
    }
    let conn = state.db()?;
    let changed = conn.execute("DELETE FROM chapter_template WHERE id = ?1", [&id])?;
    if changed == 0 {
        return Err(AppError::user("Şablon bulunamadı.", id));
    }
    Ok(())
}

#[tauri::command]
pub fn list_style_presets(
    state: tauri::State<AppState>,
    block_type: Option<String>,
) -> Result<Vec<StylePreset>, AppError> {
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let mut items = Vec::new();
    if let Some(kind) = block_type.filter(|value| !value.trim().is_empty()) {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, block_type, style, created_at
             FROM style_preset WHERE project_id = ?1 AND block_type = ?2 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![project.id, kind], map_style_preset)?;
        for row in rows {
            items.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, block_type, style, created_at
             FROM style_preset WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([&project.id], map_style_preset)?;
        for row in rows {
            items.push(row?);
        }
    }
    Ok(items)
}

#[tauri::command]
pub fn save_style_preset(
    state: tauri::State<AppState>,
    payload: SaveStylePresetPayload,
) -> Result<StylePreset, AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::user("Stil şablonu adı boş olamaz.", "empty style name"));
    }
    let block_type = payload.block_type.trim();
    if block_type.is_empty() {
        return Err(AppError::user("Blok türü gerekli.", "empty block type"));
    }
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO style_preset (id, project_id, name, block_type, style, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            project.id,
            name,
            block_type,
            payload.style.to_string(),
            ts
        ],
    )?;
    Ok(StylePreset {
        id,
        project_id: project.id,
        name: name.to_string(),
        block_type: block_type.to_string(),
        style: payload.style,
        created_at: ts,
    })
}

#[tauri::command]
pub fn delete_style_preset(state: tauri::State<AppState>, id: String) -> Result<(), AppError> {
    let conn = state.db()?;
    let changed = conn.execute("DELETE FROM style_preset WHERE id = ?1", [&id])?;
    if changed == 0 {
        return Err(AppError::user("Stil şablonu bulunamadı.", id));
    }
    Ok(())
}

fn map_style_preset(row: &rusqlite::Row<'_>) -> rusqlite::Result<StylePreset> {
    let style: String = row.get(4)?;
    Ok(StylePreset {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        block_type: row.get(3)?,
        style: serde_json::from_str(&style).unwrap_or(json!({})),
        created_at: row.get(5)?,
    })
}

#[tauri::command]
pub fn restore_book_version(state: tauri::State<AppState>, version_id: String) -> Result<(), AppError> {
    let conn = state.db()?;
    let (book_id, snapshot): (String, Option<String>) = conn.query_row(
        "SELECT book_id, snapshot FROM book_version WHERE id = ?1",
        [&version_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let Some(raw) = snapshot.filter(|value| value.len() > 2) else {
        return Err(AppError::user(
            "Bu sürümde içerik kopyası yok. Yeni bir sürüm oluşturup tekrar deneyin.",
            "missing snapshot",
        ));
    };
    let value: serde_json::Value = serde_json::from_str(&raw)?;
    let chapters = value
        .get("chapters")
        .cloned()
        .unwrap_or(json!([]));
    let blocks = value.get("blocks").cloned().unwrap_or(json!([]));
    let ts = now();
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM content_block WHERE chapter_id IN (SELECT id FROM chapter WHERE book_id = ?1)",
        [&book_id],
    )?;
    tx.execute("DELETE FROM chapter WHERE book_id = ?1", [&book_id])?;
    if let Some(items) = chapters.as_array() {
        for chapter in items {
            tx.execute(
                "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    chapter.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
                    chapter.get("bookId").and_then(|v| v.as_str()).unwrap_or(&book_id),
                    chapter.get("parentId").and_then(|v| v.as_str()),
                    chapter.get("title").and_then(|v| v.as_str()).unwrap_or("Bölüm"),
                    chapter.get("number").and_then(|v| v.as_str()),
                    chapter.get("order").and_then(|v| v.as_i64()).unwrap_or(0),
                    chapter.get("createdAt").and_then(|v| v.as_str()).filter(|v| !v.is_empty()).unwrap_or(&ts),
                    chapter.get("updatedAt").and_then(|v| v.as_str()).filter(|v| !v.is_empty()).unwrap_or(&ts),
                ],
            )?;
        }
    }
    if let Some(items) = blocks.as_array() {
        for block in items {
            tx.execute(
                "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    block.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
                    block.get("chapterId").and_then(|v| v.as_str()).unwrap_or_default(),
                    block.get("type").and_then(|v| v.as_str()).unwrap_or("paragraph"),
                    block.get("order").and_then(|v| v.as_i64()).unwrap_or(0),
                    block.get("data").cloned().unwrap_or(json!({})).to_string(),
                    block.get("style").cloned().unwrap_or(json!({})).to_string(),
                    block.get("createdAt").and_then(|v| v.as_str()).filter(|v| !v.is_empty()).unwrap_or(&ts),
                    block.get("updatedAt").and_then(|v| v.as_str()).filter(|v| !v.is_empty()).unwrap_or(&ts),
                ],
            )?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn collect_book_snapshot(conn: &rusqlite::Connection, book_id: &str) -> Result<serde_json::Value, AppError> {
    let chapters = database::list_chapters(conn, book_id)?;
    let mut blocks = Vec::new();
    for chapter in &chapters {
        blocks.extend(database::list_blocks(conn, &chapter.id)?);
    }
    Ok(json!({ "chapters": chapters, "blocks": blocks }))
}

fn builtin_templates() -> Vec<ChapterTemplate> {
    vec![
        layout(
            "builtin-kapak",
            "Kapak",
            "Kapak sayfası: görsel, kitap adı ve yazar. Bölümler panelinden ekleyin.",
            json!([
                image_block(100, "center", "Kapak görseli"),
                heading_aligned(1, "Kitap veya bölüm başlığı", "center"),
                paragraph_aligned("center", "Alt başlık veya kısa tanıtım"),
                paragraph_aligned("center", "Yazar adı")
            ]),
        ),
        layout(
            "builtin-onsoz",
            "Önsöz",
            "Önsöz sayfası. Bölümler panelinden sayfa olarak ekleyin.",
            json!([
                heading_aligned(1, "Önsöz", "center"),
                paragraph_aligned("justify", "Önsöz metnini buraya yazın."),
                paragraph_aligned("right", "Tarih / yer")
            ]),
        ),
        layout(
            "builtin-icindekiler",
            "İçindekiler",
            "İçindekiler sayfası. Bölümler panelinden ekleyin, maddeleri düzenleyin.",
            json!([
                heading_aligned(1, "İçindekiler", "center"),
                { "type": "orderedList" }
            ]),
        ),
        layout(
            "builtin-giris",
            "Giriş",
            "Giriş sayfası: özet kutu ve ilk paragraf. Bölümler panelinden ekleyin.",
            json!([
                heading_aligned(1, "Giriş", "left"),
                { "type": "infoBox" },
                paragraph_aligned("justify", "Giriş metnini buraya yazın.")
            ]),
        ),
        layout(
            "builtin-gorsel-ust",
            "Görsel üstte",
            "Üstte geniş görsel, altında metin",
            json!([
                image_block(100, "center", "Üst görsel"),
                heading_block(2, "Konu başlığı"),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-gorsel-orta",
            "Görsel ortada",
            "Metin, ortalanmış görsel, devam metni",
            json!([
                heading_block(2, "Konu başlığı"),
                { "type": "paragraph" },
                image_block(70, "center", "Orta görsel"),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-gorsel-sol",
            "Dar görsel solda",
            "Sayfanın soluna hizalı görsel, ardından açıklama",
            json!([
                heading_block(2, "Konu başlığı"),
                image_block(48, "left", "Sol hizalı görsel"),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-gorsel-sag",
            "Dar görsel sağda",
            "Sayfanın sağına hizalı görsel, ardından açıklama",
            json!([
                heading_block(2, "Konu başlığı"),
                image_block(48, "right", "Sağ hizalı görsel"),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-cift-gorsel",
            "İki görsel",
            "Karşılıklı iki görsel ve kısa metin",
            json!([
                heading_block(2, "Karşılaştırma"),
                image_block(100, "center", "Birinci görsel"),
                image_block(100, "center", "İkinci görsel"),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-ders",
            "Eğitim ünitesi",
            "Başlık, metin, bilgi kutusu ve adım listesi",
            json!([
                heading_block(2, "Ünite başlığı"),
                { "type": "paragraph" },
                { "type": "infoBox" },
                { "type": "orderedList" }
            ]),
        ),
        layout(
            "builtin-adimlar-gorsel",
            "Adımlar + görsel",
            "Görsel destekli adım adım anlatım",
            json!([
                heading_block(2, "Uygulama adımları"),
                image_block(100, "center", "Adımları gösteren görsel"),
                { "type": "orderedList" }
            ]),
        ),
        layout(
            "builtin-medya",
            "Medya sayfası",
            "Görsel, video ve QR bloğu",
            json!([
                heading_block(2, "İzle ve uygula"),
                { "type": "image" },
                { "type": "video" },
                { "type": "qr" }
            ]),
        ),
        layout(
            "builtin-alinti-gorsel",
            "Alıntı + görsel",
            "Alıntı, görsel ve açıklama",
            json!([
                { "type": "quote" },
                image_block(80, "center", "Destekleyici görsel"),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-metin-sol",
            "Metin sola yaslı",
            "Başlık ve gövde soldan hizalı",
            json!([
                heading_aligned(2, "Sol hizalı başlık", "left"),
                paragraph_aligned("left", "Paragraf sola yaslanır.")
            ]),
        ),
        layout(
            "builtin-metin-orta",
            "Metin ortalı",
            "Başlık ve gövde sayfa ortasında",
            json!([
                heading_aligned(2, "Ortalanmış başlık", "center"),
                paragraph_aligned("center", "Paragraf ortalanır.")
            ]),
        ),
        layout(
            "builtin-metin-sag",
            "Metin sağa yaslı",
            "Başlık ve gövde sağdan hizalı",
            json!([
                heading_aligned(2, "Sağ hizalı başlık", "right"),
                paragraph_aligned("right", "Paragraf sağa yaslanır.")
            ]),
        ),
        layout(
            "builtin-metin-iki-yana",
            "Metin iki yana yaslı",
            "Kitap sayfası gibi iki yana hizalı gövde",
            json!([
                heading_aligned(2, "İki yana yaslı metin", "left"),
                paragraph_aligned("justify", "Paragraf satır boyunca iki yana yaslanır.")
            ]),
        ),
        layout(
            "builtin-video-dose",
            "Video döşeme",
            "Videoyu sayfaya döşeyip sola veya sağa hizalayın",
            json!([
                heading_block(2, "Video"),
                video_tile_block("left", 48),
                { "type": "paragraph" }
            ]),
        ),
        layout(
            "builtin-uyari",
            "Uyarı sayfası",
            "Uyarı kutusu, görsel ve madde listesi",
            json!([
                { "type": "warningBox" },
                image_block(70, "center", "Uyarı görseli"),
                { "type": "paragraph" },
                { "type": "unorderedList" }
            ]),
        ),
    ]
}

fn layout(id: &str, name: &str, description: &str, payload: serde_json::Value) -> ChapterTemplate {
    ChapterTemplate {
        id: id.into(),
        project_id: "builtin".into(),
        name: name.into(),
        description: Some(description.into()),
        payload,
        created_at: String::new(),
        builtin: true,
    }
}

fn heading_block(level: u64, text: &str) -> serde_json::Value {
    heading_aligned(level, text, "left")
}

fn heading_aligned(level: u64, text: &str, align: &str) -> serde_json::Value {
    json!({
        "type": "heading",
        "style": { "align": align },
        "data": {
            "level": level,
            "content": {
                "type": "doc",
                "content": [{
                    "type": "heading",
                    "attrs": { "level": level, "textAlign": align },
                    "content": [{ "type": "text", "text": text }]
                }]
            }
        }
    })
}

fn paragraph_aligned(align: &str, text: &str) -> serde_json::Value {
    json!({
        "type": "paragraph",
        "style": { "align": align },
        "data": {
            "content": {
                "type": "doc",
                "content": [{
                    "type": "paragraph",
                    "attrs": { "textAlign": align },
                    "content": [{ "type": "text", "text": text }]
                }]
            }
        }
    })
}

fn video_tile_block(align: &str, width: i64) -> serde_json::Value {
    json!({
        "type": "video",
        "style": { "align": align },
        "data": {
            "sourceType": "local",
            "assetId": null,
            "relativePath": null,
            "title": "Video",
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
            "previewAsPdf": false,
            "tile": true,
            "width": width,
            "align": align,
            "fit": "cover"
        }
    })
}

fn image_block(width: i64, align: &str, caption: &str) -> serde_json::Value {
    json!({
        "type": "image",
        "data": {
            "assetId": null,
            "relativePath": null,
            "alt": caption,
            "caption": caption,
            "captionCustom": false,
            "captionVisible": true,
            "description": "",
            "width": width,
            "align": align,
            "borderRadius": 12,
            "showInEpub": true,
            "showInPdf": true,
            "showInHtml": true
        }
    })
}
