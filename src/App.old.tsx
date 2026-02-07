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

      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-purple-600/20 backdrop-blur-sm border-4 border-dashed border-purple-500 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center animate-pulse">
              <UploadCloud className="w-24 h-24 text-purple-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Drop to Share</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cyberpunk Grid Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-purple-900/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-blue-900/30 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="w-full p-6 flex justify-between items-center z-10 glass-nav border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-75 animate-pulse" />
            <div className="relative w-full h-full bg-black rounded-xl border border-white/10 flex items-center justify-center">
              <Zap className="text-purple-400 w-6 h-6" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">RichieDrop</h1>
            <div className="flex items-center gap-2 text-xs font-mono text-purple-300/70 uppercase tracking-widest">
              Connected • {myIp} • {myDeviceName}
            </div>
          </div>
        </div>

        <button onClick={addTestDevice} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-purple-300 transition-all flex items-center gap-2">
          <Target className="w-3 h-3" />
          SIMULATE_PEER
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-6xl flex flex-col items-center justify-center relative z-10 p-8">

        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-8 opacity-90">
            <div className="relative group">
              {/* Radar Rings */}
              <div className={cn("w-[500px] h-[500px] border border-purple-500/10 rounded-full flex items-center justify-center relative", scanning && "animate-[spin_20s_linear_infinite]")}>
                <div className="absolute inset-0 rounded-full border-t border-purple-500/30 opacity-50" />
                <div className="w-[350px] h-[350px] border border-blue-500/10 rounded-full relative">
                  <div className="absolute inset-0 rounded-full border-b border-blue-500/30 opacity-50" />
                </div>
              </div>

              {/* Scanning Beam */}
              <div className={cn("absolute top-1/2 left-1/2 w-[250px] h-[120px] bg-gradient-to-b from-purple-500/20 to-transparent blur-3xl origin-bottom -translate-x-1/2 -translate-y-full", scanning && "animate-[spin_3s_linear_infinite_origin-bottom]")} style={{ transformOrigin: "bottom center" }} />

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
                  className="w-24 h-24 bg-black/60 backdrop-blur-md rounded-2xl border border-purple-500/30 flex items-center justify-center mb-6 mx-auto shadow-[0_0_50px_rgba(168,85,247,0.2)]"
                >
                  <UploadCloud className="w-10 h-10 text-purple-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white tracking-widest uppercase">Scanning Sector</h2>
                <p className="text-sm text-purple-400/60 font-mono mt-2">Waiting for targets...</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {devices.map((device) => (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                key={device.id}
                className="group relative text-left h-full"
                onClick={() => handleSend()}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-blue-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-[#0F0A1F]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl hover:border-purple-500/50 transition-all duration-300 h-full flex flex-col justify-between overflow-hidden">

                  <div className="absolute top-0 right-0 p-4 opacity-50">
                    <ArrowRight className="w-6 h-6 text-white/20 -rotate-45 group-hover:text-purple-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                  </div>

                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/10 rounded-2xl flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-500">
                      <Laptop className="w-8 h-8 text-purple-300" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xl text-white mb-1">{device.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-xs text-purple-300/50 font-mono">{device.ip}</p>
                    </div>
                  </div>

                  {/* Hover Effect Line */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </div>
              </motion.button>
            ))}
          </div>
        )}

      </div>

      {/* Bottom Action Bar */}
      <div className="w-full max-w-2xl p-8 z-20 mb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSend}
          className="group relative w-full py-6 rounded-2xl font-bold text-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 animate-gradient-x" />
          <div className="absolute inset-[2px] bg-[#030014] rounded-2xl flex items-center justify-center gap-4 group-hover:bg-transparent transition-colors duration-300">
            <span className="relative z-10 flex items-center gap-3">
              <UploadCloud className="w-6 h-6 group-hover:text-white text-purple-400 transition-colors" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200 group-hover:text-white transition-colors">INITIATE TRANSFER</span>
            </span>
          </div>
        </motion.button>
        <p className="text-center text-xs text-purple-400/40 mt-6 font-mono uppercase tracking-widest">
          RichieDrop System v1.0 • Secure LAN Protocol
        </p>
      </div>

    </div>
  );
}

export default App;
