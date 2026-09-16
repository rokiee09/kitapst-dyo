use rusqlite;
use serde::Serialize;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{message}")]
    User {
        message: String,
        details: String,
    },
}

impl AppError {
    pub fn user(message: impl Into<String>, details: impl Into<String>) -> Self {
        let details = details.into();
        eprintln!("[kitap-studiosu] {details}");
        Self::User {
            message: message.into(),
            details,
        }
    }

    pub fn from_db(err: rusqlite::Error) -> Self {
        Self::user(
            "Veritabanı işlemi sırasında bir hata oluştu.",
            format!("sqlite: {err}"),
        )
    }

    pub fn from_fs(err: io::Error) -> Self {
        Self::user(
            "Dosya sistemi işlemi sırasında bir hata oluştu.",
            format!("fs: {err}"),
        )
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        Self::from_db(value)
    }
}

impl From<io::Error> for AppError {
    fn from(value: io::Error) -> Self {
        Self::from_fs(value)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::user(
            "Veri işlenirken bir hata oluştu.",
            format!("json: {value}"),
        )
    }
}

impl From<uuid::Error> for AppError {
    fn from(value: uuid::Error) -> Self {
        Self::user("Kimlik oluşturulamadı.", format!("uuid: {value}"))
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(value: zip::result::ZipError) -> Self {
        Self::user(
            "Yedek dosyası oluşturulamadı.",
            format!("zip: {value}"),
        )
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
