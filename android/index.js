/**
 * RichieDrop Android - CRASH ISOLATION MODE
 * 
 * Separate buttons for UDP and TCP to identify the killer.
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
import { Settings, History, FileText, Smartphone, Monitor, CheckCircle, Share2, UploadCloud, Play, Square, Wifi, Server } from 'lucide-react-native';
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
        this.log('[UDP] Starting Sequence...');

        // 1. Perms (only request runtime permissions, not manifest-only)
        if (Platform.OS === 'android') {
            try {
                // INTERNET, ACCESS_WIFI_STATE, CHANGE_WIFI_MULTICAST_STATE are manifest-only
                // They don't need runtime requests and cause crashes if requested
                // For UDP discovery on LAN, we only need manifest permissions

                // Optional: Request location if needed for WiFi scanning (Android 10+)
                // Uncomment if you need to scan WiFi networks:
                // const perms = [];
                // if (PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
                //     perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                // }
                // if (perms.length > 0) {
                //     await PermissionsAndroid.requestMultiple(perms);
                // }

                this.log('[UDP] Permissions OK (manifest-only, no runtime needed)');
            } catch (e) {
                this.log('[UDP] Perms Error: ' + e.message);
            }
        }

        await new Promise(r => setTimeout(r, 200));

        // 2. Create Socket
        try {
            this.log('[UDP] Creating Socket...');
            this.socket = dgram.createSocket({ type: 'udp4' });
            this.log('[UDP] Socket Created!');

            // 3. Bind
            this.log(`[UDP] Binding to ${this.BROADCAST_PORT}...`);
            this.socket.bind(this.BROADCAST_PORT, (err) => {
                if (err) {
                    this.log('[UDP] Bind failed: ' + err);
                    Alert.alert('Erro UDP Bind', String(err));
                    return;
                }
                this.log('[UDP] Bound Success!');

                // 4. Broadcast
                try {
                    this.log('[UDP] Setting Broadcast...');
                    this.socket.setBroadcast(true);
                    this.log('[UDP] Broadcast Set!');
                } catch (e) { this.log('[UDP] setBroadcast fail: ' + e); }
            });

            this.socket.on('message', (msg, rinfo) => {
                // ... handling
            });

            // Loop
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
            this.log('[UDP] FATAL CRASH: ' + e.message);
            Alert.alert('Erro Fatal UDP', e.message);
            throw e;
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
                // ...
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
        // ... (same as before)
        return new Promise(async (resolve, reject) => {
            try {
                const client = TcpSocket.createConnection({ port: 8080, host: device.ip }, () => {
                    // ...
                    setTimeout(() => { client.destroy(); resolve(); }, 1000);
                });
            } catch (e) { reject(e); }
        });
    }
}

const transfer = new TcpTransferService();

// --- COMPONENTS ---

const RadarRing = ({ delay, duration, isRunning }) => {
    // ... same
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
    return <Animated.View style={[styles.radarRing, { transform: [{ scale }], opacity }]} />;
};

// Main App Component
function App() {
    const [deviceName] = useState(`Android-${Math.floor(Math.random() * 1000)}`);
    const [devices, setDevices] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [logs, setLogs] = useState([]);

    // States for individual services
    const [udpRunning, setUdpRunning] = useState(false);
    const [tcpRunning, setTcpRunning] = useState(false);

    const addLog = (msg) => {
        setLogs(prev => [msg, ...prev].slice(0, 50));
    };

    useEffect(() => {
        discovery.setLogger(addLog);
        transfer.setLogger(addLog);
        if (typeof Buffer !== 'undefined') addLog('✅ Buffer OK');
    }, []);

    const toggleUDP = async () => {
        if (udpRunning) {
            discovery.stop();
            setUdpRunning(false);
            addLog('🛑 UDP Parado');
        } else {
            addLog('🛰️ Iniciar UDP...');
            try {
                await discovery.start(deviceName);
                setUdpRunning(true);
            } catch (e) {
                addLog('❌ Erro UDP: ' + e.message);
            }
        }
    };

    const toggleTCP = () => {
        if (tcpRunning) {
            transfer.stopServer();
            setTcpRunning(false);
            addLog('🛑 TCP Parado');
        } else {
            addLog('💻 Iniciar TCP...');
            try {
                transfer.startServer(deviceName);
                setTcpRunning(true);
            } catch (e) {
                addLog('❌ Erro TCP: ' + e.message);
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
                setSelectedFile(res.assets[0]);
                addLog('Ficheiro: ' + res.assets[0].name);
            }
        } catch (e) { Alert.alert('Erro', 'select fail'); }
    };

    const handleSend = async (target) => {
        // ... same send logic
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
                        <Text style={styles.appName}>Test Mode</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: (udpRunning || tcpRunning) ? '#22c55e' : '#ef4444' }]} />
                        </View>
                    </View>
                </View>

                {/* DEBUG CONTROLS */}
                <View style={styles.headerRight}>
                    <Pressable style={[styles.controlBtn, udpRunning && styles.activeBtn]} onPress={toggleUDP}>
                        <Wifi size={16} color={udpRunning ? "#fff" : "#22d3ee"} />
                        <Text style={[styles.btnText, udpRunning && { color: '#fff' }]}>UDP</Text>
                    </Pressable>
                    <Pressable style={[styles.controlBtn, tcpRunning && styles.activeBtn]} onPress={toggleTCP}>
                        <Server size={16} color={tcpRunning ? "#fff" : "#22d3ee"} />
                        <Text style={[styles.btnText, tcpRunning && { color: '#fff' }]}>TCP</Text>
                    </Pressable>
                </View>
            </View>

            {/* Logs Area */}
            <View style={{ height: 120, marginBottom: 10, marginHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, borderWidth: 1, borderColor: '#333' }}>
                <ScrollView contentContainerStyle={{ padding: 5 }}>
                    {logs.map((l, i) => (
                        <Text key={i} style={{ color: '#ddd', fontSize: 11, fontFamily: 'monospace' }}>{l}</Text>
                    ))}
                </ScrollView>
            </View>

            {/* Main Content */}
            <View style={styles.content}>

                {/* Radar Section */}
                <View style={styles.radarSection}>
                    <RadarRing delay={0} duration={3000} isRunning={udpRunning} />

                    {/* Me Node */}
                    <View style={styles.meNode}>
                        <Smartphone size={32} color={(udpRunning || tcpRunning) ? "#fff" : "#94a3b8"} />
                    </View>

                    {/* Devices & Searching Text etc... (same) */}
                    {devices.length === 0 && udpRunning && (
                        <Text style={styles.searchingText}>A procurar (UDP)...</Text>
                    )}
                </View>

                {/* File Drop Area (same) */}
                <View style={styles.fileAreaContainer}>
                    <Pressable style={styles.fileDropZone} onPress={handleSelectFile}>
                        {selectedFile ? (
                            <View style={styles.fileSelectedState}>
                                <CheckCircle size={40} color="#22c55e" />
                                <Text style={styles.fileSelectedText}>{selectedFile.name}</Text>
                            </View>
                        ) : (
                            <Text style={styles.dropMainText}>Selecionar Ficheiro</Text>
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
    headerRight: { flexDirection: 'row', gap: 8 },
    logoBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34, 211, 238, 0.15)', justifyContent: 'center', alignItems: 'center' },
    appName: { fontSize: 18, fontWeight: '700', color: '#fff' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(34, 211, 238, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: '#22d3ee' },
    activeBtn: { backgroundColor: '#22d3ee' },
    btnText: { color: '#22d3ee', fontWeight: '700', fontSize: 12 },
    content: { flex: 1, justifyContent: 'space-between' },
    radarSection: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    radarRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' },
    meNode: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    searchingText: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 },
    fileAreaContainer: { padding: 20, paddingBottom: 40 },
    fileDropZone: { height: 100, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
    fileSelectedState: { alignItems: 'center' },
    fileSelectedText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
    dropMainText: { fontSize: 18, fontWeight: '600', color: '#fff' },
});

// Register app
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App);
