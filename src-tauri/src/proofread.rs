use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProofreadAiConfig {
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofreadAiPayload {
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub text: Option<String>,
}

#[tauri::command]
pub fn save_proofread_settings(app: AppHandle, payload: ProofreadAiConfig) -> Result<(), AppError> {
    write_config(&app, &payload)
}

#[tauri::command]
pub fn load_proofread_settings(app: AppHandle) -> Result<ProofreadAiConfig, AppError> {
    Ok(read_config(&app).unwrap_or_default())
}

#[tauri::command]
pub async fn proofread_ai(
    app: AppHandle,
    payload: Option<ProofreadAiPayload>,
    endpoint: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    text: Option<String>,
) -> Result<String, AppError> {
    let saved = read_config(&app).unwrap_or_default();
    let nested = payload.unwrap_or(ProofreadAiPayload {
        endpoint: None,
        api_key: None,
        model: None,
        text: None,
    });
    let endpoint = first_nonempty([
        nested.endpoint.as_deref(),
        endpoint.as_deref(),
        Some(saved.endpoint.as_str()),
    ]);
    let api_key = first_nonempty([
        nested.api_key.as_deref(),
        api_key.as_deref(),
        Some(saved.api_key.as_str()),
    ]);
    let model = first_nonempty([
        nested.model.as_deref(),
        model.as_deref(),
        Some(saved.model.as_str()),
        Some("gpt-4o-mini"),
    ]);
    let text = first_nonempty([nested.text.as_deref(), text.as_deref()]);
    let text = text.chars().take(8000).collect::<String>();

    if endpoint.is_empty() || api_key.is_empty() {
        return Err(AppError::user(
            "Yapay zeka adresi veya anahtarı eksik. Ayarlar’da Kaydet’e basın.",
            "empty ai settings",
        ));
    }
    let _ = write_config(
        &app,
        &ProofreadAiConfig {
            endpoint: endpoint.clone(),
            api_key: api_key.clone(),
            model: model.clone(),
        },
    );
    if text.is_empty() {
        return Ok(r#"{"issues":[]}"#.to_string());
    }
    let url = chat_completions_url(&endpoint);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|err| AppError::user("Yapay zeka bağlantısı kurulamadı.", err.to_string()))?;

    let mut last_error = String::new();
    for with_json_format in [true, false] {
        let mut body = json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "Türkçe kitap editörüsün. [BAŞLIK] satırları başlıktır, sonuna nokta koyma ve madde işareti sanma. [MADDE LİSTESİ] satırları listedir, başlık değildir ve nokta zorunlu değildir. Sadece gerçek yazım/anlam hatalarını bildir. Sadece JSON yaz: {\"issues\":[{\"kind\":\"spelling\",\"excerpt\":\"alıntı\",\"message\":\"sorun\",\"suggestion\":\"düzeltme\"}]}. En fazla 20 madde. En az 1 öneri ver."
                },
                { "role": "user", "content": text }
            ]
        });
        if with_json_format {
            body["response_format"] = json!({ "type": "json_object" });
            body["temperature"] = json!(0.2);
        }
        let response = client
            .post(&url)
            .bearer_auth(&api_key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|err| {
                AppError::user(
                    "Yapay zekaya ulaşılamadı. İnternet bağlantısını ve API adresini kontrol edin.",
                    err.to_string(),
                )
            })?;
        let status = response.status();
        let raw = response
            .text()
            .await
            .map_err(|err| AppError::user("Yapay zeka yanıtı okunamadı.", err.to_string()))?;
        if status.is_success() {
            let parsed: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);
            let content = parsed
                .pointer("/choices/0/message/content")
                .and_then(Value::as_str)
                .unwrap_or(&raw);
            return Ok(content.to_string());
        }
        last_error = openai_error_message(&raw).unwrap_or_else(|| raw.chars().take(280).collect());
        let retryable = status.as_u16() == 400
            && with_json_format
            && last_error.to_ascii_lowercase().contains("response_format");
        if !retryable {
            return Err(AppError::user(
                format!("Yapay zeka hata verdi ({status}): {last_error}"),
                format!("url={url} status={status}"),
            ));
        }
    }
    Err(AppError::user(
        format!("Yapay zeka hata verdi: {last_error}"),
        last_error,
    ))
}

fn first_nonempty<const N: usize>(values: [Option<&str>; N]) -> String {
    for value in values {
        if let Some(item) = value {
            let trimmed = item.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    String::new()
}

fn config_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_config_dir().map_err(|err| {
        AppError::user(
            "Yapay zeka ayar klasörü açılamadı.",
            err.to_string(),
        )
    })?;
    fs::create_dir_all(&dir).map_err(|err| {
        AppError::user("Yapay zeka ayar klasörü oluşturulamadı.", err.to_string())
    })?;
    Ok(dir.join("proofread-ai.json"))
}

fn read_config(app: &AppHandle) -> Option<ProofreadAiConfig> {
    let path = config_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_config(app: &AppHandle, config: &ProofreadAiConfig) -> Result<(), AppError> {
    let path = config_path(app)?;
    let raw = serde_json::to_string_pretty(config)?;
    fs::write(&path, raw).map_err(|err| {
        AppError::user("Yapay zeka ayarı kaydedilemedi.", err.to_string())
    })
}

fn chat_completions_url(endpoint: &str) -> String {
    let mut base = endpoint.trim().trim_end_matches('/').to_string();
    if base.contains("/chat/completions") {
        return base;
    }
    let lower = base.to_ascii_lowercase();
    if lower == "https://api.openai.com" || lower == "http://api.openai.com" {
        base.push_str("/v1");
    }
    if base.ends_with("/v1") {
        base.push_str("/chat/completions");
        return base;
    }
    format!("{base}/chat/completions")
}

fn openai_error_message(raw: &str) -> Option<String> {
    let value: Value = serde_json::from_str(raw).ok()?;
    value
        .pointer("/error/message")
        .and_then(Value::as_str)
        .map(|item| item.to_string())
}
