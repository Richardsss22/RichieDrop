/**
 * HistoryModal - Transfer history display
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { X, Check } from 'lucide-react-native';

export interface TransferHistoryItem {
    name: string;
    device: string;
    time: string;
    success: boolean;
}

interface HistoryModalProps {
    visible: boolean;
    history: TransferHistoryItem[];
    onClose: () => void;
}

export function HistoryModal({ visible, history, onClose }: HistoryModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Histórico</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={20} color="#94a3b8" />
                        </Pressable>
                    </View>

                    {/* History list */}
                    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                        {history.length === 0 ? (
                            <Text style={styles.emptyText}>Sem transferências recentes</Text>
                        ) : (
                            history.map((item, index) => (
                                <View key={index} style={styles.item}>
                                    <View
                                        style={[
                                            styles.statusIcon,
                                            item.success ? styles.successIcon : styles.failIcon,
                                        ]}
                                    >
                                        {item.success ? (
                                            <Check size={14} color="#4ade80" />
                                        ) : (
                                            <X size={14} color="#f87171" />
                                        )}
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <View style={styles.itemMeta}>
                                            <Text style={styles.itemDevice}>{item.device}</Text>
                                            <Text style={styles.itemTime}>{item.time}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
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
        maxHeight: '70%',
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
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    closeButton: {
        padding: 4,
    },
    list: {
        flexGrow: 0,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        paddingVertical: 32,
    },
    item: {
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
    statusIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successIcon: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
    },
    failIcon: {
        backgroundColor: 'rgba(248, 113, 113, 0.2)',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 13,
        fontWeight: '500',
        color: '#ffffff',
        marginBottom: 4,
    },
    itemMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    itemDevice: {
        fontSize: 11,
        color: '#94a3b8',
    },
    itemTime: {
        fontSize: 11,
        color: '#94a3b8',
    },
});
