// @ts-nocheck
// This file serves as a backup of the original App.tsx functionality
// before integrating the new Radar UI.
import { useState, useEffect } from "react";
import { startDiscovery, onDeviceFound, onDeviceLost, Device, getDevices } from "./discovery";
import { sendFile } from "./transfer";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { UploadCloud, Laptop, ArrowRight, Zap, Target } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "framer-motion";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

function App() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [scanning] = useState(true);
    const [myDeviceName, setMyDeviceName] = useState("My PC");
    const [myIp, setMyIp] = useState("...");
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const initDiscovery = async () => {
            const name = "Windows-" + Math.floor(Math.random() * 1000);
            setMyDeviceName(name);
            const ip = await startDiscovery(name, 8080);
            setMyIp(ip);
            setDevices(await getDevices());

            const unlistenFound = await onDeviceFound((device) => {
                setDevices((prev) => {
                    if (prev.find((d) => d.id === device.id)) return prev;
                    return [...prev, device];
                });
            });

            const unlistenLost = await onDeviceLost((deviceId) => {
                setDevices((prev) => prev.filter((d) => d.id !== deviceId));
            });

            // File Drop Handler
            const unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
                if (event.payload.type === 'enter') {
                    setIsDragging(true);
                } else if (event.payload.type === 'leave') {
                    setIsDragging(false);
                } else if (event.payload.type === 'drop') {
                    setIsDragging(false);
                    const paths = event.payload.paths;
                    if (paths && paths.length > 0) {
                        // Handle dropped file
                        sendSelectedFile(paths[0]);
                    }
                }
            });

            return () => {
                unlistenFound();
                unlistenLost();
                unlistenDrop();
            };
        };
        initDiscovery();
    }, []);

    const sendSelectedFile = async (path: string) => {
        try {
            console.log("Sending file:", path);
            const result = await sendFile(path);
            const fileName = path.split(/[/\\]/).pop();
            alert(`Ready to Drop!\n\n${fileName}\n\nLink: http://${result.ip}:${result.port}/download/${fileName}`);
        } catch (e) {
            console.error(e);
            alert("Error sending file: " + e);
        }
    };

    const handleSend = async () => {
        try {
            const file = await open({
                multiple: false,
                directory: false,
            });

            if (file) {
                sendSelectedFile(file as string);
            }
        } catch (e) {
            console.error(e);
            alert("Error selecting file: " + e);
        }
    };

    const addTestDevice = () => {
        setDevices(prev => [...prev, {
            id: "test-" + Math.random(),
            name: "Samsung Galaxy S24 Ultra",
            ip: "192.168.1.50",
            port: 8080,
            last_seen: Date.now()
        }]);
    };

    return (
        <div className="h-screen w-screen bg-[#030014] text-white overflow-hidden flex flex-col items-center relative selection:bg-purple-500/30 font-sans">
            {/* Original JSX Content truncated for brevity in backup since it's preserved in App.old.tsx via move command */}
        </div>
    );
}

export default App;
