import type { Serializable } from 'child_process';
interface IDebugInfo {
    break?: boolean;
    port?: number;
}
export declare class ControllableScript {
    isRunning: boolean;
    private process?;
    private script;
    private debugInfo;
    constructor(script: string, debugInfo: IDebugInfo | null);
    start(): Promise<void>;
    stop(signal?: NodeJS.Signals | null, code?: number): Promise<void>;
    onMessage(callback: (msg: Serializable) => void): void;
    onExit(callback: (code: number | null, signal: NodeJS.Signals | null) => void): void;
    send(msg: Serializable): void;
}
export {};
