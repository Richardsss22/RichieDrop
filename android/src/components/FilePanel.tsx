/**
 * FilePanel - File selection and display panel
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { File, Image as ImageIcon, X, Plus } from 'lucide-react-native';

export interface SelectedFile {
    name: string;
    uri: string;
    size?: string;
    type?: string;
}

interface FilePanelProps {
    files: SelectedFile[];
    onSelectFile: () => void;
    onRemoveFile: (index: number) => void;
    onClearAll: () => void;
}

export function FilePanel({
    files,
    onSelectFile,
    onRemoveFile,
    onClearAll,
}: FilePanelProps) {
    const hasFiles = files.length > 0;

    return (
        <View style={styles.container}>
            {!hasFiles ? (
                // Empty state - prompt to select files
                <Pressable style={styles.emptyContainer} onPress={onSelectFile}>
                    <View style={styles.iconWrapper}>
                        <File size={32} color="#22d3ee" />
                    </View>
                    <Text style={styles.title}>Seleciona ficheiros</Text>
                    <Text style={styles.subtitle}>Toca para escolher</Text>
                    <View style={styles.selectButton}>
                        <Plus size={18} color="#0f172a" />
                        <Text style={styles.selectButtonText}>Adicionar</Text>
                    </View>
                </Pressable>
            ) : (
                // Files selected - show list
                <View style={styles.filesContainer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Pronto a enviar</Text>
                        <Pressable onPress={onClearAll}>
                            <Text style={styles.clearText}>Limpar</Text>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.fileList} showsVerticalScrollIndicator={false}>
                        {files.map((file, index) => (
                            <View key={index} style={styles.fileItem}>
                                <View style={styles.fileIcon}>
                                    <ImageIcon size={18} color="#a78bfa" />
                                </View>
                                <View style={styles.fileInfo}>
                                    <Text style={styles.fileName} numberOfLines={1}>
                                        {file.name}
                                    </Text>
                                    <Text style={styles.fileSize}>{file.size || 'Tamanho desconhecido'}</Text>
                                </View>
                                <Pressable
                                    style={styles.removeButton}
                                    onPress={() => onRemoveFile(index)}
                                >
                                    <X size={16} color="#94a3b8" />
                                </Pressable>
                            </View>
                        ))}
                    </ScrollView>

                    <Pressable style={styles.addMoreButton} onPress={onSelectFile}>
                        <Plus size={16} color="#22d3ee" />
                        <Text style={styles.addMoreText}>Adicionar mais</Text>
                    </Pressable>

                    <View style={styles.hint}>
                        <Text style={styles.hintText}>
                            Toca num dispositivo no radar para enviar
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    iconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e2e8f0',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 20,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#06b6d4',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    selectButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    filesContainer: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#cbd5e1',
    },
    clearText: {
        fontSize: 12,
        color: '#f87171',
    },
    fileList: {
        maxHeight: 200,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 12,
        marginBottom: 8,
        gap: 12,
    },
    fileIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: 13,
        fontWeight: '500',
        color: '#ffffff',
    },
    fileSize: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    removeButton: {
        padding: 4,
    },
    addMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.3)',
        borderRadius: 12,
        borderStyle: 'dashed',
        marginTop: 8,
        gap: 8,
    },
    addMoreText: {
        fontSize: 13,
        color: '#22d3ee',
        fontWeight: '500',
    },
    hint: {
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.2)',
    },
    hintText: {
        fontSize: 12,
        color: '#67e8f9',
        textAlign: 'center',
    },
});
