/**
 * Root Layout for Expo Router
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components';

export default function RootLayout() {
    return (
        <ErrorBoundary>
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
        </ErrorBoundary>
    );
}
