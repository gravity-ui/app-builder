import * as fs from 'node:fs';
import nodemon from 'nodemon';
import {onExit} from 'signal-exit';
import {rimraf} from 'rimraf';

import {createRunFolder, getAppRunPath, shouldCompileTarget} from '../../common/utils.js';
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
    let shutdownPromise: Promise<void> | undefined;

    const shutdown = (signal: NodeJS.Signals) => {
        if (!shutdownPromise) {
            needToStartNodemon = false;
            shutdownPromise = (async () => {
                logger.success('\nCleaning up...');
                await Promise.all([
                    applicationExit,
                    serverCompilation?.stop(signal),
                    clientCompilation?.stop(),
                ]);
                process.exit(1);
            })();
        }
        return shutdownPromise;
    };

    const serverPath = config.server.outputPath;
    const {inspect, inspectBrk} = config.server;

    const startNodemon = () => {
        if (needToStartNodemon && serverCompiled && clientCompiled) {
            logger.message('Starting application at', serverPath);
            const nodeOptions = [process.env.NODE_OPTIONS, '--enable-source-maps'];
            if (inspect || inspectBrk) {
                nodeOptions.push(
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
                    // Node arguments make nodemon spawn a shell instead of forking the server.
                    NODE_OPTIONS: nodeOptions.filter(Boolean).join(' '),
                },
                watch: [serverPath, ...serverWatch],
                delay,
            });

            nodemonInstance.on('start', () => {
                applicationExit = new Promise<void>((resolve) => {
                    resolveApplicationExit = resolve;
                });
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
        if (!shutdownPromise) {
            serverCompilation?.stop(signal);
            clientCompilation?.stop();
        }
    });
}
