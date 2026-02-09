import { AppRegistry, View, Text, StyleSheet } from 'react-native';
import { name as appName } from './app.json';

// Minimal App Component
const App = () => (
    <View style={styles.container}>
        <Text style={styles.text}>NUCLEAR OPTION</Text>
        <Text style={styles.subtext}>If you see this, New Arch was the problem.</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'blue',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 32,
        color: 'white',
        fontWeight: 'bold',
    },
    subtext: {
        fontSize: 16,
        color: 'white',
        marginTop: 10,
    },
});

// Register the app
// Note: 'main' is the default app name in Expo projects usually, or the one from app.json
// We'll try to register 'main' explicitly as Expo Go/Dev Client expects it
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('RichieDrop', () => App); // Just in case
