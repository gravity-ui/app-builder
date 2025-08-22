import * as path from 'node:path';
import * as fs from 'node:fs';
import nodemon from 'nodemon';
import {onExit} from 'signal-exit';
import {rimraf} from 'rimraf';

import {getAppRunPath, shouldCompileTarget} from '../../common/utils';
import logger from '../../common/logger';
import paths from '../../common/paths';

import type WebpackDevServer from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models';
import type {ControllableScript} from '../../common/child-process/controllable-script';
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
                startNodemon();
            }
        });
    }

    let clientCompilation: WebpackDevServer | RspackDevServer | undefined;
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
