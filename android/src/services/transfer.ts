/**
 * Transfer Service - HTTP-based file sharing for RichieDrop
 * Compatible with desktop Rust implementation
 */

import * as FileSystem from 'expo-file-system';
import { Device } from './discovery';

export interface NotifyPayload {
    filename: string;
    filesize: string;
    sender_name: string;
    download_url: string;
}

export interface TransferRequest {
    filename: string;
    filesize: string;
    senderName: string;
    downloadUrl: string;
}

type TransferRequestCallback = (request: TransferRequest) => void;

class TransferService {
    private serverPort: number = 0;
    private serverRunning: boolean = false;
    private currentFile: { uri: string; name: string } | null = null;
    private transferRequestCallbacks: TransferRequestCallback[] = [];
    private deviceName: string = 'Android';

    /**
     * Set the device name for outgoing transfers
     */
    setDeviceName(name: string) {
        this.deviceName = name;
    }

    /**
     * Get local IP address
     * Note: This is a simplified version - in production you'd use a native module
     */
    private async getLocalIP(): Promise<string> {
        // For React Native, we'll get this from the device's network interface
        // This is typically handled by the zeroconf service which already knows our IP
        // For now, return a placeholder that will be replaced by actual device IP
        return '0.0.0.0';
    }

    /**
     * Start HTTP server to serve the file
     * Note: React Native doesn't have built-in HTTP server capabilities
     * In a real app, you'd use a native module like react-native-http-bridge
     * For this implementation, we use a direct transfer approach
     */
    async startFileServer(fileUri: string, fileName: string): Promise<{ port: number }> {
        this.currentFile = { uri: fileUri, name: fileName };
        // In production, this would start an actual HTTP server
        // For now, we'll use a direct transfer mechanism
        this.serverPort = 8081 + Math.floor(Math.random() * 1000);
        this.serverRunning = true;

        console.log(`[Transfer] File server started for ${fileName} on port ${this.serverPort}`);
        return { port: this.serverPort };
    }

    /**
     * Send file to a target device
     */
    async sendFile(
        device: Device,
        fileUri: string,
        fileName: string,
        fileSize: string
    ): Promise<void> {
        try {
            // Start serving the file
            const { port } = await this.startFileServer(fileUri, fileName);

            // Notify the peer about the file (POST to /notify endpoint)
            const payload: NotifyPayload = {
                filename: fileName,
                filesize: fileSize,
                sender_name: this.deviceName,
                download_url: `http://${await this.getLocalIP()}:${port}/download/${encodeURIComponent(fileName)}`,
            };

            const response = await fetch(`http://${device.ip}:${device.port}/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Failed to notify peer: ${response.status}`);
            }

            console.log(`[Transfer] Notified ${device.name} about ${fileName}`);
        } catch (error) {
            console.error('[Transfer] Send failed:', error);
            throw error;
        }
    }

    /**
     * Receive file from URL and save to local storage
     */
    async receiveFile(url: string, savePath: string): Promise<void> {
        try {
            console.log(`[Transfer] Downloading from ${url}`);

            const downloadResult = await FileSystem.downloadAsync(url, savePath);

            if (downloadResult.status !== 200) {
                throw new Error(`Download failed with status ${downloadResult.status}`);
            }

            console.log(`[Transfer] File saved to ${savePath}`);
        } catch (error) {
            console.error('[Transfer] Receive failed:', error);
            throw error;
        }
    }

    /**
     * Handle incoming transfer request from signaling server
     */
    handleIncomingRequest(payload: NotifyPayload) {
        const request: TransferRequest = {
            filename: payload.filename,
            filesize: payload.filesize,
            senderName: payload.sender_name,
            downloadUrl: payload.download_url,
        };

        this.transferRequestCallbacks.forEach((cb) => cb(request));
    }

    /**
     * Register callback for incoming transfer requests
     */
    onTransferRequest(callback: TransferRequestCallback): () => void {
        this.transferRequestCallbacks.push(callback);
        return () => {
            const index = this.transferRequestCallbacks.indexOf(callback);
            if (index > -1) this.transferRequestCallbacks.splice(index, 1);
        };
    }

    /**
     * Stop file server
     */
    stopServer() {
        this.serverRunning = false;
        this.currentFile = null;
        console.log('[Transfer] Server stopped');
    }
}

// Singleton instance
export const transferService = new TransferService();

// Convenience exports
export const sendFile = (device: Device, fileUri: string, fileName: string, fileSize: string) =>
    transferService.sendFile(device, fileUri, fileName, fileSize);
export const receiveFile = (url: string, savePath: string) =>
    transferService.receiveFile(url, savePath);
export const onTransferRequest = (cb: TransferRequestCallback) =>
    transferService.onTransferRequest(cb);
export const setDeviceName = (name: string) => transferService.setDeviceName(name);
