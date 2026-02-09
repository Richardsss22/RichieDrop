/**
 * MainContent - The actual app content, loaded lazily
 * This allows the main index.tsx to catch any import errors
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    useWindowDimensions,
    Alert,
    StatusBar,
    Pressable,
    ScrollView,
} from 'react-native';

// Safe conditional imports for optional modules
let SafeAreaView: any = View;
let LinearGradient: any = View;
let AsyncStorage: any = { getItem: async () => null, setItem: async () => { } };
let DocumentPicker: any = { getDocumentAsync: async () => ({ canceled: true }) };
let FileSystem: any = { getInfoAsync: async () => ({ exists: false }), documentDirectory: '' };

// Components - import safely
let Header: any = null;
let RadarView: any = null;
let DeviceCard: any = null;
let FilePanel: any = null;
let TransferModal: any = null;
let SettingsModal: any = null;
let HistoryModal: any = null;

// Services
let startDiscovery: any = async () => { };
let stopDiscovery: any = () => { };
let onDeviceFound: any = () => () => { };
let onDeviceLost: any = () => () => { };
let sendFile: any = async () => { };
let receiveFile: any = async () => { };
let onTransferRequest: any = () => () => { };
let setDeviceName: any = () => { };

// Track what loaded successfully
const loadStatus = {
    safeArea: false,
    gradient: false,
    storage: false,
    docPicker: false,
    fileSystem: false,
    components: false,
    services: false,
};

// Try loading each dependency
try {
    SafeAreaView = require('react-native-safe-area-context').SafeAreaView;
    loadStatus.safeArea = true;
} catch (e) { console.warn('SafeAreaView failed:', e); }

try {
    LinearGradient = require('expo-linear-gradient').LinearGradient;
    loadStatus.gradient = true;
} catch (e) { console.warn('LinearGradient failed:', e); }

try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
    loadStatus.storage = true;
} catch (e) { console.warn('AsyncStorage failed:', e); }

try {
    DocumentPicker = require('expo-document-picker');
    loadStatus.docPicker = true;
} catch (e) { console.warn('DocumentPicker failed:', e); }

try {
    FileSystem = require('expo-file-system');
    loadStatus.fileSystem = true;
} catch (e) { console.warn('FileSystem failed:', e); }

try {
    const components = require('@/components');
    Header = components.Header;
    RadarView = components.RadarView;
    DeviceCard = components.DeviceCard;
    FilePanel = components.FilePanel;
    TransferModal = components.TransferModal;
    SettingsModal = components.SettingsModal;
    HistoryModal = components.HistoryModal;
    loadStatus.components = true;
} catch (e) { console.warn('Components failed:', e); }

try {
    const services = require('@/services');
    startDiscovery = services.startDiscovery;
    stopDiscovery = services.stopDiscovery;
    onDeviceFound = services.onDeviceFound;
    onDeviceLost = services.onDeviceLost;
    sendFile = services.sendFile;
    receiveFile = services.receiveFile;
    onTransferRequest = services.onTransferRequest;
    setDeviceName = services.setDeviceName;
    loadStatus.services = true;
} catch (e) { console.warn('Services failed:', e); }

// Type definitions
interface UIDevice {
    id: string;
    name: string;
    ip: string;
    port: number;
    type: 'mobile' | 'laptop' | 'desktop';
    status: 'idle' | 'sending' | 'success';
    progress: number;
    lastSeen: number;
}

interface SelectedFile {
    name: string;
    uri: string;
    size?: string;
}

interface TransferHistoryItem {
    name: string;
    device: string;
    time: string;
    success: boolean;
}

interface TransferRequest {
    filename: string;
    filesize: string;
    senderName: string;
    downloadUrl: string;
}

interface Device {
    id: string;
    name: string;
    ip: string;
    port: number;
    lastSeen: number;
}

const STORAGE_KEY = 'richiedrop_name';
const DEFAULT_PORT = 8080;

// Fallback simple header
function SimpleHeader({ deviceName, onSettingsPress }: { deviceName: string; onSettingsPress: () => void }) {
    return (
        <View style={styles.simpleHeader}>
            <Text style={styles.simpleHeaderTitle}>📡 RichieDrop</Text>
            <Text style={styles.simpleHeaderSubtitle}>Visível como "{deviceName}"</Text>
        </View>
    );
}

// Fallback simple file panel
function SimpleFilePanel({ onSelectFile }: { onSelectFile: () => void }) {
    return (
        <Pressable style={styles.simpleFilePanel} onPress={onSelectFile}>
            <Text style={styles.simpleFilePanelText}>📁 Toca para selecionar ficheiros</Text>
        </Pressable>
    );
}

export default function MainContent() {
    const { width, height } = useWindowDimensions();

    // Device discovery state
    const [myDeviceName, setMyDeviceName] = useState('Android');
    const [foundDevices, setFoundDevices] = useState<UIDevice[]>([]);
    const [scanning, setScanning] = useState(false);

    // File selection state
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

    // Modal states
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Transfer state
    const [incomingTransfer, setIncomingTransfer] = useState<TransferRequest | null>(null);
    const [isReceiving, setIsReceiving] = useState(false);
    const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);

    // Initialize
    useEffect(() => {
        const init = async () => {
            try {
                // Load saved device name
                let savedName = await AsyncStorage.getItem(STORAGE_KEY);
                if (!savedName) {
                    savedName = `Android-${Math.floor(Math.random() * 1000)}`;
                    await AsyncStorage.setItem(STORAGE_KEY, savedName);
                }
                setMyDeviceName(savedName);

                if (loadStatus.services) {
                    setDeviceName(savedName);
                    await startDiscovery(savedName, DEFAULT_PORT);
                    setScanning(true);
                }
            } catch (error) {
                console.warn('Initialization error:', error);
            }
        };

        init();

        return () => {
            try {
                stopDiscovery();
            } catch (e) {
                // Ignore
            }
        };
    }, []);

    // Listen for device events
    useEffect(() => {
        if (!loadStatus.services) return;

        const unsubscribeFound = onDeviceFound((device: Device) => {
            setFoundDevices((prev) => {
                if (prev.find((d) => d.id === device.id)) return prev;
                return [...prev, mapDeviceToUI(device)];
            });
        });

        const unsubscribeLost = onDeviceLost((deviceId: string) => {
            setFoundDevices((prev) => prev.filter((d) => d.id !== deviceId));
        });

        const unsubscribeTransfer = onTransferRequest((request: TransferRequest) => {
            setIncomingTransfer(request);
        });

        return () => {
            unsubscribeFound();
            unsubscribeLost();
            unsubscribeTransfer();
        };
    }, []);

    // Map Device to UIDevice
    const mapDeviceToUI = (device: Device): UIDevice => {
        const name = device.name.toLowerCase();
        let type: UIDevice['type'] = 'laptop';
        if (name.includes('iphone') || name.includes('android') || name.includes('mobile')) {
            type = 'mobile';
        } else if (name.includes('desktop') || name.includes('pc') || name.includes('windows')) {
            type = 'desktop';
        }

        return {
            ...device,
            type,
            status: 'idle',
            progress: 0,
        };
    };

    // Handle file selection
    const handleSelectFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                const fileInfo = await FileSystem.getInfoAsync(asset.uri);

                setSelectedFiles((prev) => [
                    ...prev,
                    {
                        name: asset.name,
                        uri: asset.uri,
                        size: fileInfo.exists && 'size' in fileInfo
                            ? formatFileSize(fileInfo.size)
                            : 'Tamanho desconhecido',
                    },
                ]);
            }
        } catch (error) {
            console.error('Error picking document:', error);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleClearFiles = () => {
        setSelectedFiles([]);
    };

    const handleSendToDevice = async (deviceId: string) => {
        if (selectedFiles.length === 0) {
            Alert.alert('Atenção', 'Seleciona um ficheiro primeiro');
            return;
        }

        const device = foundDevices.find((d) => d.id === deviceId);
        if (!device) return;

        const file = selectedFiles[0];

        setFoundDevices((prev) =>
            prev.map((d) =>
                d.id === deviceId ? { ...d, status: 'sending' as const, progress: 0 } : d
            )
        );

        try {
            const progressInterval = setInterval(() => {
                setFoundDevices((prev) =>
                    prev.map((d) =>
                        d.id === deviceId && d.status === 'sending'
                            ? { ...d, progress: Math.min(d.progress + 5, 95) }
                            : d
                    )
                );
            }, 100);

            await sendFile(device, file.uri, file.name, file.size || 'Unknown');

            clearInterval(progressInterval);

            setFoundDevices((prev) =>
                prev.map((d) =>
                    d.id === deviceId ? { ...d, status: 'success' as const, progress: 100 } : d
                )
            );

            addToHistory(file.name, device.name, true);

            setTimeout(() => {
                setFoundDevices((prev) =>
                    prev.map((d) =>
                        d.id === deviceId ? { ...d, status: 'idle' as const, progress: 0 } : d
                    )
                );
            }, 3000);
        } catch (error) {
            console.error('Send failed:', error);
            Alert.alert('Erro', 'Falha ao enviar ficheiro');

            setFoundDevices((prev) =>
                prev.map((d) =>
                    d.id === deviceId ? { ...d, status: 'idle' as const, progress: 0 } : d
                )
            );

            addToHistory(file.name, device.name, false);
        }
    };

    const handleAcceptTransfer = async () => {
        if (!incomingTransfer) return;

        setIsReceiving(true);

        try {
            const savePath = `${FileSystem.documentDirectory}${incomingTransfer.filename}`;
            await receiveFile(incomingTransfer.downloadUrl, savePath);

            setIsReceiving(false);
            setIncomingTransfer(null);

            Alert.alert('Sucesso', 'Ficheiro recebido com sucesso!');
            addToHistory(incomingTransfer.filename, incomingTransfer.senderName, true);
        } catch (error) {
            console.error('Receive failed:', error);
            Alert.alert('Erro', 'Falha ao receber ficheiro');
            setIsReceiving(false);
        }
    };

    const handleRejectTransfer = () => {
        setIncomingTransfer(null);
    };

    const addToHistory = (name: string, device: string, success: boolean) => {
        const now = new Date();
        const time = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

        setTransferHistory((prev) =>
            [{ name, device, time, success }, ...prev].slice(0, 20)
        );
    };

    const handleSaveSettings = async (name: string) => {
        await AsyncStorage.setItem(STORAGE_KEY, name);
        setMyDeviceName(name);

        if (loadStatus.services) {
            setDeviceName(name);
            stopDiscovery();
            await startDiscovery(name, DEFAULT_PORT);
        }

        setShowSettings(false);
    };

    const radarCenterX = width / 2;
    const radarCenterY = height * 0.35;

    // Check if we have components loaded
    const hasFullUI = loadStatus.components && Header && RadarView && FilePanel;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Background */}
            {loadStatus.gradient ? (
                <LinearGradient
                    colors={['#0f172a', '#1e293b', '#0f172a']}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0f172a' }]} />
            )}

            {/* Glow effects */}
            <View style={[styles.glow, styles.glowPurple]} />
            <View style={[styles.glow, styles.glowCyan]} />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                {hasFullUI && Header ? (
                    <Header
                        deviceName={myDeviceName}
                        onHistoryPress={() => setShowHistory(true)}
                        onSettingsPress={() => setShowSettings(true)}
                    />
                ) : (
                    <SimpleHeader
                        deviceName={myDeviceName}
                        onSettingsPress={() => setShowSettings(true)}
                    />
                )}

                {/* Radar section */}
                <View style={styles.radarSection}>
                    {hasFullUI && RadarView ? (
                        <RadarView scanning={scanning}>
                            {foundDevices.map((device, index) => (
                                DeviceCard && (
                                    <DeviceCard
                                        key={device.id}
                                        device={device}
                                        index={index}
                                        total={foundDevices.length}
                                        centerX={radarCenterX}
                                        centerY={140}
                                        radius={110}
                                        onPress={() => handleSendToDevice(device.id)}
                                    />
                                )
                            ))}
                        </RadarView>
                    ) : (
                        <View style={styles.simpleRadar}>
                            <View style={styles.simpleRadarCircle}>
                                <Text style={styles.simpleRadarIcon}>📱</Text>
                            </View>
                            {scanning ? (
                                <Text style={styles.scanningText}>A procurar dispositivos...</Text>
                            ) : (
                                <Text style={styles.scanningText}>Descoberta desativada</Text>
                            )}
                            {foundDevices.length > 0 && (
                                <Text style={styles.deviceCount}>
                                    {foundDevices.length} dispositivo(s) encontrado(s)
                                </Text>
                            )}
                        </View>
                    )}

                    {foundDevices.length === 0 && (
                        <Text style={styles.scanningText}>
                            A procurar dispositivos próximos...
                        </Text>
                    )}
                </View>

                {/* File panel */}
                <View style={styles.fileSection}>
                    {hasFullUI && FilePanel ? (
                        <FilePanel
                            files={selectedFiles}
                            onSelectFile={handleSelectFile}
                            onRemoveFile={handleRemoveFile}
                            onClearAll={handleClearFiles}
                        />
                    ) : (
                        <SimpleFilePanel onSelectFile={handleSelectFile} />
                    )}
                </View>
            </SafeAreaView>

            {/* Modals - only if components loaded */}
            {hasFullUI && TransferModal && (
                <TransferModal
                    visible={incomingTransfer !== null}
                    filename={incomingTransfer?.filename || ''}
                    filesize={incomingTransfer?.filesize || ''}
                    senderName={incomingTransfer?.senderName || ''}
                    isReceiving={isReceiving}
                    onAccept={handleAcceptTransfer}
                    onReject={handleRejectTransfer}
                />
            )}

            {hasFullUI && SettingsModal && (
                <SettingsModal
                    visible={showSettings}
                    deviceName={myDeviceName}
                    onSave={handleSaveSettings}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {hasFullUI && HistoryModal && (
                <HistoryModal
                    visible={showHistory}
                    history={transferHistory}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    safeArea: {
        flex: 1,
        padding: 16,
    },
    glow: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.15,
    },
    glowPurple: {
        top: -100,
        left: -100,
        backgroundColor: '#9333ea',
    },
    glowCyan: {
        bottom: -100,
        right: -100,
        backgroundColor: '#06b6d4',
    },
    radarSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    scanningText: {
        position: 'absolute',
        bottom: 40,
        fontSize: 13,
        color: '#64748b',
    },
    fileSection: {
        paddingTop: 16,
    },
    // Simple fallback styles
    simpleHeader: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    simpleHeaderTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    simpleHeaderSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    simpleFilePanel: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 32,
        alignItems: 'center',
    },
    simpleFilePanelText: {
        fontSize: 16,
        color: '#94a3b8',
    },
    simpleRadar: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    simpleRadarCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#1e293b',
        borderWidth: 2,
        borderColor: '#22d3ee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    simpleRadarIcon: {
        fontSize: 40,
    },
    deviceCount: {
        marginTop: 16,
        fontSize: 14,
        color: '#22d3ee',
    },
});
