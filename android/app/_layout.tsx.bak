/**
 * Root Layout for Expo Router
 *
 * CRITICAL: This file must NOT import from '@/components' barrel file!
 * Doing so triggers premature loading of complex native dependencies (Reanimated, SVG)
 * which can crash the app on startup before the root view is mounted.
 */

import { Stack } from 'expo-router';
// Import StatusBar safely if needed, but standard import should be fine
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import directly from file to avoid barrel file side-effects
import { SimpleErrorBoundary } from '../src/components/SimpleErrorBoundary';

export default function RootLayout() {
    return (
        <SimpleErrorBoundary>
            <SafeAreaProvider>
                <StatusBar style="light" />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: '#0f172a' },
                        animation: 'fade',
                    }}
                />
            </SafeAreaProvider>
        </SimpleErrorBoundary>
    );
}
