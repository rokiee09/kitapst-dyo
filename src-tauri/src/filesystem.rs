use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const PROJECTS_FOLDER: &str = "KitapStudioProjects";
const DEFAULT_PROJECT_SLUG: &str = "TaktikEgitim";
const APP_STATE_FILE: &str = "app-state.json";

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppStateFile {
    last_project_path: Option<String>,
}

pub fn resolve_or_create_project(app: &AppHandle) -> Result<PathBuf, AppError> {
    let app_state_path = app_state_file_path(app)?;
    if let Some(existing) = read_last_project(&app_state_path)? {
        if existing.join("project.sqlite").is_file() {
            ensure_project_layout(&existing)?;
            return Ok(existing);
        }
    }

    let root = create_default_project_root(app)?;
    write_last_project(&app_state_path, &root)?;
    write_project_metadata(&root)?;
    Ok(root)
}

fn create_default_project_root(app: &AppHandle) -> Result<PathBuf, AppError> {
    let mut bases = Vec::new();
    push_ok(&mut bases, app.path().document_dir().ok());
    push_ok(&mut bases, app.path().home_dir().ok());
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        bases.push(PathBuf::from(local));
    }
    push_ok(&mut bases, app.path().app_local_data_dir().ok());
    push_ok(&mut bases, app.path().app_data_dir().ok());
    bases.push(std::env::temp_dir());

    let mut last_error = String::from("uygun klasör bulunamadı");
    for base in bases {
        let root = base.join(PROJECTS_FOLDER).join(DEFAULT_PROJECT_SLUG);
        eprintln!("[kitap-studiosu] proje klasörü deneniyor: {}", root.display());
        match ensure_project_layout(&root) {
            Ok(()) => return Ok(root),
            Err(err) => {
                last_error = format!("{} -> {err}", root.display());
                eprintln!("[kitap-studiosu] {last_error}");
            }
        }
    }

    Err(AppError::user(
        "Proje klasörü oluşturulamadı.",
        last_error,
    ))
}

pub fn ensure_project_layout(root: &Path) -> Result<(), AppError> {
    let folders = [
        root.join("assets").join("images"),
        root.join("assets").join("videos"),
        root.join("assets").join("files"),
        root.join("exports").join("epub"),
        root.join("exports").join("pdf"),
        root.join("exports").join("html"),
        root.join("backups"),
    ];
    for folder in folders {
        create_dir_logged(&folder)?;
    }
    Ok(())
}

pub fn write_project_metadata(root: &Path) -> Result<(), AppError> {
    let metadata_path = root.join("project.json");
    if metadata_path.exists() {
        return Ok(());
    }
    let payload = serde_json::json!({
        "schemaVersion": 1,
        "name": "TAKTİK EĞİTİM",
        "app": "kitap-studiosu"
    });
    fs::write(&metadata_path, serde_json::to_vec_pretty(&payload)?).map_err(|err| {
        AppError::user(
            "Proje bilgisi yazılamadı.",
            format!("{}: {err}", metadata_path.display()),
        )
    })?;
    Ok(())
}

pub fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|ch| *ch != '\0' && !r#"<>:"/\|?*"#.contains(*ch))
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if cleaned.is_empty() {
        "dosya".to_string()
    } else {
        cleaned
    }
}

pub fn safe_child_path(base: &Path, relative: &str) -> Result<PathBuf, AppError> {
    let sanitized = relative.replace('\\', "/");
    if sanitized.split('/').any(|segment| {
        segment.is_empty() || segment == "." || segment == ".." || segment.contains(':')
    }) {
        return Err(AppError::user(
            "Geçersiz dosya yolu.",
            format!("path traversal attempt: {relative}"),
        ));
    }
    Ok(base.join(sanitized))
}

fn app_state_file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let mut dirs = Vec::new();
    push_ok(&mut dirs, app.path().app_local_data_dir().ok());
    push_ok(&mut dirs, app.path().app_data_dir().ok());
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        dirs.push(PathBuf::from(local).join("KitapStudiosu"));
    }
    push_ok(
        &mut dirs,
        app.path()
            .home_dir()
            .ok()
            .map(|home| home.join(".kitap-studiosu")),
    );
    dirs.push(std::env::temp_dir().join("KitapStudiosu"));

    let mut last_error = String::from("uygulama veri klasörü bulunamadı");
    for dir in dirs {
        eprintln!("[kitap-studiosu] veri klasörü deneniyor: {}", dir.display());
        match create_dir_logged(&dir) {
            Ok(()) => return Ok(dir.join(APP_STATE_FILE)),
            Err(err) => {
                last_error = format!("{} -> {err}", dir.display());
                eprintln!("[kitap-studiosu] {last_error}");
            }
        }
    }

    Err(AppError::user(
        "Uygulama veri klasörü oluşturulamadı.",
        last_error,
    ))
}

fn read_last_project(path: &Path) -> Result<Option<PathBuf>, AppError> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|err| {
        AppError::user(
            "Kayıtlı proje yolu okunamadı.",
            format!("{}: {err}", path.display()),
        )
    })?;
    let parsed: AppStateFile = serde_json::from_str(&raw)?;
    Ok(parsed.last_project_path.map(PathBuf::from))
}

pub fn remember_project(app: &AppHandle, project_root: &Path) -> Result<(), AppError> {
    let app_state_path = app_state_file_path(app)?;
    write_last_project(&app_state_path, project_root)
}

pub fn write_project_metadata_named(root: &Path, name: &str) -> Result<(), AppError> {
    let metadata_path = root.join("project.json");
    let payload = serde_json::json!({
        "schemaVersion": 1,
        "name": name,
        "app": "kitap-studiosu"
    });
    fs::write(&metadata_path, serde_json::to_vec_pretty(&payload)?).map_err(|err| {
        AppError::user(
            "Proje bilgisi yazılamadı.",
            format!("{}: {err}", metadata_path.display()),
        )
    })?;
    Ok(())
}

pub fn library_parent_dirs(app: &AppHandle, current: &Path) -> Vec<PathBuf> {
    let mut parents = Vec::new();
    if let Some(parent) = current.parent() {
        push_ok(&mut parents, Some(parent.to_path_buf()));
    }
    push_ok(
        &mut parents,
        app.path().document_dir().ok().map(|dir| dir.join(PROJECTS_FOLDER)),
    );
    push_ok(
        &mut parents,
        app.path().home_dir().ok().map(|dir| dir.join(PROJECTS_FOLDER)),
    );
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        parents.push(PathBuf::from(local).join(PROJECTS_FOLDER));
    }
    push_ok(
        &mut parents,
        app.path()
            .app_local_data_dir()
            .ok()
            .map(|dir| dir.join(PROJECTS_FOLDER)),
    );
    parents
}

fn write_last_project(path: &Path, project_root: &Path) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        create_dir_logged(parent)?;
    }
    let payload = AppStateFile {
        last_project_path: Some(project_root.to_string_lossy().to_string()),
    };
    fs::write(path, serde_json::to_vec_pretty(&payload)?).map_err(|err| {
        AppError::user(
            "Uygulama durumu kaydedilemedi.",
            format!("{}: {err}", path.display()),
        )
    })?;
    Ok(())
}

fn create_dir_logged(path: &Path) -> Result<(), AppError> {
    fs::create_dir_all(path).map_err(|err| {
        AppError::user(
            "Klasör oluşturulamadı.",
            format!("{}: {err}", path.display()),
        )
    })
}

fn push_ok(target: &mut Vec<PathBuf>, value: Option<PathBuf>) {
    if let Some(path) = value {
        if !target.contains(&path) {
            target.push(path);
        }
    }
}
