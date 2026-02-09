/**
 * RichieDrop Android - DEBUG MODE
 * 
 * Includes explicit error alerts and checks for Buffer/Permissions.
 */

import './shim'; // Must be first import
import { AppRegistry, LogBox, Platform, NativeModules, PermissionsAndroid } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Pressable,
    Alert,
    Dimensions,
    Animated,
    Easing,
    Image,
    ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, History, FileText, Smartphone, Monitor, CheckCircle, Share2, UploadCloud, Play, Square } from 'lucide-react-native';
import dgram from 'react-native-udp';
import TcpSocket from 'react-native-tcp-socket';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// Ignore specific logs
LogBox.ignoreLogs(['new NativeEventEmitter']);

// --- REAL UDP DISCOVERY SERVICE ---
class UdpDiscoveryService {
    socket = null;
    deviceName = '';
    isScanning = false;
    devices = new Map();
    listeners = [];
    logCallback = null;

    // Config
    PORT = 5353; // mDNS port
    MCAST_ADDR = '224.0.0.251'; // mDNS multicast group
    BROADCAST_PORT = 41234; // Custom protocol port for Android-Android

    setLogger(cb) { this.logCallback = cb; }
    log(msg) {
        console.log(msg);
        if (this.logCallback) this.logCallback(msg);
    }

    async start(name) {
        this.deviceName = name;
        this.devices.clear();
        this.notify();
        this.isScanning = true;
        this.log('[UDP] Starting...');

        // Request Permissions on Android
        if (Platform.OS === 'android') {
            try {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.ACCESS_WIFI_STATE,
                    PermissionsAndroid.PERMISSIONS.CHANGE_WIFI_MULTICAST_STATE,
                    PermissionsAndroid.PERMISSIONS.INTERNET
                ]);
            } catch (e) {
                this.log('[UDP] Perms Error: ' + e.message);
                Alert.alert('Erro Permissões', e.message);
            }
        }

        // Wait a bit to ensure permissions propagate
        await new Promise(r => setTimeout(r, 500));

        try {
            if (typeof Buffer === 'undefined') {
                throw new Error("Buffer polyfill missing! (shim failed)");
            }

            this.socket = dgram.createSocket({ type: 'udp4' });
            this.socket.bind(this.BROADCAST_PORT, (err) => {
                if (err) {
                    this.log('[UDP] Bind failed: ' + err);
                    Alert.alert('Erro UDP Bind', String(err));
                    return;
                }
                this.log('[UDP] Bound to ' + this.BROADCAST_PORT);
                try {
                    this.socket.setBroadcast(true);
                } catch (e) { this.log('[UDP] setBroadcast fail: ' + e); }
            });

            this.socket.on('message', (msg, rinfo) => {
                try {
                    const message = msg.toString();
                    if (message.startsWith('RICHIEDROP:')) {
                        const peerName = message.split(':')[1];
                        if (peerName === this.deviceName) return; // Ignore self

                        const peerId = `${peerName}-${rinfo.address}`;
                        if (!this.devices.has(peerId)) {
                            this.log(`[UDP] Found: ${peerName} (${rinfo.address})`);
                            const device = {
                                id: peerId,
                                name: peerName,
                                ip: rinfo.address,
                                type: 'phone',
                                port: 8080
                            };
                            this.devices.set(peerId, device);
                            this.notify();
                        }
                    }
                } catch (e) {
                    this.log('Parse error: ' + e);
                }
            });

            this.socket.on('error', (err) => {
                this.log('[UDP] Socket Error: ' + err);
            });

            this.broadcastLoop = setInterval(() => {
                if (!this.isScanning) return;
                const message = `RICHIEDROP:${this.deviceName}`;
                if (this.socket) {
                    this.socket.send(message, 0, message.length, this.BROADCAST_PORT, '255.255.255.255', (err) => {
                        if (err) this.log('Broadcast error: ' + err);
                    });
                }
            }, 3000);

        } catch (e) {
            this.log('[UDP] CRASH: ' + e.message);
            Alert.alert('Erro Fatal UDP', e.message);
            throw e; // Propagate to toggleService catch
        }
    }

    stop() {
        this.isScanning = false;
        if (this.broadcastLoop) clearInterval(this.broadcastLoop);
        if (this.socket) {
            try { this.socket.close(); } catch (e) { }
            this.socket = null;
        }
        this.log('[UDP] Stopped');
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        const deviceList = Array.from(this.devices.values());
        this.listeners.forEach(cb => cb(deviceList));
    }
}

const discovery = new UdpDiscoveryService();


// --- TCP TRANSFER SERVICE (P2P) ---
class TcpTransferService {
    server = null;
    deviceName = '';
    logCallback = null;

    setLogger(cb) { this.logCallback = cb; }
    log(msg) {
        console.log(msg);
        if (this.logCallback) this.logCallback(msg);
    }

    startServer(name) {
        this.deviceName = name;
        this.log('[TCP] Starting Server...');
        try {
            if (typeof Buffer === 'undefined') throw new Error("Buffer missing for TCP");

            this.server = TcpSocket.createServer((socket) => {
                this.log(`[TCP] Connection from ${socket.remoteAddress}`);

                socket.on('data', (data) => {
                    const str = data.toString();
                    if (str.includes('"filename"')) {
                        Alert.alert('Receber', `Dados de ${socket.remoteAddress}`);
                    }
                });

                socket.on('error', (error) => this.log('[TCP] Socket error: ' + error));
                socket.on('close', () => this.log('[TCP] Client disconnected'));
            }).listen({ port: 8080, host: '0.0.0.0' }, () => {
                this.log('[TCP] Listening on 8080');
            });

            this.server.on('error', (error) => {
                this.log('[TCP] Server error: ' + error);
                Alert.alert('Erro TCP Server', String(error));
            });
        } catch (e) {
            this.log('[TCP] Server Crash: ' + e.message);
            Alert.alert('Erro Fatal TCP', e.message);
            throw e;
        }
    }

    stopServer() {
        if (this.server) {
            try { this.server.close(); } catch (e) { }
            this.server = null;
        }
        this.log('[TCP] Server stopped');
    }

    async sendFile(device, file) {
        return new Promise(async (resolve, reject) => {
            try {
                this.log(`[TCP] Connecting to ${device.ip}:8080`);
                const client = TcpSocket.createConnection({ port: 8080, host: device.ip }, () => {
                    this.log('[TCP] Connected, sending...');

                    const manifest = JSON.stringify({
                        filename: file.name,
                        size: file.size,
                        sender: this.deviceName
                    });
                    client.write(manifest);
                    client.write('\n\n---FILE-DATA-START---\n');

                    setTimeout(() => {
                        client.destroy();
                        resolve();
                    }, 1000);
                });

                client.on('error', (err) => {
                    this.log('[TCP] Client error: ' + err);
                    reject(err);
                });

            } catch (e) {
                reject(e);
            }
        });
    }
}

const transfer = new TcpTransferService();

// --- COMPONENTS ---

const RadarRing = ({ delay, duration, isRunning }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (!isRunning) return;
        const animate = () => {
            scale.setValue(0);
            opacity.setValue(0.3);
            Animated.parallel([
                Animated.timing(scale, { toValue: 3, duration, easing: Easing.out(Easing.ease), useNativeDriver: true, delay }),
                Animated.timing(opacity, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: true, delay })
            ]).start(() => animate());
        };
        animate();
    }, [isRunning]);

    if (!isRunning) return null;

    return (
        <Animated.View style={[styles.radarRing, { transform: [{ scale }], opacity }]} />
    );
};

// Main App Component
function App() {
    const [deviceName] = useState(`Android-${Math.floor(Math.random() * 1000)}`);
    const [devices, setDevices] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => {
        setLogs(prev => [msg, ...prev].slice(0, 50));
    };

    useEffect(() => {
        discovery.setLogger(addLog);
        transfer.setLogger(addLog);

        // Initial Check
        if (typeof Buffer !== 'undefined') {
            addLog('✅ Polyfill Buffer OK');
        } else {
            addLog('❌ Polyfill Buffer MISSING');
            Alert.alert('Erro Crítico', 'Buffer não encontrado!');
        }
    }, []);

    const toggleService = async () => {
        if (running) {
            discovery.stop();
            transfer.stopServer();
            setRunning(false);
            addLog('🛑 Serviços Parados');
        } else {
            addLog('🚀 A iniciar serviços...');
            try {
                // Try UDP
                try {
                    await discovery.start(deviceName);
                } catch (e) {
                    addLog('❌ UDP Falhou: ' + e.message);
                }

                // Try TCP
                try {
                    transfer.startServer(deviceName);
                } catch (e) {
                    addLog('❌ TCP Falhou: ' + e.message);
                }

                setRunning(true);
            } catch (e) {
                addLog('❌ Falha Geral: ' + e.message);
                Alert.alert('Erro Geral', e.message);
            }
        }
    };

    useEffect(() => {
        const unsub = discovery.subscribe(setDevices);
        return () => {
            unsub();
            discovery.stop();
            transfer.stopServer();
        };
    }, []);

    const handleSelectFile = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                const file = res.assets[0];
                setSelectedFile(file);
                addLog('Ficheiro: ' + file.name);
            }
        } catch (e) {
            Alert.alert('Erro', 'Falha ao selecionar ficheiro');
        }
    };

    const handleSend = async (target) => {
        if (!selectedFile) {
            Alert.alert('Atenção', 'Seleciona um ficheiro primeiro!');
            return;
        }

        addLog(`A enviar ${selectedFile.name} para ${target.name}...`);

        try {
            await transfer.sendFile(target, selectedFile);
            addLog('Envio concluído (simulado)');
        } catch (e) {
            addLog(`Erro envio: ${e.message}`);
            Alert.alert('Erro Envio', e.message);
        }
    };

    return (
        <LinearGradient
            colors={['#1e1b4b', '#0f172a', '#020617']} // Dark Purple to Black gradient
            style={styles.container}
        >
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.logoBadge}>
                        <Share2 size={24} color="#22d3ee" />
                    </View>
                    <View>
                        <Text style={styles.appName}>RichieDrop Safe</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: running ? '#22c55e' : '#ef4444' }]} />
                            <Text style={styles.statusText}>{running ? `Visível: ${deviceName}` : 'Offline'}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <Pressable style={styles.iconButton} onPress={toggleService}>
                        {running ? <Square size={20} color="#ef4444" fill="#ef4444" /> : <Play size={20} color="#22c55e" fill="#22c55e" />}
                    </Pressable>
                </View>
            </View>

            {/* Logs Area (Debug) */}
            <View style={{ height: 100, marginBottom: 10, marginHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, borderWidth: 1, borderColor: '#333' }}>
                <ScrollView contentContainerStyle={{ padding: 5 }}>
                    {logs.length === 0 && <Text style={{ color: '#666' }}>A aguardar logs...</Text>}
                    {logs.map((l, i) => (
                        <Text key={i} style={{ color: '#ddd', fontSize: 11, fontFamily: 'monospace' }}>{l}</Text>
                    ))}
                </ScrollView>
            </View>

            {/* Main Content */}
            <View style={styles.content}>

                {/* Radar Section */}
                <View style={styles.radarSection}>
                    <RadarRing delay={0} duration={3000} isRunning={running} />
                    <RadarRing delay={1000} duration={3000} isRunning={running} />

                    {/* Me Node */}
                    <View style={styles.meNode}>
                        <Smartphone size={32} color={running ? "#fff" : "#94a3b8"} />
                    </View>

                    {/* Devices */}
                    {devices.map((device, i) => {
                        const angle = (i * (360 / (devices.length || 1))) * (Math.PI / 180);
                        const radius = 120;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;

                        return (
                            <Pressable
                                key={device.id}
                                style={[styles.deviceNode, { transform: [{ translateX: x }, { translateY: y }] }]}
                                onPress={() => handleSend(device)}
                            >
                                <View style={styles.deviceIconBg}>
                                    <Monitor size={24} color="#22d3ee" />
                                </View>
                                <Text style={styles.deviceLabel}>{device.name}</Text>
                            </Pressable>
                        );
                    })}

                    {devices.length === 0 && running && (
                        <Text style={styles.searchingText}>A procurar dispositivos (UDP)...</Text>
                    )}
                    {!running && (
                        <Text style={styles.searchingText}>Toca no Play para iniciar</Text>
                    )}
                </View>

                {/* File Drop Area */}
                <View style={styles.fileAreaContainer}>
                    <Pressable style={styles.fileDropZone} onPress={handleSelectFile}>
                        {selectedFile ? (
                            <View style={styles.fileSelectedState}>
                                <CheckCircle size={40} color="#22c55e" />
                                <Text style={styles.fileSelectedText}>{selectedFile.name}</Text>
                                <Text style={styles.fileSubText}>Toque para mudar</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.uploadIconCircle}>
                                    <FileText size={24} color="#22d3ee" />
                                </View>
                                <Text style={styles.dropMainText}>Arrasta ficheiros</Text>
                                <Text style={styles.dropSubText}>ou clica para explorar</Text>
                                <View style={styles.selectButton}>
                                    <Text style={styles.selectButtonText}>Selecionar</Text>
                                </View>
                            </>
                        )}
                    </Pressable>
                </View>

            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34, 211, 238, 0.15)', justifyContent: 'center', alignItems: 'center' },
    appName: { fontSize: 18, fontWeight: '700', color: '#fff' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 12, color: '#94a3b8' },
    headerRight: { flexDirection: 'row', gap: 8 },
    iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, justifyContent: 'space-between' },
    radarSection: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    radarRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' },
    meNode: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    searchingText: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 },
    deviceNode: { position: 'absolute', alignItems: 'center', zIndex: 20 },
    deviceIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#22d3ee', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    deviceLabel: { color: '#fff', fontSize: 12, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    fileAreaContainer: { padding: 20, paddingBottom: 40 },
    fileDropZone: { height: 220, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
    uploadIconCircle: { marginBottom: 16 },
    dropMainText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
    dropSubText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },
    selectButton: { backgroundColor: '#22d3ee', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    selectButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
    fileSelectedState: { alignItems: 'center' },
    fileSelectedText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
    fileSubText: { color: '#22c55e', marginTop: 4 }
});

// Register app
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App);
