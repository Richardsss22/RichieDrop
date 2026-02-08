/**
 * RadarView - Central radar animation with pulsing rings
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { User } from 'lucide-react-native';

interface RadarViewProps {
    scanning?: boolean;
    children?: React.ReactNode;
}

export function RadarView({ scanning = true, children }: RadarViewProps) {
    // Pulse animations
    const pulse1 = useSharedValue(1);
    const pulse2 = useSharedValue(1);
    const opacity1 = useSharedValue(0.3);
    const opacity2 = useSharedValue(0.2);

    React.useEffect(() => {
        if (scanning) {
            // Ring 1
            pulse1.value = withRepeat(
                withTiming(2.5, { duration: 2000, easing: Easing.out(Easing.ease) }),
                -1,
                false
            );
            opacity1.value = withRepeat(
                withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
                -1,
                false
            );

            // Ring 2 (delayed)
            pulse2.value = withDelay(
                1000,
                withRepeat(
                    withTiming(3, { duration: 2500, easing: Easing.out(Easing.ease) }),
                    -1,
                    false
                )
            );
            opacity2.value = withDelay(
                1000,
                withRepeat(
                    withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }),
                    -1,
                    false
                )
            );
        }
    }, [scanning]);

    const animatedStyle1 = useAnimatedStyle(() => ({
        transform: [{ scale: pulse1.value }],
        opacity: opacity1.value,
    }));

    const animatedStyle2 = useAnimatedStyle(() => ({
        transform: [{ scale: pulse2.value }],
        opacity: opacity2.value,
    }));

    return (
        <View style={styles.container}>
            {/* Pulsing rings */}
            {scanning && (
                <>
                    <Animated.View style={[styles.ring, styles.ring1, animatedStyle1]} />
                    <Animated.View style={[styles.ring, styles.ring2, animatedStyle2]} />
                </>
            )}

            {/* Glow effect */}
            <View style={styles.glow} />

            {/* Central user avatar */}
            <View style={styles.centerCircle}>
                <User size={32} color="#cbd5e1" />
            </View>

            {/* Device cards will be positioned here */}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    centerCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#475569',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    ring: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
    },
    ring1: {
        borderColor: '#22d3ee',
    },
    ring2: {
        borderColor: '#22d3ee',
    },
    glow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(6, 182, 212, 0.05)',
    },
});
