/**
 * RichieDrop Android - NUCLEAR MAXIMUM + FEATURES (SAFE MODE)
 * 
 * ALL CODE INLINE - NO LAZY LOADING - NO DYNAMICS - NO NATIVE LIBS
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
    Platform
} from 'react-native';

// LogBox.ignoreLogs(['new NativeEventEmitter']); 

// --- MOCK DISCOVERY SERVICE (SAFE MODE) ---
// Native Zeroconf causes crashes on startup, using mock for UI validation
class SafeDiscoveryService {
    deviceName = '';
    isScanning = false;
    devices = new Map();
    listeners = [];
    mockInterval = null;

    constructor() {
        console.log('[Discovery] Safe/Mock instance created');
    }

    async start(name) {
        this.deviceName = name;
        this.devices.clear();
        this.notify();
        this.isScanning = true;
        console.log('[Discovery] Started scanning (MOCK)');

        // Simulate finding a device after 2 seconds
        this.mockInterval = setTimeout(() => {
            if (!this.isScanning) return;
            const mockDevice = {
                id: 'mock-macbook',
                name: "Ricardo's MacBook Pro (Mock)",
                ip: '192.168.1.50',
                type: 'computer'
            };
            console.log('[Discovery] Found mock device:', mockDevice.name);
            this.devices.set(mockDevice.name, mockDevice);
            this.notify();
        }, 2500);
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

const RadarRing = ({ delay, duration }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const animate = () => {
            scale.setValue(0);
            opacity.setValue(0.5);

            Animated.parallel([
                Animated.timing(scale, {
                    toValue: 2.5,
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
                    backfaceVisibility: 'hidden', // optimization
                    transform: [{ scale }],
                    opacity
                }
            ]}
        />
    );
};

// Main App Component
function App() {
    // Generate a random name if not stored
    const [deviceName] = useState(`Android-${Math.floor(Math.random() * 1000)}`);
    const [devices, setDevices] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    // Start discovery on mount
    useEffect(() => {
        console.log('App Mounted, starting discovery...');
        discovery.start(deviceName);
        const unsub = discovery.subscribe((updatedDevices) => {
            setDevices(updatedDevices);
        });

        return () => {
            unsub();
            discovery.stop();
        };
    }, []);

    const handleSelectFile = () => {
        // Placeholder for now
        Alert.alert('Selecionar Ficheiro', 'A abrir seletor de ficheiros (Simulado)...');
    };

    const handleSend = (targetDevice) => {
        Alert.alert('Enviar', `Enviar ficheiro para ${targetDevice.name}?`);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📡 RichieDrop</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#22c55e' }]}>
                    <Text style={styles.statusText}>Visível como {deviceName}</Text>
                </View>
            </View>

            {/* Radar Section (Center) */}
            <View style={styles.radarContainer}>
                {/* Rings */}
                <RadarRing delay={0} duration={3000} />
                <RadarRing delay={1000} duration={3000} />
                <RadarRing delay={2000} duration={3000} />

                {/* Center / Me */}
                <View style={styles.meCircle}>
                    <Text style={styles.meIcon}>📱</Text>
                </View>

                {/* Orbiting Devices */}
                {devices.map((device, index) => {
                    // Simple logic to position devices around the center
                    // standard angles based on index
                    const angle = (index * (360 / (devices.length || 1))) * (Math.PI / 180);
                    const radius = 140; // distance from center
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    return (
                        <Pressable
                            key={device.id}
                            style={[styles.deviceNode, { transform: [{ translateX: x }, { translateY: y }] }]}
                            onPress={() => handleSend(device)}
                        >
                            <View style={styles.deviceIconCircle}>
                                <Text style={styles.deviceIcon}>💻</Text>
                            </View>
                            <Text style={styles.deviceName}>{device.name}</Text>
                        </Pressable>
                    );
                })}

                {devices.length === 0 && (
                    <Text style={styles.scanningText}>A procurar dispositivos...</Text>
                )}
            </View>

            {/* File Actions */}
            <View style={styles.footer}>
                <Pressable style={styles.actionButton} onPress={handleSelectFile}>
                    <Text style={styles.actionButtonText}>
                        {selectedFile ? '📄 Ficheiro Selecionado' : 'PLUS Selecionar Ficheiro'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a', // Slate 900
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#f8fafc', // Slate 50
        letterSpacing: -0.5,
    },
    statusBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    radarContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    radarRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderColor: '#38bdf8', // Sky 400
        borderWidth: 2,
    },
    meCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#3b82f6', // Blue 500
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    meIcon: {
        fontSize: 36,
    },
    scanningText: {
        position: 'absolute',
        bottom: '20%',
        color: '#94a3b8',
        fontSize: 16,
    },
    deviceNode: {
        position: 'absolute',
        alignItems: 'center',
        zIndex: 20,
    },
    deviceIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1e293b', // Slate 800
        borderColor: '#22d3ee', // Cyan 400
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    deviceIcon: {
        fontSize: 28,
    },
    deviceName: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    footer: {
        padding: 30,
        paddingBottom: 50,
    },
    actionButton: {
        backgroundColor: '#22d3ee', // Cyan 400
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#22d3ee',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    actionButtonText: {
        color: '#0f172a',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

// Register app
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App);
