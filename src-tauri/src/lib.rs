mod assets;
mod backup;
mod commands;
mod database;
mod error;
mod export;
mod extras;
mod filesystem;
mod library;
mod models;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| match database::initialize(app.handle()) {
            Ok(app_state) => {
                app.manage(app_state);
                Ok(())
            }
            Err(err) => {
                eprintln!("[kitap-studiosu] başlatma hatası: {err:?}");
                Err(err.into())
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_workspace,
            commands::update_book,
            commands::create_chapter,
            commands::rename_chapter,
            commands::delete_chapter,
            commands::duplicate_chapter,
            commands::move_chapter,
            commands::reorder_chapters,
            commands::set_active_chapter,
            commands::list_blocks,
            commands::create_block,
            commands::update_block,
            commands::delete_block,
            commands::duplicate_block,
            commands::reorder_blocks,
            commands::get_stats,
            commands::create_book_version,
            commands::list_book_versions,
            backup::create_backup,
            backup::restore_backup,
            assets::import_asset,
            assets::list_assets,
            assets::read_asset_data_url,
            assets::resolve_asset_path,
            assets::delete_asset,
            assets::open_asset,
            assets::read_import_bytes,
            export::export_book,
            extras::open_folder,
            extras::list_notes,
            extras::upsert_note,
            extras::delete_note,
            extras::list_templates,
            extras::save_template,
            extras::apply_template,
            extras::delete_template,
            extras::list_style_presets,
            extras::save_style_preset,
            extras::delete_style_preset,
            extras::restore_book_version,
            library::list_library_books,
            library::create_library_book,
            library::open_library_book,
        ])
        .run(tauri::generate_context!())
        .expect("Kitap Stüdyosu başlatılamadı.");
}
