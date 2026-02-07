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
    X
} from 'lucide-react';
import { startDiscovery, onDeviceFound, onDeviceLost, Device, getDevices } from "./discovery";
import { sendFile } from "./transfer";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";

// --- Utilitários de Estilo ---
const glassClass = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl";
const buttonGlass = "bg-white/5 hover:bg-white/20 backdrop-blur-lg border border-white/10 transition-all duration-300";

// --- Interface para Estado UI ---
interface UIDevice extends Device {
    type: 'mobile' | 'laptop' | 'desktop';
    status: 'idle' | 'sending' | 'success';
    progress: number;
}

export default function App() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [scanning, _setScanning] = useState(true);
    const [foundDevices, setFoundDevices] = useState<UIDevice[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<{ name: string, path: string, size?: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [myDeviceName, setMyDeviceName] = useState("My Device");
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [transferHistory, setTransferHistory] = useState<{ name: string, device: string, time: string, success: boolean }[]>([]);

    // --- Inicialização e Descoberta Real ---
    useEffect(() => {
        const initDiscovery = async () => {
            // Nome aleatório para este cliente
            const name = "Windows-" + Math.floor(Math.random() * 1000);
            setMyDeviceName(name);

            // Iniciar serviço de descoberta na porta 8080
            await startDiscovery(name, 8080);

            // Carregar dispositivos já encontrados
            const initialDevices = await getDevices();
            setFoundDevices(initialDevices.map(mapDeviceToUI));

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

            // Drag & Drop do Tauri (Ficheiros Reais)
            const unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
                if (event.payload.type === 'enter') {
                    setIsDragging(true);
                } else if (event.payload.type === 'leave') {
                    setIsDragging(false);
                } else if (event.payload.type === 'drop') {
                    setIsDragging(false);
                    const paths = event.payload.paths;
                    if (paths && paths.length > 0) {
                        // Adicionar ficheiro à lista
                        // Nota: Em webview não conseguimos ver tamanho fácil sem File API do JS, 
                        // mas paths são strings absolutas aqui.
                        const newFiles = paths.map(p => ({
                            name: p.split(/[/\\]/).pop() || "Unknown",
                            path: p,
                            size: "Unknown" // Backend poderia resolver isso, ou ignoramos na UI
                        }));
                        setSelectedFiles(prev => [...prev, ...newFiles]);
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

        // Como o backend atual não reporta progresso granular, vamos simular progresso visual
        // enquanto aguardamos a Promise do sendFile resolver (que significa servidor pronto)
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progress > 90) progress = 90; // Espera terminar
            setFoundDevices(prev => prev.map(d => d.id === deviceId ? { ...d, progress } : d));
        }, 200);

        // Ficheiro a enviar (declarado aqui para estar acessível no catch)
        const fileToSend = selectedFiles[0];

        try {
            console.log(`Sending ${fileToSend.path} to ${device.ip}:${device.port}`);

            // Backend Call
            await sendFile(fileToSend.path);

            clearInterval(progressInterval);

            // Sucesso
            setFoundDevices(prev => prev.map(d =>
                d.id === deviceId ? { ...d, status: 'success', progress: 100 } : d
            ));

            // Adicionar ao histórico
            setTransferHistory(prev => [{
                name: fileToSend.name,
                device: device.name,
                time: new Date().toLocaleTimeString('pt-PT'),
                success: true
            }, ...prev].slice(0, 20)); // Keep last 20

            setTimeout(() => {
                setFoundDevices(prev => prev.map(d =>
                    d.id === deviceId ? { ...d, status: 'idle', progress: 0 } : d
                ));
            }, 3000);

        } catch (e) {
            console.error(e);
            clearInterval(progressInterval);

            // Adicionar falha ao histórico
            setTransferHistory(prev => [{
                name: fileToSend.name,
                device: device.name,
                time: new Date().toLocaleTimeString('pt-PT'),
                success: false
            }, ...prev].slice(0, 20));

            alert("Erro ao enviar: " + e);
            setFoundDevices(prev => prev.map(d =>
                d.id === deviceId ? { ...d, status: 'idle', progress: 0 } : d
            ));
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
                            className={`p-2 rounded-full ${buttonGlass} text-slate-300 hover:text-white`}
                            title="Histórico"
                        >
                            <History size={20} />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`p-2 rounded-full ${buttonGlass} text-slate-300 hover:text-white`}
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
                                null // Mensagem já tratada abaixo
                            ) : (
                                foundDevices.map((device, index) => (
                                    <DeviceCard
                                        key={device.id}
                                        device={device}
                                        index={index}
                                        total={foundDevices.length}
                                        onSend={() => handleSend(device.id)}
                                    />
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
                                        className="mt-4 px-6 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-sm transition-colors shadow-lg shadow-cyan-500/20"
                                    >
                                        Selecionar
                                    </button>
                                </>
                            ) : (
                                <div className="w-full flex flex-col gap-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-300">Pronto a enviar</span>
                                        <button onClick={() => setSelectedFiles([])} className="text-xs text-red-400 hover:text-red-300">Limpar</button>
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
                                    <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
                                        Clica num dispositivo no radar para enviar.
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Global Drop Overlay (Visual cue) */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 rounded-3xl bg-cyan-500/10 backdrop-blur-sm border-2 border-cyan-400 flex items-center justify-center pointer-events-none">
                        <div className="bg-slate-900/90 p-8 rounded-3xl border border-cyan-500/50 shadow-2xl flex flex-col items-center animate-bounce-slight">
                            <File size={48} className="text-cyan-400 mb-4" />
                            <h2 className="text-2xl font-bold text-white">Larga para partilhar</h2>
                        </div>
                    </div>
                )}

            </div>

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
                                <label className="text-sm text-slate-400">Nome do dispositivo</label>
                                <p className="text-white font-medium">{myDeviceName}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="text-sm text-slate-400">Porta de descoberta</label>
                                <p className="text-white font-medium">8080</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="text-sm text-slate-400">Versão</label>
                                <p className="text-white font-medium">0.1.0</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full mt-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold transition-colors"
                        >
                            Fechar
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
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {transferHistory.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <History size={32} className="mx-auto mb-3 opacity-50" />
                                    <p>Sem transferências recentes</p>
                                </div>
                            ) : (
                                transferHistory.map((item, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-2">
                                            <Check size={16} className={item.success ? "text-green-400" : "text-red-400"} />
                                            <span className="text-white font-medium truncate">{item.name}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Para: {item.device} • {item.time}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => setShowHistory(false)}
                            className="w-full mt-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

// Subcomponente para os Dispositivos
function DeviceCard({ device, index, total, onSend }: { device: UIDevice, index: number, total: number, onSend: () => void }) {
    const Icon = device.type === 'mobile' ? Smartphone : device.type === 'laptop' ? Laptop : Monitor;

    // Posicionamento Matemático (Circular)
    const angle = total === 1 ? -90 : (index * (360 / total)) - 90;
    const radius = 160; // Distância do centro

    return (
        <div
            className="absolute top-1/2 left-1/2 pointer-events-auto transition-all duration-700 ease-out"
            style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`
            }}
        >
            <div className="group relative flex flex-col items-center gap-3">

                {/* Connection Line (Visual Only) */}
                <div className={`absolute top-1/2 left-1/2 w-[160px] h-[1px] bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 -z-10 origin-left transition-all duration-500
          ${device.status === 'sending' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}
        `} style={{ transform: `rotate(${angle + 180}deg)` }}></div>

                {/* Card Body */}
                <button
                    onClick={onSend}
                    disabled={device.status !== 'idle'}
                    className={`relative p-4 rounded-2xl transition-all duration-300 cursor-pointer group
            ${device.status === 'idle' ? 'hover:scale-105 hover:-translate-y-1' : ''}
          `}
                >
                    {/* Glass Background of Icon */}
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-md border shadow-xl relative z-10 transition-colors duration-300
            ${device.status === 'sending' ? 'bg-slate-900 border-cyan-500/50' : 'bg-white/5 border-white/10 group-hover:bg-white/10 group-hover:border-white/30'}
          `}>
                        {device.status === 'success' ? (
                            <Check className="text-green-400 animate-slide-in" size={32} />
                        ) : (
                            <Icon className={`text-white transition-opacity duration-300 ${device.status === 'sending' ? 'opacity-50' : 'opacity-100'}`} size={32} />
                        )}

                        {/* Progress Ring */}
                        {device.status === 'sending' && (
                            <svg className="absolute inset-0 w-full h-full -rotate-90 scale-110" viewBox="0 0 36 36">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1e293b" strokeWidth="2" />
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray={`${device.progress}, 100`} />
                            </svg>
                        )}
                    </div>

                    {/* Status Indicator Dot */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 z-20 flex items-center justify-center
            ${device.status === 'idle' ? 'bg-green-500' : device.status === 'sending' ? 'bg-cyan-500' : 'bg-blue-500'}
          `}>
                        {device.status === 'sending' && <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>}
                    </div>

                </button>

                {/* Label */}
                <div className={`text-center transition-all duration-300 ${device.status === 'idle' ? 'opacity-60 group-hover:opacity-100' : 'opacity-100'}`}>
                    <p className="font-semibold text-sm text-white drop-shadow-md whitespace-nowrap">{device.name}</p>
                    <p className="text-xs text-cyan-300 font-medium">
                        {device.status === 'sending' ? `${device.progress}% a enviar...` : device.status === 'success' ? 'Enviado!' : ''}
                    </p>
                </div>

            </div>
        </div>
    );
}
