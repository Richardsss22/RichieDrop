// Type declarations for react-native-zeroconf
declare module 'react-native-zeroconf' {
    interface Service {
        name: string;
        fullName: string;
        host: string;
        port: number;
        addresses: string[];
        txt: Record<string, string>;
    }

    type EventType = 'resolved' | 'remove' | 'error' | 'start' | 'stop' | 'found' | 'update';

    export default class Zeroconf {
        constructor();
        scan(type?: string, protocol?: string, domain?: string): void;
        stop(): void;
        publishService(
            protocol: string,
            type: string,
            name: string,
            port: number,
            txt?: Record<string, string>
        ): void;
        unpublishService(name: string): void;
        on(event: EventType, callback: (data: any) => void): void;
        off(event: EventType, callback: (data: any) => void): void;
        removeListener(event: EventType, callback: (data: any) => void): void;
        getServices(): Record<string, Service>;
    }
}
