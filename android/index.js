/**
 * RichieDrop Android - Entry Point (No Router)
 * 
 * This version bypasses Expo Router entirely due to compatibility issues.
 * Renders the main content directly.
 */

import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import React, { Suspense } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Lazy load the main content
const MainContent = React.lazy(() => import('./app/MainContent'));

// Loading fallback
function LoadingScreen() {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.loadingText}>A carregar RichieDrop...</Text>
        </View>
    );
}

// Simple error boundary for crashes
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('App crashed:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>⚠️ Erro</Text>
                    <Text style={styles.errorMessage}>
                        {this.state.error?.message || 'Ocorreu um erro'}
                    </Text>
                </View>
            );
        }
        return this.props.children;
    }
}

// Main App Component
function App() {
    return (
        <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
                <MainContent />
            </Suspense>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
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
    },
});

// Register the app
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App);
