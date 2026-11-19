//! Google Drive API senkronu — yalnızca `drive.file` izni.
//! Uygulama kendi oluşturduğu “Kitap Stüdyosu” klasörüne yazar; elle yapıştırılan klasör linki kullanılmaz.

use crate::error::AppError;
use crate::filesystem;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const SCOPE: &str = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const DRIVE_FILES: &str = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const ROOT_FOLDER_NAME: &str = "Kitap Stüdyosu";
const TOKEN_FILE: &str = "google-drive-tokens.json";
const CLIENT_FILE: &str = "google-oauth-client.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleClientConfig {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GoogleTokenStore {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
    pub email: String,
    pub root_folder_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAccountInfo {
    pub connected: bool,
    pub email: String,
    pub root_folder_id: String,
    pub client_configured: bool,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: i64,
}

#[derive(Debug, Deserialize)]
struct DriveFileList {
    #[serde(default)]
    files: Vec<DriveFile>,
}

#[derive(Debug, Deserialize, Clone)]
struct DriveFile {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default, rename = "modifiedTime")]
    modified_time: String,
}

pub fn account_info(app: &AppHandle) -> Result<GoogleAccountInfo, AppError> {
    let client_ok = load_client_config(app).is_ok();
    let tokens = load_tokens(app).unwrap_or_default();
    Ok(GoogleAccountInfo {
        connected: !tokens.refresh_token.is_empty() || !tokens.access_token.is_empty(),
        email: tokens.email,
        root_folder_id: tokens.root_folder_id,
        client_configured: client_ok,
    })
}

pub fn save_client_config(app: &AppHandle, config: GoogleClientConfig) -> Result<(), AppError> {
    let id = config.client_id.trim().to_string();
    let secret = config.client_secret.trim().to_string();
    if id.is_empty() || secret.is_empty() {
        return Err(AppError::user(
            "Google Client ID ve Client Secret gerekli.",
            "empty oauth client",
        ));
    }
    let path = client_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        &path,
        serde_json::to_vec_pretty(&GoogleClientConfig {
            client_id: id,
            client_secret: secret,
        })?,
    )?;
    Ok(())
}

pub fn login(app: &AppHandle) -> Result<GoogleAccountInfo, AppError> {
    let client = load_client_config(app)?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|err| {
        AppError::user(
            "Yerel OAuth dinleyicisi açılamadı.",
            format!("bind: {err}"),
        )
    })?;
    listener.set_nonblocking(false).ok();
    let port = listener
        .local_addr()
        .map_err(|err| AppError::user("OAuth portu okunamadı.", err.to_string()))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth2callback");
    let verifier = pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    let state = uuid::Uuid::new_v4().to_string();
    let auth = format!(
        "{AUTH_URL}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent",
        urlencoding::encode(&client.client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(SCOPE),
        urlencoding::encode(&state),
        urlencoding::encode(&challenge),
    );

    let (tx, rx) = mpsc::channel::<Result<(String, String), String>>();
    std::thread::spawn(move || {
        let _ = tx.send(wait_for_oauth_code(&listener, &state));
    });

    app.opener()
        .open_url(auth, None::<&str>)
        .map_err(|err| AppError::user("Tarayıcı açılamadı.", err.to_string()))?;

    let (code, _) = rx
        .recv_timeout(Duration::from_secs(180))
        .map_err(|_| {
            AppError::user(
                "Google girişi zaman aşımına uğradı. Tekrar deneyin.",
                "oauth timeout",
            )
        })?
        .map_err(|err| AppError::user("Google girişi tamamlanamadı.", err))?;

    let token = exchange_code(&client, &code, &redirect_uri, &verifier)?;
    let email = fetch_email(&token.access_token).unwrap_or_default();
    let mut store = GoogleTokenStore {
        access_token: token.access_token,
        refresh_token: token
            .refresh_token
            .unwrap_or_else(|| load_tokens(app).map(|t| t.refresh_token).unwrap_or_default()),
        expires_at: chrono::Utc::now().timestamp() + token.expires_in.max(60) - 30,
        email,
        root_folder_id: String::new(),
    };
    if store.refresh_token.is_empty() {
        return Err(AppError::user(
            "Google yenileme anahtarı alınamadı. Testing modunda test kullanıcısı ekli olduğundan ve uygulamaya yeniden izin verdiğinizden emin olun.",
            "missing refresh_token",
        ));
    }
    let access = ensure_access_token(app, &mut store)?;
    let root_id = ensure_named_folder(&access, ROOT_FOLDER_NAME, None)?;
    store.root_folder_id = root_id;
    save_tokens(app, &store)?;
    account_info(app)
}

pub fn logout(app: &AppHandle) -> Result<GoogleAccountInfo, AppError> {
    let path = token_path(app)?;
    let _ = fs::remove_file(path);
    account_info(app)
}

pub fn ensure_book_folder(app: &AppHandle, book_slug: &str) -> Result<String, AppError> {
    let mut store = load_tokens(app)?;
    let access = ensure_access_token(app, &mut store)?;
    if store.root_folder_id.trim().is_empty() {
        store.root_folder_id = ensure_named_folder(&access, ROOT_FOLDER_NAME, None)?;
        save_tokens(app, &store)?;
    }
    ensure_named_folder(&access, book_slug, Some(&store.root_folder_id))
}

pub fn upload_bytes(
    app: &AppHandle,
    parent_id: &str,
    file_name: &str,
    mime: &str,
    bytes: &[u8],
) -> Result<String, AppError> {
    let mut store = load_tokens(app)?;
    let access = ensure_access_token(app, &mut store)?;
    if let Some(existing) = find_child(&access, parent_id, file_name)? {
        update_file_content(&access, &existing.id, mime, bytes)?;
        Ok(existing.id)
    } else {
        create_file_with_content(&access, parent_id, file_name, mime, bytes)
    }
}

pub fn download_file_bytes(app: &AppHandle, parent_id: &str, file_name: &str) -> Result<Option<Vec<u8>>, AppError> {
    let mut store = load_tokens(app)?;
    let access = ensure_access_token(app, &mut store)?;
    let Some(file) = find_child(&access, parent_id, file_name)? else {
        return Ok(None);
    };
    let client = http_client()?;
    let response = client
        .get(format!("{DRIVE_FILES}/{}?alt=media", file.id))
        .bearer_auth(&access)
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        return Err(AppError::user(
            "Drive dosyası indirilemedi.",
            format!("download {} status={}", file_name, response.status()),
        ));
    }
    Ok(Some(response.bytes().map_err(map_http)?.to_vec()))
}

pub fn read_text_file(app: &AppHandle, parent_id: &str, file_name: &str) -> Result<Option<String>, AppError> {
    Ok(download_file_bytes(app, parent_id, file_name)?
        .map(|bytes| String::from_utf8_lossy(&bytes).to_string()))
}

pub fn file_modified_time(app: &AppHandle, parent_id: &str, file_name: &str) -> Result<Option<String>, AppError> {
    let mut store = load_tokens(app)?;
    let access = ensure_access_token(app, &mut store)?;
    Ok(find_child(&access, parent_id, file_name)?.map(|f| f.modified_time))
}

pub fn is_connected(app: &AppHandle) -> bool {
    load_tokens(app)
        .map(|t| !t.refresh_token.is_empty())
        .unwrap_or(false)
}

fn wait_for_oauth_code(listener: &TcpListener, expected_state: &str) -> Result<(String, String), String> {
    let deadline = Instant::now() + Duration::from_secs(180);
    let _ = listener.set_nonblocking(true);
    loop {
        if Instant::now() > deadline {
            return Err("zaman aşımı".into());
        }
        let (mut stream, _) = match listener.accept() {
            Ok(pair) => pair,
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
            Err(err) => return Err(err.to_string()),
        };
        let _ = stream.set_nonblocking(false);
        let mut buf = [0u8; 4096];
        let n = stream.read(&mut buf).unwrap_or(0);
        let req = String::from_utf8_lossy(&buf[..n]);
        let line = req.lines().next().unwrap_or("");
        let path = line.split_whitespace().nth(1).unwrap_or("");
        let query = path.split('?').nth(1).unwrap_or("");
        let mut code = None;
        let mut state = None;
        let mut error = None;
        for part in query.split('&') {
            let mut kv = part.splitn(2, '=');
            let key = kv.next().unwrap_or("");
            let value = urlencoding::decode(kv.next().unwrap_or("")).unwrap_or_default();
            match key {
                "code" => code = Some(value.to_string()),
                "state" => state = Some(value.to_string()),
                "error" => error = Some(value.to_string()),
                _ => {}
            }
        }
        let body = if error.is_some() {
            "<html><body><h2>Giriş iptal edildi.</h2><p>Bu pencereyi kapatabilirsiniz.</p></body></html>"
        } else {
            "<html><body><h2>Kitap Stüdyosu bağlandı.</h2><p>Bu pencereyi kapatıp uygulamaya dönebilirsiniz.</p></body></html>"
        };
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = stream.write_all(response.as_bytes());
        if let Some(err) = error {
            return Err(err);
        }
        let code = code.ok_or_else(|| "code yok".to_string())?;
        let state = state.unwrap_or_default();
        if state != expected_state {
            return Err("state uyuşmazlığı".into());
        }
        return Ok((code, state));
    }
}

fn exchange_code(
    client: &GoogleClientConfig,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
) -> Result<TokenResponse, AppError> {
    let http = http_client()?;
    let response = http
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client.client_id.as_str()),
            ("client_secret", client.client_secret.as_str()),
            ("code", code),
            ("code_verifier", verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ])
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        let text = response.text().unwrap_or_default();
        return Err(AppError::user(
            "Google jetonu alınamadı.",
            text,
        ));
    }
    response.json().map_err(map_http)
}

fn ensure_access_token(app: &AppHandle, store: &mut GoogleTokenStore) -> Result<String, AppError> {
    let now = chrono::Utc::now().timestamp();
    if !store.access_token.is_empty() && store.expires_at > now + 20 {
        return Ok(store.access_token.clone());
    }
    if store.refresh_token.is_empty() {
        return Err(AppError::user(
            "Google oturumu yok. Ayarlar’dan Google ile giriş yapın.",
            "no refresh token",
        ));
    }
    let client = load_client_config(app)?;
    let http = http_client()?;
    let response = http
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client.client_id.as_str()),
            ("client_secret", client.client_secret.as_str()),
            ("refresh_token", store.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        let text = response.text().unwrap_or_default();
        return Err(AppError::user(
            "Google oturumu yenilenemedi. Testing modunda 7 gün sonra yeniden giriş gerekir; uygulamayı yayınladıysanız tekrar giriş yapın.",
            text,
        ));
    }
    let token: TokenResponse = response.json().map_err(map_http)?;
    store.access_token = token.access_token;
    store.expires_at = now + token.expires_in.max(60) - 30;
    if let Some(refresh) = token.refresh_token {
        if !refresh.is_empty() {
            store.refresh_token = refresh;
        }
    }
    save_tokens(app, store)?;
    Ok(store.access_token.clone())
}

fn fetch_email(access_token: &str) -> Result<String, AppError> {
    let http = http_client()?;
    let response = http
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        return Ok(String::new());
    }
    let value: serde_json::Value = response.json().map_err(map_http)?;
    Ok(value
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string())
}

fn ensure_named_folder(access: &str, name: &str, parent: Option<&str>) -> Result<String, AppError> {
    if let Some(parent_id) = parent {
        if let Some(existing) = find_child(access, parent_id, name)? {
            return Ok(existing.id);
        }
    } else if let Some(existing) = find_root_folder(access, name)? {
        return Ok(existing.id);
    }
    let mut meta = serde_json::json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    });
    if let Some(parent_id) = parent {
        meta["parents"] = serde_json::json!([parent_id]);
    }
    let http = http_client()?;
    let response = http
        .post(DRIVE_FILES)
        .bearer_auth(access)
        .query(&[("fields", "id,name")])
        .json(&meta)
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        return Err(AppError::user(
            "Drive klasörü oluşturulamadı.",
            response.text().unwrap_or_default(),
        ));
    }
    let file: DriveFile = response.json().map_err(map_http)?;
    Ok(file.id)
}

fn find_root_folder(access: &str, name: &str) -> Result<Option<DriveFile>, AppError> {
    let q = format!(
        "name = '{}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        escape_drive_query(name)
    );
    list_files(access, &q)
}

fn find_child(access: &str, parent_id: &str, name: &str) -> Result<Option<DriveFile>, AppError> {
    let q = format!(
        "name = '{}' and '{}' in parents and trashed = false",
        escape_drive_query(name),
        escape_drive_query(parent_id)
    );
    list_files(access, &q)
}

fn list_files(access: &str, query: &str) -> Result<Option<DriveFile>, AppError> {
    let http = http_client()?;
    let response = http
        .get(DRIVE_FILES)
        .bearer_auth(access)
        .query(&[
            ("q", query),
            ("spaces", "drive"),
            ("pageSize", "10"),
            ("fields", "files(id,name,modifiedTime)"),
        ])
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        return Err(AppError::user(
            "Drive dosyaları listelenemedi.",
            response.text().unwrap_or_default(),
        ));
    }
    let list: DriveFileList = response.json().map_err(map_http)?;
    Ok(list.files.into_iter().next())
}

fn create_file_with_content(
    access: &str,
    parent_id: &str,
    name: &str,
    mime: &str,
    bytes: &[u8],
) -> Result<String, AppError> {
    let metadata = serde_json::json!({
        "name": name,
        "parents": [parent_id],
    });
    multipart_upload(access, None, &metadata, mime, bytes)
}

fn update_file_content(access: &str, file_id: &str, mime: &str, bytes: &[u8]) -> Result<(), AppError> {
    let metadata = serde_json::json!({});
    multipart_upload(access, Some(file_id), &metadata, mime, bytes)?;
    Ok(())
}

fn multipart_upload(
    access: &str,
    file_id: Option<&str>,
    metadata: &serde_json::Value,
    mime: &str,
    bytes: &[u8],
) -> Result<String, AppError> {
    let boundary = format!("kitap_{}", uuid::Uuid::new_v4().simple());
    let meta_json = serde_json::to_string(metadata)?;
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(b"Content-Type: application/json; charset=UTF-8\r\n\r\n");
    body.extend_from_slice(meta_json.as_bytes());
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(format!("Content-Type: {mime}\r\n\r\n").as_bytes());
    body.extend_from_slice(bytes);
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());

    let http = http_client()?;
    let request = if let Some(id) = file_id {
        http.patch(format!("{DRIVE_UPLOAD}/{id}?uploadType=multipart"))
            .query(&[("fields", "id,name")])
    } else {
        http.post(format!("{DRIVE_UPLOAD}?uploadType=multipart"))
            .query(&[("fields", "id,name")])
    };
    let response = request
        .bearer_auth(access)
        .header(
            "Content-Type",
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .map_err(map_http)?;
    if !response.status().is_success() {
        return Err(AppError::user(
            "Drive dosyası yüklenemedi.",
            response.text().unwrap_or_default(),
        ));
    }
    let file: DriveFile = response.json().map_err(map_http)?;
    Ok(file.id)
}

fn load_client_config(app: &AppHandle) -> Result<GoogleClientConfig, AppError> {
    if let Ok(id) = std::env::var("KITAP_GOOGLE_CLIENT_ID") {
        if let Ok(secret) = std::env::var("KITAP_GOOGLE_CLIENT_SECRET") {
            if !id.trim().is_empty() && !secret.trim().is_empty() {
                return Ok(GoogleClientConfig {
                    client_id: id.trim().to_string(),
                    client_secret: secret.trim().to_string(),
                });
            }
        }
    }
    let path = client_config_path(app)?;
    if path.is_file() {
        let raw = fs::read_to_string(&path)?;
        let cfg: GoogleClientConfig = serde_json::from_str(&raw)?;
        if !cfg.client_id.trim().is_empty() && !cfg.client_secret.trim().is_empty() {
            return Ok(cfg);
        }
    }
    let bundled = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("google_oauth.json");
    if bundled.is_file() {
        let raw = fs::read_to_string(&bundled)?;
        let cfg: GoogleClientConfig = serde_json::from_str(&raw)?;
        if !cfg.client_id.trim().is_empty()
            && !cfg.client_id.contains("BURAYA_")
            && !cfg.client_secret.trim().is_empty()
            && !cfg.client_secret.contains("BURAYA_")
        {
            return Ok(cfg);
        }
    }
    Err(AppError::user(
        "Google OAuth istemcisi yapılandırılmadı. Ayarlar’da Client ID ve Secret girin (Google Cloud → Desktop uygulama).",
        "missing google oauth client",
    ))
}

fn load_tokens(app: &AppHandle) -> Result<GoogleTokenStore, AppError> {
    let path = token_path(app)?;
    if !path.is_file() {
        return Ok(GoogleTokenStore::default());
    }
    let raw = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn save_tokens(app: &AppHandle, store: &GoogleTokenStore) -> Result<(), AppError> {
    let path = token_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_vec_pretty(store)?)?;
    Ok(())
}

fn token_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(filesystem::app_state_file_path(app)?
        .parent()
        .map(|p| p.join(TOKEN_FILE))
        .unwrap_or_else(|| PathBuf::from(TOKEN_FILE)))
}

fn client_config_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(filesystem::app_state_file_path(app)?
        .parent()
        .map(|p| p.join(CLIENT_FILE))
        .unwrap_or_else(|| PathBuf::from(CLIENT_FILE)))
}

fn pkce_verifier() -> String {
    let raw = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(64)
        .collect()
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

fn escape_drive_query(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}

fn http_client() -> Result<reqwest::blocking::Client, AppError> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|err| AppError::user("HTTP istemcisi oluşturulamadı.", err.to_string()))
}

fn map_http(err: impl std::fmt::Display) -> AppError {
    AppError::user("Google Drive isteği başarısız.", err.to_string())
}

pub fn zip_dir(dir: &Path) -> Result<Vec<u8>, AppError> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        add_dir_to_zip(&mut zip, dir, Path::new(""), options)?;
        zip.finish()?;
    }
    Ok(cursor.into_inner())
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    dir: &Path,
    prefix: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), AppError> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = prefix.join(entry.file_name());
        if path.is_dir() {
            add_dir_to_zip(zip, &path, &name, options)?;
        } else if path.is_file() {
            let rel = name.to_string_lossy().replace('\\', "/");
            zip.start_file(rel, options)?;
            let bytes = fs::read(&path)?;
            zip.write_all(&bytes)?;
        }
    }
    Ok(())
}

pub fn unzip_bytes(bytes: &[u8], dest: &Path) -> Result<(), AppError> {
    if dest.exists() {
        fs::remove_dir_all(dest)?;
    }
    fs::create_dir_all(dest)?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|err| AppError::user("assets.zip açılamadı.", err.to_string()))?;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|err| AppError::user("ZIP girdisi okunamadı.", err.to_string()))?;
        let out_path = dest.join(file.name());
        if file.name().ends_with('/') {
            fs::create_dir_all(&out_path)?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut out = fs::File::create(&out_path)?;
        std::io::copy(&mut file, &mut out)?;
    }
    Ok(())
}
