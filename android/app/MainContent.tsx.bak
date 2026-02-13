/**
 * MainContent - Ultra-Minimal Version (SURVIVAL MODE)
 * 
 * CRITICAL: This version does NOT import @/components or @/services
 * Those barrel files trigger native module crashes on some devices.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Pressable,
    ActivityIndicator,
    Alert,
} from 'react-native';

// Core dependencies only - no SVG, no Reanimated, no complex imports
let AsyncStorage: any = { getItem: async () => null, setItem: async () => { } };
let DocumentPicker: any = { getDocumentAsync: async () => ({ canceled: true }) };
let FileSystem: any = { getInfoAsync: async () => ({ exists: false }) };

try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) { console.warn('AsyncStorage failed'); }

try {
    DocumentPicker = require('expo-document-picker');
} catch (e) { console.warn('DocumentPicker failed'); }

try {
    FileSystem = require('expo-file-system');
} catch (e) { console.warn('FileSystem failed'); }

// Constants
const STORAGE_KEY = 'richiedrop_name';

interface SelectedFile {
    name: string;
    uri: string;
    size?: string;
}

export default function MainContent() {
    const [myDeviceName, setMyDeviceName] = useState('Android');
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            try {
                let savedName = await AsyncStorage.getItem(STORAGE_KEY);
                if (!savedName) {
                    savedName = `Android-${Math.floor(Math.random() * 1000)}`;
                    await AsyncStorage.setItem(STORAGE_KEY, savedName);
                }
                setMyDeviceName(savedName);
            } catch (e) {
                console.warn('Init error:', e);
            }
            setIsLoading(false);
        };
        init();
    }, []);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

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
            Alert.alert('Erro', 'Não foi possível selecionar o ficheiro');
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#06b6d4" />
                <Text style={styles.loadingText}>A inicializar...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📡 RichieDrop</Text>
                <Text style={styles.headerSubtitle}>Visível como "{myDeviceName}"</Text>
            </View>

            {/* Radar placeholder */}
            <View style={styles.radarSection}>
                <View style={styles.radarCircle}>
                    <Text style={styles.radarIcon}>📱</Text>
                </View>
                <Text style={styles.radarText}>A procurar dispositivos próximos...</Text>
                <Text style={styles.radarHint}>
                    Abre o RichieDrop no teu computador para transferir ficheiros
                </Text>
            </View>

            {/* File selection */}
            <View style={styles.fileSection}>
                <Pressable style={styles.selectButton} onPress={handleSelectFile}>
                    <Text style={styles.selectButtonIcon}>📁</Text>
                    <Text style={styles.selectButtonText}>Selecionar Ficheiro</Text>
                </Pressable>

                {selectedFiles.length > 0 && (
                    <View style={styles.fileList}>
                        {selectedFiles.map((file, index) => (
                            <View key={index} style={styles.fileItem}>
                                <View style={styles.fileInfo}>
                                    <Text style={styles.fileName}>{file.name}</Text>
                                    <Text style={styles.fileSize}>{file.size}</Text>
                                </View>
                                <Pressable
                                    style={styles.removeButton}
                                    onPress={() => handleRemoveFile(index)}
                                >
                                    <Text style={styles.removeButtonText}>✕</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Status bar */}
            <View style={styles.statusBar}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>App iniciada com sucesso!</Text>
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
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#94a3b8',
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
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
    radarSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radarCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#1e293b',
        borderWidth: 3,
        borderColor: '#22d3ee',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22d3ee',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    radarIcon: {
        fontSize: 50,
    },
    radarText: {
        fontSize: 16,
        color: '#e2e8f0',
        marginTop: 24,
    },
    radarHint: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    fileSection: {
        paddingVertical: 24,
    },
    selectButton: {
        flexDirection: 'row',
        backgroundColor: '#3b82f6',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    selectButtonIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    selectButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#ffffff',
    },
    fileList: {
        marginTop: 16,
    },
    fileItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    fileInfo: {
        flex: 1,
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
    removeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        fontSize: 14,
        color: '#ef4444',
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22c55e',
        marginRight: 8,
    },
    statusText: {
        fontSize: 12,
        color: '#22c55e',
    },
});
