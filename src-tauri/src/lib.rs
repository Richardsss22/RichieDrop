use axum::{
    extract::{Json, Path, Request},
    http::StatusCode,
    routing::post,
    Router,
};
use futures_util::StreamExt;
use local_ip_address::local_ip;
use std::path::PathBuf;
use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use tower_http::cors::CorsLayer;

// Discovery module
pub mod discovery;
use discovery::DiscoveryService;

// ── Global state ──
static SERVER_PORT: LazyLock<Mutex<Option<u16>>> = LazyLock::new(|| Mutex::new(None));
static DISCOVERY_SERVICE: LazyLock<Mutex<Option<DiscoveryService>>> = LazyLock::new(|| Mutex::new(None));
static PAIRING_TOKENS: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

// ── Data types ──

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct Device {
    id: String,
    name: String,
    ip: String,
    port: u16,
    last_seen: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct NotifyPayload {
    pub filename: String,
    pub filesize: u64,
    pub sender_name: String,
    pub download_url: String,
}

// ── Token Management (Simplified) ──

// ── Commands ──

#[tauri::command]
async fn start_discovery(
    app_handle: tauri::AppHandle,
    device_name: String,
    port: u16,
) -> Result<String, String> {
    // Create and start UDP discovery service
    let discovery = DiscoveryService::new(device_name.clone(), port);
    discovery.start(app_handle.clone())?;
    
    // Store in global state
    *DISCOVERY_SERVICE.lock().unwrap() = Some(discovery);

    let my_ip = local_ip().map_err(|e| e.to_string())?;
    let ip_str = my_ip.to_string();

    // Start HTTP server
    let app_handle_server = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        let app_handle_notify = app_handle_server.clone();
        let app_handle_upload = app_handle_server.clone();

        let app = Router::new()
            .route(
                "/notify",
                post(move |Json(payload): Json<NotifyPayload>| async move {
                    println!("Received transfer request: {:?}", payload);
                    let _ = app_handle_notify.emit("transfer-request", payload);
                    StatusCode::OK
                }),
            )
            .route(
                "/upload/{filename}",
                post(move |Path(filename): Path<String>, req: Request| async move {
                    let expected_size = req
                        .headers()
                        .get("X-File-Size")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| {
                            req.headers()
                                .get(axum::http::header::CONTENT_LENGTH)
                                .and_then(|v| v.to_str().ok())
                                .and_then(|s| s.parse::<u64>().ok())
                        });

                    let Some(expected_size) = expected_size else {
                        eprintln!("Missing file size header");
                        return StatusCode::LENGTH_REQUIRED;
                    };

                    println!("Receiving file upload: {} ({} bytes)", filename, expected_size);
                    
                    let temp_dir = std::env::temp_dir().join("richiedrop_incoming");
                    if let Err(e) = std::fs::create_dir_all(&temp_dir) {
                        eprintln!("Failed to create temp dir: {}", e);
                        return StatusCode::INTERNAL_SERVER_ERROR;
                    }

                    let part_filename = format!("{}.part", filename);
                    let part_path = temp_dir.join(&part_filename);
                    let save_path = temp_dir.join(&filename);

                    let file = match tokio::fs::File::create(&part_path).await {
                        Ok(f) => f,
                        Err(e) => {
                            eprintln!("Failed to create temp file: {}", e);
                            return StatusCode::INTERNAL_SERVER_ERROR;
                        }
                    };

                    let mut writer = tokio::io::BufWriter::new(file);
                    let mut stream = req.into_body().into_data_stream();
                    let mut received_bytes: u64 = 0;

                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(data) => {
                                if let Err(e) = writer.write_all(&data).await {
                                    eprintln!("Write error: {}", e);
                                    return StatusCode::INTERNAL_SERVER_ERROR;
                                }
                                received_bytes += data.len() as u64;
                            }
                            Err(e) => {
                                eprintln!("Stream error: {}", e);
                                return StatusCode::INTERNAL_SERVER_ERROR;
                            }
                        }
                    }

                    if let Err(e) = writer.flush().await {
                        eprintln!("Flush error: {}", e);
                        return StatusCode::INTERNAL_SERVER_ERROR;
                    }

                    println!("Transfer finished: received {} of {} bytes", received_bytes, expected_size);

                    if received_bytes != expected_size {
                        eprintln!("Error: Size mismatch (EOF prematuro). Received {} but expected {}", received_bytes, expected_size);
                        let _ = tokio::fs::remove_file(&part_path).await;
                        return StatusCode::BAD_REQUEST;
                    }

                    // Rename .part to final filename
                    if let Err(e) = tokio::fs::rename(&part_path, &save_path).await {
                        eprintln!("Rename error: {}", e);
                        return StatusCode::INTERNAL_SERVER_ERROR;
                    }

                    println!("File saved to temp: {:?}", save_path);

                    let _ = app_handle_upload.emit(
                        "file-uploaded",
                        serde_json::json!({
                            "filename": filename,
                            "temp_path": save_path.to_string_lossy().to_string()
                        }),
                    );

                    StatusCode::OK
                }),
            )
            .layer(CorsLayer::permissive());

        let addr = format!("0.0.0.0:{}", port);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                let actual_port = listener.local_addr().unwrap().port();
                *SERVER_PORT.lock().unwrap() = Some(actual_port);
                println!("Server listening on 0.0.0.0:{}", actual_port);
                let _ = axum::serve(listener, app).await;
            }
            Err(e) => {
                eprintln!("FATAL: Failed to bind on port {}: {}", port, e);
            }
        }
    });

    Ok(ip_str)
}

#[tauri::command]
fn stop_discovery() -> Result<(), String> {
    if let Some(discovery) = DISCOVERY_SERVICE.lock().unwrap().as_ref() {
        discovery.stop();
    }
    Ok(())
}

#[tauri::command]
fn get_devices() -> Vec<discovery::Peer> {
    if let Some(discovery) = DISCOVERY_SERVICE.lock().unwrap().as_ref() {
        discovery.get_peers()
    } else {
        vec![]
    }
}

#[tauri::command]
fn generate_pair_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let token = format!("richiedrop-{}", timestamp);
    
    // Auto-add generated token
    PAIRING_TOKENS.lock().unwrap().insert(token.clone());
    token
}

#[tauri::command]
fn add_pair_token(token: String) -> Result<(), String> {
    PAIRING_TOKENS.lock().unwrap().insert(token);
    Ok(())
}

/// Notify the peer AND push the file to them (sender → receiver)
#[tauri::command]
async fn send_file_to_peer(
    target_ip: String,
    target_port: u16,
    filepath: String,
    sender_name: String,
) -> Result<(), String> {
    let path = PathBuf::from(&filepath);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let filename = path
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    let file = tokio::fs::File::open(&path)
        .await
        .map_err(|e| format!("Cannot open file: {}", e))?;
    
    let metadata = file.metadata().await.map_err(|e| format!("Metadata error: {}", e))?;
    let filesize = metadata.len();

    let client = reqwest::Client::new();

    // Step 1: Notify the peer (lightweight metadata)
    let notify_url = format!("http://{}:{}/notify", target_ip, target_port);
    let payload = NotifyPayload {
        filename: filename.clone(),
        filesize,
        sender_name,
        download_url: String::new(),
    };

    println!("Sending notification to {}: file {} ({} bytes)", notify_url, filename, filesize);

    client
        .post(&notify_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Notify failed: {}", e))?;

    // Step 2: Push the file data to the peer using streaming
    let upload_url = format!(
        "http://{}:{}/upload/{}",
        target_ip,
        target_port,
        urlencoding::encode(&filename)
    );

    println!("Uploading to {}: {} bytes", upload_url, filesize);

    // Create a stream from the file
    let stream = tokio_util::io::ReaderStream::with_capacity(file, 256 * 1024); // 256KB chunks
    let body = reqwest::Body::wrap_stream(stream);

    client
        .post(&upload_url)
        .header("content-type", "application/octet-stream")
        .header("X-File-Size", filesize.to_string())
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    println!("Sent {} bytes to {}", filesize, target_ip);

    Ok(())
}

/// Move file from temp to user-chosen save path
#[tauri::command]
async fn save_received_file(temp_path: String, save_path: String) -> Result<(), String> {
    // Try rename first (fast, same filesystem)
    if tokio::fs::rename(&temp_path, &save_path).await.is_ok() {
        return Ok(());
    }

    // Fallback: copy + delete (cross-filesystem)
    tokio::fs::copy(&temp_path, &save_path)
        .await
        .map_err(|e| format!("Copy failed: {}", e))?;
    let _ = tokio::fs::remove_file(&temp_path).await;

    Ok(())
}

/// Get the temp file path for a given filename
#[tauri::command]
fn get_temp_file_path(filename: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("richiedrop_incoming");
    let path = temp_dir.join(&filename);
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(format!("File not found in temp: {}", path.display()))
    }
}

/// Delete temp file when user declines
#[tauri::command]
async fn decline_received_file(temp_path: String) -> Result<(), String> {
    let _ = tokio::fs::remove_file(&temp_path).await;
    Ok(())
}

// ── Entry point ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_discovery,
            stop_discovery,
            get_devices,
            generate_pair_token,
            add_pair_token,
            send_file_to_peer,
            save_received_file,
            get_temp_file_path,
            decline_received_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
