import { invoke } from "@tauri-apps/api/core";

export async function sendFile(filepath: string): Promise<{ ip: string; port: number }> {
    return await invoke("send_file", { filepath });
}

export async function receiveFile(url: string, savePath: string): Promise<void> {
    await invoke("receive_file", { url, savePath });
}
