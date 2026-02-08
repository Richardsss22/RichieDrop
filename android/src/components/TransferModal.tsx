/**
 * TransferModal - Incoming transfer accept/reject modal
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { Download } from 'lucide-react-native';

interface TransferModalProps {
    visible: boolean;
    filename: string;
    filesize: string;
    senderName: string;
    isReceiving: boolean;
    onAccept: () => void;
    onReject: () => void;
}

export function TransferModal({
    visible,
    filename,
    filesize,
    senderName,
    isReceiving,
    onAccept,
    onReject,
}: TransferModalProps) {
    const bounce = useSharedValue(0);

    React.useEffect(() => {
        if (visible && !isReceiving) {
            bounce.value = withRepeat(
                withTiming(-10, { duration: 500 }),
                -1,
                true
            );
        }
    }, [visible, isReceiving]);

    const bounceStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bounce.value }],
    }));

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.springify()}
                    exiting={FadeOut}
                    style={styles.modal}
                >
                    {/* Icon */}
                    <Animated.View style={[styles.iconContainer, bounceStyle]}>
                        <Download size={32} color="#22d3ee" />
                    </Animated.View>

                    {/* Title */}
                    <Text style={styles.title}>Receber ficheiro</Text>

                    {/* Sender info */}
                    <Text style={styles.description}>
                        <Text style={styles.senderName}>{senderName}</Text>
                        {' quer enviar-te'}
                    </Text>

                    {/* File info */}
                    <View style={styles.fileInfo}>
                        <Text style={styles.filename}>{filename}</Text>
                        {filesize && <Text style={styles.filesize}>{filesize}</Text>}
                    </View>

                    {/* Actions */}
                    {isReceiving ? (
                        <View style={styles.receivingContainer}>
                            <View style={styles.progressBar}>
                                <View style={styles.progressFill} />
                            </View>
                            <Text style={styles.receivingText}>A fazer download...</Text>
                        </View>
                    ) : (
                        <View style={styles.actions}>
                            <Pressable style={styles.rejectButton} onPress={onReject}>
                                <Text style={styles.rejectText}>Recusar</Text>
                            </Pressable>
                            <Pressable style={styles.acceptButton} onPress={onAccept}>
                                <Text style={styles.acceptText}>Aceitar</Text>
                            </Pressable>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 16,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(6, 182, 212, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 16,
    },
    senderName: {
        color: '#ffffff',
        fontWeight: '600',
    },
    fileInfo: {
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 24,
    },
    filename: {
        fontSize: 13,
        fontFamily: 'monospace',
        color: '#67e8f9',
        textAlign: 'center',
    },
    filesize: {
        fontSize: 11,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    rejectButton: {
        flex: 1,
        backgroundColor: '#475569',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    rejectText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    acceptButton: {
        flex: 1,
        backgroundColor: '#06b6d4',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    acceptText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    receivingContainer: {
        width: '100%',
        alignItems: 'center',
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressFill: {
        width: '100%',
        height: '100%',
        backgroundColor: '#06b6d4',
        opacity: 0.8,
    },
    receivingText: {
        fontSize: 12,
        color: '#94a3b8',
    },
});
