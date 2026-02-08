/**
 * SettingsModal - Device name and app settings
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import { X, Save } from 'lucide-react-native';

interface SettingsModalProps {
    visible: boolean;
    deviceName: string;
    onSave: (name: string) => void;
    onClose: () => void;
}

export function SettingsModal({
    visible,
    deviceName,
    onSave,
    onClose,
}: SettingsModalProps) {
    const [name, setName] = useState(deviceName);

    React.useEffect(() => {
        if (visible) {
            setName(deviceName);
        }
    }, [visible, deviceName]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Definições</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={20} color="#94a3b8" />
                        </Pressable>
                    </View>

                    {/* Device name input */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nome do dispositivo</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Meu Android"
                            placeholderTextColor="#64748b"
                            autoCapitalize="words"
                        />
                    </View>

                    {/* Port info */}
                    <View style={styles.infoField}>
                        <Text style={styles.label}>Porta de descoberta</Text>
                        <Text style={styles.infoValue}>8080 (Fixo)</Text>
                    </View>

                    {/* Version */}
                    <View style={styles.infoField}>
                        <Text style={styles.label}>Versão</Text>
                        <Text style={styles.infoValue}>0.1.0</Text>
                    </View>

                    {/* Save button */}
                    <Pressable style={styles.saveButton} onPress={handleSave}>
                        <Save size={18} color="#0f172a" />
                        <Text style={styles.saveText}>Guardar</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modal: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    closeButton: {
        padding: 4,
    },
    field: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 16,
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 8,
    },
    input: {
        fontSize: 15,
        color: '#ffffff',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 8,
        padding: 12,
    },
    infoField: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 16,
        marginBottom: 12,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '500',
        color: '#ffffff',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#06b6d4',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 8,
        gap: 8,
    },
    saveText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
});
