import * as path from 'node:path';
import nodemon from 'nodemon';
import {onExit} from 'signal-exit';
import {rimraf} from 'rimraf';

import {shouldCompileTarget} from '../../common/utils';
import logger from '../../common/logger';
import paths from '../../common/paths';

import type WebpackDevServer from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models';
import type {ControllableScript} from '../../common/child-process/controllable-script';

export default async function (config: NormalizedServiceConfig) {
    process.env.NODE_ENV = 'development';

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
                    ...(config.server.port ? {APP_PORT: config.server.port} : undefined),
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
                startNodemon();
            }
        });
    }

    let clientCompilation: WebpackDevServer | undefined;
    if (shouldCompileClient) {
        const {watchClientCompilation} = await import('./client.js');
        clientCompilation = await watchClientCompilation(config, () => {
            logger.success('Manifest was compiled successfully');
            clientCompiled = true;
            startNodemon();
        });
    }

    process.on('SIGINT', async () => {
        logger.success('\nCleaning up...');
        await serverCompilation?.stop('SIGINT');
        await clientCompilation?.stop();
        process.exit(1);
    });

    process.on('SIGTERM', async () => {
        logger.success('\nCleaning up...');
        await serverCompilation?.stop('SIGTERM');
        await clientCompilation?.stop();
        process.exit(1);
    });

    onExit((_code, signal) => {
        serverCompilation?.stop(signal);
        clientCompilation?.stop();
    });
}
