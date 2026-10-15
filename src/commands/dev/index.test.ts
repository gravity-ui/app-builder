import {EventEmitter} from 'node:events';
import {setImmediate} from 'node:timers/promises';
import {jest} from '@jest/globals';

import {deferredPromise, shouldCompileTarget} from '../../common/utils.js';
import type {NormalizedServiceConfig} from '../../common/models/index.js';

const monitor = new EventEmitter();
const signals = new EventEmitter();
const nodemon = jest.fn((_options: unknown) => monitor);
const stopServer = jest.fn<() => Promise<void>>();
const stopClient = jest.fn<() => Promise<void>>();
const onExit = jest.fn<(callback: () => void) => void>();
let onServerMessage: (message: {type: string}) => void;
let onCompilerExit: () => void;
let onClientCompiled: () => void;

jest.unstable_mockModule('nodemon', () => ({default: nodemon}));
jest.unstable_mockModule('signal-exit', () => ({onExit}));
jest.unstable_mockModule('../../common/utils.js', () => ({
    deferredPromise,
    shouldCompileTarget,
    createRunFolder: jest.fn(),
    getAppRunPath: () => '/nonexistent-app-builder-test/run',
}));
jest.unstable_mockModule('../../common/logger/index.js', () => ({
    default: {message: jest.fn(), warning: jest.fn(), success: jest.fn()},
}));
jest.unstable_mockModule('./server.js', () => ({
    watchServerCompilation: async () => ({
        stop: stopServer,
        onExit: (callback: () => void) => {
            onCompilerExit = callback;
        },
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

beforeEach(() => {
    jest.replaceProperty(process, 'env', {...process.env});
    jest.spyOn(process, 'on').mockImplementation((event, listener) => {
        signals.on(event, listener);
        return process;
    });
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stopServer.mockResolvedValue(undefined);
    stopClient.mockResolvedValue(undefined);
});
afterEach(() => {
    monitor.removeAllListeners();
    signals.removeAllListeners();
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

async function startApplication(start = true) {
    await dev(config);
    onServerMessage({type: 'Emitted'});
    onClientCompiled();
    if (start) monitor.emit('start');
}
async function expectExitCount(count: number) {
    await setImmediate();
    expect(process.exit).toHaveBeenCalledTimes(count);
}

it('preserves Node flags and custom commands while replacing the default POSIX shell', async () => {
    await startApplication();
    const command = {raw: {executable: 'node'}};
    monitor.emit('config:update', {command});
    expect(command.raw.executable).toBe(process.platform === 'win32' ? 'node' : 'exec node');
    expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({nodeArgs: ['--enable-source-maps']}),
    );
    command.raw.executable = 'node --max-old-space-size=384';
    monitor.emit('config:update', {command});
    expect(command.raw.executable).toBe('node --max-old-space-size=384');
});

it.each(['loading', 'running', 'waiting'])(
    'prevents new starts while nodemon is %s',
    async (state) => {
        await startApplication(state === 'running');
        const options = {runOnChangeOnly: state === 'waiting'};
        const loaded = {options, lastStarted: 1, command: {raw: {executable: 'node'}}};
        if (state !== 'loading') monitor.emit('config:update', loaded);
        monitor.emit('quit');
        if (state === 'loading') monitor.emit('config:update', loaded);
        expect(options.runOnChangeOnly).toBe(true);
        expect(loaded.lastStarted).toBe(0);
        monitor.emit('exit');
        await expectExitCount(1);
    },
);

it('skips an already exited compiler', async () => {
    await startApplication();
    onCompilerExit();
    monitor.emit('quit');
    monitor.emit('exit');
    await expectExitCount(1);
    expect(stopServer).not.toHaveBeenCalled();
});

it.each([
    ['SIGINT', false],
    ['SIGTERM', false],
    ['SIGINT', true],
] as const)('waits for cleanup on %s (nodemon quits first: %s)', async (signal, nodemonFirst) => {
    const clientStop = deferredPromise<void>();
    stopClient.mockReturnValue(clientStop.promise);
    await startApplication();
    if (nodemonFirst) monitor.emit('quit');
    signals.emit(signal);
    signals.emit(signal);
    monitor.emit('quit');
    await expectExitCount(0);
    expect(stopServer).toHaveBeenCalledWith(signal);
    monitor.emit('exit');
    await expectExitCount(0);
    clientStop.resolve();
    await expectExitCount(1);
    expect(process.exit).toHaveBeenCalledWith(1);
    onExit.mock.calls[0]?.[0]();
    expect(stopServer).toHaveBeenCalledTimes(1);
    expect(stopClient).toHaveBeenCalledTimes(1);
});

it.each([
    ['exit', false],
    ['crash', false],
    ['exit', true],
    ['crash', true],
] as const)('handles %s followed by shutdown (restart: %s)', async (event, restart) => {
    await startApplication();
    monitor.emit(event);
    await expectExitCount(0);
    if (restart) monitor.emit('start');
    monitor.emit('quit');
    await expectExitCount(restart ? 0 : 1);
    if (restart) {
        monitor.emit('exit');
        await expectExitCount(1);
    }
});

it.each(['client-only', 'before compilation'])(
    'can stop %s without starting nodemon',
    async (scenario) => {
        await dev({...config, target: scenario === 'client-only' ? 'client' : undefined});
        signals.emit('SIGTERM');
        if (scenario === 'before compilation') {
            onServerMessage({type: 'Emitted'});
            onClientCompiled();
        }
        await expectExitCount(1);
        expect(nodemon).not.toHaveBeenCalled();
        expect(stopServer).toHaveBeenCalledTimes(scenario === 'client-only' ? 0 : 1);
        expect(stopClient).toHaveBeenCalledTimes(1);
    },
);
