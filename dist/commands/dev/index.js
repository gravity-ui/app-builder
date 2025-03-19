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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const path = __importStar(require("node:path"));
const nodemon_1 = __importDefault(require("nodemon"));
const signal_exit_1 = require("signal-exit");
const rimraf_1 = require("rimraf");
const utils_1 = require("../../common/utils");
const logger_1 = __importDefault(require("../../common/logger"));
const paths_1 = __importDefault(require("../../common/paths"));
async function default_1(config) {
    process.env.NODE_ENV = 'development';
    const shouldCompileClient = (0, utils_1.shouldCompileTarget)(config.target, 'client');
    const shouldCompileServer = (0, utils_1.shouldCompileTarget)(config.target, 'server');
    if (shouldCompileClient && shouldCompileServer) {
        rimraf_1.rimraf.sync(paths_1.default.appRun);
    }
    let clientCompiled = !shouldCompileClient;
    let serverCompiled = !shouldCompileServer;
    let needToStartNodemon = shouldCompileServer;
    const serverPath = path.resolve(paths_1.default.appDist, 'server');
    const { inspect, inspectBrk } = config.server;
    const startNodemon = () => {
        if (needToStartNodemon && serverCompiled && clientCompiled) {
            logger_1.default.message('Starting application at', serverPath);
            const nodeArgs = ['--enable-source-maps'];
            if (inspect || inspectBrk) {
                nodeArgs.push(`--${inspect ? 'inspect' : 'inspect-brk'}=:::${inspect || inspectBrk}`);
            }
            const serverWatch = config.server.watch ?? [];
            const delay = config.server.watchThrottle;
            const nodemonInstance = (0, nodemon_1.default)({
                ext: 'js json',
                script: `${serverPath}/index.js`,
                args: ['--dev', config.server.port ? `--port=${config.server.port}` : ''],
                env: {
                    ...(config.server.port ? { APP_PORT: `${config.server.port}` } : undefined),
                },
                nodeArgs,
                watch: [serverPath, ...serverWatch],
                delay,
            });
            nodemonInstance.on('quit', () => process.exit());
            needToStartNodemon = false;
        }
    };
    let serverCompilation;
    if (shouldCompileServer) {
        const { watchServerCompilation } = await import('./server.js');
        serverCompilation = await watchServerCompilation(config);
        serverCompilation.onMessage((msg) => {
            if (typeof msg === 'object' && 'type' in msg && msg.type === 'Emitted') {
                serverCompiled = true;
                startNodemon();
            }
        });
    }
    let clientCompilation;
    if (shouldCompileClient) {
        const { watchClientCompilation } = await import('./client.js');
        clientCompilation = await watchClientCompilation(config, () => {
            logger_1.default.success('Manifest was compiled successfully');
            clientCompiled = true;
            startNodemon();
        });
    }
    process.on('SIGINT', async () => {
        logger_1.default.success('\nCleaning up...');
        await serverCompilation?.stop('SIGINT');
        await clientCompilation?.stop();
        process.exit(1);
    });
    process.on('SIGTERM', async () => {
        logger_1.default.success('\nCleaning up...');
        await serverCompilation?.stop('SIGTERM');
        await clientCompilation?.stop();
        process.exit(1);
    });
    (0, signal_exit_1.onExit)((_code, signal) => {
        serverCompilation?.stop(signal);
        clientCompilation?.stop();
    });
}
