use crate::database::{self, new_id, now};
use crate::error::AppError;
use crate::filesystem;
use crate::models::{Asset, ImportAssetBytesPayload, ImportAssetPayload};
use crate::state::AppState;
use base64::Engine;
use rusqlite::params;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "svg", "gif"];
const VIDEO_EXTS: &[&str] = &["mp4", "webm", "mov", "mkv"];
const FILE_EXTS: &[&str] = &[
    "pdf", "zip", "epub", "txt", "md", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "rtf",
];
const IMPORT_EXTS: &[&str] = &["docx", "txt", "md"];
const MAX_IMPORT_BYTES: u64 = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES: u64 = 512 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 100 * 1024 * 1024;

#[tauri::command]
pub fn import_asset(
    state: tauri::State<AppState>,
    payload: ImportAssetPayload,
) -> Result<Asset, AppError> {
    let asset_type = payload.asset_type.trim().to_lowercase();
    let allowed_exts = match asset_type.as_str() {
        "image" => IMAGE_EXTS,
        "video" => VIDEO_EXTS,
        "file" => FILE_EXTS,
        other => {
            return Err(AppError::user(
                "Desteklenmeyen medya türü.",
                format!("asset_type={other}"),
            ))
        }
    };

    let source = PathBuf::from(payload.source_path.trim());
    if !source.is_file() {
        return Err(AppError::user(
            "Seçilen dosya bulunamadı.",
            format!("missing {}", source.display()),
        ));
    }

    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !allowed_exts.contains(&ext.as_str()) {
        return Err(AppError::user(
            "Bu dosya uzantısı desteklenmiyor.",
            format!("ext={ext}"),
        ));
    }

    let metadata = fs::metadata(&source)?;
    let size = metadata.len();
    let limit = match asset_type.as_str() {
        "image" => MAX_IMAGE_BYTES,
        "video" => MAX_VIDEO_BYTES,
        _ => MAX_FILE_BYTES,
    };
    if size > limit {
        return Err(AppError::user(
            "Dosya boyutu izin verilen sınırı aşıyor.",
            format!("size={size} limit={limit}"),
        ));
    }

    let original_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("dosya");
    let safe_name = filesystem::sanitize_filename(original_name);
    let folder = match asset_type.as_str() {
        "image" => "images",
        "video" => "videos",
        _ => "files",
    };
    let asset_id = new_id();
    let stored_name = format!("{asset_id}-{safe_name}");
    let relative_path = format!("assets/{folder}/{stored_name}");
    let root = state.project_root()?;
    let destination = filesystem::safe_child_path(&root, &relative_path)?;
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(&source, &destination).map_err(|err| {
        AppError::user(
            "Dosya proje klasörüne kopyalanamadı.",
            format!("{} -> {}: {err}", source.display(), destination.display()),
        )
    })?;
    insert_asset_row(&state, &asset_type, &safe_name, &relative_path, &ext, size, &asset_id)
}

fn insert_asset_row(
    state: &tauri::State<AppState>,
    asset_type: &str,
    safe_name: &str,
    relative_path: &str,
    ext: &str,
    size: u64,
    asset_id: &str,
) -> Result<Asset, AppError> {
    let root = state.project_root()?;
    let destination = filesystem::safe_child_path(&root, relative_path)?;
    assert_inside_project(&root, &destination)?;
    let mime = mime_for_ext(ext);
    let ts = now();
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    conn.execute(
        "INSERT INTO asset (id, project_id, type, filename, relative_path, mime_type, size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            asset_id,
            project.id,
            asset_type,
            safe_name,
            relative_path,
            mime,
            size as i64,
            ts
        ],
    )?;
    get_asset(&conn, asset_id)
}

#[tauri::command]
pub fn import_asset_bytes(
    state: tauri::State<AppState>,
    payload: ImportAssetBytesPayload,
) -> Result<Asset, AppError> {
    let asset_type = payload.asset_type.trim().to_lowercase();
    if asset_type != "image" {
        return Err(AppError::user(
            "Yalnızca görsel baytları içe aktarılabilir.",
            asset_type,
        ));
    }
    let size = payload.bytes.len() as u64;
    if size == 0 || size > MAX_IMAGE_BYTES {
        return Err(AppError::user(
            "Görsel boyutu geçersiz.",
            format!("size={size}"),
        ));
    }
    let original_name = if payload.filename.trim().is_empty() {
        "word-gorsel.png".to_string()
    } else {
        filesystem::sanitize_filename(&payload.filename)
    };
    let ext = Path::new(&original_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "png".to_string());
    if !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(AppError::user(
            "Bu görsel uzantısı desteklenmiyor.",
            format!("ext={ext}"),
        ));
    }
    let asset_id = new_id();
    let stored_name = format!("{asset_id}-{original_name}");
    let relative_path = format!("assets/images/{stored_name}");
    let root = state.project_root()?;
    let destination = filesystem::safe_child_path(&root, &relative_path)?;
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&destination, &payload.bytes).map_err(|err| {
        AppError::user(
            "Görsel kaydedilemedi.",
            format!("{}: {err}", destination.display()),
        )
    })?;
    insert_asset_row(
        &state,
        &asset_type,
        &original_name,
        &relative_path,
        &ext,
        size,
        &asset_id,
    )
}

#[tauri::command]
pub fn list_assets(
    state: tauri::State<AppState>,
    asset_type: Option<String>,
) -> Result<Vec<Asset>, AppError> {
    let conn = state.db()?;
    let project = database::get_project(&conn)?;
    let mut assets = Vec::new();
    if let Some(kind) = asset_type {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, type, filename, relative_path, mime_type, size, created_at
             FROM asset WHERE project_id = ?1 AND type = ?2 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![project.id, kind], map_asset)?;
        for row in rows {
            assets.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, type, filename, relative_path, mime_type, size, created_at
             FROM asset WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![project.id], map_asset)?;
        for row in rows {
            assets.push(row?);
        }
    }
    Ok(assets)
}

#[tauri::command]
pub fn read_asset_data_url(
    state: tauri::State<AppState>,
    relative_path: String,
) -> Result<String, AppError> {
    let dest = resolve_existing_asset(&state.project_root()?, &relative_path)?;
    let ext = dest
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(AppError::user(
            "Bu dosya görsel olarak okunamaz.",
            format!("ext={ext}"),
        ));
    }
    let bytes = fs::read(&dest).map_err(|err| {
        AppError::user(
            "Görsel okunamadı.",
            format!("{}: {err}", dest.display()),
        )
    })?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(AppError::user(
            "Görsel çok büyük.",
            format!("size={}", bytes.len()),
        ));
    }
    let mime = mime_for_ext(&ext);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

#[tauri::command]
pub fn resolve_asset_path(
    state: tauri::State<AppState>,
    relative_path: String,
) -> Result<String, AppError> {
    let dest = resolve_existing_asset(&state.project_root()?, &relative_path)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_asset(state: tauri::State<AppState>, id: String) -> Result<(), AppError> {
    let relative_path = {
        let conn = state.db()?;
        let asset = get_asset(&conn, &id)?;
        asset.relative_path
    };
    if let Ok(dest) = resolve_existing_asset(&state.project_root()?, &relative_path) {
        let _ = fs::remove_file(dest);
    }
    let conn = state.db()?;
    conn.execute(
        "UPDATE book SET cover_asset_id = NULL WHERE cover_asset_id = ?1",
        [&id],
    )?;
    conn.execute("DELETE FROM asset WHERE id = ?1", [&id])?;
    Ok(())
}

#[tauri::command]
pub fn open_asset(
    state: tauri::State<AppState>,
    app: AppHandle,
    relative_path: String,
) -> Result<(), AppError> {
    let dest = resolve_existing_asset(&state.project_root()?, &relative_path)?;
    app.opener()
        .open_path(dest.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| AppError::user("Dosya açılamadı.", err.to_string()))?;
    Ok(())
}

fn resolve_existing_asset(project_root: &Path, relative_path: &str) -> Result<PathBuf, AppError> {
    if !relative_path.starts_with("assets/") {
        return Err(AppError::user(
            "Geçersiz medya yolu.",
            format!("relative={relative_path}"),
        ));
    }
    let dest = filesystem::safe_child_path(project_root, relative_path)?;
    if !dest.is_file() {
        return Err(AppError::user(
            "Medya dosyası bulunamadı.",
            format!("{}", dest.display()),
        ));
    }
    assert_inside_project(project_root, &dest)?;
    Ok(dest)
}

fn assert_inside_project(root: &Path, path: &Path) -> Result<(), AppError> {
    let root = fs::canonicalize(root).map_err(|err| {
        AppError::user(
            "Proje klasörü doğrulanamadı.",
            format!("{}: {err}", root.display()),
        )
    })?;
    let path = fs::canonicalize(path).map_err(|err| {
        AppError::user(
            "Dosya yolu doğrulanamadı.",
            format!("{}: {err}", path.display()),
        )
    })?;
    if !path.starts_with(&root) {
        return Err(AppError::user(
            "Dosya proje klasörünün dışında.",
            format!("{} !starts_with {}", path.display(), root.display()),
        ));
    }
    Ok(())
}

fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "epub" => "application/epub+zip",
        _ => "application/octet-stream",
    }
}

fn map_asset(row: &rusqlite::Row<'_>) -> rusqlite::Result<Asset> {
    Ok(Asset {
        id: row.get(0)?,
        project_id: row.get(1)?,
        asset_type: row.get(2)?,
        filename: row.get(3)?,
        relative_path: row.get(4)?,
        mime_type: row.get(5)?,
        size: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn get_asset(conn: &rusqlite::Connection, id: &str) -> Result<Asset, AppError> {
    conn.query_row(
        "SELECT id, project_id, type, filename, relative_path, mime_type, size, created_at
         FROM asset WHERE id = ?1",
        [id],
        map_asset,
    )
    .map_err(|_| AppError::user("Medya kaydı bulunamadı.", format!("missing asset {id}")))
}

#[tauri::command]
pub fn read_import_bytes(path: String) -> Result<Vec<u8>, AppError> {
    let source = PathBuf::from(path.trim());
    if !source.is_file() {
        return Err(AppError::user(
            "Seçilen dosya bulunamadı.",
            format!("missing {}", source.display()),
        ));
    }
    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !IMPORT_EXTS.contains(&ext.as_str()) {
        return Err(AppError::user(
            "Word içe aktarma için .docx, .txt veya .md seçin.",
            format!("ext={ext}"),
        ));
    }
    let size = fs::metadata(&source)?.len();
    if size > MAX_IMPORT_BYTES {
        return Err(AppError::user(
            "Dosya içe aktarma sınırını aşıyor (20 MB).",
            format!("size={size}"),
        ));
    }
    fs::read(&source).map_err(AppError::from)
}
