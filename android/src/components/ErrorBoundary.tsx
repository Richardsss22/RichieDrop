/**
 * ErrorBoundary - Catches React errors and displays fallback UI
 * Prevents blank screen by showing error message instead
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <AlertTriangle size={48} color="#f87171" />
                        </View>
                        <Text style={styles.title}>Ocorreu um erro</Text>
                        <Text style={styles.message}>
                            A aplicação encontrou um problema inesperado.
                        </Text>
                        {this.state.error && (
                            <Text style={styles.errorText} numberOfLines={3}>
                                {this.state.error.message}
                            </Text>
                        )}
                        <Pressable style={styles.button} onPress={this.handleRetry}>
                            <RefreshCw size={18} color="#0f172a" />
                            <Text style={styles.buttonText}>Tentar novamente</Text>
                        </Pressable>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 16,
    },
    errorText: {
        fontSize: 12,
        color: '#f87171',
        textAlign: 'center',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        padding: 12,
        borderRadius: 8,
        width: '100%',
        marginBottom: 24,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#06b6d4',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 24,
        gap: 8,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
});
