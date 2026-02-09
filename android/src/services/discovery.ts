/**
 * Discovery Service - mDNS/Zeroconf for RichieDrop
 * Compatible with desktop Rust mDNS implementation
 */

import Zeroconf from 'react-native-zeroconf';

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
    private zeroconf: Zeroconf | undefined;
    private myName: string | undefined;
    private myPort: number | undefined;
    private discoveredDevices: Map<string, Device> = new Map();
    private deviceFoundCallbacks: DeviceCallback[] = [];
    private deviceLostCallbacks: DeviceLostCallback[] = [];

    constructor() {
        // Lazy initialization happens in startDiscovery
    }

    private isZeroconfAvailable: boolean = true;

    private getZeroconf(): Zeroconf | null {
        if (!this.isZeroconfAvailable) {
            return null;
        }
        if (!this.zeroconf) {
            try {
                // Check if native module is available first
                if (!Zeroconf) {
                    throw new Error('Zeroconf module is undefined');
                }
                this.zeroconf = new Zeroconf();
                this.setupListeners();
            } catch (error) {
                console.warn('[Discovery] Zeroconf native module not available, using mock mode:', error);
                this.isZeroconfAvailable = false;
                return null;
            }
        }
        return this.zeroconf;
    }

    private setupListeners() {
        if (!this.zeroconf) return;

        // Device found
        this.zeroconf.on('resolved', (service: any) => {
            // Skip self
            if (service.name === this.myName) return;

            const device: Device = {
                id: service.fullName || `${service.name}.${service.type}`,
                name: service.name,
                ip: service.addresses?.[0] || service.host,
                port: service.port || 8080,
                lastSeen: Date.now(),
            };

            this.discoveredDevices.set(device.id, device);
            this.deviceFoundCallbacks.forEach((cb) => cb(device));
        });

        // Device lost
        this.zeroconf.on('remove', (name: string) => {
            const deviceId = Array.from(this.discoveredDevices.keys()).find((id) =>
                id.includes(name)
            );
            if (deviceId) {
                this.discoveredDevices.delete(deviceId);
                this.deviceLostCallbacks.forEach((cb) => cb(deviceId));
            }
        });

        // Error handling
        this.zeroconf.on('error', (err: any) => {
            console.error('[Discovery] Zeroconf error:', err);
        });
    }

    /**
     * Start discovery service - advertise ourselves and scan for others
     */
    async startDiscovery(deviceName: string, port: number = 8080): Promise<string> {
        this.myName = deviceName;
        this.myPort = port;

        try {
            const zc = this.getZeroconf();

            // If Zeroconf is not available, just log and continue
            if (!zc) {
                console.warn('[Discovery] Zeroconf not available, discovery disabled');
                return deviceName;
            }

            // Publish ourselves as _richiedrop._tcp service (same as desktop)
            zc.publishService(
                'tcp',
                'richiedrop',
                deviceName,
                port
            );

            // Start scanning for other RichieDrop devices
            zc.scan('richiedrop', 'tcp', 'local.');

            console.log(`[Discovery] Started as "${deviceName}" on port ${port}`);
            return deviceName;
        } catch (error) {
            console.warn('[Discovery] Failed to start, continuing without discovery:', error);
            return deviceName;
        }
    }

    /**
     * Stop discovery service
     */
    stopDiscovery() {
        if (this.zeroconf) {
            try {
                this.zeroconf.unpublishService(this.myName || '');
                this.zeroconf.stop();
            } catch (e) {
                console.warn('[Discovery] Error stopping zeroconf:', e);
            }
        }
        this.discoveredDevices.clear();
        console.log('[Discovery] Stopped');
    }

    /**
     * Get currently discovered devices
     */
    getDevices(): Device[] {
        return Array.from(this.discoveredDevices.values());
    }

    /**
     * Register callback for device found events
     */
    onDeviceFound(callback: DeviceCallback): () => void {
        this.deviceFoundCallbacks.push(callback);
        return () => {
            const index = this.deviceFoundCallbacks.indexOf(callback);
            if (index > -1) this.deviceFoundCallbacks.splice(index, 1);
        };
    }

    /**
     * Register callback for device lost events
     */
    onDeviceLost(callback: DeviceLostCallback): () => void {
        this.deviceLostCallbacks.push(callback);
        return () => {
            const index = this.deviceLostCallbacks.indexOf(callback);
            if (index > -1) this.deviceLostCallbacks.splice(index, 1);
        };
    }
}

// Singleton instance
export const discoveryService = new DiscoveryService();

// Convenience exports
export const startDiscovery = (name: string, port?: number) =>
    discoveryService.startDiscovery(name, port);
export const stopDiscovery = () => discoveryService.stopDiscovery();
export const getDevices = () => discoveryService.getDevices();
export const onDeviceFound = (cb: DeviceCallback) => discoveryService.onDeviceFound(cb);
export const onDeviceLost = (cb: DeviceLostCallback) => discoveryService.onDeviceLost(cb);
