import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {FallbackRuntimeConfig} from './fallback-controller.js';
import {createFallbackController, installChunkFallback} from './fallback-controller.js';

const config: FallbackRuntimeConfig = {
    root: 'https://primary.test/assets/',
    scope: 'host',
    federated: true,
    fallbacks: [{publicPath: 'https://ru.test/backup/'}, {publicPath: 'https://kz.test/backup/'}],
};
type TestRuntime = {
    p: string;
    e: (chunkId: string | number) => Promise<unknown>;
};

type PendingChunk = {
    resolve: () => void;
    reject: (error: Error) => void;
    path: string;
};

type FallbackEvent = {type: string; detail: {deadPath: string}};

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let events: FallbackEvent[];

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    events = [];
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: {
            location: {href: 'https://app.test/', hostname: 'app.test'},
            __PUBLIC_PATH__: config.root + 'host/',
            CustomEvent: class {
                type: string;
                detail: FallbackEvent['detail'];

                constructor(type: string, options: {detail: FallbackEvent['detail']}) {
                    this.type = type;
                    this.detail = options.detail;
                }
            },
            dispatchEvent: (event: FallbackEvent) => {
                events.push(event);

                return true;
            },
        },
    });
    Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: {}});
});

afterEach(() => {
    restoreGlobal('window', originalWindow);
    restoreGlobal('document', originalDocument);
    jest.restoreAllMocks();
    jest.useRealTimers();
});
describe('fallback controller', () => {
    it('shares CDN selection without sharing application directories', () => {
        const host = createInstalledController(config);
        const remote = createInstalledController({...config, scope: 'remote'});
        host.fail(host.base(), 'chunk', failure());
        expect(host.path()).toBe('https://ru.test/backup/host/');
        expect(remote.path()).toBe('https://ru.test/backup/remote/');
        expect(remote.rewrite(config.root + 'remote/entry-42.js?q=1')).toBe(
            'https://ru.test/backup/remote/entry-42.js?q=1',
        );
        expect(remote.rewrite('https://external.test/entry.js')).toBe(
            'https://external.test/entry.js',
        );
    });

    it('isolates unrelated applications', () => {
        const host = createInstalledController(config);
        const other = createInstalledController({...config, root: 'https://other.test/'});
        host.fail(host.base(), 'chunk', failure());
        expect(other.base()).toBe(config.root);
    });

    it('does not inherit a foreign host directory in an independent remote', () => {
        const remote = createInstalledController({
            ...config,
            root: 'https://external.test/assets/',
            scope: 'independent',
        });
        expect(remote.path()).toBe('https://external.test/assets/independent/');
    });

    it('keeps the runtime primary when no host filter matches', () => {
        const controller = createInstalledController({
            ...config,
            fallbacks: [{publicPath: 'https://kz.test/', hosts: [{source: '\\.kz$', flags: 'i'}]}],
        });
        expect(controller.path()).toBe(config.root + 'host/');
        expect(controller.fail(controller.base(), 'chunk', failure())).toBeNull();
    });

    it('filters backups by browser hostname and removes duplicates', () => {
        window.location.hostname = 'app.kz';
        const controller = createInstalledController({
            ...config,
            fallbacks: [
                {publicPath: 'https://ru.test/', hosts: [{source: '\\.ru$', flags: 'i'}]},
                {publicPath: 'https://kz.test/'},
                {publicPath: 'https://kz.test/'},
            ],
        });
        expect(controller.fail(controller.base(), 'chunk', failure())).toBe('https://kz.test/');
        expect(controller.fail(controller.base(), 'chunk', failure())).toBeNull();
    });

    it('recovers the primary after backoff', () => {
        const controller = createInstalledController(config);
        controller.fail(controller.base(), 'chunk', failure());
        jest.advanceTimersByTime(4500);
        expect(controller.base()).toBe(config.root);
    });

    it('does not restart a failed request on a recovered, already attempted base', () => {
        const controller = createInstalledController(config);
        controller.fail(controller.base(), 'chunk', failure());
        jest.advanceTimersByTime(4500);
        expect(
            controller.fail('https://ru.test/backup/', 'chunk', failure(), [
                config.root,
                'https://ru.test/backup/',
            ]),
        ).toBe('https://kz.test/backup/');
    });

    it('does not install in SSR or without matching fallbacks', () => {
        expect(createFallbackController({...config, fallbacks: []})).toBeNull();
        Reflect.deleteProperty(globalThis, 'window');
        expect(createFallbackController(config)).toBeNull();
    });

    it('resolves relative backup roots against the page origin', () => {
        const controller = createInstalledController({
            ...config,
            fallbacks: [{publicPath: '/build/'}],
        });
        controller.fail(controller.base(), 'chunk', failure());
        expect(controller.base()).toBe('https://app.test/build/');
        expect(controller.path()).toBe('/build/host/');
        expect(controller.rewrite(config.root + 'remote/entry.js')).toBe(
            'https://app.test/build/remote/entry.js',
        );
    });

    it('preserves the ordinary default /build/ path', () => {
        Reflect.deleteProperty(window, '__PUBLIC_PATH__');
        expect(createInstalledController({...config, scope: '', federated: false}).path()).toBe(
            'https://app.test/build/',
        );
    });

    it('attributes concurrent failures to the original attempt', async () => {
        const controller = createInstalledController(config);
        const pending: PendingChunk[] = [];
        const req: TestRuntime = {
            p: '',
            e: () =>
                new Promise<void>((resolve, reject) =>
                    pending.push({resolve, reject, path: req.p}),
                ),
        };
        installChunkFallback(req, controller);
        const first = req.e('a');
        const second = req.e('b');
        await Promise.resolve();
        getPendingChunk(pending, 0).reject(failure(config.root + 'host/a.js'));
        await jest.advanceTimersByTimeAsync(0);
        getPendingChunk(pending, 1).reject(failure(config.root + 'host/b.js'));
        await jest.advanceTimersByTimeAsync(0);
        expect(pending.slice(2).map((item) => item.path)).toEqual([
            'https://ru.test/backup/host/',
            'https://ru.test/backup/host/',
        ]);
        pending.slice(2).forEach((item) => item.resolve());
        await Promise.all([first, second]);
        expect(events.map((event) => event.detail.deadPath)).toEqual([config.root, config.root]);
    });

    it('retries the selected CDN after a late rejection from an earlier JS/CSS attempt', async () => {
        const controller = createInstalledController(config);
        const ensure = jest
            .fn<TestRuntime['e']>()
            .mockRejectedValueOnce(
                Object.assign(new Error('CSS load failed'), {
                    code: 'CSS_CHUNK_LOAD_FAILED',
                    request: config.root + 'host/chunk.css',
                }),
            )
            .mockRejectedValueOnce(failure(config.root + 'host/chunk.js'))
            .mockResolvedValue(undefined);
        const req: TestRuntime = {p: '', e: ensure};
        installChunkFallback(req, controller);
        await req.e('chunk');
        expect(ensure).toHaveBeenCalledTimes(3);
        expect(controller.base()).toBe('https://ru.test/backup/');
        expect(events).toHaveLength(1);
    });

    it('retains fallback support for generic chunk-loading errors', async () => {
        const controller = createInstalledController(config);
        const req: TestRuntime = {
            p: '',
            e: jest
                .fn<TestRuntime['e']>()
                .mockRejectedValueOnce(new Error('Loading CSS chunk 1 failed.'))
                .mockResolvedValue(undefined),
        };
        installChunkFallback(req, controller);
        await req.e('chunk');
        expect(req.e).toBeDefined();
        expect(controller.base()).toBe('https://ru.test/backup/');
    });

    it('propagates execution errors and errors owned by another runtime', async () => {
        const controller = createInstalledController(config);
        const error = new Error('application error');
        const req: TestRuntime = {p: '', e: () => Promise.reject(error)};
        installChunkFallback(req, controller);
        await expect(req.e('chunk')).rejects.toBe(error);
        const remoteError = failure(config.root + 'remote/chunk.js');
        const remoteReq: TestRuntime = {p: '', e: () => Promise.reject(remoteError)};
        installChunkFallback(remoteReq, controller);
        await expect(remoteReq.e('remote')).rejects.toBe(remoteError);
        expect(events).toEqual([]);
    });
});

function createInstalledController(options: FallbackRuntimeConfig) {
    const controller = createFallbackController(options);

    if (!controller) {
        throw new Error('Expected the fallback controller to be installed.');
    }

    return controller;
}

function failure(request?: string) {
    return Object.assign(new Error('Loading chunk failed'), {name: 'ChunkLoadError', request});
}

function restoreGlobal(name: 'window' | 'document', descriptor?: PropertyDescriptor) {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
    } else {
        Reflect.deleteProperty(globalThis, name);
    }
}

function getPendingChunk(pending: PendingChunk[], index: number) {
    const chunk = pending[index];

    if (!chunk) {
        throw new Error(`Expected a pending chunk at index ${index}.`);
    }

    return chunk;
}
