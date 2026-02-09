/**
 * Discovery Service - MOCK IMPLEMENTATION (SURVIVAL MODE)
 *
 * To prevent native crashes, we are mocking the entire service.
 * No react-native-zeroconf import allowed.
 */

// import Zeroconf from 'react-native-zeroconf'; // CRASH SOURCE

export interface Device {
    id: string;
    name: string;
    ip: string;
    port: number;
    lastSeen: number;
}

type DeviceCallback = (device: Device) => void;
type DeviceLostCallback = (deviceId: string) => void;

class DiscoveryService {
    private myName: string | undefined;
    private discoveredDevices: Map<string, Device> = new Map();
    private deviceFoundCallbacks: DeviceCallback[] = [];
    private deviceLostCallbacks: DeviceLostCallback[] = [];

    constructor() {
        console.log('[Discovery] Initialized in MOCK MODE (Survival)');
    }

    async startDiscovery(deviceName: string, port: number = 8080): Promise<string> {
        this.myName = deviceName;
        console.log(`[Discovery] Mock start for ${deviceName}`);

        // Simulate a device found for testing purposes (optional)
        setTimeout(() => {
            const mockDevice: Device = {
                id: 'mock-device',
                name: "Richie's Mac (Mock)",
                ip: '192.168.1.100',
                port: 8080,
                lastSeen: Date.now()
            };
            this.discoveredDevices.set(mockDevice.id, mockDevice);
            this.deviceFoundCallbacks.forEach(cb => cb(mockDevice));
        }, 2000);

        return deviceName;
    }

    stopDiscovery() {
        console.log('[Discovery] Mock stop');
    }

    getDevices(): Device[] {
        return Array.from(this.discoveredDevices.values());
    }

    onDeviceFound(callback: DeviceCallback): () => void {
        this.deviceFoundCallbacks.push(callback);
        return () => {
            const index = this.deviceFoundCallbacks.indexOf(callback);
            if (index > -1) this.deviceFoundCallbacks.splice(index, 1);
        };
    }

    onDeviceLost(callback: DeviceLostCallback): () => void {
        this.deviceLostCallbacks.push(callback);
        return () => {
            const index = this.deviceLostCallbacks.indexOf(callback);
            if (index > -1) this.deviceLostCallbacks.splice(index, 1);
        };
    }
}

export const discoveryService = new DiscoveryService();

export const startDiscovery = (name: string, port?: number) =>
    discoveryService.startDiscovery(name, port);
export const stopDiscovery = () => discoveryService.stopDiscovery();
export const getDevices = () => discoveryService.getDevices();
export const onDeviceFound = (cb: DeviceCallback) => discoveryService.onDeviceFound(cb);
export const onDeviceLost = (cb: DeviceLostCallback) => discoveryService.onDeviceLost(cb);
