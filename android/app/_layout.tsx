/**
 * RED SCREEN TEST
 * This is a minimal layout to test if the app can render ANYTHING.
 * If this shows up, the JS engine is working and the issue is in the navigation/dependencies.
 * If this doesn't show up, the issue is native or entry-point related.
 */
import React from 'react';
import { View, Text } from 'react-native';

export default function RootLayout() {
    console.log("RED SCREEN RENDERING");
    return (
        <View style={{
            flex: 1,
            backgroundColor: 'red',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
        }}>
            <Text style={{
                fontSize: 32,
                color: 'white',
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 20
            }}>
                TEST MODE
            </Text>
            <Text style={{
                fontSize: 16,
                color: 'white',
                textAlign: 'center'
            }}>
                If you see this, the app is working!
            </Text>
        </View>
    );
}
