use crate::database;
use crate::error::AppError;
use crate::filesystem;
use crate::models::WorkspaceSnapshot;
use crate::state::AppState;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::AppHandle;

const LOCK_STALE_SECS: u64 = 120;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveSyncSettings {
    pub enabled: bool,
    pub folder_path: String,
    pub machine_id: String,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncMeta {
    book_title: String,
    updated_at: String,
    machine_id: String,
    project_slug: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncLock {
    machine_id: String,
    updated_at: String,
    book_title: String,
}

#[tauri::command]
pub fn get_drive_sync_settings(app: AppHandle) -> Result<DriveSyncSettings, AppError> {
    Ok(load_settings(&app)?)
}

#[tauri::command]
pub fn set_drive_sync_settings(
    app: AppHandle,
    state: tauri::State<AppState>,
    enabled: bool,
    folder_path: String,
) -> Result<DriveSyncSettings, AppError> {
    let folder = folder_path.trim().to_string();
    if enabled && folder.is_empty() {
        return Err(AppError::user(
            "Drive klasör yolu boş olamaz.",
            "empty sync folder",
        ));
    }
    if enabled {
        let path = PathBuf::from(&folder);
        if !path.is_dir() {
            return Err(AppError::user(
                "Seçilen Drive klasörü bulunamadı. Google Drive masaüstü uygulamasındaki klasörü seçin.",
                path.display().to_string(),
            ));
        }
    }
    let mut settings = load_settings(&app)?;
    settings.enabled = enabled;
    settings.folder_path = folder;
    settings.warning = None;
    save_settings(&app, &settings)?;
    if settings.enabled {
        match push_current(&app, &state, &settings) {
            Ok(next) => return Ok(next),
            Err(err) => {
                settings.warning = Some(err.to_string());
                save_settings(&app, &settings)?;
            }
        }
    }
    Ok(settings)
}

#[tauri::command]
pub fn push_drive_sync(
    app: AppHandle,
    state: tauri::State<AppState>,
) -> Result<DriveSyncSettings, AppError> {
    let settings = load_settings(&app)?;
    if !settings.enabled {
        return Ok(settings);
    }
    push_current(&app, &state, &settings)
}

#[tauri::command]
pub fn pull_drive_sync(
    app: AppHandle,
    state: tauri::State<AppState>,
) -> Result<WorkspaceSnapshot, AppError> {
    try_pull_on_load(&app, &state);
    crate::commands::workspace_snapshot(&state)
}

pub fn try_pull_on_load(app: &AppHandle, state: &AppState) {
    let Ok(mut settings) = load_settings(app) else {
        return;
    };
    if !settings.enabled || settings.folder_path.trim().is_empty() {
        return;
    }
    match pull_current(app, state, &settings) {
        Ok(warning) => {
            settings.last_pull_at = Some(database::now());
            settings.warning = warning;
            let _ = save_settings(app, &settings);
        }
        Err(err) => {
            settings.warning = Some(err.to_string());
            let _ = save_settings(app, &settings);
        }
    }
}

fn push_current(
    app: &AppHandle,
    state: &AppState,
    settings: &DriveSyncSettings,
) -> Result<DriveSyncSettings, AppError> {
    let root = state.project_root()?;
    {
        let conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    }
    let book = {
        let conn = state.db()?;
        database::get_book(&conn)?
    };
    let slug = folder_slug(&book.title);
    let remote = PathBuf::from(settings.folder_path.trim()).join(slug);
    fs::create_dir_all(&remote)?;

    let warning = conflict_warning(&remote, &settings.machine_id, &book.title);

    copy_file_if_exists(&root.join("project.sqlite"), &remote.join("project.sqlite"))?;
    copy_file_if_exists(&root.join("project.json"), &remote.join("project.json"))?;
    copy_dir_replace(&root.join("assets"), &remote.join("assets"))?;

    let meta = SyncMeta {
        book_title: book.title.clone(),
        updated_at: database::now(),
        machine_id: settings.machine_id.clone(),
        project_slug: folder_slug(&book.title),
    };
    fs::write(
        remote.join("sync-meta.json"),
        serde_json::to_vec_pretty(&meta)?,
    )?;
    write_lock(&remote, &settings.machine_id, &book.title)?;

    let mut next = settings.clone();
    next.last_push_at = Some(meta.updated_at);
    next.warning = warning;
    save_settings(app, &next)?;
    Ok(next)
}

fn pull_current(
    app: &AppHandle,
    state: &AppState,
    settings: &DriveSyncSettings,
) -> Result<Option<String>, AppError> {
    let root = state.project_root()?;
    let book = {
        let conn = state.db()?;
        database::get_book(&conn)?
    };
    let remote = PathBuf::from(settings.folder_path.trim()).join(folder_slug(&book.title));
    let remote_sqlite = remote.join("project.sqlite");
    if !remote_sqlite.is_file() {
        return Ok(None);
    }

    let warning = conflict_warning(&remote, &settings.machine_id, &book.title);
    let remote_mtime = file_mtime(&remote_sqlite)?;
    let local_mtime = file_mtime(&root.join("project.sqlite")).unwrap_or(0);
    if remote_mtime <= local_mtime {
        return Ok(warning);
    }

    {
        let mut conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        *conn = Connection::open_in_memory()?;
    }

    let _ = fs::remove_file(root.join("project.sqlite-wal"));
    let _ = fs::remove_file(root.join("project.sqlite-shm"));
    fs::copy(&remote_sqlite, root.join("project.sqlite"))?;
    if remote.join("project.json").is_file() {
        fs::copy(remote.join("project.json"), root.join("project.json"))?;
    }
    if remote.join("assets").is_dir() {
        copy_dir_replace(&remote.join("assets"), &root.join("assets"))?;
    }

    let new_conn = database::open_project_connection(&root.join("project.sqlite"))?;
    {
        let mut conn = state.db()?;
        *conn = new_conn;
    }
    filesystem::remember_project(app, &root)?;
    write_lock(&remote, &settings.machine_id, &book.title)?;
    Ok(warning.or_else(|| {
        Some("Drive klasöründen daha yeni kitap içeriği alındı.".to_string())
    }))
}

fn conflict_warning(remote: &Path, machine_id: &str, book_title: &str) -> Option<String> {
    let lock_path = remote.join(".kitap-edit.lock");
    let Ok(raw) = fs::read_to_string(&lock_path) else {
        return None;
    };
    let Ok(lock) = serde_json::from_str::<SyncLock>(&raw) else {
        return None;
    };
    if lock.machine_id == machine_id {
        return None;
    }
    let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&lock.updated_at) else {
        return Some(format!(
            "“{book_title}” başka bir bilgisayarda açık olabilir. Aynı anda düzenlemek çakışma yaratabilir."
        ));
    };
    let age = chrono::Utc::now().signed_duration_since(updated.with_timezone(&chrono::Utc));
    if age.to_std().unwrap_or(Duration::from_secs(0)) < Duration::from_secs(LOCK_STALE_SECS) {
        Some(format!(
            "“{book_title}” şu an başka bir makinede düzenleniyor olabilir. Son kayıt Drive’a yazılır; aynı anda çalışmayın."
        ))
    } else {
        None
    }
}

fn write_lock(remote: &Path, machine_id: &str, book_title: &str) -> Result<(), AppError> {
    let lock = SyncLock {
        machine_id: machine_id.to_string(),
        updated_at: database::now(),
        book_title: book_title.to_string(),
    };
    fs::write(
        remote.join(".kitap-edit.lock"),
        serde_json::to_vec_pretty(&lock)?,
    )?;
    Ok(())
}

fn load_settings(app: &AppHandle) -> Result<DriveSyncSettings, AppError> {
    let path = filesystem::app_state_file_path(app)?;
    let mut enabled = false;
    let mut folder_path = String::new();
    let mut machine_id = String::new();
    let mut last_push_at = None;
    let mut last_pull_at = None;
    let mut warning = None;
    if path.exists() {
        let raw = fs::read_to_string(&path)?;
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
            enabled = value
                .get("driveSyncEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            folder_path = value
                .get("driveSyncPath")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            machine_id = value
                .get("machineId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            last_push_at = value
                .get("driveLastPushAt")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            last_pull_at = value
                .get("driveLastPullAt")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            warning = value
                .get("driveWarning")
                .and_then(|v| v.as_str())
                .map(str::to_string);
        }
    }
    if machine_id.trim().is_empty() {
        machine_id = uuid::Uuid::new_v4().to_string();
        let settings = DriveSyncSettings {
            enabled,
            folder_path: folder_path.clone(),
            machine_id: machine_id.clone(),
            last_push_at: last_push_at.clone(),
            last_pull_at: last_pull_at.clone(),
            warning: warning.clone(),
        };
        save_settings(app, &settings)?;
        return Ok(settings);
    }
    Ok(DriveSyncSettings {
        enabled,
        folder_path,
        machine_id,
        last_push_at,
        last_pull_at,
        warning,
    })
}

fn save_settings(app: &AppHandle, settings: &DriveSyncSettings) -> Result<(), AppError> {
    let path = filesystem::app_state_file_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut value = if path.exists() {
        serde_json::from_str(&fs::read_to_string(&path)?).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !value.is_object() {
        value = serde_json::json!({});
    }
    let obj = value.as_object_mut().unwrap();
    obj.insert(
        "driveSyncEnabled".into(),
        serde_json::Value::Bool(settings.enabled),
    );
    obj.insert(
        "driveSyncPath".into(),
        serde_json::Value::String(settings.folder_path.clone()),
    );
    obj.insert(
        "machineId".into(),
        serde_json::Value::String(settings.machine_id.clone()),
    );
    obj.insert(
        "driveLastPushAt".into(),
        match &settings.last_push_at {
            Some(v) => serde_json::Value::String(v.clone()),
            None => serde_json::Value::Null,
        },
    );
    obj.insert(
        "driveLastPullAt".into(),
        match &settings.last_pull_at {
            Some(v) => serde_json::Value::String(v.clone()),
            None => serde_json::Value::Null,
        },
    );
    obj.insert(
        "driveWarning".into(),
        match &settings.warning {
            Some(v) => serde_json::Value::String(v.clone()),
            None => serde_json::Value::Null,
        },
    );
    fs::write(&path, serde_json::to_vec_pretty(&value)?)?;
    Ok(())
}

fn copy_file_if_exists(from: &Path, to: &Path) -> Result<(), AppError> {
    if !from.is_file() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(from, to)?;
    Ok(())
}

fn copy_dir_replace(from: &Path, to: &Path) -> Result<(), AppError> {
    if !from.is_dir() {
        return Ok(());
    }
    if to.exists() {
        fs::remove_dir_all(to)?;
    }
    copy_dir_recursive(from, to)
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), AppError> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let src = entry.path();
        let dest = to.join(entry.file_name());
        if src.is_dir() {
            copy_dir_recursive(&src, &dest)?;
        } else if src.is_file() {
            fs::copy(&src, &dest)?;
        }
    }
    Ok(())
}

fn file_mtime(path: &Path) -> Result<u64, AppError> {
    let meta = fs::metadata(path)?;
    Ok(meta
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs())
}

fn folder_slug(name: &str) -> String {
    let cleaned = filesystem::sanitize_filename(name);
    let mapped: String = cleaned
        .chars()
        .map(|ch| match ch {
            'ı' | 'I' | 'İ' | 'i' => 'i',
            'ş' | 'Ş' => 's',
            'ğ' | 'Ğ' => 'g',
            'ü' | 'Ü' => 'u',
            'ö' | 'Ö' => 'o',
            'ç' | 'Ç' => 'c',
            c if c.is_ascii_alphanumeric() => c.to_ascii_lowercase(),
            _ => '-',
        })
        .collect();
    let collapsed = mapped
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "kitap".to_string()
    } else {
        collapsed
    }
}
