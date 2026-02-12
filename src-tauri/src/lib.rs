use axum::{
    body::Body,
    extract::{Json, Path},
    http::{header, StatusCode},
    routing::{get, post},
    Router,
};
use local_ip_address::local_ip;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use tauri::Emitter;
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;

// ── Global shared state (simple, no Axum/Tauri state complexity) ──
static TRANSFERS: LazyLock<Mutex<HashMap<String, PathBuf>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SERVER_PORT: LazyLock<Mutex<Option<u16>>> =
    LazyLock::new(|| Mutex::new(None));

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
    filename: String,
    filesize: String,
    sender_name: String,
    download_url: String,
}

#[derive(serde::Serialize)]
struct TransferResult {
    ip: String,
    port: u16,
}

// ── Commands ──

#[tauri::command]
async fn start_discovery(
    app_handle: tauri::AppHandle,
    device_name: String,
    port: u16,
) -> Result<String, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;

    // 1. Advertise ourselves
    let my_ip = local_ip().map_err(|e| e.to_string())?;
    let ip_str = my_ip.to_string();
    let service_type = "_richiedrop._tcp.local.";
    let instance_name = &device_name;
    let host_name = format!("{}.local.", device_name.replace(" ", "-"));

    let service_info =
        ServiceInfo::new(service_type, instance_name, &host_name, &ip_str, port, None)
            .map_err(|e| e.to_string())?;

    mdns.register(service_info).map_err(|e| e.to_string())?;

    // 2. Start HTTP server (signaling + file serving) on the discovery port
    let app_handle_server = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route(
                "/notify",
                post(move |Json(payload): Json<NotifyPayload>| async move {
                    println!("Received transfer request: {:?}", payload);
                    let _ = app_handle_server.emit("transfer-request", payload);
                    StatusCode::OK
                }),
            )
            .route(
                "/download/{filename}",
                get(|Path(filename): Path<String>| async move {
                    // Look up file in the global transfers map
                    let file_path = {
                        let map = TRANSFERS.lock().unwrap();
                        map.get(&filename).cloned()
                    };

                    match file_path {
                        Some(p) if p.exists() => {
                            match tokio::fs::File::open(&p).await {
                                Ok(file) => {
                                    let stream = ReaderStream::new(file);
                                    let body = Body::from_stream(stream);
                                    let disp = format!("attachment; filename=\"{}\"", filename);
                                    Ok((
                                        [
                                            (header::CONTENT_TYPE, "application/octet-stream".to_string()),
                                            (header::CONTENT_DISPOSITION, disp),
                                        ],
                                        body,
                                    ))
                                }
                                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
                            }
                        }
                        _ => Err(StatusCode::NOT_FOUND),
                    }
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

    // 3. Browse for others
    let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;
    let app_handle_clone = app_handle.clone();
    let my_ip_clone = my_ip.clone();

    tauri::async_runtime::spawn(async move {
        while let Ok(event) = receiver.recv_async().await {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let id = info.get_fullname().to_string();
                    let addrs = info.get_addresses();
                    if let Some(addr) = addrs.iter().next() {
                        if addr.to_string() == my_ip_clone.to_string() {
                            continue;
                        }

                        let device = Device {
                            id: id.clone(),
                            name: info.get_hostname().trim_end_matches('.').to_string(),
                            ip: addr.to_string(),
                            port: info.get_port(),
                            last_seen: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs(),
                        };

                        let _ = app_handle_clone.emit("device-found", device);
                    }
                }
                ServiceEvent::ServiceRemoved(_service_type, fullname) => {
                    let _ = app_handle_clone.emit("device-lost", fullname);
                }
                _ => {}
            }
        }
    });

    Ok(ip_str)
}

#[tauri::command]
fn get_devices() -> Vec<Device> {
    vec![]
}

#[tauri::command]
async fn send_file(
    _app_handle: tauri::AppHandle,
    filepath: String,
) -> Result<TransferResult, String> {
    let path = PathBuf::from(&filepath);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let filename = path
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    // Register in global map
    TRANSFERS.lock().unwrap().insert(filename.clone(), path);

    // Get the server port
    let port = SERVER_PORT
        .lock()
        .unwrap()
        .ok_or("Server not running yet")?;

    let ip = local_ip().map_err(|e| e.to_string())?.to_string();

    Ok(TransferResult { ip, port })
}

#[tauri::command]
async fn notify_peer(
    target_ip: String,
    target_port: u16,
    filename: String,
    filesize: String,
    sender_name: String,
    download_url: String,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("http://{}:{}/notify", target_ip, target_port);

    let payload = NotifyPayload {
        filename,
        filesize,
        sender_name,
        download_url,
    };

    let _res = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn receive_file(url: String, save_path: String) -> Result<(), String> {
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed for {}: {}", url, e))?;

    let mut file = tokio::fs::File::create(&save_path)
        .await
        .map_err(|e| format!("Cannot create {}: {}", save_path, e))?;

    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
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
            get_devices,
            send_file,
            receive_file,
            notify_peer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
