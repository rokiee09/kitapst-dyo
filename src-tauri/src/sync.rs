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
    /// `google` = OAuth + Drive API (drive.file); `folder` = masaüstü klasör yolu.
    pub mode: String,
    pub folder_path: String,
    pub machine_id: String,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub last_applied_remote_at: Option<String>,
    pub remote_slug: String,
    pub warning: Option<String>,
    pub google_email: String,
    pub google_connected: bool,
    pub client_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrivePollResult {
    pub changed: bool,
    pub settings: DriveSyncSettings,
    pub snapshot: Option<WorkspaceSnapshot>,
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
    #[serde(default)]
    machine_name: String,
}

enum PullOutcome {
    Unchanged(Option<String>),
    Updated {
        warning: Option<String>,
        remote_updated_at: String,
    },
}

#[tauri::command]
pub fn get_drive_sync_settings(app: AppHandle) -> Result<DriveSyncSettings, AppError> {
    Ok(enrich_google(&app, load_settings(&app)?))
}

fn enrich_google(app: &AppHandle, mut settings: DriveSyncSettings) -> DriveSyncSettings {
    let info = crate::google_drive::account_info(app).unwrap_or(crate::google_drive::GoogleAccountInfo {
        connected: false,
        email: String::new(),
        root_folder_id: String::new(),
        client_configured: false,
    });
    settings.google_connected = info.connected;
    settings.google_email = info.email;
    settings.client_configured = info.client_configured;
    if settings.mode.trim().is_empty() {
        settings.mode = if info.connected {
            "google".into()
        } else if !settings.folder_path.trim().is_empty() {
            "folder".into()
        } else {
            "google".into()
        };
    }
    settings
}

#[tauri::command]
pub fn set_drive_sync_settings(
    app: AppHandle,
    state: tauri::State<AppState>,
    enabled: bool,
    folder_path: String,
    mode: Option<String>,
) -> Result<DriveSyncSettings, AppError> {
    let folder = folder_path.trim().to_string();
    let mut settings = load_settings(&app)?;
    let next_mode = mode
        .as_deref()
        .map(str::trim)
        .filter(|value| matches!(*value, "google" | "folder"))
        .unwrap_or(if settings.mode == "google" {
            "google"
        } else {
            "folder"
        })
        .to_string();
    if enabled && next_mode == "folder" && folder.is_empty() {
        return Err(AppError::user(
            "Drive klasör yolu boş olamaz.",
            "empty sync folder",
        ));
    }
    if enabled && next_mode == "folder" {
        let path = PathBuf::from(&folder);
        if !path.is_dir() {
            return Err(AppError::user(
                "Seçilen Drive klasörü bulunamadı. Google Drive masaüstü uygulamasındaki klasörü seçin.",
                path.display().to_string(),
            ));
        }
    }
    if enabled && next_mode == "google" && !crate::google_drive::is_connected(&app) {
        return Err(AppError::user(
            "Önce Google hesabıyla giriş yapın.",
            "google not connected",
        ));
    }
    settings.enabled = enabled;
    settings.mode = next_mode;
    settings.folder_path = folder;
    settings.warning = None;
    save_settings(&app, &settings)?;
    settings = enrich_google(&app, settings);
    if settings.enabled {
        match pull_current(&app, &state, &settings) {
            Ok(PullOutcome::Updated {
                warning,
                remote_updated_at,
            }) => {
                settings.last_pull_at = Some(database::now());
                settings.last_applied_remote_at = Some(remote_updated_at);
                settings.warning = warning;
                save_settings(&app, &settings)?;
            }
            Ok(PullOutcome::Unchanged(warning)) => {
                settings.warning = warning;
                save_settings(&app, &settings)?;
            }
            Err(err) => {
                settings.warning = Some(err.to_string());
                save_settings(&app, &settings)?;
            }
        }
        match push_current(&app, &state, &settings) {
            Ok(next) => return Ok(next),
            Err(err) => {
                settings.warning = Some(err.to_string());
                save_settings(&app, &settings)?;
            }
        }
    }
    Ok(enrich_google(&app, settings))
}

#[tauri::command]
pub fn save_google_oauth_client(
    app: AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<DriveSyncSettings, AppError> {
    crate::google_drive::save_client_config(
        &app,
        crate::google_drive::GoogleClientConfig {
            client_id,
            client_secret,
        },
    )?;
    Ok(enrich_google(&app, load_settings(&app)?))
}

#[tauri::command]
pub fn google_drive_login(app: AppHandle) -> Result<DriveSyncSettings, AppError> {
    let _ = crate::google_drive::login(&app)?;
    let mut settings = load_settings(&app)?;
    settings.mode = "google".into();
    save_settings(&app, &settings)?;
    Ok(enrich_google(&app, settings))
}

#[tauri::command]
pub fn google_drive_logout(app: AppHandle) -> Result<DriveSyncSettings, AppError> {
    let _ = crate::google_drive::logout(&app)?;
    let mut settings = load_settings(&app)?;
    if settings.mode == "google" {
        settings.enabled = false;
    }
    settings.warning = None;
    save_settings(&app, &settings)?;
    Ok(enrich_google(&app, settings))
}

#[tauri::command]
pub fn push_drive_sync(
    app: AppHandle,
    state: tauri::State<AppState>,
) -> Result<DriveSyncSettings, AppError> {
    let settings = enrich_google(&app, load_settings(&app)?);
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

#[tauri::command]
pub fn poll_drive_sync(
    app: AppHandle,
    state: tauri::State<AppState>,
) -> Result<DrivePollResult, AppError> {
    let mut settings = enrich_google(&app, load_settings(&app)?);
    let ready = settings.enabled
        && (settings.mode == "google" && settings.google_connected
            || settings.mode != "google" && !settings.folder_path.trim().is_empty());
    if !ready {
        return Ok(DrivePollResult {
            changed: false,
            settings,
            snapshot: None,
        });
    }
    match pull_current(&app, &state, &settings) {
        Ok(PullOutcome::Updated {
            warning,
            remote_updated_at,
        }) => {
            settings.last_pull_at = Some(database::now());
            settings.last_applied_remote_at = Some(remote_updated_at);
            settings.warning = warning;
            save_settings(&app, &settings)?;
            let snapshot = crate::commands::workspace_snapshot(&state)?;
            Ok(DrivePollResult {
                changed: true,
                settings,
                snapshot: Some(snapshot),
            })
        }
        Ok(PullOutcome::Unchanged(warning)) => {
            if settings.warning != warning {
                settings.warning = warning;
                let _ = save_settings(&app, &settings);
            }
            Ok(DrivePollResult {
                changed: false,
                settings,
                snapshot: None,
            })
        }
        Err(err) => {
            settings.warning = Some(err.to_string());
            let _ = save_settings(&app, &settings);
            Ok(DrivePollResult {
                changed: false,
                settings,
                snapshot: None,
            })
        }
    }
}

pub fn try_pull_on_load(app: &AppHandle, state: &AppState) {
    let Ok(mut settings) = load_settings(app).map(|s| enrich_google(app, s)) else {
        return;
    };
    let ready = settings.enabled
        && (settings.mode == "google" && settings.google_connected
            || settings.mode != "google" && !settings.folder_path.trim().is_empty());
    if !ready {
        return;
    }
    match pull_current(app, state, &settings) {
        Ok(PullOutcome::Updated {
            warning,
            remote_updated_at,
        }) => {
            settings.last_pull_at = Some(database::now());
            settings.last_applied_remote_at = Some(remote_updated_at);
            settings.warning = warning;
            let _ = save_settings(app, &settings);
        }
        Ok(PullOutcome::Unchanged(warning)) => {
            settings.warning = warning;
            if let Ok(book) = state.db().and_then(|conn| database::get_book(&conn)) {
                let remote = resolve_remote_dir(&settings, &book.title);
                let _ = write_lock(&remote, &settings.machine_id, &book.title);
            }
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
    if settings.mode == "google" {
        return push_google(app, state, settings);
    }
    let root = state.project_root()?;
    let book = {
        let conn = state.db()?;
        database::get_book(&conn)?
    };
    let mut next = settings.clone();
    if next.remote_slug.trim().is_empty() {
        next.remote_slug = folder_slug(&book.title);
    }
    let remote = resolve_remote_dir(&next, &book.title);
    fs::create_dir_all(&remote)?;

    {
        let conn = state.db()?;
        export_sqlite_to_drive(&conn, &root, &remote.join("project.sqlite"))?;
    }
    copy_file_if_exists(&root.join("project.json"), &remote.join("project.json"))?;
    copy_dir_replace(&root.join("assets"), &remote.join("assets"))?;

    let meta = SyncMeta {
        book_title: book.title.clone(),
        updated_at: database::now(),
        machine_id: next.machine_id.clone(),
        project_slug: next.remote_slug.clone(),
    };
    fs::write(
        remote.join("sync-meta.json"),
        serde_json::to_vec_pretty(&meta)?,
    )?;
    let warning = conflict_warning(&remote, &next.machine_id, &book.title);
    write_lock(&remote, &next.machine_id, &book.title)?;
    next.last_push_at = Some(meta.updated_at.clone());
    next.last_applied_remote_at = Some(meta.updated_at);
    next.warning = warning;
    save_settings(app, &next)?;
    Ok(enrich_google(app, next))
}

fn push_google(
    app: &AppHandle,
    state: &AppState,
    settings: &DriveSyncSettings,
) -> Result<DriveSyncSettings, AppError> {
    let root = state.project_root()?;
    let book = {
        let conn = state.db()?;
        database::get_book(&conn)?
    };
    let mut next = settings.clone();
    if next.remote_slug.trim().is_empty() {
        next.remote_slug = folder_slug(&book.title);
    }
    let folder_id = crate::google_drive::ensure_book_folder(app, &next.remote_slug)?;
    let staging = root.join(".drive-google-push");
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging)?;
    {
        let conn = state.db()?;
        export_sqlite_to_drive(&conn, &root, &staging.join("project.sqlite"))?;
    }
    copy_file_if_exists(&root.join("project.json"), &staging.join("project.json"))?;
    let sqlite_bytes = fs::read(staging.join("project.sqlite"))?;
    crate::google_drive::upload_bytes(
        app,
        &folder_id,
        "project.sqlite",
        "application/x-sqlite3",
        &sqlite_bytes,
    )?;
    if staging.join("project.json").is_file() {
        let bytes = fs::read(staging.join("project.json"))?;
        crate::google_drive::upload_bytes(app, &folder_id, "project.json", "application/json", &bytes)?;
    }
    let assets = root.join("assets");
    if assets.is_dir() {
        let zip_bytes = crate::google_drive::zip_dir(&assets)?;
        crate::google_drive::upload_bytes(
            app,
            &folder_id,
            "assets.zip",
            "application/zip",
            &zip_bytes,
        )?;
    }
    let meta = SyncMeta {
        book_title: book.title.clone(),
        updated_at: database::now(),
        machine_id: next.machine_id.clone(),
        project_slug: next.remote_slug.clone(),
    };
    let meta_bytes = serde_json::to_vec_pretty(&meta)?;
    let warning = conflict_warning_google(app, &folder_id, &next.machine_id, &book.title)?;
    let lock = SyncLock {
        machine_id: next.machine_id.clone(),
        updated_at: database::now(),
        book_title: book.title.clone(),
        machine_name: hostname(),
    };
    crate::google_drive::upload_bytes(
        app,
        &folder_id,
        "sync-meta.json",
        "application/json",
        &meta_bytes,
    )?;
    crate::google_drive::upload_bytes(
        app,
        &folder_id,
        ".kitap-edit.lock",
        "application/json",
        &serde_json::to_vec_pretty(&lock)?,
    )?;
    let _ = fs::remove_dir_all(&staging);
    next.last_push_at = Some(meta.updated_at.clone());
    next.last_applied_remote_at = Some(meta.updated_at);
    next.warning = warning;
    save_settings(app, &next)?;
    Ok(enrich_google(app, next))
}

fn pull_current(
    app: &AppHandle,
    state: &AppState,
    settings: &DriveSyncSettings,
) -> Result<PullOutcome, AppError> {
    if settings.mode == "google" {
        return pull_google(app, state, settings);
    }
    let root = state.project_root()?;
    let book = {
        let conn = state.db()?;
        database::get_book(&conn)?
    };
    let remote = resolve_remote_dir(settings, &book.title);
    let remote_sqlite = remote.join("project.sqlite");
    if !remote_sqlite.is_file() {
        return Ok(PullOutcome::Unchanged(None));
    }

    let meta = read_meta(&remote);
    let warning = conflict_warning(&remote, &settings.machine_id, &book.title);
    if !should_pull(settings, meta.as_ref()) {
        return Ok(PullOutcome::Unchanged(warning));
    }

    {
        let mut conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        *conn = Connection::open_in_memory()?;
    }

    let _ = fs::remove_file(root.join("project.sqlite-wal"));
    let _ = fs::remove_file(root.join("project.sqlite-shm"));
    fs::copy(&remote_sqlite, root.join("project.sqlite"))?;
    copy_file_if_exists(
        &remote.join("project.sqlite-wal"),
        &root.join("project.sqlite-wal"),
    )?;
    copy_file_if_exists(
        &remote.join("project.sqlite-shm"),
        &root.join("project.sqlite-shm"),
    )?;
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
    let remote_updated_at = meta
        .map(|item| item.updated_at)
        .unwrap_or_else(database::now);
    Ok(PullOutcome::Updated {
        warning: warning.or_else(|| {
            Some("Drive klasöründen daha yeni kitap içeriği alındı.".to_string())
        }),
        remote_updated_at,
    })
}

fn pull_google(
    app: &AppHandle,
    state: &AppState,
    settings: &DriveSyncSettings,
) -> Result<PullOutcome, AppError> {
    let root = state.project_root()?;
    let book = {
        let conn = state.db()?;
        database::get_book(&conn)?
    };
    let mut slug = settings.remote_slug.clone();
    if slug.trim().is_empty() {
        slug = folder_slug(&book.title);
    }
    let folder_id = crate::google_drive::ensure_book_folder(app, &slug)?;
    let meta = crate::google_drive::read_text_file(app, &folder_id, "sync-meta.json")?
        .and_then(|raw| serde_json::from_str::<SyncMeta>(&raw).ok());
    let warning = conflict_warning_google(app, &folder_id, &settings.machine_id, &book.title)?;
    if !should_pull(settings, meta.as_ref()) {
        let lock = SyncLock {
            machine_id: settings.machine_id.clone(),
            updated_at: database::now(),
            book_title: book.title.clone(),
            machine_name: hostname(),
        };
        let _ = crate::google_drive::upload_bytes(
            app,
            &folder_id,
            ".kitap-edit.lock",
            "application/json",
            &serde_json::to_vec_pretty(&lock)?,
        );
        return Ok(PullOutcome::Unchanged(warning));
    }
    let Some(sqlite_bytes) = crate::google_drive::download_file_bytes(app, &folder_id, "project.sqlite")? else {
        return Ok(PullOutcome::Unchanged(warning));
    };

    {
        let mut conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        *conn = Connection::open_in_memory()?;
    }
    let _ = fs::remove_file(root.join("project.sqlite-wal"));
    let _ = fs::remove_file(root.join("project.sqlite-shm"));
    fs::write(root.join("project.sqlite"), &sqlite_bytes)?;
    if let Some(project_json) = crate::google_drive::download_file_bytes(app, &folder_id, "project.json")? {
        fs::write(root.join("project.json"), project_json)?;
    }
    if let Some(assets_zip) = crate::google_drive::download_file_bytes(app, &folder_id, "assets.zip")? {
        crate::google_drive::unzip_bytes(&assets_zip, &root.join("assets"))?;
    }

    let new_conn = database::open_project_connection(&root.join("project.sqlite"))?;
    {
        let mut conn = state.db()?;
        *conn = new_conn;
    }
    filesystem::remember_project(app, &root)?;
    let lock = SyncLock {
        machine_id: settings.machine_id.clone(),
        updated_at: database::now(),
        book_title: book.title.clone(),
        machine_name: hostname(),
    };
    let _ = crate::google_drive::upload_bytes(
        app,
        &folder_id,
        ".kitap-edit.lock",
        "application/json",
        &serde_json::to_vec_pretty(&lock)?,
    );
    let remote_updated_at = meta
        .map(|item| item.updated_at)
        .unwrap_or_else(database::now);
    Ok(PullOutcome::Updated {
        warning: warning.or_else(|| {
            Some("Google Drive’dan daha yeni kitap içeriği alındı.".to_string())
        }),
        remote_updated_at,
    })
}

fn conflict_warning_google(
    app: &AppHandle,
    folder_id: &str,
    machine_id: &str,
    book_title: &str,
) -> Result<Option<String>, AppError> {
    let Some(raw) = crate::google_drive::read_text_file(app, folder_id, ".kitap-edit.lock")? else {
        return Ok(None);
    };
    let Ok(lock) = serde_json::from_str::<SyncLock>(&raw) else {
        return Ok(None);
    };
    if lock.machine_id == machine_id {
        return Ok(None);
    }
    let who = if lock.machine_name.trim().is_empty() {
        "başka bir bilgisayar".to_string()
    } else {
        format!("“{}”", lock.machine_name.trim())
    };
    let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&lock.updated_at) else {
        return Ok(Some(format!(
            "Dikkat: “{book_title}” {who} üzerinde açık görünüyor. Drive senkronunda son yazan kazanır; aynı anda iki PC’de düzenlemeyin."
        )));
    };
    let age = chrono::Utc::now().signed_duration_since(updated.with_timezone(&chrono::Utc));
    if age.to_std().unwrap_or(Duration::from_secs(0)) < Duration::from_secs(LOCK_STALE_SECS) {
        Ok(Some(format!(
            "Dikkat: “{book_title}” şu an {who} bilgisayarında açık. Son kayıt Drive’a yazılır; bu PC’de devam ederseniz diğerindeki değişiklikler kaybolabilir."
        )))
    } else {
        Ok(None)
    }
}

fn should_pull(settings: &DriveSyncSettings, meta: Option<&SyncMeta>) -> bool {
    let Some(meta) = meta else {
        return false;
    };
    if meta.machine_id == settings.machine_id {
        return false;
    }
    match &settings.last_applied_remote_at {
        Some(applied) => meta.updated_at > *applied,
        None => true,
    }
}

fn resolve_remote_dir(settings: &DriveSyncSettings, book_title: &str) -> PathBuf {
    let base = PathBuf::from(settings.folder_path.trim());
    let mut names = Vec::new();
    if !settings.remote_slug.trim().is_empty() {
        names.push(settings.remote_slug.trim().to_string());
    }
    let slug = folder_slug(book_title);
    if !names.iter().any(|name| name == &slug) {
        names.push(slug.clone());
    }
    for name in &names {
        let dir = base.join(name);
        if dir.join("sync-meta.json").is_file() || dir.join("project.sqlite").is_file() {
            return dir;
        }
    }
    if let Ok(entries) = fs::read_dir(&base) {
        for entry in entries.flatten() {
            let dir = entry.path();
            if !dir.is_dir() {
                continue;
            }
            if let Some(meta) = read_meta(&dir) {
                if meta.book_title == book_title || folder_slug(&meta.book_title) == slug {
                    return dir;
                }
            }
        }
    }
    base.join(names.into_iter().next().unwrap_or(slug))
}

fn read_meta(remote: &Path) -> Option<SyncMeta> {
    let raw = fs::read_to_string(remote.join("sync-meta.json")).ok()?;
    serde_json::from_str(&raw).ok()
}

fn export_sqlite_to_drive(
    conn: &Connection,
    root: &Path,
    dest: &Path,
) -> Result<(), AppError> {
    let tmp = root.join(".drive-project.sqlite");
    let _ = fs::remove_file(&tmp);
    let quoted = tmp.to_string_lossy().replace('\'', "''");
    match conn.execute_batch(&format!("VACUUM INTO '{quoted}';")) {
        Ok(()) => {
            copy_replace(&tmp, dest)?;
            let _ = fs::remove_file(&tmp);
            let _ = fs::remove_file(sidecar(dest, "-wal"));
            let _ = fs::remove_file(sidecar(dest, "-shm"));
            Ok(())
        }
        Err(err) => {
            eprintln!("[kitap-studiosu] VACUUM INTO başarısız, WAL kopyalanacak: {err}");
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(FULL);");
            copy_file_if_exists(&root.join("project.sqlite"), dest)?;
            copy_file_if_exists(&root.join("project.sqlite-wal"), &sidecar(dest, "-wal"))?;
            copy_file_if_exists(&root.join("project.sqlite-shm"), &sidecar(dest, "-shm"))?;
            let _ = fs::remove_file(&tmp);
            Ok(())
        }
    }
}

fn sidecar(sqlite: &Path, suffix: &str) -> PathBuf {
    let mut name = sqlite
        .file_name()
        .map(|value| value.to_os_string())
        .unwrap_or_else(|| "project.sqlite".into());
    name.push(suffix);
    sqlite.with_file_name(name)
}

fn copy_replace(from: &Path, to: &Path) -> Result<(), AppError> {
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
    }
    let staging = sidecar(to, ".tmp");
    fs::copy(from, &staging)?;
    if let Err(err) = fs::rename(&staging, to) {
        fs::copy(&staging, to)?;
        let _ = fs::remove_file(&staging);
        let _ = err;
    }
    Ok(())
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
    let who = if lock.machine_name.trim().is_empty() {
        "başka bir bilgisayar".to_string()
    } else {
        format!("“{}”", lock.machine_name.trim())
    };
    let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&lock.updated_at) else {
        return Some(format!(
            "Dikkat: “{book_title}” {who} üzerinde açık görünüyor. Drive senkronunda son yazan kazanır; aynı anda iki PC’de düzenlemeyin."
        ));
    };
    let age = chrono::Utc::now().signed_duration_since(updated.with_timezone(&chrono::Utc));
    if age.to_std().unwrap_or(Duration::from_secs(0)) < Duration::from_secs(LOCK_STALE_SECS) {
        Some(format!(
            "Dikkat: “{book_title}” şu an {who} bilgisayarında açık. Son kayıt Drive’a yazılır; bu PC’de devam ederseniz diğerindeki değişiklikler kaybolabilir."
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
        machine_name: hostname(),
    };
    fs::write(
        remote.join(".kitap-edit.lock"),
        serde_json::to_vec_pretty(&lock)?,
    )?;
    Ok(())
}

fn hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "bilgisayar".to_string())
}

fn load_settings(app: &AppHandle) -> Result<DriveSyncSettings, AppError> {
    let path = filesystem::app_state_file_path(app)?;
    let mut enabled = false;
    let mut mode = String::from("google");
    let mut folder_path = String::new();
    let mut machine_id = String::new();
    let mut last_push_at = None;
    let mut last_pull_at = None;
    let mut last_applied_remote_at = None;
    let mut remote_slug = String::new();
    let mut warning = None;
    if path.exists() {
        let raw = fs::read_to_string(&path)?;
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
            enabled = value
                .get("driveSyncEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            mode = value
                .get("driveSyncMode")
                .and_then(|v| v.as_str())
                .unwrap_or("google")
                .to_string();
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
            last_applied_remote_at = value
                .get("driveLastAppliedRemoteAt")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            remote_slug = value
                .get("driveRemoteSlug")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            warning = value
                .get("driveWarning")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            if mode != "google" && mode != "folder" {
                mode = if folder_path.trim().is_empty() {
                    "google".into()
                } else {
                    "folder".into()
                };
            }
        }
    }
    let settings = DriveSyncSettings {
        enabled,
        mode,
        folder_path,
        machine_id: if machine_id.trim().is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            machine_id
        },
        last_push_at,
        last_pull_at,
        last_applied_remote_at,
        remote_slug,
        warning,
        google_email: String::new(),
        google_connected: false,
        client_configured: false,
    };
    if settings.machine_id != machine_id_from_disk(app).unwrap_or_default() {
        save_settings(app, &settings)?;
    }
    Ok(settings)
}

fn machine_id_from_disk(app: &AppHandle) -> Option<String> {
    let path = filesystem::app_state_file_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value
        .get("machineId")
        .and_then(|v| v.as_str())
        .map(str::to_string)
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
        "driveSyncMode".into(),
        serde_json::Value::String(settings.mode.clone()),
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
        "driveLastAppliedRemoteAt".into(),
        match &settings.last_applied_remote_at {
            Some(v) => serde_json::Value::String(v.clone()),
            None => serde_json::Value::Null,
        },
    );
    obj.insert(
        "driveRemoteSlug".into(),
        serde_json::Value::String(settings.remote_slug.clone()),
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
