use axum::{
    body::Body,
    extract::{Json, Path, State},
    http::{header, StatusCode},
    routing::{get, post},
    Router,
};
use local_ip_address::local_ip;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;

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

struct AppState {
    // Map filename -> absolute path
    // Wrapped in Arc so we can share it with Axum state
    transfers: Arc<Mutex<HashMap<String, PathBuf>>>,
    // Store the port we are listening on
    port: Mutex<Option<u16>>,
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
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;

    // 1. Advertise Ourselves
    let my_ip = local_ip().map_err(|e| e.to_string())?;
    let ip_str = my_ip.to_string();
    let service_type = "_richiedrop._tcp.local.";
    let instance_name = &device_name;
    let host_name = format!("{}.local.", device_name.replace(" ", "-"));

    let service_info =
        ServiceInfo::new(service_type, instance_name, &host_name, &ip_str, port, None)
            .map_err(|e| e.to_string())?;

    mdns.register(service_info).map_err(|e| e.to_string())?;

    // Update state with the port we are using
    *state.port.lock().unwrap() = Some(port);

    // 2. Start Control Server (Signaling + File Serving) on the SAME port
    let app_handle_server = app_handle.clone();
    let transfer_map = state.transfers.clone();

    tauri::async_runtime::spawn(async move {
        // Define Axum app
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
                "/download/:filename",
                get(move |Path(filename): Path<String>, State(map): State<Arc<Mutex<HashMap<String, PathBuf>>>>| async move {
                    let path = {
                        let lock = map.lock().unwrap();
                        lock.get(&filename).cloned()
                    };
                    
                    if let Some(p) = path {
                        if let Ok(file) = tokio::fs::File::open(&p).await {
                             let stream = ReaderStream::new(file);
                             let body = Body::from_stream(stream);
                             
                             // Try to guess mime type or just send as octet-stream
                             // For simplicity: octet-stream with attachment disposition
                             let content_disposition = format!("attachment; filename=\"{}\"", filename);
                             
                             let headers = [
                                 (header::CONTENT_TYPE, "application/octet-stream".to_string()),
                                 (header::CONTENT_DISPOSITION, content_disposition),
                             ];
                             
                             return Ok((headers, body));
                        }
                    }
                    Err(StatusCode::NOT_FOUND)
                }),
            )
            .with_state(transfer_map)
            .layer(CorsLayer::permissive());

        // Bind strict to the discovery port
        let addr = format!("0.0.0.0:{}", port);
        if let Ok(listener) = tokio::net::TcpListener::bind(&addr).await {
            println!("Control server listening on {}", addr);
            let _ = axum::serve(listener, app).await;
        } else {
            eprintln!("Failed to bind control server on port {}", port);
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
    state: tauri::State<'_, AppState>,
    filepath: String,
) -> Result<TransferResult, String> {
    let path = std::path::PathBuf::from(filepath.clone());
    if !path.exists() {
        return Err("File not found".to_string());
    }
    
    let filename = path
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    // Register file in the shared map
    {
        let mut transfers = state.transfers.lock().unwrap();
        transfers.insert(filename.clone(), path);
    }
    
    // Get the port we are running on
    let port = *state.port.lock().unwrap();
    let port = port.ok_or("Discovery service not running")?;

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
    let client = reqwest::Client::new();
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
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let mut file = tokio::fs::File::create(save_path)
        .await
        .map_err(|e| e.to_string())?;

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
        .manage(AppState {
            transfers: Arc::new(Mutex::new(HashMap::new())),
            port: Mutex::new(None),
        })
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
