import {tmpNameSync} from './utils';
import path from 'path';
import * as fs from 'fs-extra';
import * as execa from 'execa';

import type {ChildProcess} from 'child_process';

interface IDebugInfo {
    break?: boolean;
    port?: number;
}

export class ControllableScript {
    isRunning = false;
    private process?: ChildProcess;
    private script = '';
    private tmpFileName = '';
    private debugInfo: IDebugInfo | null;
    constructor(script: string, debugInfo: IDebugInfo | null) {
        this.script = script;
        this.debugInfo = debugInfo;
    }
    start(): void {
        const args: Array<string> = [];
        this.tmpFileName = tmpNameSync(path.join(process.cwd(), 'node_modules'));
        fs.outputFileSync(this.tmpFileName, this.script);
        this.isRunning = true;
        // Passing --inspect isn't necessary for the child process to launch a port, but it allows some editors to automatically attach
        if (this.debugInfo) {
            if (this.debugInfo.break) {
                args.push(`--inspect-brk=${this.debugInfo.port}`);
            } else {
                args.push(`--inspect=${this.debugInfo.port}`);
            }
        }

        this.process = execa.node(this.tmpFileName, args, {
            env: {
                ...process.env,
            },
            stdio: [`inherit`, `inherit`, `inherit`, `ipc`],
            nodeOptions: ['--unhandled-rejections=strict'],
        });
        this.process.on('unhandledRejection', () => {
            this.stop('SIGABRT');
        });
    }
    async stop(signal: NodeJS.Signals | null = null, code?: number): Promise<void> {
        if (!this.process) {
            throw new Error(`Trying to stop the process before starting it`);
        }

        this.isRunning = false;
        try {
            if (signal) {
                this.process.kill(signal);
            } else {
                this.process.send(
                    {
                        type: `COMMAND`,
                        action: {
                            type: `EXIT`,
                            payload: code,
                        },
                    },
                    () => {
                        // The try/catch won't suffice for this process.send
                        // So use the callback to manually catch the Error, otherwise it'll be thrown
                        // Ref: https://nodejs.org/api/child_process.html#child_process_subprocess_send_message_sendhandle_options_callback
                    },
                );
            }
        } catch (err) {
            // Ignore error if process has crashed or already quit.
        }

        return new Promise((resolve) => {
            if (!this.process) {
                throw new Error(`Trying to stop the process before starting it`);
            }

            this.process.on(`exit`, () => {
                if (this.process) {
                    this.process.removeAllListeners();
                }
                this.process = undefined;
                fs.unlinkSync(this.tmpFileName);
                resolve();
            });
        });
    }
    onMessage(callback: (msg: any) => void): void {
        if (!this.process) {
            throw new Error(`Trying to attach message handler before process started`);
        }
        this.process.on(`message`, callback);
    }
    onExit(callback: (code: number | null, signal: NodeJS.Signals | null) => void): void {
        if (!this.process) {
            throw new Error(`Trying to attach exit handler before process started`);
        }
        this.process.on(`exit`, callback);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(msg: any): void {
        if (!this.process) {
            throw new Error(`Trying to send a message before process started`);
        }

        this.process.send(msg);
    }
}
