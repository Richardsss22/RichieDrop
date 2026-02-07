use axum::{
    body::Body,
    http::{header, StatusCode},
    response::Response,
    routing::get_service,
    Router,
};
use local_ip_address::local_ip;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Listener, Manager};
use tower_http::services::ServeFile;

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct Device {
    id: String,
    name: String,
    ip: String,
    port: u16,
    last_seen: u64,
}

struct AppState {
    devices: Arc<Mutex<HashMap<String, Device>>>,
    // Store current server task to abort if needed?
    // For now, simpler: one file served at a time or concurrent is fine.
}

#[derive(serde::Serialize)]
struct TransferResult {
    ip: String,
    port: u16,
}

#[tauri::command]
async fn start_discovery(
    app_handle: tauri::AppHandle,
    device_name: String,
    port: u16,
) -> Result<String, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;

    // 1. Advertise Ourselves
    let my_ip = local_ip().map_err(|e| e.to_string())?;
    let ip_str = my_ip.to_string();
    let service_type = "_richiedrop._tcp.local.";
    let instance_name = &device_name;
    let host_name = format!("{}.local.", device_name.replace(" ", "-")); // simple sanitization

    let service_info = ServiceInfo::new(
        service_type,
        instance_name,
        &host_name,
        &ip_str,
        port,
        None, // properties
    )
    .map_err(|e| e.to_string())?;

    mdns.register(service_info).map_err(|e| e.to_string())?;

    // 2. Browse for others
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
                        // Filter out our own device by checking IP (compare as strings since types differ)
                        if addr.to_string() == my_ip_clone.to_string() {
                            continue; // Skip self
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
    // In this simple implementation, we rely on the frontend listener for the live list.
    // The initial get_devices call returns empty or we could cache in AppState.
    // For simplicity of restoration: return empty, let discovery fill it.
    vec![]
}

#[tauri::command]
async fn send_file(
    _app_handle: tauri::AppHandle,
    filepath: String,
) -> Result<TransferResult, String> {
    // Start an ephemeral HTTP server to serve this file
    // Strategy: Bind to random port or fixed port?
    // User logic calls start_discovery with 8080.
    // Ideally we serve on 8080 (our discovery port).

    // NOTE: In a real robust app, we should have the server running constantly.
    // Here we'll spawn a server for this file specifically or reuse a global one.
    // Given the complexity of checking if server is running, let's try to bind 8080.
    // If it fails (already running), we might need to handle that.

    // Simpler hack for this "Fix": bind strict 8080 in a separate task globally?
    // Or just bind ephemeral port and return it (but discovery advertised 8080).

    // Let's assume 8080 is THE port.
    // We need to serve the file at /download/:filename

    let path = std::path::PathBuf::from(filepath.clone());
    if !path.exists() {
        return Err("File not found".to_string());
    }
    let filename = path
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    // We need to serve this file.
    // To support dynamic file serving, we'd need a shared state of "files to serve".
    // Implementing a full server is complex in one go.
    // Let's implement a "start server if not started" approach?
    // Or just spawn a server on a RANDOM port and return THAT port?
    // The frontend logic: `alert` shows `result.port`.
    // So dynamic port is ACCEPTABLE and SAFER.

    let ip = local_ip().map_err(|e| e.to_string())?.to_string();

    // Create a router that serves this specific file
    let app =
        Router::new().nest_service(&format!("/download/{}", filename), ServeFile::new(filepath));

    // Bind to port 0 (random)
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    tauri::async_runtime::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    Ok(TransferResult { ip, port })
}

#[tauri::command]
async fn receive_file(url: String, save_path: String) -> Result<(), String> {
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let mut file = tokio::fs::File::create(save_path)
        .await
        .map_err(|e| e.to_string())?;
    // Stream content
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_discovery,
            get_devices,
            send_file,
            receive_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
