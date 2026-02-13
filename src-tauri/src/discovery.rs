use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::UdpSocket;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const DISCOVERY_PORT: u16 = 41234;
const BROADCAST_INTERVAL_MS: u64 = 1000;
const PEER_TIMEOUT_SECS: u64 = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryMessage {
    pub t: String, // "DISCOVER" or "ANNOUNCE"
    pub app: String,
    pub v: u32,
    pub id: String,
    pub name: String,
    pub tcp: u16,
}

#[derive(Debug, Clone, Serialize)]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub last_seen: u64,
}

type PeerMap = Arc<Mutex<HashMap<String, Peer>>>;

pub struct DiscoveryService {
    device_id: String,
    device_name: String,
    tcp_port: u16,
    peers: PeerMap,
    running: Arc<Mutex<bool>>,
}

impl DiscoveryService {
    pub fn new(device_name: String, tcp_port: u16) -> Self {
        let device_id = format!("{}-{}", 
            device_name.replace(" ", "-"),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() % 10000
        );

        Self {
            device_id,
            device_name,
            tcp_port,
            peers: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self, app_handle: AppHandle) -> Result<(), String> {
        *self.running.lock().unwrap() = true;

        // Bind UDP socket
        let socket = UdpSocket::bind(format!("0.0.0.0:{}", DISCOVERY_PORT))
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
        
        socket.set_broadcast(true)
            .map_err(|e| format!("Failed to set broadcast: {}", e))?;

        println!("[Discovery] Started on port {}", DISCOVERY_PORT);

        // Clone for threads
        let device_id = self.device_id.clone();
        let device_name = self.device_name.clone();
        let tcp_port = self.tcp_port;
        let peers = self.peers.clone();
        let running = self.running.clone();
        let app_handle_broadcast = app_handle.clone();
        let app_handle_receive = app_handle.clone();

        // Broadcast thread
        let socket_send = socket.try_clone().unwrap();
        let device_id_broadcast = device_id.clone();
        let device_name_broadcast = device_name.clone();
        let running_broadcast = running.clone();
        std::thread::spawn(move || {
            while *running_broadcast.lock().unwrap() {
                let discover_msg = DiscoveryMessage {
                    t: "DISCOVER".to_string(),
                    app: "RichieDrop".to_string(),
                    v: 1,
                    id: device_id_broadcast.clone(),
                    name: device_name_broadcast.clone(),
                    tcp: tcp_port,
                };

                if let Ok(json) = serde_json::to_string(&discover_msg) {
                    let broadcast_addr = format!("255.255.255.255:{}", DISCOVERY_PORT);
                    let _ = socket_send.send_to(json.as_bytes(), broadcast_addr);
                }

                std::thread::sleep(std::time::Duration::from_millis(BROADCAST_INTERVAL_MS));
            }
        });

        // Receive thread
        let socket_recv = socket.try_clone().unwrap();
        let device_id_recv = device_id.clone();
        let device_name_recv = device_name.clone();
        let peers_recv = peers.clone();
        let running_recv = running.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 1024];
            
            while *running_recv.lock().unwrap() {
                if let Ok((len, src_addr)) = socket_recv.recv_from(&mut buf) {
                    if let Ok(msg_str) = std::str::from_utf8(&buf[..len]) {
                        if let Ok(msg) = serde_json::from_str::<DiscoveryMessage>(msg_str) {
                            // Ignore own messages
                            if msg.id == device_id_recv || msg.app != "RichieDrop" {
                                continue;
                            }

                            let now = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_secs();

                            // Store peer
                            let peer = Peer {
                                id: msg.id.clone(),
                                name: msg.name.clone(),
                                ip: src_addr.ip().to_string(),
                                port: msg.tcp,
                                last_seen: now,
                            };

                            {
                                let mut peers_lock = peers_recv.lock().unwrap();
                                peers_lock.insert(msg.id.clone(), peer);
                            }

                            // If DISCOVER, send ANNOUNCE back
                            if msg.t == "DISCOVER" {
                                let announce_msg = DiscoveryMessage {
                                    t: "ANNOUNCE".to_string(),
                                    app: "RichieDrop".to_string(),
                                    v: 1,
                                    id: device_id_recv.clone(),
                                    name: device_name_recv.clone(),
                                    tcp: tcp_port,
                                };

                                if let Ok(json) = serde_json::to_string(&announce_msg) {
                                    let _ = socket_recv.send_to(json.as_bytes(), src_addr);
                                }
                            }

                            // Emit update
                            let peer_list: Vec<Peer> = peers_recv.lock().unwrap().values().cloned().collect();
                            let _ = app_handle_receive.emit("peer:update", peer_list);
                        }
                    }
                }
            }
        });

        // TTL cleanup thread
        let peers_cleanup = self.peers.clone();
        let running_cleanup = self.running.clone();
        std::thread::spawn(move || {
            while *running_cleanup.lock().unwrap() {
                std::thread::sleep(std::time::Duration::from_secs(2));

                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

                let mut peers_lock = peers_cleanup.lock().unwrap();
                peers_lock.retain(|_, peer| now - peer.last_seen < PEER_TIMEOUT_SECS);

                // Emit update
                let peer_list: Vec<Peer> = peers_lock.values().cloned().collect();
                let _ = app_handle_broadcast.emit("peer:update", peer_list);
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
        println!("[Discovery] Stopped");
    }

    pub fn get_peers(&self) -> Vec<Peer> {
        self.peers.lock().unwrap().values().cloned().collect()
    }
}
