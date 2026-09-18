import {EventEmitter} from 'node:events';
import {setImmediate} from 'node:timers/promises';
import {jest} from '@jest/globals';

import type {NormalizedServiceConfig} from '../../common/models/index.js';

const monitor = new EventEmitter();
const nodemon = jest.fn((_options: unknown) => monitor);
const stopServer = jest.fn<() => Promise<void>>();
const stopClient = jest.fn<() => Promise<void>>();
let onServerMessage: (message: {type: string}) => void;
let onClientCompiled: () => void;
let onProcessExit: (code: number, signal: NodeJS.Signals | null) => void;

jest.unstable_mockModule('nodemon', () => ({default: nodemon}));
jest.unstable_mockModule('signal-exit', () => ({
    onExit: (callback: typeof onProcessExit) => {
        onProcessExit = callback;
    },
}));
jest.unstable_mockModule('@rspack/dev-server', () => ({RspackDevServer: class {}}));
jest.unstable_mockModule('../../common/utils.js', () => ({
    createRunFolder: jest.fn(),
    getAppRunPath: () => '/nonexistent-app-builder-test/run',
    shouldCompileTarget: (target: string | undefined, part: string) => !target || target === part,
}));
jest.unstable_mockModule('../../common/logger/index.js', () => ({
    default: {message: jest.fn(), warning: jest.fn(), success: jest.fn()},
}));
jest.unstable_mockModule('./server.js', () => ({
    watchServerCompilation: async () => ({
        stop: stopServer,
        onMessage: (callback: typeof onServerMessage) => {
            onServerMessage = callback;
        },
    }),
}));
jest.unstable_mockModule('./client.js', () => ({
    watchClientCompilation: async (_config: unknown, callback: () => void) => {
        onClientCompiled = callback;
        return {stop: stopClient};
    },
}));

const {default: dev} = await import('./index.js');
const config = {server: {outputPath: '/app/server'}} as NormalizedServiceConfig;
let signalListeners: Map<NodeJS.Signals, NodeJS.SignalsListener[]>;

beforeEach(() => {
    signalListeners = new Map(
        (['SIGINT', 'SIGTERM'] as const).map((signal) => [signal, process.listeners(signal)]),
    );
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stopServer.mockResolvedValue(undefined);
    stopClient.mockResolvedValue(undefined);
});

afterEach(() => {
    for (const [signal, previous] of signalListeners) {
        for (const listener of process.listeners(signal)) {
            if (!previous.includes(listener)) {
                process.removeListener(signal, listener);
            }
        }
    }
    monitor.removeAllListeners();
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

const startApplication = async () => {
    await dev(config);
    onServerMessage({type: 'Emitted'});
    onClientCompiled();
    monitor.emit('start');
};

describe('dev shutdown', () => {
    it('passes Node options through the environment so nodemon can fork the server', async () => {
        const previousOptions = process.env.NODE_OPTIONS;
        process.env.NODE_OPTIONS = '--max-old-space-size=2048';
        try {
            await dev({...config, server: {...config.server, inspectBrk: 9229, port: 3000}});
            onServerMessage({type: 'Emitted'});
            onClientCompiled();
            expect(nodemon).toHaveBeenCalledWith(
                expect.objectContaining({
                    env: {
                        APP_PORT: '3000',
                        NODE_OPTIONS:
                            '--max-old-space-size=2048 --enable-source-maps --inspect-brk=:::9229',
                    },
                }),
            );
            expect(nodemon.mock.calls[0]?.[0]).not.toHaveProperty('nodeArgs');
        } finally {
            if (previousOptions === undefined) {
                delete process.env.NODE_OPTIONS;
            } else {
                process.env.NODE_OPTIONS = previousOptions;
            }
        }
    });

    it.each(['SIGINT', 'SIGTERM'] as const)(
        'waits for the application and compilers before exiting on %s',
        async (signal) => {
            let finishClient: () => void = () => {};
            stopClient.mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        finishClient = resolve;
                    }),
            );
            await startApplication();

            process.emit(signal);
            monitor.emit('quit');
            await setImmediate();

            expect(process.exit).not.toHaveBeenCalled();
            expect(stopServer).toHaveBeenCalledWith(signal);

            monitor.emit('exit');
            await setImmediate();

            expect(stopServer).toHaveBeenCalledWith(signal);
            expect(stopClient).toHaveBeenCalledTimes(1);
            expect(process.exit).not.toHaveBeenCalled();

            finishClient();
            await setImmediate();

            expect(process.exit).toHaveBeenCalledWith(1);
            onProcessExit(1, null);
            expect(stopServer).toHaveBeenCalledTimes(1);
            expect(stopClient).toHaveBeenCalledTimes(1);
        },
    );

    it('waits for nodemon quit cleanup when it receives the signal first', async () => {
        await startApplication();
        monitor.emit('quit');
        process.emit('SIGINT');
        process.emit('SIGINT');
        await setImmediate();
        expect(process.exit).not.toHaveBeenCalled();

        monitor.emit('exit');
        await setImmediate();
        expect(stopServer).toHaveBeenCalledTimes(1);
        expect(stopClient).toHaveBeenCalledTimes(1);
        expect(process.exit).toHaveBeenCalledTimes(1);
    });

    it.each(['exit', 'crash'])('keeps watching after an application %s', async (event) => {
        await startApplication();
        monitor.emit(event);
        await setImmediate();
        expect(process.exit).not.toHaveBeenCalled();

        monitor.emit('start');
        monitor.emit('quit');
        await setImmediate();
        expect(process.exit).not.toHaveBeenCalled();

        monitor.emit('exit');
        await setImmediate();
        expect(process.exit).toHaveBeenCalledTimes(1);
    });

    it.each(['exit', 'crash'])(
        'can quit after the application has already emitted %s',
        async (event) => {
            await startApplication();
            monitor.emit(event);
            monitor.emit('quit');
            await setImmediate();
            expect(process.exit).toHaveBeenCalledTimes(1);
        },
    );

    it('does not start the application if compilation finishes during shutdown', async () => {
        await dev(config);
        process.emit('SIGINT');
        onServerMessage({type: 'Emitted'});
        onClientCompiled();
        await setImmediate();
        expect(nodemon).not.toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledTimes(1);
    });

    it('stops a client-only dev server without waiting for nodemon', async () => {
        await dev({...config, target: 'client'});
        process.emit('SIGTERM');
        await setImmediate();
        expect(nodemon).not.toHaveBeenCalled();
        expect(stopServer).not.toHaveBeenCalled();
        expect(stopClient).toHaveBeenCalledTimes(1);
        expect(process.exit).toHaveBeenCalledTimes(1);
    });
});
