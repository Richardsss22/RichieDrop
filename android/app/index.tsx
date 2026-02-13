/**
 * RichieDrop Android - Unified Main App
 * Complete UDP Discovery + File Transfer
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Pressable,
    ScrollView,
    Alert,
    Platform,
    NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// UDP imports
const dgram = require('react-native-udp');

const STORAGE_KEY = 'richiedrop_name';
const UDP_PORT = 41234;
const TCP_PORT = 8080;

interface Device {
    id: string;
    name: string;
    ip: string;
    port: number;
    lastSeen: number;
}

interface SelectedFile {
    name: string;
    uri: string;
    size: string;
}

export default function RichieDropApp() {
    const [myDeviceName, setMyDeviceName] = useState('Android');
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    // UDP service refs
    const socketRef = useRef<any>(null);
    const deviceIdRef = useRef('');
    const devicesMapRef = useRef(new Map<string, Device>());
    const broadcastLoopRef = useRef<any>(null);
    const announceLoopRef = useRef<any>(null);
    const ttlCleanupLoopRef = useRef<any>(null);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Multi-broadcast helper
    const sendPacket = (obj: any) => {
        if (!socketRef.current) return;

        const data = Buffer.from(JSON.stringify(obj), 'utf8');
        const targets = [
            '255.255.255.255',
            '192.168.1.255',
            '192.168.0.255',
            '10.0.0.255',
        ];

        for (const ip of targets) {
            socketRef.current.send(data, 0, data.length, UDP_PORT, ip, (err: any) => {
                if (err) addLog(`Send ${ip} error: ${err}`);
            });
        }
    };

    // Start UDP Discovery
    const startDiscovery = async () => {
        if (isScanning) return;

        addLog('🚀 Starting UDP Discovery...');
        setIsScanning(true);

        // Generate device ID
        deviceIdRef.current = `android-${Math.random().toString(36).substring(2, 15)}`;
        devicesMapRef.current.clear();
        setDevices([]);

        // Acquire MulticastLock (Android only)
        if (Platform.OS === 'android') {
            try {
                const { MulticastLockModule } = NativeModules;
                if (MulticastLockModule) {
                    await MulticastLockModule.acquire();
                    addLog('✅ MulticastLock acquired');
                } else {
                    addLog('⚠️ MulticastLockModule not found');
                }
            } catch (e: any) {
                addLog(`❌ MulticastLock error: ${e.message}`);
            }
        }

        await new Promise(r => setTimeout(r, 200));

        try {
            // Create socket
            addLog('📡 Creating UDP socket...');
            socketRef.current = dgram.createSocket({ type: 'udp4' });

            // Bind
            socketRef.current.bind(UDP_PORT, (err: any) => {
                if (err) {
                    addLog(`❌ Bind failed: ${err}`);
                    Alert.alert('Erro UDP', String(err));
                    return;
                }
                addLog(`✅ Bound to port ${UDP_PORT}`);

                try {
                    socketRef.current.setBroadcast(true);
                    addLog('✅ Broadcast enabled');
                } catch (e: any) {
                    addLog(`⚠️ setBroadcast error: ${e}`);
                }
            });

            // Message handler
            socketRef.current.on('message', (msg: any, rinfo: any) => {
                try {
                    const data = JSON.parse(msg.toString());
                    if (data.app !== 'RichieDrop' || data.id === deviceIdRef.current) return;

                    // Store/update peer
                    const peer: Device = {
                        id: data.id,
                        name: data.name,
                        ip: rinfo.address,
                        port: data.tcp,
                        lastSeen: Date.now()
                    };

                    devicesMapRef.current.set(data.id, peer);
                    setDevices(Array.from(devicesMapRef.current.values()));
                    addLog(`📱 Device found: ${data.name} (${rinfo.address})`);

                    // Reply to DISCOVER with ANNOUNCE
                    if (data.t === 'DISCOVER') {
                        const announce = {
                            t: 'ANNOUNCE',
                            app: 'RichieDrop',
                            v: 1,
                            id: deviceIdRef.current,
                            name: myDeviceName,
                            tcp: TCP_PORT
                        };
                        const announceStr = JSON.stringify(announce);
                        socketRef.current.send(announceStr, 0, announceStr.length, UDP_PORT, rinfo.address, (err: any) => {
                            if (err) addLog(`ANNOUNCE error: ${err}`);
                        });
                    }
                } catch (e) {
                    // Ignore non-JSON messages
                }
            });

            // Send initial ANNOUNCE
            const hello = {
                t: 'ANNOUNCE',
                app: 'RichieDrop',
                v: 1,
                id: deviceIdRef.current,
                name: myDeviceName,
                tcp: TCP_PORT
            };
            sendPacket(hello);
            addLog('📢 Sent initial ANNOUNCE');

            // DISCOVER loop (1s)
            broadcastLoopRef.current = setInterval(() => {
                const discover = {
                    t: 'DISCOVER',
                    app: 'RichieDrop',
                    v: 1,
                    id: deviceIdRef.current,
                    name: myDeviceName,
                    tcp: TCP_PORT
                };
                sendPacket(discover);
            }, 1000);

            // ANNOUNCE loop (2.5s)
            announceLoopRef.current = setInterval(() => {
                const announce = {
                    t: 'ANNOUNCE',
                    app: 'RichieDrop',
                    v: 1,
                    id: deviceIdRef.current,
                    name: myDeviceName,
                    tcp: TCP_PORT
                };
                sendPacket(announce);
            }, 2500);

            // TTL cleanup (2s)
            ttlCleanupLoopRef.current = setInterval(() => {
                const now = Date.now();
                let changed = false;
                for (const [id, peer] of devicesMapRef.current) {
                    if (now - peer.lastSeen > 8000) {
                        devicesMapRef.current.delete(id);
                        changed = true;
                        addLog(`🗑️ Device expired: ${peer.name}`);
                    }
                }
                if (changed) {
                    setDevices(Array.from(devicesMapRef.current.values()));
                }
            }, 2000);

            addLog('✅ Discovery started!');
        } catch (e: any) {
            addLog(`❌ FATAL: ${e.message}`);
            Alert.alert('Erro Fatal UDP', e.message);
        }
    };

    // Stop UDP Discovery
    const stopDiscovery = () => {
        addLog('🛑 Stopping discovery...');
        setIsScanning(false);

        if (broadcastLoopRef.current) clearInterval(broadcastLoopRef.current);
        if (announceLoopRef.current) clearInterval(announceLoopRef.current);
        if (ttlCleanupLoopRef.current) clearInterval(ttlCleanupLoopRef.current);

        if (socketRef.current) {
            try {
                socketRef.current.close();
            } catch (e) { }
            socketRef.current = null;
        }

        // Release MulticastLock
        if (Platform.OS === 'android') {
            try {
                const { MulticastLockModule } = NativeModules;
                if (MulticastLockModule) {
                    MulticastLockModule.release();
                }
            } catch (e) { }
        }

        devicesMapRef.current.clear();
        setDevices([]);
        addLog('✅ Discovery stopped');
    };

    // File selection
    const handleSelectFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                const fileInfo = await FileSystem.getInfoAsync(asset.uri);

                const formatSize = (bytes: number) => {
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                };

                setSelectedFiles(prev => [...prev, {
                    name: asset.name,
                    uri: asset.uri,
                    size: fileInfo.exists && 'size' in fileInfo
                        ? formatSize(fileInfo.size)
                        : 'Unknown'
                }]);
                addLog(`📄 File selected: ${asset.name}`);
            }
        } catch (error: any) {
            addLog(`❌ File picker error: ${error.message}`);
            Alert.alert('Erro', 'Não foi possível selecionar o ficheiro');
        }
    };

    // Initialize
    useEffect(() => {
        const init = async () => {
            try {
                let savedName = await AsyncStorage.getItem(STORAGE_KEY);
                if (!savedName) {
                    savedName = `Android-${Math.floor(Math.random() * 1000)}`;
                    await AsyncStorage.setItem(STORAGE_KEY, savedName);
                }
                setMyDeviceName(savedName);
                addLog(`📱 Device name: ${savedName}`);
            } catch (e: any) {
                addLog(`⚠️ Init error: ${e.message}`);
            }
        };
        init();

        // Cleanup on unmount
        return () => {
            if (isScanning) {
                stopDiscovery();
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📡 RichieDrop</Text>
                <Text style={styles.headerSubtitle}>Visível como "{myDeviceName}"</Text>
            </View>

            {/* Discovery Controls */}
            <View style={styles.controls}>
                <Pressable
                    style={[styles.button, isScanning && styles.buttonActive]}
                    onPress={isScanning ? stopDiscovery : startDiscovery}
                >
                    <Text style={styles.buttonText}>
                        {isScanning ? '🛑 Parar Discovery' : '🚀 Iniciar Discovery'}
                    </Text>
                </Pressable>
            </View>

            {/* Devices List */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Dispositivos Encontrados ({devices.length})
                </Text>
                <ScrollView style={styles.deviceList}>
                    {devices.length === 0 ? (
                        <Text style={styles.emptyText}>
                            {isScanning ? 'A procurar...' : 'Inicia o discovery para encontrar dispositivos'}
                        </Text>
                    ) : (
                        devices.map(device => (
                            <View key={device.id} style={styles.deviceItem}>
                                <View style={styles.deviceInfo}>
                                    <Text style={styles.deviceName}>{device.name}</Text>
                                    <Text style={styles.deviceDetails}>
                                        {device.ip}:{device.port}
                                    </Text>
                                </View>
                                <View style={styles.statusDot} />
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* File Selection */}
            <View style={styles.section}>
                <Pressable style={styles.selectButton} onPress={handleSelectFile}>
                    <Text style={styles.selectButtonText}>📁 Selecionar Ficheiro</Text>
                </Pressable>
                {selectedFiles.map((file, idx) => (
                    <View key={idx} style={styles.fileItem}>
                        <Text style={styles.fileName}>{file.name}</Text>
                        <Text style={styles.fileSize}>{file.size}</Text>
                    </View>
                ))}
            </View>

            {/* Logs */}
            <View style={styles.logsSection}>
                <Text style={styles.logsTitle}>📋 Logs</Text>
                <ScrollView style={styles.logsList}>
                    {logs.map((log, idx) => (
                        <Text key={idx} style={styles.logText}>{log}</Text>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 16,
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffffff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 6,
    },
    controls: {
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    buttonActive: {
        backgroundColor: '#ef4444',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e2e8f0',
        marginBottom: 12,
    },
    deviceList: {
        maxHeight: 150,
    },
    deviceItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    deviceDetails: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22c55e',
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        padding: 20,
    },
    selectButton: {
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    selectButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    fileItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#e2e8f0',
    },
    fileSize: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    logsSection: {
        flex: 1,
        marginTop: 8,
    },
    logsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 8,
    },
    logsList: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 8,
        padding: 8,
    },
    logText: {
        fontSize: 11,
        color: '#64748b',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 2,
    },
});
