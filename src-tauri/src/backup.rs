use crate::database;
use crate::error::AppError;
use crate::state::AppState;
use rusqlite::Connection;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

#[tauri::command]
pub fn create_backup(state: tauri::State<AppState>) -> Result<String, AppError> {
    {
        let conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    }
    let root = state.project_root()?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let backup_name = format!("yedek-{stamp}.zip");
    let backup_path = root.join("backups").join(&backup_name);
    std::fs::create_dir_all(root.join("backups"))?;

    let file = File::create(&backup_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    add_file_if_exists(&mut zip, &root, Path::new("project.sqlite"), options)?;
    add_file_if_exists(&mut zip, &root, Path::new("project.json"), options)?;
    add_dir(&mut zip, &root, Path::new("assets"), options)?;

    zip.finish()?;
    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_backup(state: tauri::State<AppState>, zip_path: String) -> Result<(), AppError> {
    let zip_path = PathBuf::from(zip_path.trim());
    if !zip_path.is_file() {
        return Err(AppError::user(
            "Yedek dosyası bulunamadı.",
            zip_path.display().to_string(),
        ));
    }
    let root = state.project_root()?;
    let tmp = root.join("backups").join(format!(
        "restore-{}",
        chrono::Utc::now().format("%Y%m%d-%H%M%S")
    ));
    fs::create_dir_all(&tmp)?;
    let extracted = extract_backup_zip(&zip_path, &tmp);
    if let Err(err) = extracted {
        let _ = fs::remove_dir_all(&tmp);
        return Err(err);
    }
    let sqlite_src = tmp.join("project.sqlite");
    if !sqlite_src.is_file() {
        let _ = fs::remove_dir_all(&tmp);
        return Err(AppError::user(
            "ZIP içinde project.sqlite yok. Bu bir Kitap Stüdyosu yedeği değil.",
            "missing sqlite",
        ));
    }

    {
        let mut conn = state.db()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        *conn = Connection::open_in_memory()?;
    }

    let db_path = root.join("project.sqlite");
    let _ = fs::remove_file(root.join("project.sqlite-wal"));
    let _ = fs::remove_file(root.join("project.sqlite-shm"));
    fs::copy(&sqlite_src, &db_path)?;

    if tmp.join("assets").is_dir() {
        let dest_assets = root.join("assets");
        if dest_assets.exists() {
            fs::remove_dir_all(&dest_assets)?;
        }
        copy_dir_all(&tmp.join("assets"), &dest_assets)?;
    }
    if tmp.join("project.json").is_file() {
        fs::copy(tmp.join("project.json"), root.join("project.json"))?;
    }

    {
        let mut conn = state.db()?;
        *conn = Connection::open(&db_path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "busy_timeout", "5000")?;
        database::schema::migrate(&conn)?;
    }

    let _ = fs::remove_dir_all(&tmp);
    Ok(())
}

fn extract_backup_zip(zip_path: &Path, dest: &Path) -> Result<(), AppError> {
    let file = File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file).map_err(|err| {
        AppError::user("ZIP yedek açılamadı.", err.to_string())
    })?;
    for i in 0..archive.len() {
        let mut item = archive.by_index(i).map_err(|err| {
            AppError::user("ZIP içeriği okunamadı.", err.to_string())
        })?;
        if item.is_dir() {
            continue;
        }
        let Some(enclosed) = item.enclosed_name() else {
            continue;
        };
        let relative = enclosed.to_path_buf();
        let rel_str = relative.to_string_lossy().replace('\\', "/");
        let allowed = rel_str == "project.sqlite"
            || rel_str == "project.json"
            || rel_str.starts_with("assets/");
        if !allowed {
            continue;
        }
        let out = dest.join(&relative);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut outfile = File::create(&out)?;
        std::io::copy(&mut item, &mut outfile)?;
    }
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), AppError> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let dest = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_all(&entry.path(), &dest)?;
        } else if entry.path().is_file() {
            fs::copy(entry.path(), dest)?;
        }
    }
    Ok(())
}

fn add_file_if_exists(
    zip: &mut zip::ZipWriter<File>,
    root: &Path,
    relative: &Path,
    options: SimpleFileOptions,
) -> Result<(), AppError> {
    let full = root.join(relative);
    if !full.is_file() {
        return Ok(());
    }
    zip.start_file(relative.to_string_lossy().replace('\\', "/"), options)?;
    let mut file = File::open(full)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    zip.write_all(&buffer)?;
    Ok(())
}

fn add_dir(
    zip: &mut zip::ZipWriter<File>,
    root: &Path,
    relative: &Path,
    options: SimpleFileOptions,
) -> Result<(), AppError> {
    let full = root.join(relative);
    if !full.is_dir() {
        return Ok(());
    }
    for entry in std::fs::read_dir(full)? {
        let entry = entry?;
        let name = entry.file_name();
        let child_relative = relative.join(&name);
        if entry.path().is_dir() {
            add_dir(zip, root, &child_relative, options)?;
        } else if entry.path().is_file() {
            add_file_if_exists(zip, root, &child_relative, options)?;
        }
    }
    Ok(())
}
