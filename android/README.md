# RichieDrop Android

Versão Android do RichieDrop - app de partilha de ficheiros entre dispositivos na mesma rede local (estilo AirDrop).

## 📱 Requisitos

- Node.js 18+
- Expo CLI
- EAS CLI (para builds)

## 🚀 Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npx expo start

# Correr no Android (com Expo Go ou dev client)
npx expo start --android
```

## 🔨 Build

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login no Expo
eas login

# Build APK para preview
eas build --platform android --profile preview

# Build APK para produção
eas build --platform android --profile production
```

## 📁 Estrutura

```
android/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Main screen
├── src/
│   ├── components/        # UI components
│   │   ├── RadarView.tsx  # Pulsing radar animation
│   │   ├── DeviceCard.tsx # Device orbital cards
│   │   ├── FilePanel.tsx  # File selection panel
│   │   └── ...modals
│   └── services/          # Core services
│       ├── discovery.ts   # mDNS/Zeroconf
│       └── transfer.ts    # HTTP file transfer
├── assets/                # Icons and images
├── app.json              # Expo config
├── eas.json              # EAS Build config
└── package.json
```

## 🔗 Compatibilidade

Esta app é 100% compatível com a versão desktop (Tauri):

- **Protocolo de descoberta:** `_richiedrop._tcp.local.` via mDNS
- **Sinalização:** POST `/notify` na porta 8080
- **Transferência:** GET `/download/{filename}`

## 📄 Licença

MIT
