import * as fs from 'node:fs';
import nodemon from 'nodemon';
import {onExit} from 'signal-exit';
import {rimraf} from 'rimraf';

import {
    createRunFolder,
    deferredPromise,
    getAppRunPath,
    shouldCompileTarget,
} from '../../common/utils.js';
import logger from '../../common/logger/index.js';

import type WebpackDevServer from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models/index.js';
import type {ControllableScript} from '../../common/child-process/controllable-script.js';
// TypeScript 5.6 does not know that modern Node.js can require synchronous ESM.
// @ts-ignore -- ts-jest uses CommonJS resolution while @rspack/dev-server 2 is ESM.
import {RspackDevServer} from '@rspack/dev-server';

export default async function (config: NormalizedServiceConfig) {
    process.env.NODE_ENV = 'development';

    const shouldCompileClient = shouldCompileTarget(config.target, 'client');
    const shouldCompileServer = shouldCompileTarget(config.target, 'server');

    const appRunPath = getAppRunPath(config);

    if (shouldCompileClient && shouldCompileServer) {
        try {
            fs.accessSync(appRunPath, fs.constants.W_OK | fs.constants.X_OK); // eslint-disable-line no-bitwise
            rimraf.sync(appRunPath);
        } catch (error) {
            logger.warning(`Failed to remove appRun path [${appRunPath}]: ${error}`);
        }
    }

    if (shouldCompileClient || shouldCompileServer) {
        createRunFolder(config);
    }

    let clientCompiled = !shouldCompileClient;
    let serverCompiled = !shouldCompileServer;
    let needToStartNodemon = shouldCompileServer;
    let serverCompilation: ControllableScript | undefined;
    let clientCompilation: WebpackDevServer | RspackDevServer | undefined;
    let applicationExit = Promise.resolve();
    let resolveApplicationExit = () => {};
    let shuttingDown = false;
    let preventApplicationStart = () => {};

    const shutdown = async (signal: NodeJS.Signals) => {
        if (shuttingDown) return;
        shuttingDown = true;
        needToStartNodemon = false;
        preventApplicationStart();
        logger.success('\nCleaning up...');
        await Promise.all([
            applicationExit,
            serverCompilation?.stop(signal),
            clientCompilation?.stop(),
        ]);
        process.exit(1);
    };

    const serverPath = config.server.outputPath;
    const {inspect, inspectBrk} = config.server;

    const startNodemon = () => {
        if (needToStartNodemon && serverCompiled && clientCompiled) {
            logger.message('Starting application at', serverPath);
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

            nodemonInstance.on('config:update', (loaded) => {
                if (!loaded) return;
                const state = loaded as typeof loaded & {command: {raw: {executable: string}}};
                preventApplicationStart = () => {
                    // Nodemon can finish loading or run a queued restart after quit.
                    state.options.runOnChangeOnly = true;
                    state.lastStarted = 0;
                };
                if (shuttingDown) preventApplicationStart();
                // Replace the POSIX shell so nodemon waits for Node itself.
                if (process.platform !== 'win32' && state.command.raw.executable === 'node') {
                    state.command.raw.executable = 'exec node';
                }
            });
            nodemonInstance.on('start', () => {
                ({promise: applicationExit, resolve: resolveApplicationExit} =
                    deferredPromise<void>());
            });
            nodemonInstance.on('exit', () => resolveApplicationExit());
            nodemonInstance.on('crash', () => resolveApplicationExit());
            nodemonInstance.on('quit', () => shutdown('SIGINT'));
            needToStartNodemon = false;
        }
    };

    if (shouldCompileServer) {
        const {watchServerCompilation} = await import('./server.js');
        serverCompilation = await watchServerCompilation(config);
        serverCompilation.onExit(() => {
            serverCompilation = undefined;
        });
        serverCompilation.onMessage((msg) => {
            if (typeof msg === 'object' && 'type' in msg && msg.type === 'Emitted') {
                serverCompiled = true;
                startNodemon();
            }
        });
    }

    if (shouldCompileClient) {
        const {watchClientCompilation} = await import('./client.js');
        try {
            clientCompilation = await watchClientCompilation(config, () => {
                logger.success('Manifest was compiled successfully');
                clientCompiled = true;
                startNodemon();
            });
        } catch (e) {
            logger.logError('Failed to start client dev server', e);
            await serverCompilation?.stop('SIGTERM');
            process.exit(1);
        }
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    onExit((_code, signal) => {
        if (!shuttingDown) {
            serverCompilation?.stop(signal);
            clientCompilation?.stop();
        }
    });
}
