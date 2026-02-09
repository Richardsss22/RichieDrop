/**
 * RichieDrop Android - Main App Screen
 * File sharing app compatible with desktop version
 * 
 * IMPORTANT: This version uses lazy loading to prevent blank screen crashes
 */

import React, { useState, useEffect, Suspense } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
} from 'react-native';

// Safe imports - these are core React Native and should always work
let SafeAreaView: any;
let LinearGradient: any;
let AsyncStorage: any;
let DocumentPicker: any;
let FileSystem: any;

// Try to import optional dependencies
try {
    SafeAreaView = require('react-native-safe-area-context').SafeAreaView;
} catch (e) {
    console.warn('SafeAreaView not available, using View');
    SafeAreaView = View;
}

try {
    LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
    console.warn('LinearGradient not available');
    LinearGradient = View;
}

try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
    console.warn('AsyncStorage not available');
    AsyncStorage = {
        getItem: async () => null,
        setItem: async () => { },
    };
}

try {
    DocumentPicker = require('expo-document-picker');
} catch (e) {
    console.warn('DocumentPicker not available');
    DocumentPicker = { getDocumentAsync: async () => ({ canceled: true }) };
}

try {
    FileSystem = require('expo-file-system');
} catch (e) {
    console.warn('FileSystem not available');
    FileSystem = { getInfoAsync: async () => ({ exists: false }) };
}

// Lazy load complex components
const LazyMainContent = React.lazy(() => import('./MainContent'));

// Loading screen component
function LoadingScreen() {
    return (
        <View style={styles.loadingContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.loadingText}>A carregar RichieDrop...</Text>
        </View>
    );
}

// Error fallback component
function ErrorFallback({ error }: { error?: Error }) {
    return (
        <View style={styles.errorContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <Text style={styles.errorTitle}>⚠️ Ocorreu um erro</Text>
            <Text style={styles.errorMessage}>
                A aplicação encontrou um problema.
            </Text>
            {error && (
                <Text style={styles.errorDetails}>{error.message}</Text>
            )}
            <Text style={styles.errorHint}>
                Tenta reiniciar a aplicação.
            </Text>
        </View>
    );
}

// Main screen wrapper with all safety checks
export default function HomeScreen() {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | undefined>();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Mark as ready after a short delay to let things initialize
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // If there was a loading error, show fallback
    if (hasError) {
        return <ErrorFallback error={error} />;
    }

    // Show loading while not ready
    if (!isReady) {
        return <LoadingScreen />;
    }

    // Try to render main content with Suspense fallback
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <Suspense fallback={<LoadingScreen />}>
                <ErrorBoundaryWrapper onError={(e) => { setHasError(true); setError(e); }}>
                    <LazyMainContent />
                </ErrorBoundaryWrapper>
            </Suspense>
        </View>
    );
}

// Simple error boundary wrapper
class ErrorBoundaryWrapper extends React.Component<
    { children: React.ReactNode; onError: (error: Error) => void },
    { hasError: boolean }
> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('ErrorBoundaryWrapper caught:', error);
        this.props.onError(error);
    }

    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#94a3b8',
    },
    errorContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#f87171',
        marginBottom: 12,
    },
    errorMessage: {
        fontSize: 16,
        color: '#e2e8f0',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorDetails: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        borderRadius: 8,
        maxWidth: 300,
    },
    errorHint: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 24,
    },
});
