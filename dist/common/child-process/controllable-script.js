"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllableScript = void 0;
const utils_1 = require("./utils");
const fs = __importStar(require("fs-extra"));
const utils_2 = require("../utils");
class ControllableScript {
    isRunning = false;
    process;
    script = '';
    debugInfo;
    constructor(script, debugInfo) {
        this.script = script;
        this.debugInfo = debugInfo;
    }
    async start() {
        const args = [];
        const tmpFileName = (0, utils_1.tmpNameSync)(await (0, utils_2.getCacheDir)());
        fs.outputFileSync(tmpFileName, this.script);
        this.isRunning = true;
        // Passing --inspect isn't necessary for the child process to launch a port, but it allows some editors to automatically attach
        if (this.debugInfo) {
            if (this.debugInfo.break) {
                args.push(`--inspect-brk=${this.debugInfo.port}`);
            }
            else {
                args.push(`--inspect=${this.debugInfo.port}`);
            }
        }
        const { execaNode } = await import('execa');
        this.process = execaNode(tmpFileName, args, {
            env: {
                ...process.env,
            },
            stdio: [`inherit`, `inherit`, `inherit`, `ipc`],
            nodeOptions: ['--unhandled-rejections=strict'],
        });
        this.process.on('unhandledRejection', () => {
            this.stop('SIGABRT');
        });
        this.process.on('exit', () => {
            fs.unlinkSync(tmpFileName);
        });
    }
    async stop(signal = null, code) {
        if (!this.process) {
            throw new Error(`Trying to stop the process before starting it`);
        }
        this.isRunning = false;
        try {
            if (signal) {
                this.process.kill(signal);
            }
            else {
                this.process.send({
                    type: `COMMAND`,
                    action: {
                        type: `EXIT`,
                        payload: code,
                    },
                }, () => {
                    // The try/catch won't suffice for this process.send
                    // So use the callback to manually catch the Error, otherwise it'll be thrown
                    // Ref: https://nodejs.org/api/child_process.html#child_process_subprocess_send_message_sendhandle_options_callback
                });
            }
        }
        catch (err) {
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
                resolve();
            });
        });
    }
    onMessage(callback) {
        if (!this.process) {
            throw new Error(`Trying to attach message handler before process started`);
        }
        this.process.on(`message`, callback);
    }
    onExit(callback) {
        if (!this.process) {
            throw new Error(`Trying to attach exit handler before process started`);
        }
        this.process.on(`exit`, callback);
    }
    send(msg) {
        if (!this.process) {
            throw new Error(`Trying to send a message before process started`);
        }
        this.process.send(msg);
    }
}
exports.ControllableScript = ControllableScript;
