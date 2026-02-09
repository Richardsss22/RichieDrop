/**
 * RichieDrop Android - UI MATCH UPDATE
 * 
 * Matching Desktop UI (Dark Gradient, Dashed File Area)
 * Safe Mode (Mock Discovery) to ensure stability
 */

import { AppRegistry, LogBox } from 'react-native';
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
    Platform,
    Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, History, FileText, Smartphone, Monitor, CheckCircle, Share2, UploadCloud } from 'lucide-react-native';

// Ignore specific logs
LogBox.ignoreLogs(['new NativeEventEmitter']);

// --- MOCK DISCOVERY SERVICE (SAFE MODE) ---
class SafeDiscoveryService {
    deviceName = '';
    isScanning = false;
    devices = new Map();
    listeners = [];
    mockInterval = null;

    async start(name) {
        this.deviceName = name;
        this.devices.clear();
        this.notify();
        this.isScanning = true;

        // Mock finding a device
        this.mockInterval = setTimeout(() => {
            if (!this.isScanning) return;
            const mockDevice = {
                id: 'mock-mac-air',
                name: "MAC AIR",
                ip: '192.168.1.100',
                type: 'computer'
            };
            this.devices.set(mockDevice.name, mockDevice);
            this.notify();
        }, 2000);
    }

    stop() {
        this.isScanning = false;
        if (this.mockInterval) clearTimeout(this.mockInterval);
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

const discovery = new SafeDiscoveryService();

// --- COMPONENTS ---

// Animated Pulse Ring
const RadarRing = ({ delay, duration }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animate = () => {
            scale.setValue(0);
            opacity.setValue(0.3);

            Animated.parallel([
                Animated.timing(scale, {
                    toValue: 3,
                    duration: duration,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                    delay: delay
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: duration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                    delay: delay
                })
            ]).start(() => animate());
        };
        animate();
    }, []);

    return (
        <Animated.View
            style={[
                styles.radarRing,
                {
                    transform: [{ scale }],
                    opacity
                }
            ]}
        />
    );
};

// Main App Component
function App() {
    const [deviceName] = useState(`Android-${Math.floor(Math.random() * 1000)}`);
    const [devices, setDevices] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        discovery.start(deviceName);
        const unsub = discovery.subscribe(setDevices);
        return () => {
            unsub();
            discovery.stop();
        };
    }, []);

    const handleSelectFile = () => {
        Alert.alert('Selecionar', 'Abrir seletor de ficheiros...');
        // Mock selection
        setTimeout(() => setSelectedFile("foto_ferias.jpg"), 500);
    };

    const handleSend = (target) => {
        Alert.alert('Enviar', `Enviar ${selectedFile || 'ficheiro'} para ${target.name}?`);
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
                        <Text style={styles.appName}>RichieDrop</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                            <Text style={styles.statusText}>Visível como "{deviceName}"</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <Pressable style={styles.iconButton}>
                        <History size={20} color="#94a3b8" />
                    </Pressable>
                    <Pressable style={styles.iconButton}>
                        <Settings size={20} color="#94a3b8" />
                    </Pressable>
                </View>
            </View>

            {/* Main Content: Split into Radar and File Area */}
            <View style={styles.content}>

                {/* Radar Section */}
                <View style={styles.radarSection}>
                    <RadarRing delay={0} duration={3000} />
                    <RadarRing delay={1000} duration={3000} />

                    {/* Me Node */}
                    <View style={styles.meNode}>
                        <Smartphone size={32} color="#fff" />
                    </View>

                    {/* Devices */}
                    {devices.map((device, i) => {
                        // Orbit logic
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

                    {devices.length === 0 && (
                        <Text style={styles.searchingText}>A procurar dispositivos próximos...</Text>
                    )}
                </View>

                {/* File Drop Area (Replicated from screenshot) */}
                <View style={styles.fileAreaContainer}>
                    <Pressable style={styles.fileDropZone} onPress={handleSelectFile}>
                        {selectedFile ? (
                            <View style={styles.fileSelectedState}>
                                <CheckCircle size={40} color="#22c55e" />
                                <Text style={styles.fileSelectedText}>{selectedFile}</Text>
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
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(34, 211, 238, 0.15)', // Cyan tint
        justifyContent: 'center',
        alignItems: 'center',
    },
    appName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
    },
    radarSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    radarRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    meNode: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    searchingText: {
        position: 'absolute',
        bottom: 40,
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
    },
    deviceNode: {
        position: 'absolute',
        alignItems: 'center',
        zIndex: 20,
    },
    deviceIconBg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1e293b',
        borderWidth: 2,
        borderColor: '#22d3ee', // Accent
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        shadowColor: '#22d3ee',
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    deviceLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    fileAreaContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    fileDropZone: {
        height: 220,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    uploadIconCircle: {
        marginBottom: 16,
    },
    dropMainText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    dropSubText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 24,
    },
    selectButton: {
        backgroundColor: '#22d3ee',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 30,
        shadowColor: '#22d3ee',
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    selectButtonText: {
        color: '#0f172a',
        fontWeight: '700',
        fontSize: 15,
    },
    fileSelectedState: {
        alignItems: 'center',
    },
    fileSelectedText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    fileSubText: {
        color: '#22c55e',
        marginTop: 4,
    }
});

// Register app
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App);
