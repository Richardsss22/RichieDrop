import { useState, useEffect } from 'react';
import {
    Smartphone,
    Monitor,
    Laptop,
    Settings,
    History,
    User,
    File,
    Image as ImageIcon,
    Share2,
    Check,
    X,
    Download,
    Save
} from 'lucide-react';
import { startDiscovery, onDeviceFound, onDeviceLost, Device } from "./discovery";
import { sendFile } from "./transfer";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// --- Utilitários de Estilo ---
const glassClass = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl";
const buttonGlass = "bg-white/5 hover:bg-white/20 backdrop-blur-lg border border-white/10 transition-all duration-300";

// --- Interface para Estado UI ---
interface UIDevice extends Device {
    type: 'mobile' | 'laptop' | 'desktop';
    status: 'idle' | 'sending' | 'success';
    progress: number;
}

interface IncomingTransfer {
    filename: string;
    filesize: string;
    sender_name: string;
    download_url: string;
}

export default function App() {
    const [scanning, _setScanning] = useState(true);
    const [foundDevices, setFoundDevices] = useState<UIDevice[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<{ name: string, path: string, size?: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Settings State
    const [myDeviceName, setMyDeviceName] = useState("My Device");
    const [tempDeviceName, setTempDeviceName] = useState(""); // For editing

    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [transferHistory, setTransferHistory] = useState<{ name: string, device: string, time: string, success: boolean }[]>([]);

    // Incoming Transfer State
    const [incomingTransfer, setIncomingTransfer] = useState<IncomingTransfer | null>(null);
    const [isReceiving, setIsReceiving] = useState(false);

    // --- Inicialização e Descoberta Real ---
    useEffect(() => {
        const initDiscovery = async () => {
            // Load saved name or generate random
            let name = localStorage.getItem("richiedrop_name");
            if (!name) {
                name = "Windows-" + Math.floor(Math.random() * 1000);
                localStorage.setItem("richiedrop_name", name);
            }
            setMyDeviceName(name);
            setTempDeviceName(name);

            // Iniciar serviço de descoberta na porta 8080
            await startDiscovery(name, 8080);

            // Listeners
            const unlistenFound = await onDeviceFound((device) => {
                setFoundDevices((prev) => {
                    if (prev.find((d) => d.id === device.id)) return prev;
                    return [...prev, mapDeviceToUI(device)];
                });
            });

            const unlistenLost = await onDeviceLost((deviceId) => {
                setFoundDevices((prev) => prev.filter((d) => d.id !== deviceId));
            });

            // Listen for Transfer Requests
            const unlistenTransfer = await listen<IncomingTransfer>('transfer-request', (event) => {
                console.log("Transfer Request Received:", event.payload);
                setIncomingTransfer(event.payload);
            });

            // Drag & Drop do Tauri
            const unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
                if (event.payload.type === 'enter') {
                    setIsDragging(true);
                } else if (event.payload.type === 'leave') {
                    setIsDragging(false);
                } else if (event.payload.type === 'drop') {
                    setIsDragging(false);
                    const paths = event.payload.paths;
                    if (paths && paths.length > 0) {
                        const newFiles = paths.map(p => ({
                            name: p.split(/[/\\]/).pop() || "Unknown",
                            path: p,
                            size: "Unknown"
                        }));
                        setSelectedFiles(prev => [...prev, ...newFiles]);
                    }
                }
            });

            return () => {
                unlistenFound();
                unlistenLost();
                unlistenDrop();
                unlistenTransfer();
            };
        };

        initDiscovery();
    }, []);

    // Helper para mapear backend Device -> UI Device
    const mapDeviceToUI = (d: Device): UIDevice => {
        let type: 'mobile' | 'laptop' | 'desktop' = 'laptop';
        const lower = d.name.toLowerCase();
        if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) type = 'mobile';
        else if (lower.includes('desktop') || lower.includes('pc')) type = 'desktop';

        return {
            ...d,
            type,
            status: 'idle',
            progress: 0
        };
    };

    const handleSaveSettings = async () => {
        if (tempDeviceName.trim() === "") return;
        localStorage.setItem("richiedrop_name", tempDeviceName);
        setMyDeviceName(tempDeviceName);

        // Restart discovery with new name
        await startDiscovery(tempDeviceName, 8080);
        setShowSettings(false);
    };

    // --- Envio Real ---
    const handleSend = async (deviceId: string) => {
        if (selectedFiles.length === 0) {
            alert("Seleciona um ficheiro primeiro (clica no botão + ou arrasta)");
            return;
        }

        const device = foundDevices.find(d => d.id === deviceId);
        if (!device) return;

        // Atualizar UI para "Sending"
        setFoundDevices(prev => prev.map(d =>
            d.id === deviceId ? { ...d, status: 'sending', progress: 0 } : d
        ));

        const fileToSend = selectedFiles[0];

        try {
            console.log(`Starting send for ${fileToSend.path}`);

            // 1. Start serving file (Backend)
            const result = await sendFile(fileToSend.path);
            console.log(`File serving at ${result.ip}:${result.port}`);

            const downloadUrl = `http://${result.ip}:${result.port}/download/${encodeURIComponent(fileToSend.name)}`;

            // 2. Notify Peer (Signaling)
            console.log(`Notifying peer at ${device.ip}:${device.port}`);
            await invoke("notify_peer", {
                targetIp: device.ip,
                targetPort: device.port,
                filename: fileToSend.name,
                filesize: "Unknown",
                senderName: myDeviceName,
                downloadUrl: downloadUrl
            });

            // Simulate progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += 5;
                if (progress > 95) clearInterval(interval);
                setFoundDevices(prev => prev.map(d => d.id === deviceId ? { ...d, progress } : d));
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                setFoundDevices(prev => prev.map(d =>
                    d.id === deviceId ? { ...d, status: 'success', progress: 100 } : d
                ));

                // Add History
                setTransferHistory(prev => [{
                    name: fileToSend.name,
                    device: device.name,
                    time: new Date().toLocaleTimeString('pt-PT'),
                    success: true
                }, ...prev].slice(0, 20));

                setTimeout(() => {
                    setFoundDevices(prev => prev.map(d =>
                        d.id === deviceId ? { ...d, status: 'idle', progress: 0 } : d
                    ));
                }, 3000);
            }, 5000);

        } catch (e) {
            console.error(e);
            alert("Erro ao enviar: " + e);
            setFoundDevices(prev => prev.map(d =>
                d.id === deviceId ? { ...d, status: 'idle', progress: 0 } : d
            ));

            setTransferHistory(prev => [{
                name: fileToSend.name,
                device: device.name,
                time: new Date().toLocaleTimeString('pt-PT'),
                success: false
            }, ...prev].slice(0, 20));
        }
    };

    const handleAcceptTransfer = async () => {
        if (!incomingTransfer) return;

        try {
            // Open Save Dialog
            const savePath = await save({
                defaultPath: incomingTransfer.filename
            });

            if (!savePath) return; // User cancelled

            setIsReceiving(true);

            // Start Download
            await invoke("receive_file", { url: incomingTransfer.download_url, savePath });

            // Success
            setIsReceiving(false);
            setIncomingTransfer(null);
            alert("Ficheiro recebido com sucesso!");
            setTransferHistory(prev => [{
                name: incomingTransfer.filename,
                device: incomingTransfer.sender_name,
                time: new Date().toLocaleTimeString('pt-PT'),
                success: true
            }, ...prev].slice(0, 20));

        } catch (e) {
            console.error(e);
            alert("Erro ao receber: " + e);
            setIsReceiving(false);
        }
    };

    // --- Seleção Manual de Arquivo ---
    const handleBrowse = async () => {
        try {
            const file = await open({ multiple: false, directory: false });
            if (file) {
                const path = file as string;
                setSelectedFiles(prev => [...prev, {
                    name: path.split(/[/\\]/).pop() || "Unknown",
                    path: path,
                    size: "Unknown"
                }]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-cyan-500/30 overflow-hidden relative">

            {/* Background Ambience (Glows) */}
            <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse-slow delay-1000 pointer-events-none"></div>

            {/* Grid Pattern Overlay */}
            <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

            {/* Main Container */}
            <div className="relative z-10 flex flex-col h-screen max-w-6xl mx-auto p-4 md:p-8">

                {/* Header */}
                <header className={`flex justify-between items-center p-4 rounded-2xl mb-8 ${glassClass}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Share2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg tracking-wide">RichieDrop</h1>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                Visível como "{myDeviceName}"
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowHistory(true)}
                            className={`p-2 rounded-full ${buttonGlass} text-slate-300 hover:text-white pointer-events-auto cursor-pointer`}
                            title="Histórico"
                        >
                            <History size={20} />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`p-2 rounded-full ${buttonGlass} text-slate-300 hover:text-white pointer-events-auto cursor-pointer`}
                            title="Definições"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 flex flex-col md:flex-row gap-6 relative">

                    {/* Left: Radar & Devices */}
                    <div className="flex-1 flex flex-col items-center justify-center relative min-h-[400px]">

                        {/* The Radar Effect */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <div className="relative">
                                {/* Central User */}
                                <div className="w-24 h-24 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600 shadow-2xl z-20 relative flex items-center justify-center">
                                    <User size={32} className="text-slate-300" />
                                </div>

                                {/* Ripples */}
                                {scanning && (
                                    <>
                                        <div className="absolute inset-0 rounded-full border border-cyan-500/30 scale-150 animate-ping-slow"></div>
                                        <div className="absolute inset-0 rounded-full border border-cyan-500/20 scale-[2] animate-ping-slower"></div>
                                        <div className="absolute inset-0 rounded-full bg-cyan-500/5 scale-[3] blur-3xl"></div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Found Devices (Floating Orbit) */}
                        <div className="absolute inset-0 w-full h-full pointer-events-none">
                            {foundDevices.length === 0 ? (
                                null
                            ) : (
                                foundDevices.map((device, index) => (
                                    <div key={device.id} className="pointer-events-auto">
                                        <DeviceCard
                                            device={device}
                                            index={index}
                                            total={foundDevices.length}
                                            onSend={() => handleSend(device.id)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>

                        {foundDevices.length === 0 && (
                            <div className="mt-40 text-slate-400 text-sm animate-pulse">
                                A procurar dispositivos próximos...
                            </div>
                        )}
                    </div>

                    {/* Right: File Stage */}
                    <div className={`w-full md:w-80 flex flex-col gap-4 transition-all duration-500 ${isDragging ? 'scale-105' : ''}`}>

                        {/* File Drop Area */}
                        <div className={`flex-1 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 text-center gap-4 relative overflow-hidden group
              ${isDragging ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'}
            `}>
                            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            {selectedFiles.length === 0 ? (
                                <>
                                    <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                        <File className="text-cyan-400" size={32} />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Arrasta ficheiros</h3>
                                    <p className="text-sm text-slate-500">ou clica para explorar</p>
                                    <button
                                        onClick={handleBrowse}
                                        className="mt-4 px-6 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-sm transition-colors shadow-lg shadow-cyan-500/20 cursor-pointer pointer-events-auto relative z-10"
                                    >
                                        Selecionar
                                    </button>
                                </>
                            ) : (
                                <div className="w-full flex flex-col gap-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-300">Pronto a enviar</span>
                                        <button onClick={() => setSelectedFiles([])} className="text-xs text-red-400 hover:text-red-300 cursor-pointer pointer-events-auto">Limpar</button>
                                    </div>
                                    {selectedFiles.map((file, i) => (
                                        <div key={i} className={`p-3 rounded-xl flex items-center gap-3 ${glassClass} animate-slide-in`}>
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                                                <ImageIcon size={18} className="text-purple-300" />
                                            </div>
                                            <div className="flex-1 text-left overflow-hidden">
                                                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                                <p className="text-xs text-slate-400">{file.size}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs text-left">
                                        Clica num dispositivo no radar para enviar.
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Global Drop Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 rounded-3xl bg-cyan-500/10 backdrop-blur-sm border-2 border-cyan-400 flex items-center justify-center pointer-events-none">
                        <div className="bg-slate-900/90 p-8 rounded-3xl border border-cyan-500/50 shadow-2xl flex flex-col items-center animate-bounce-slight">
                            <File size={48} className="text-cyan-400 mb-4" />
                            <h2 className="text-2xl font-bold text-white">Larga para partilhar</h2>
                        </div>
                    </div>
                )}

            </div>

            {/* Incoming Transfer Modal */}
            {incomingTransfer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in zoom-in duration-200">
                    <div className={`w-96 p-6 rounded-3xl ${glassClass} flex flex-col items-center text-center`}>
                        <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4 animate-bounce">
                            <Download size={32} className="text-cyan-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Receber ficheiro</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            <span className="text-white font-semibold">{incomingTransfer.sender_name}</span> quer enviar-te <br />
                            <span className="text-cyan-300 font-mono bg-cyan-500/10 px-2 py-0.5 rounded">{incomingTransfer.filename}</span>
                        </p>

                        {isReceiving ? (
                            <div className="w-full space-y-3">
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 animate-pulse w-full"></div>
                                </div>
                                <p className="text-xs text-slate-400">A fazer download...</p>
                            </div>
                        ) : (
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setIncomingTransfer(null)}
                                    className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                                >
                                    Recusar
                                </button>
                                <button
                                    onClick={handleAcceptTransfer}
                                    className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold transition-colors"
                                >
                                    Aceitar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className={`w-96 p-6 rounded-3xl ${glassClass}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Definições</h2>
                            <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-white/10">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="text-sm text-slate-400 block mb-2">Nome do dispositivo</label>
                                <input
                                    type="text"
                                    value={tempDeviceName}
                                    onChange={(e) => setTempDeviceName(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                                    placeholder="Ex: My Laptop"
                                />
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="text-sm text-slate-400">Porta de descoberta</label>
                                <p className="text-white font-medium">8080 (Fixo)</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="text-sm text-slate-400">Versão</label>
                                <p className="text-white font-medium">0.1.0</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSaveSettings}
                            className="w-full mt-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            Guardar
                        </button>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className={`w-96 max-h-[80vh] p-6 rounded-3xl ${glassClass} flex flex-col`}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Histórico</h2>
                            <button onClick={() => setShowHistory(false)} className="p-1 rounded-full hover:bg-white/10">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {transferHistory.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">Sem transferências recentes</p>
                            ) : (
                                transferHistory.map((item, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {item.success ? <Check size={14} /> : <X size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                                            <div className="flex justify-between items-center text-xs text-slate-400">
                                                <span>{item.device}</span>
                                                <span>{item.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// Subcomponente simples para dispositivo
function DeviceCard({ device, index, total, onSend }: { device: UIDevice, index: number, total: number, onSend: () => void }) {
    // Calcular posição em círculo
    const angle = (index / total) * 2 * Math.PI;
    const radius = 140; // Distância do centro
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const Icon = device.type === 'mobile' ? Smartphone : device.type === 'desktop' ? Monitor : Laptop;

    return (
        <div
            className="absolute transition-all duration-500"
            style={{
                transform: `translate(${x}px, ${y}px)`,
                left: '50%',
                top: '50%'
            }}
        >
            <div className={`relative group -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer pointer-events-auto`} onClick={onSend}>

                {/* Status Indicator Ring */}
                {device.status === 'sending' && (
                    <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90 pointer-events-none">
                        <circle cx="50%" cy="50%" r="28" stroke="currentColor" strokeWidth="2" fill="none" className="text-slate-700" />
                        <circle cx="50%" cy="50%" r="28" stroke="currentColor" strokeWidth="2" fill="none" className="text-cyan-400 transition-all duration-300"
                            strokeDasharray="176"
                            strokeDashoffset={176 - (176 * device.progress) / 100}
                        />
                    </svg>
                )}

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-all duration-300
                    ${device.status === 'success' ? 'bg-green-500 text-white border-green-400 scale-110' :
                        device.status === 'sending' ? 'bg-slate-800 text-cyan-400 border-cyan-500/50' :
                            'bg-slate-800/80 backdrop-blur text-slate-300 border-white/10 hover:bg-slate-700 hover:text-white hover:scale-110 hover:border-cyan-500/30'}
                `}>
                    {device.status === 'success' ? <Check size={24} /> : <Icon size={24} />}
                </div>

                <div className="absolute top-16 w-32 text-center pointer-events-none">
                    <p className="text-xs font-bold text-white truncate shadow-black drop-shadow-md">{device.name}</p>
                    <p className="text-xs text-slate-400">{device.ip}</p>
                    {device.status === 'sending' && <p className="text-[10px] text-cyan-400 font-bold">{device.progress}%</p>}
                </div>
            </div>
        </div>
    );
}
