use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub author: Option<String>,
    pub description: Option<String>,
    pub language: String,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub cover_asset_id: Option<String>,
    #[serde(default = "default_page_color")]
    pub page_color: String,
    #[serde(default = "default_ink_color")]
    pub ink_color: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default)]
    pub page_numbers: bool,
    #[serde(default = "default_page_number_align")]
    pub page_number_align: String,
    #[serde(default = "default_page_number_start")]
    pub page_number_start: i64,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    pub created_at: String,
    pub updated_at: String,
}

fn default_page_color() -> String {
    "#ffffff".to_string()
}

fn default_ink_color() -> String {
    "#152033".to_string()
}

fn default_page_number_align() -> String {
    "center".to_string()
}

fn default_page_number_start() -> i64 {
    1
}

fn default_line_height() -> f64 {
    1.15
}

fn default_font_family() -> String {
    "Segoe UI".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub id: String,
    pub book_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub number: Option<String>,
    pub order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentBlock {
    pub id: String,
    pub chapter_id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub order: i64,
    pub data: serde_json::Value,
    pub style: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub project_id: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub filename: String,
    pub relative_path: String,
    pub mime_type: String,
    pub size: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookVersion {
    pub id: String,
    pub book_id: String,
    pub version: String,
    pub changelog: Option<String>,
    pub created_at: String,
    pub has_snapshot: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub id: String,
    pub project_id: String,
    pub autosave_ms: i64,
    pub last_opened_chapter_id: Option<String>,
    pub theme: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookStats {
    pub chapter_count: i64,
    pub word_count: i64,
    pub character_count: i64,
    pub image_count: i64,
    pub video_count: i64,
    pub qr_count: i64,
    pub file_count: i64,
    pub estimated_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub project: Project,
    pub book: Book,
    pub chapters: Vec<Chapter>,
    pub settings: ProjectSettings,
    pub versions: Vec<BookVersion>,
    pub selected_chapter_id: Option<String>,
    pub selected_blocks: Vec<ContentBlock>,
    pub stats: BookStats,
    pub is_demo: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookPayload {
    pub title: String,
    pub subtitle: Option<String>,
    pub author: Option<String>,
    pub description: Option<String>,
    pub language: String,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub cover_asset_id: Option<String>,
    pub page_color: Option<String>,
    pub ink_color: Option<String>,
    pub font_family: Option<String>,
    pub page_numbers: Option<bool>,
    pub page_number_align: Option<String>,
    pub page_number_start: Option<i64>,
    pub line_height: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChapterPayload {
    pub book_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub template_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlockPayload {
    pub chapter_id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub after_block_id: Option<String>,
    pub data: Option<serde_json::Value>,
    pub style: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBlockPayload {
    pub id: String,
    pub data: serde_json::Value,
    pub style: serde_json::Value,
    #[serde(rename = "type")]
    pub block_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderBlocksPayload {
    pub chapter_id: String,
    pub ordered_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionPayload {
    pub book_id: String,
    pub version: String,
    pub changelog: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAssetPayload {
    pub source_path: String,
    pub asset_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAssetBytesPayload {
    pub filename: String,
    pub bytes: Vec<u8>,
    pub asset_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub project_id: String,
    pub chapter_id: Option<String>,
    pub title: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertNotePayload {
    pub id: Option<String>,
    pub chapter_id: Option<String>,
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterTemplate {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub payload: serde_json::Value,
    pub created_at: String,
    pub builtin: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTemplatePayload {
    pub name: String,
    pub description: Option<String>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyTemplatePayload {
    pub chapter_id: String,
    pub template_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderChaptersPayload {
    pub parent_id: Option<String>,
    pub ordered_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryBook {
    pub title: String,
    pub path: String,
    pub updated_at: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StylePreset {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub block_type: String,
    pub style: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStylePresetPayload {
    pub name: String,
    pub block_type: String,
    pub style: serde_json::Value,
}
