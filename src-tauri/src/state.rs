use crate::error::AppError;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub project_root: Mutex<PathBuf>,
}

impl AppState {
    pub fn db(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.db
            .lock()
            .map_err(|_| AppError::user("Veritabanı meşgul.", "mutex poisoned"))
    }

    pub fn project_root(&self) -> Result<PathBuf, AppError> {
        self.project_root
            .lock()
            .map(|guard| guard.clone())
            .map_err(|_| AppError::user("Proje yolu meşgul.", "mutex poisoned"))
    }

    pub fn set_project_root(&self, path: PathBuf) -> Result<(), AppError> {
        let mut guard = self
            .project_root
            .lock()
            .map_err(|_| AppError::user("Proje yolu meşgul.", "mutex poisoned"))?;
        *guard = path;
        Ok(())
    }
}
