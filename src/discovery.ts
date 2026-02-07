import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface Device {
    id: string;
    name: string;
    ip: string;
    port: number;
    last_seen: number;
}

export async function startDiscovery(deviceName: string, port: number): Promise<string> {
    return await invoke("start_discovery", { deviceName, port });
}

export async function getDevices(): Promise<Device[]> {
    return await invoke("get_devices");
}

export async function onDeviceFound(callback: (device: Device) => void): Promise<UnlistenFn> {
    return await listen<Device>("device-found", (event) => callback(event.payload));
}

export async function onDeviceLost(callback: (deviceId: string) => void): Promise<UnlistenFn> {
    return await listen<string>("device-lost", (event) => callback(event.payload));
}
