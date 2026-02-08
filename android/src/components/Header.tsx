/**
 * Header - App header with device name and action buttons
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Share2, History, Settings } from 'lucide-react-native';

interface HeaderProps {
    deviceName: string;
    onHistoryPress: () => void;
    onSettingsPress: () => void;
}

export function Header({ deviceName, onHistoryPress, onSettingsPress }: HeaderProps) {
    return (
        <View style={styles.container}>
            {/* Logo and name */}
            <View style={styles.logoSection}>
                <View style={styles.logoIcon}>
                    <Share2 size={20} color="#ffffff" />
                </View>
                <View>
                    <Text style={styles.appName}>RichieDrop</Text>
                    <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.deviceName}>Visível como "{deviceName}"</Text>
                    </View>
                </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
                <Pressable style={styles.actionButton} onPress={onHistoryPress}>
                    <History size={20} color="#cbd5e1" />
                </Pressable>
                <Pressable style={styles.actionButton} onPress={onSettingsPress}>
                    <Settings size={20} color="#cbd5e1" />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 16,
    },
    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0891b2',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    appName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4ade80',
    },
    deviceName: {
        fontSize: 11,
        color: '#94a3b8',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
