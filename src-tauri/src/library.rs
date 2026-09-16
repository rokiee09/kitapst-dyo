use crate::commands;
use crate::database;
use crate::error::AppError;
use crate::filesystem;
use crate::models::{LibraryBook, WorkspaceSnapshot};
use crate::state::AppState;
use rusqlite::{Connection, OpenFlags};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[tauri::command]
pub fn list_library_books(
    state: tauri::State<AppState>,
    app: AppHandle,
) -> Result<Vec<LibraryBook>, AppError> {
    let current = state.project_root()?;
    let current_key = normalize_key(&current);
    let mut seen = HashSet::new();
    let mut books = Vec::new();
    for parent in filesystem::library_parent_dirs(&app, &current) {
        if !parent.is_dir() {
            continue;
        }
        let Ok(entries) = std::fs::read_dir(&parent) else {
            continue;
        };
        for entry in entries.flatten() {
            let root = entry.path();
            let sqlite = root.join("project.sqlite");
            if !sqlite.is_file() {
                continue;
            }
            let key = normalize_key(&root);
            if !seen.insert(key.clone()) {
                continue;
            }
            let (title, updated_at) = read_book_meta(&sqlite);
            books.push(LibraryBook {
                title,
                path: root.to_string_lossy().to_string(),
                updated_at,
                is_current: key == current_key,
            });
        }
    }
    books.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(books)
}

#[tauri::command]
pub fn create_library_book(
    state: tauri::State<AppState>,
    app: AppHandle,
    title: String,
) -> Result<WorkspaceSnapshot, AppError> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::user("Kitap adı boş olamaz.", "empty book title"));
    }
    let current = state.project_root()?;
    let parent = current
        .parent()
        .map(Path::to_path_buf)
        .or_else(|| filesystem::library_parent_dirs(&app, &current).into_iter().next())
        .ok_or_else(|| AppError::user("Kitaplık klasörü bulunamadı.", "no library parent"))?;
    std::fs::create_dir_all(&parent)?;
    let root = unique_dir(&parent, &folder_slug(&title));
    filesystem::ensure_project_layout(&root)?;
    filesystem::write_project_metadata_named(&root, &title)?;
    switch_project(&state, &app, root, Some(&title))?;
    commands::workspace_snapshot(&state)
}

#[tauri::command]
pub fn open_library_book(
    state: tauri::State<AppState>,
    app: AppHandle,
    path: String,
) -> Result<WorkspaceSnapshot, AppError> {
    let root = PathBuf::from(path.trim());
    let sqlite = root.join("project.sqlite");
    if !sqlite.is_file() {
        return Err(AppError::user(
            "Bu klasörde kitap bulunamadı.",
            root.display().to_string(),
        ));
    }
    switch_project(&state, &app, root, None)?;
    commands::workspace_snapshot(&state)
}

fn switch_project(
    state: &AppState,
    app: &AppHandle,
    root: PathBuf,
    title: Option<&str>,
) -> Result<(), AppError> {
    filesystem::ensure_project_layout(&root)?;
    let db_path = root.join("project.sqlite");
    {
        let mut conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        *conn = Connection::open_in_memory()?;
    }
    let new_conn = database::open_project_connection(&db_path)?;
    if let Some(name) = title {
        database::seed::seed_named_book(&new_conn, &root, name)?;
    } else {
        database::seed::ensure_default_content(&new_conn, &root)?;
    }
    filesystem::remember_project(app, &root)?;
    {
        let mut conn = state.db()?;
        *conn = new_conn;
    }
    state.set_project_root(root)?;
    Ok(())
}

fn read_book_meta(sqlite: &Path) -> (String, String) {
    let Ok(conn) = Connection::open_with_flags(sqlite, OpenFlags::SQLITE_OPEN_READ_ONLY) else {
        return (
            sqlite
                .parent()
                .and_then(|path| path.file_name())
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| "Kitap".to_string()),
            String::new(),
        );
    };
    let title = conn
        .query_row("SELECT title FROM book LIMIT 1", [], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "Kitap".to_string());
    let updated = conn
        .query_row("SELECT updated_at FROM book LIMIT 1", [], |row| row.get::<_, String>(0))
        .unwrap_or_default();
    (title, updated)
}

fn unique_dir(parent: &Path, slug: &str) -> PathBuf {
    let mut path = parent.join(slug);
    let mut index = 2u32;
    while path.exists() {
        path = parent.join(format!("{slug}-{index}"));
        index += 1;
    }
    path
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

fn normalize_key(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_ascii_lowercase()
}
