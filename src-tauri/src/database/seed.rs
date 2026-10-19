use crate::database::{new_id, now};
use crate::error::AppError;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::path::Path;

pub fn ensure_default_content(conn: &Connection, project_root: &Path) -> Result<(), AppError> {
    let book_count: i64 = conn.query_row("SELECT COUNT(*) FROM book", [], |row| row.get(0))?;
    if book_count > 0 {
        return Ok(());
    }

    if cfg!(debug_assertions) {
        seed_demo(conn, project_root)
    } else {
        seed_empty(conn, project_root)
    }
}

fn seed_empty(conn: &Connection, project_root: &Path) -> Result<(), AppError> {
    seed_named_book(conn, project_root, "Adsız Kitap")
}

pub fn seed_named_book(conn: &Connection, project_root: &Path, title: &str) -> Result<(), AppError> {
    let book_count: i64 = conn.query_row("SELECT COUNT(*) FROM book", [], |row| row.get(0))?;
    if book_count > 0 {
        return Ok(());
    }
    let ts = now();
    let project_id = new_id();
    let book_id = new_id();
    let settings_id = new_id();
    let version_id = new_id();
    let chapter_id = new_id();
    let book_title = if title.trim().is_empty() {
        "Adsız Kitap"
    } else {
        title.trim()
    };

    conn.execute(
        "INSERT INTO project (id, name, root_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![project_id, book_title, project_root.to_string_lossy().to_string(), ts, ts],
    )?;
    conn.execute(
        "INSERT INTO book (id, project_id, title, subtitle, author, description, language, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'tr', ?7, ?8)",
        params![
            book_id,
            project_id,
            book_title,
            "Yaz • Tasarla • Yayınla",
            "",
            "Bu kitap Kitap Stüdyosu ile oluşturuldu.",
            ts,
            ts
        ],
    )?;
    conn.execute(
        "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
         VALUES (?1, ?2, NULL, 'Giriş', '1', 0, ?3, ?4)",
        params![chapter_id, book_id, ts, ts],
    )?;
    insert_block(
        conn,
        &chapter_id,
        "paragraph",
        0,
        json!({ "content": rich_paragraph("Yazmaya buradan başlayın.") }),
    )?;
    conn.execute(
        "INSERT INTO project_settings (id, project_id, autosave_ms, last_opened_chapter_id, theme, created_at, updated_at)
         VALUES (?1, ?2, 800, ?3, 'system', ?4, ?5)",
        params![settings_id, project_id, chapter_id, ts, ts],
    )?;
    conn.execute(
        "INSERT INTO book_version (id, book_id, version, changelog, created_at)
         VALUES (?1, ?2, '1.0.0', 'İlk sürüm', ?3)",
        params![version_id, book_id, ts],
    )?;
    Ok(())
}

fn seed_demo(conn: &Connection, project_root: &Path) -> Result<(), AppError> {
    let ts = now();
    let project_id = new_id();
    let book_id = new_id();
    let settings_id = new_id();
    let version_id = new_id();

    conn.execute(
        "INSERT INTO project (id, name, root_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            project_id,
            "TAKTİK EĞİTİM",
            project_root.to_string_lossy().to_string(),
            ts,
            ts
        ],
    )?;
    conn.execute(
        "INSERT INTO book (id, project_id, title, subtitle, author, description, language, publisher, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'tr', ?7, ?8, ?9)",
        params![
            book_id,
            project_id,
            "TAKTİK EĞİTİM",
            "Hayatta Kalma Bakış Açısı",
            "Kitap Stüdyosu",
            "Geliştirme ortamı için örnek kitap içeriği. Production derlemesine bağlı değildir.",
            "Kitap Stüdyosu Yayınları",
            ts,
            ts
        ],
    )?;

    let preface = insert_chapter(conn, &book_id, None, "Önsöz", None, 0)?;
    insert_chapter(conn, &book_id, None, "Giriş", Some("1"), 1)?;
    insert_chapter(conn, &book_id, None, "Temel Kavramlar", Some("2"), 2)?;
    insert_chapter(conn, &book_id, None, "Risk ve Tehdit", Some("3"), 3)?;
    let survival = insert_chapter(conn, &book_id, None, "Hayatta Kalma Bakış Açısı", Some("4"), 4)?;
    insert_chapter(conn, &book_id, Some(&survival), "Genel Bakış", Some("4.1"), 0)?;
    let principles = insert_chapter(
        conn,
        &book_id,
        Some(&survival),
        "Uygulama Prensipleri",
        Some("4.2"),
        1,
    )?;
    insert_chapter(conn, &book_id, Some(&principles), "Durumu Değerlendirin", Some("4.2.1"), 0)?;
    insert_chapter(conn, &book_id, Some(&principles), "Öncelikleri Belirleyin", Some("4.2.2"), 1)?;
    insert_chapter(conn, &book_id, Some(&principles), "Kaynakları Yönetin", Some("4.2.3"), 2)?;
    insert_chapter(conn, &book_id, Some(&principles), "İletişimi Sürdürün", Some("4.2.4"), 3)?;
    insert_chapter(conn, &book_id, Some(&principles), "Enerjinizi Koruyun", Some("4.2.5"), 4)?;
    let breathing = insert_chapter(
        conn,
        &book_id,
        Some(&principles),
        "Doğru Bir Teknikle Nefes Alıp Verin",
        Some("4.2.6"),
        5,
    )?;
    insert_chapter(conn, &book_id, None, "Örnek Olaylar", Some("5"), 5)?;
    insert_chapter(conn, &book_id, None, "Sonuç", Some("6"), 6)?;
    let sources = insert_chapter(conn, &book_id, None, "Kaynakça", None, 7)?;

    seed_preface_blocks(conn, &preface)?;
    seed_breathing_blocks(conn, &breathing)?;
    insert_block(
        conn,
        &sources,
        "paragraph",
        0,
        json!({ "content": rich_paragraph("Kaynakça bu milestonda örnek olarak bırakılmıştır.") }),
    )?;

    conn.execute(
        "INSERT INTO project_settings (id, project_id, autosave_ms, last_opened_chapter_id, theme, created_at, updated_at)
         VALUES (?1, ?2, 800, ?3, 'system', ?4, ?5)",
        params![settings_id, project_id, breathing, ts, ts],
    )?;
    conn.execute(
        "INSERT INTO book_version (id, book_id, version, changelog, created_at)
         VALUES (?1, ?2, '1.0.0', 'Geliştirme demo içeriği oluşturuldu.', ?3)",
        params![version_id, book_id, ts],
    )?;
    Ok(())
}

fn seed_preface_blocks(conn: &Connection, chapter_id: &str) -> Result<(), AppError> {
    insert_block(
        conn,
        chapter_id,
        "heading",
        0,
        json!({ "level": 1, "content": rich_heading(1, "Önsöz") }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "paragraph",
        1,
        json!({
            "content": rich_paragraph(
                "Bu kitap, baskı altında sakin kalmayı ve doğru tekniği otomatik hale getirmeyi öğretir."
            )
        }),
    )?;
    Ok(())
}

fn seed_breathing_blocks(conn: &Connection, chapter_id: &str) -> Result<(), AppError> {
    insert_block(
        conn,
        chapter_id,
        "heading",
        0,
        json!({
            "level": 1,
            "content": rich_heading(1, "Doğru Bir Teknikle Nefes Alıp Verin")
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "paragraph",
        1,
        json!({
            "content": rich_paragraph(
                "Stres altında ilk kaybedilen becerilerden biri düzgün nefes almaktır. Kontrolsüz nefes, kalp ritmini yükseltir, karar kalitesini düşürür ve bedeni gereksiz yere yorar. Bilinçli bir teknik, birkaç saniye içinde sistemi yeniden dengeleyebilir."
            )
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "image",
        2,
        json!({
            "assetId": null,
            "alt": "Nefes tekniği diyagramı",
            "caption": "Kutu nefesi adımları — görseli Medya panelinden ekleyin",
            "description": "",
            "width": 100,
            "align": "center",
            "borderRadius": 8,
            "showInEpub": true,
            "showInPdf": true,
            "showInHtml": true,
            "placeholder": true
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "infoBox",
        3,
        json!({
            "icon": "info",
            "title": "ÖNEMLİ",
            "content": rich_paragraph(
                "Nefes egzersizlerini düzenli olarak uygulamak, stresli durumlarda otomatik olarak doğru tepki vermenizi sağlar."
            ),
            "variant": "info",
            "padding": "md"
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "video",
        4,
        json!({
            "sourceType": "external",
            "title": "Kutu nefesi uygulaması",
            "description": "Yerel video dosyası veya harici bağlantı ekleyebilirsiniz",
            "url": "",
            "thumbnailAssetId": null,
            "duration": null,
            "generateQr": false,
            "showInEpub": true,
            "showInPdf": true,
            "showInHtml": true,
            "placeholder": true
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "qr",
        5,
        json!({
            "mode": "url",
            "value": "https://example.com/nefes-teknigi",
            "title": "Uygulama videosu",
            "description": "Telefonda açılacak bağlantı için QR kod",
            "size": 160,
            "errorCorrection": "M",
            "margin": 4,
            "placeholder": true
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "orderedList",
        6,
        json!({
            "content": {
                "type": "doc",
                "content": [{
                    "type": "orderedList",
                    "content": [
                        list_item("Burnunuzdan dört saniye nefes alın."),
                        list_item("Dört saniye nefesi tutun."),
                        list_item("Ağzınızdan dört saniye nefes verin."),
                        list_item("Dört saniye bekleyin ve döngüyü tekrarlayın.")
                    ]
                }]
            }
        }),
    )?;
    insert_block(
        conn,
        chapter_id,
        "quote",
        7,
        json!({
            "content": rich_quote(
                "Sakin bir nefes, karmaşık bir kararın ilk adımıdır."
            ),
            "attribution": ""
        }),
    )?;
    Ok(())
}

fn insert_chapter(
    conn: &Connection,
    book_id: &str,
    parent_id: Option<&str>,
    title: &str,
    number: Option<&str>,
    order: i64,
) -> Result<String, AppError> {
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO chapter (id, book_id, parent_id, title, number, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, book_id, parent_id, title, number, order, ts, ts],
    )?;
    Ok(id)
}

fn insert_block(
    conn: &Connection,
    chapter_id: &str,
    block_type: &str,
    order: i64,
    data: Value,
) -> Result<(), AppError> {
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO content_block (id, chapter_id, type, sort_order, data, style, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6, ?7)",
        params![id, chapter_id, block_type, order, data.to_string(), ts, ts],
    )?;
    Ok(())
}

fn text_node(text: &str) -> Value {
    json!({ "type": "text", "text": text })
}

fn rich_paragraph(text: &str) -> Value {
    json!({
        "type": "doc",
        "content": [{
            "type": "paragraph",
            "content": [text_node(text)]
        }]
    })
}

fn rich_heading(level: u8, text: &str) -> Value {
    json!({
        "type": "doc",
        "content": [{
            "type": "heading",
            "attrs": { "level": level },
            "content": [text_node(text)]
        }]
    })
}

fn rich_quote(text: &str) -> Value {
    json!({
        "type": "doc",
        "content": [{
            "type": "blockquote",
            "content": [{
                "type": "paragraph",
                "content": [text_node(text)]
            }]
        }]
    })
}

fn list_item(text: &str) -> Value {
    json!({
        "type": "listItem",
        "content": [{
            "type": "paragraph",
            "content": [text_node(text)]
        }]
    })
}
