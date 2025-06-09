import * as path from 'node:path';
import nodemon from 'nodemon';
import {onExit} from 'signal-exit';
import {rimraf} from 'rimraf';

import {shouldCompileTarget} from '../../common/utils';
import logger from '../../common/logger';
import paths from '../../common/paths';

// Импортируем систему табов для логирования
import {TerminalTabs} from './ui/TerminalTabs';
import type {LogEntry} from './ui/TerminalTabs';

import type WebpackDevServer from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models';
import type {ControllableScript} from '../../common/child-process/controllable-script';
import {RspackDevServer} from '@rspack/dev-server';

// Глобальная система табов
let terminalTabs: TerminalTabs | undefined;

// Функция для добавления лога в систему табов
function addLogToTabs(
    type: 'server' | 'client' | 'all',
    message: string,
    level: LogEntry['level'] = 'message',
) {
    if (terminalTabs && process.stdout.isTTY) {
        terminalTabs.addLog({
            type,
            message,
            timestamp: Date.now(),
            level,
        });
    }
}

// Обёртка для logger с интеграцией в табы
function createLoggerWrapper(type: 'server' | 'client') {
    return {
        message: (...args: string[]) => {
            const message = args.join(' ');
            addLogToTabs(type, message, 'message');
            if (!process.stdout.isTTY) {
                logger.message(`[${type}]`, message);
            }
        },
        success: (...args: string[]) => {
            const message = args.join(' ');
            addLogToTabs(type, message, 'success');
            if (!process.stdout.isTTY) {
                logger.success(`[${type}]`, message);
            }
        },
        warning: (...args: string[]) => {
            const message = args.join(' ');
            addLogToTabs(type, message, 'warning');
            if (!process.stdout.isTTY) {
                logger.warning(`[${type}]`, message);
            }
        },
        error: (...args: string[]) => {
            const message = args.join(' ');
            addLogToTabs(type, message, 'error');
            if (!process.stdout.isTTY) {
                logger.error(`[${type}]`, message);
            }
        },
        verbose: (...args: string[]) => {
            const message = args.join(' ');
            addLogToTabs(type, message, 'verbose');
            if (!process.stdout.isTTY) {
                logger.verbose(`[${type}]`, message);
            }
        },
    };
}

export default async function (config: NormalizedServiceConfig) {
    process.env.NODE_ENV = 'development';

    // Инициализируем систему табов только в TTY
    if (process.stdout.isTTY) {
        terminalTabs = new TerminalTabs();
        terminalTabs.initialize();

        // Добавляем начальный лог
        addLogToTabs('all', 'Запуск режима разработки...', 'message');
    }

    const shouldCompileClient = shouldCompileTarget(config.target, 'client');
    const shouldCompileServer = shouldCompileTarget(config.target, 'server');

    if (shouldCompileClient && shouldCompileServer) {
        rimraf.sync(paths.appRun);
    }

    let clientCompiled = !shouldCompileClient;
    let serverCompiled = !shouldCompileServer;
    let needToStartNodemon = shouldCompileServer;

    const serverPath = path.resolve(paths.appDist, 'server');
    const {inspect, inspectBrk} = config.server;

    const startNodemon = () => {
        if (needToStartNodemon && serverCompiled && clientCompiled) {
            const serverLogger = createLoggerWrapper('server');
            serverLogger.message('Starting application at', serverPath);

            const nodeArgs = ['--enable-source-maps'];
            if (inspect || inspectBrk) {
                nodeArgs.push(
                    `--${inspect ? 'inspect' : 'inspect-brk'}=:::${inspect || inspectBrk}`,
                );
            }

            const serverWatch = config.server.watch ?? [];
            const delay = config.server.watchThrottle;
            const nodemonInstance = nodemon({
                ext: 'js json',
                script: `${serverPath}/index.js`,
                args: ['--dev', config.server.port ? `--port=${config.server.port}` : ''],
                env: {
                    ...(config.server.port ? {APP_PORT: `${config.server.port}`} : undefined),
                },
                nodeArgs,
                watch: [serverPath, ...serverWatch],
                delay,
            });

            nodemonInstance.on('quit', () => process.exit());
            needToStartNodemon = false;
        }
    };

    let serverCompilation: ControllableScript | undefined;
    if (shouldCompileServer) {
        const {watchServerCompilation} = await import('./server.js');
        serverCompilation = await watchServerCompilation(config);
        serverCompilation.onMessage((msg) => {
            if (typeof msg === 'object' && 'type' in msg && msg.type === 'Emitted') {
                serverCompiled = true;
                const serverLogger = createLoggerWrapper('server');
                serverLogger.success('Server compilation completed');
                startNodemon();
            }
        });
    }

    let clientCompilation: WebpackDevServer | RspackDevServer | undefined;
    if (shouldCompileClient) {
        const {watchClientCompilation} = await import('./client.js');
        clientCompilation = await watchClientCompilation(config, () => {
            const clientLogger = createLoggerWrapper('client');
            clientLogger.success('Manifest was compiled successfully');
            clientCompiled = true;
            startNodemon();
        });
    }

    const cleanup = async () => {
        if (terminalTabs) {
            terminalTabs.destroy();
        }
        await serverCompilation?.stop('SIGINT');
        await clientCompilation?.stop();
    };

    process.on('SIGINT', async () => {
        if (!process.stdout.isTTY) {
            logger.success('\nCleaning up...');
        }
        await cleanup();
        process.exit(1);
    });

    process.on('SIGTERM', async () => {
        if (!process.stdout.isTTY) {
            logger.success('\nCleaning up...');
        }
        await cleanup();
        process.exit(1);
    });

    onExit((_code, signal) => {
        serverCompilation?.stop(signal);
        clientCompilation?.stop();
        if (terminalTabs) {
            terminalTabs.destroy();
        }
    });
}
