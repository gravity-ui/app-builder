import {runInNewContext} from 'node:vm';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as sourceRuntime from './fallback-controller.js';
import {fallbackRuntimeSource} from './fallback-runtime-source.js';

class Stylesheet extends EventTarget {
    rel = 'stylesheet';
    sheet: object | null = null;
    isConnected = true;

    href: string;

    constructor(href: string) {
        super();
        this.href = href;
    }

    remove() {
        this.isConnected = false;
    }
}

const originals = ['window', 'document', 'MutationObserver'].map(
    (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
);
let links: Stylesheet[];
let notifyMutation: () => void;
let disconnect: ReturnType<typeof jest.fn>;

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    links = [];
    disconnect = jest.fn();

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            location: {href: 'https://app.test/', hostname: 'app.test'},
            __PUBLIC_PATH__: 'https://primary.test/host/',
        },
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            head: {
                querySelectorAll: () =>
                    links.filter((link) => link.isConnected && link.rel === 'stylesheet'),
            },
        },
    });
    Object.defineProperty(globalThis, 'MutationObserver', {
        configurable: true,
        value: class {
            disconnect = disconnect;

            constructor(callback: () => void) {
                notifyMutation = callback;
            }
            observe() {}
        },
    });
});

afterEach(() => {
    for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }

    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe.each([false, true])('stylesheet timeouts (generated: %s)', (generated) => {
    function runtime() {
        return generated
            ? (runInNewContext(fallbackRuntimeSource, {
                  window,
                  document,
                  MutationObserver,
                  Event,
                  URL,
                  console,
                  setTimeout,
                  clearTimeout,
              }) as typeof sourceRuntime)
            : sourceRuntime;
    }

    function controller() {
        const result = runtime().createFallbackController({
            root: 'https://primary.test/',
            scope: 'host',
            federated: true,
            fallbacks: [{publicPath: 'https://backup.test/'}],
        });

        if (!result) throw new Error('Controller should be installed');

        return result;
    }

    it('rejects the pending CSS chunk and reloads it from the backup', async () => {
        const active = controller();
        let pending: Promise<void> | undefined;
        const requests: string[] = [];
        const req = {
            p: '',
            miniCssF: () => 'chunk.css',
            e: () => {
                if (pending) return pending;

                const link = new Stylesheet(req.p + 'chunk.css');
                links.push(link);
                requests.push(link.href);
                pending = new Promise<void>((resolve, reject) => {
                    link.addEventListener('error', () => {
                        pending = undefined;
                        reject(
                            Object.assign(new Error('CSS load failed'), {
                                code: 'CSS_CHUNK_LOAD_FAILED',
                                request: link.href,
                            }),
                        );
                    });
                    link.addEventListener('load', () => {
                        pending = undefined;
                        resolve();
                    });
                });

                return pending;
            },
        };
        runtime().installChunkFallback(req, active, 100);
        const loaded = req.e();
        await jest.advanceTimersByTimeAsync(100);

        expect(requests).toEqual([
            'https://primary.test/host/chunk.css',
            'https://backup.test/host/chunk.css',
        ]);
        expect(links[0]?.isConnected).toBe(false);
        links[1]?.dispatchEvent(new Event('load'));
        await loaded;
        expect(disconnect).toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(1); // Primary recovery timer remains.
    });

    it('ignores initial, foreign, already loaded and unrelated stylesheets', async () => {
        const monitor = runtime().createStylesheetMonitor(controller(), 100);
        const release = monitor.track('https://primary.test/host/chunk.css');
        links.push(
            new Stylesheet('https://primary.test/host/initial.css'),
            new Stylesheet('https://primary.test/remote/chunk.css'),
            new Stylesheet('https://external.test/chunk.css'),
        );
        const loaded = new Stylesheet('https://primary.test/host/chunk.css');
        loaded.sheet = {};
        links.push(loaded);
        notifyMutation();
        await jest.advanceTimersByTimeAsync(100);

        expect(links.every((link) => link.isConnected)).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
        release();
        expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it.each(['load', 'error', 'remove'])(
        'cleans the timer on %s and ignores late events',
        async (event) => {
            const monitor = runtime().createStylesheetMonitor(controller(), 100);
            const release = monitor.track('https://primary.test/host/chunk.css');
            const link = new Stylesheet('https://primary.test/host/chunk.css');
            links.push(link);
            notifyMutation();
            const errors = jest.fn();
            link.addEventListener('error', errors);

            if (event === 'remove') {
                link.remove();
                notifyMutation();
            } else link.dispatchEvent(new Event(event));

            release();
            await jest.advanceTimersByTimeAsync(200);
            link.dispatchEvent(new Event('load'));
            expect(errors).toHaveBeenCalledTimes(event === 'error' ? 1 : 0);
            expect(jest.getTimerCount()).toBe(0);
            expect(disconnect).toHaveBeenCalledTimes(1);
        },
    );

    it('keeps a CSS timeout alive after a concurrent JS rejection', async () => {
        const monitor = runtime().createStylesheetMonitor(controller(), 100);
        const releaseFirst = monitor.track('https://primary.test/host/chunk.css');
        const releaseSecond = monitor.track('https://primary.test/host/chunk.css');
        const link = new Stylesheet('https://primary.test/host/chunk.css');
        links.push(link);
        notifyMutation();
        notifyMutation();
        const errors = jest.fn();
        link.addEventListener('error', errors);
        releaseFirst();
        releaseSecond();

        expect(disconnect).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(100);
        expect(errors).toHaveBeenCalledTimes(1);
        expect(disconnect).toHaveBeenCalledTimes(1);
    });
});
