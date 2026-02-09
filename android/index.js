/**
 * RichieDrop Android - NUCLEAR MAXIMUM
 * 
 * ALL CODE INLINE - NO LAZY LOADING - NO DYNAMIC IMPORTS
 * This mirrors Build #31 which WORKED
 */

import { AppRegistry } from 'react-native';
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Pressable,
    Alert,
} from 'react-native';

// Main App Component - EVERYTHING INLINE
function App() {
    const [deviceName] = useState(`Android-${Math.floor(Math.random() * 1000)}`);
    const [selectedFile, setSelectedFile] = useState(null);

    const handleSelectFile = () => {
        Alert.alert(
            'Selecionar Ficheiro',
            'Esta funcionalidade requer módulos nativos que estão desativados temporariamente.',
            [{ text: 'OK' }]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📡 RichieDrop</Text>
                <Text style={styles.headerSubtitle}>Visível como "{deviceName}"</Text>
            </View>

            {/* Radar placeholder */}
            <View style={styles.radarSection}>
                <View style={styles.radarCircle}>
                    <Text style={styles.radarIcon}>📱</Text>
                </View>
                <Text style={styles.radarText}>A procurar dispositivos...</Text>
                <Text style={styles.radarHint}>
                    Abre o RichieDrop no teu computador
                </Text>
            </View>

            {/* File selection */}
            <View style={styles.fileSection}>
                <Pressable style={styles.selectButton} onPress={handleSelectFile}>
                    <Text style={styles.selectButtonText}>📁 Selecionar Ficheiro</Text>
                </Pressable>

                {selectedFile && (
                    <View style={styles.fileItem}>
                        <Text style={styles.fileName}>{selectedFile}</Text>
                    </View>
                )}
            </View>

            {/* Status */}
            <View style={styles.statusBar}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>App funcionando! Build #36</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 20,
        paddingTop: 60,
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 28,
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
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: '#1e293b',
        borderWidth: 3,
        borderColor: '#22d3ee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radarIcon: {
        fontSize: 60,
    },
    radarText: {
        fontSize: 18,
        color: '#e2e8f0',
        marginTop: 24,
        fontWeight: '500',
    },
    radarHint: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
    },
    fileSection: {
        paddingVertical: 30,
    },
    selectButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    selectButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    fileItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
    },
    fileName: {
        fontSize: 14,
        color: '#e2e8f0',
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22c55e',
        marginRight: 10,
    },
    statusText: {
        fontSize: 14,
        color: '#22c55e',
        fontWeight: '500',
    },
});

// Register app - try both possible names
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App);
