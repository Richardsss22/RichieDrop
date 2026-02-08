/**
 * RichieDrop Android - Main App Screen
 * File sharing app compatible with desktop version
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    useWindowDimensions,
    Alert,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import {
    Header,
    RadarView,
    DeviceCard,
    FilePanel,
    TransferModal,
    SettingsModal,
    HistoryModal,
    UIDevice,
    SelectedFile,
    TransferHistoryItem,
} from '@/components';

import {
    startDiscovery,
    stopDiscovery,
    onDeviceFound,
    onDeviceLost,
    Device,
    sendFile,
    receiveFile,
    onTransferRequest,
    setDeviceName,
    TransferRequest,
} from '@/services';

const STORAGE_KEY = 'richiedrop_name';
const DEFAULT_PORT = 8080;

export default function HomeScreen() {
    const { width, height } = useWindowDimensions();

    // Device discovery state
    const [myDeviceName, setMyDeviceName] = useState('Android');
    const [foundDevices, setFoundDevices] = useState<UIDevice[]>([]);
    const [scanning, setScanning] = useState(true);

    // File selection state
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

    // Modal states
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Transfer state
    const [incomingTransfer, setIncomingTransfer] = useState<TransferRequest | null>(null);
    const [isReceiving, setIsReceiving] = useState(false);
    const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);

    // Initialize discovery
    useEffect(() => {
        const init = async () => {
            // Load saved device name
            let savedName = await AsyncStorage.getItem(STORAGE_KEY);
            if (!savedName) {
                savedName = `Android-${Math.floor(Math.random() * 1000)}`;
                await AsyncStorage.setItem(STORAGE_KEY, savedName);
            }
            setMyDeviceName(savedName);
            setDeviceName(savedName);

            // Start mDNS discovery
            try {
                await startDiscovery(savedName, DEFAULT_PORT);
                setScanning(true);
            } catch (error) {
                console.error('Failed to start discovery:', error);
                Alert.alert('Erro', 'Não foi possível iniciar a descoberta de dispositivos');
            }
        };

        init();

        // Cleanup
        return () => {
            stopDiscovery();
        };
    }, []);

    // Listen for device events
    useEffect(() => {
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

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Remove file from selection
    const handleRemoveFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Clear all files
    const handleClearFiles = () => {
        setSelectedFiles([]);
    };

    // Send file to device
    const handleSendToDevice = async (deviceId: string) => {
        if (selectedFiles.length === 0) {
            Alert.alert('Atenção', 'Seleciona um ficheiro primeiro');
            return;
        }

        const device = foundDevices.find((d) => d.id === deviceId);
        if (!device) return;

        const file = selectedFiles[0];

        // Update UI to sending state
        setFoundDevices((prev) =>
            prev.map((d) =>
                d.id === deviceId ? { ...d, status: 'sending', progress: 0 } : d
            )
        );

        try {
            // Simulate progress
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

            // Success state
            setFoundDevices((prev) =>
                prev.map((d) =>
                    d.id === deviceId ? { ...d, status: 'success', progress: 100 } : d
                )
            );

            // Add to history
            addToHistory(file.name, device.name, true);

            // Reset after delay
            setTimeout(() => {
                setFoundDevices((prev) =>
                    prev.map((d) =>
                        d.id === deviceId ? { ...d, status: 'idle', progress: 0 } : d
                    )
                );
            }, 3000);
        } catch (error) {
            console.error('Send failed:', error);
            Alert.alert('Erro', 'Falha ao enviar ficheiro');

            setFoundDevices((prev) =>
                prev.map((d) =>
                    d.id === deviceId ? { ...d, status: 'idle', progress: 0 } : d
                )
            );

            addToHistory(file.name, device.name, false);
        }
    };

    // Accept incoming transfer
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

    // Reject incoming transfer
    const handleRejectTransfer = () => {
        setIncomingTransfer(null);
    };

    // Add to transfer history
    const addToHistory = (name: string, device: string, success: boolean) => {
        const now = new Date();
        const time = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

        setTransferHistory((prev) =>
            [{ name, device, time, success }, ...prev].slice(0, 20)
        );
    };

    // Save settings
    const handleSaveSettings = async (name: string) => {
        await AsyncStorage.setItem(STORAGE_KEY, name);
        setMyDeviceName(name);
        setDeviceName(name);

        // Restart discovery with new name
        stopDiscovery();
        await startDiscovery(name, DEFAULT_PORT);

        setShowSettings(false);
    };

    // Calculate radar center
    const radarCenterX = width / 2;
    const radarCenterY = height * 0.35;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Background gradient */}
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#0f172a']}
                style={StyleSheet.absoluteFill}
            />

            {/* Ambient glow effects */}
            <View style={[styles.glow, styles.glowPurple]} />
            <View style={[styles.glow, styles.glowCyan]} />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <Header
                    deviceName={myDeviceName}
                    onHistoryPress={() => setShowHistory(true)}
                    onSettingsPress={() => setShowSettings(true)}
                />

                {/* Radar section */}
                <View style={styles.radarSection}>
                    <RadarView scanning={scanning}>
                        {foundDevices.map((device, index) => (
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
                        ))}
                    </RadarView>

                    {foundDevices.length === 0 && (
                        <Text style={styles.scanningText}>
                            A procurar dispositivos próximos...
                        </Text>
                    )}
                </View>

                {/* File panel */}
                <View style={styles.fileSection}>
                    <FilePanel
                        files={selectedFiles}
                        onSelectFile={handleSelectFile}
                        onRemoveFile={handleRemoveFile}
                        onClearAll={handleClearFiles}
                    />
                </View>
            </SafeAreaView>

            {/* Modals */}
            <TransferModal
                visible={incomingTransfer !== null}
                filename={incomingTransfer?.filename || ''}
                filesize={incomingTransfer?.filesize || ''}
                senderName={incomingTransfer?.senderName || ''}
                isReceiving={isReceiving}
                onAccept={handleAcceptTransfer}
                onReject={handleRejectTransfer}
            />

            <SettingsModal
                visible={showSettings}
                deviceName={myDeviceName}
                onSave={handleSaveSettings}
                onClose={() => setShowSettings(false)}
            />

            <HistoryModal
                visible={showHistory}
                history={transferHistory}
                onClose={() => setShowHistory(false)}
            />
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
});
