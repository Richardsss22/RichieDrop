/**
 * DeviceCard - Represents a discovered device in the radar
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
} from 'react-native-reanimated';
import { Smartphone, Monitor, Laptop, Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

export type DeviceType = 'mobile' | 'laptop' | 'desktop';
export type DeviceStatus = 'idle' | 'sending' | 'success';

export interface UIDevice {
    id: string;
    name: string;
    ip: string;
    port: number;
    type: DeviceType;
    status: DeviceStatus;
    progress: number;
}

interface DeviceCardProps {
    device: UIDevice;
    index: number;
    total: number;
    onPress: () => void;
    centerX: number;
    centerY: number;
    radius?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function DeviceCard({
    device,
    index,
    total,
    onPress,
    centerX,
    centerY,
    radius = 120,
}: DeviceCardProps) {
    const scale = useSharedValue(1);

    // Calculate orbital position
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius - 28; // -28 to center the 56px card
    const y = centerY + Math.sin(angle) * radius - 28;

    const Icon =
        device.type === 'mobile'
            ? Smartphone
            : device.type === 'desktop'
                ? Monitor
                : Laptop;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(1.1);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    // Progress ring
    const circumference = 2 * Math.PI * 24;
    const strokeDashoffset = circumference - (circumference * device.progress) / 100;

    return (
        <AnimatedPressable
            style={[
                styles.container,
                { left: x, top: y },
                animatedStyle,
            ]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            {/* Progress ring (visible when sending) */}
            {device.status === 'sending' && (
                <View style={styles.progressRing}>
                    <Svg width={60} height={60} viewBox="0 0 60 60">
                        {/* Background ring */}
                        <Circle
                            cx="30"
                            cy="30"
                            r="24"
                            stroke="#334155"
                            strokeWidth={2}
                            fill="none"
                        />
                        {/* Progress ring */}
                        <Circle
                            cx="30"
                            cy="30"
                            r="24"
                            stroke="#22d3ee"
                            strokeWidth={2}
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            rotation={-90}
                            origin="30, 30"
                        />
                    </Svg>
                </View>
            )}

            {/* Device icon container */}
            <View
                style={[
                    styles.iconContainer,
                    device.status === 'success' && styles.successContainer,
                    device.status === 'sending' && styles.sendingContainer,
                ]}
            >
                {device.status === 'success' ? (
                    <Check size={24} color="#ffffff" />
                ) : (
                    <Icon
                        size={24}
                        color={device.status === 'sending' ? '#22d3ee' : '#cbd5e1'}
                    />
                )}
            </View>

            {/* Device info */}
            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={1}>
                    {device.name}
                </Text>
                <Text style={styles.ip}>{device.ip}</Text>
                {device.status === 'sending' && (
                    <Text style={styles.progress}>{device.progress}%</Text>
                )}
            </View>
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignItems: 'center',
        width: 80,
    },
    progressRing: {
        position: 'absolute',
        top: -2,
        left: 10,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    successContainer: {
        backgroundColor: '#22c55e',
        borderColor: '#4ade80',
    },
    sendingContainer: {
        borderColor: 'rgba(6, 182, 212, 0.5)',
    },
    infoContainer: {
        marginTop: 6,
        alignItems: 'center',
    },
    name: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
        maxWidth: 80,
    },
    ip: {
        fontSize: 9,
        color: '#94a3b8',
        textAlign: 'center',
    },
    progress: {
        fontSize: 9,
        fontWeight: '700',
        color: '#22d3ee',
        marginTop: 2,
    },
});
