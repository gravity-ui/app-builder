import * as fs from 'node:fs';
import {fileURLToPath} from 'node:url';

/*
 * `public-path-fallback.js` is a browser runtime module that reads and writes webpack's
 * free variables (`__webpack_require__`, `__webpack_public_path__`) and is injected into
 * the app bundle rather than imported, so it cannot be `import`ed here. Instead it is
 * evaluated inside a `with` block over a sandbox that stands in for the webpack runtime.
 */
const source = fs.readFileSync(
    fileURLToPath(new URL('./public-path-fallback.js', import.meta.url)),
    'utf8',
);

const CDN = 'https://cdn.example.com/build/';
const RU = 'https://cdn.example.ru/build/';
const KZ = 'https://cdn.example.kz/build/';
const LOCAL = '/build/';

/*
 * What `client.publicPathFallback` normalizes to. The primary (CDN) is intentionally
 * present here as well, to cover the case where a project does list it explicitly - it is
 * deduplicated against the page-provided public path.
 */
const FALLBACKS = [
    {publicPath: CDN},
    {publicPath: RU, hosts: [{source: '\\.ru$', flags: 'i'}]},
    {publicPath: KZ, hosts: [{source: '^app\\.example\\.kz$', flags: 'i'}]},
    {publicPath: LOCAL},
];

/* Backups only, which is how the option is meant to be used */
const BACKUPS_ONLY = [
    {publicPath: RU, hosts: [{source: '\\.ru$', flags: 'i'}]},
    {publicPath: LOCAL},
];

interface HarnessOptions {
    /** Public paths whose requests should fail, i.e. the degraded CDNs */
    deadPaths?: string[];
    fallbacks?: unknown;
    hostname?: string;
    /** What `public-path.js` has already put into `__webpack_public_path__` */
    initialPath?: string;
}

function createHarness({
    deadPaths = [],
    fallbacks = FALLBACKS,
    hostname = 'app.example.com',
    initialPath = CDN,
}: HarnessOptions = {}) {
    const requests: string[] = [];
    const warnings: string[] = [];
    let publicPath = initialPath;

    const webpackRequire = {
        /*
         * Stands in for webpack's `ensureChunk`: reads the public path synchronously
         * (as every `__webpack_require__.f.*` handler does), then settles asynchronously.
         */
        e(chunkId: string) {
            const url = `${publicPath}js/${chunkId}.chunk.js`;
            requests.push(url);

            if (deadPaths.some((deadPath) => url.startsWith(deadPath))) {
                const error: Error & {name: string} = new Error(
                    `Loading chunk ${chunkId} failed.\n(error: ${url})`,
                );
                error.name = 'ChunkLoadError';
                return Promise.reject(error);
            }

            return Promise.resolve(url);
        },
    };

    const sandbox = {
        window: {location: {hostname}},
        document: {},
        console: {warn: (message: string) => warnings.push(message)},
        __webpack_require__: webpackRequire,
        __PUBLIC_PATH_FALLBACKS__: fallbacks,
        get __webpack_public_path__() {
            return publicPath;
        },
        set __webpack_public_path__(value: string) {
            publicPath = value;
        },
    };

    // eslint-disable-next-line no-new-func
    new Function('sandbox', `with (sandbox) { ${source} }`)(sandbox);

    return {
        ensureChunk: (chunkId: string) => webpackRequire.e(chunkId),
        getPublicPath: () => publicPath,
        requests,
        warnings,
    };
}

describe('public-path-fallback runtime', () => {
    it('walks the candidate list until a public path works', async () => {
        const harness = createHarness({deadPaths: [CDN, RU]});

        await expect(harness.ensureChunk('42')).resolves.toBe(`${LOCAL}js/42.chunk.js`);
        expect(harness.requests).toEqual([`${CDN}js/42.chunk.js`, `${LOCAL}js/42.chunk.js`]);
    });

    it('uses a regional backup only on a matching host', async () => {
        const ruHost = createHarness({deadPaths: [CDN], hostname: 'app.example.ru'});
        await ruHost.ensureChunk('1');
        expect(ruHost.requests).toEqual([`${CDN}js/1.chunk.js`, `${RU}js/1.chunk.js`]);

        const kzHost = createHarness({deadPaths: [CDN], hostname: 'app.example.kz'});
        await kzHost.ensureChunk('1');
        expect(kzHost.requests).toEqual([`${CDN}js/1.chunk.js`, `${KZ}js/1.chunk.js`]);
    });

    it('skips every host-restricted candidate on an unmatched host', async () => {
        const harness = createHarness({deadPaths: [CDN], hostname: 'app.example.com'});

        await harness.ensureChunk('1');

        expect(harness.requests).toEqual([`${CDN}js/1.chunk.js`, `${LOCAL}js/1.chunk.js`]);
    });

    it('matches hosts case-insensitively', async () => {
        const harness = createHarness({deadPaths: [CDN], hostname: 'APP.EXAMPLE.KZ'});

        await harness.ensureChunk('1');

        expect(harness.requests).toEqual([`${CDN}js/1.chunk.js`, `${KZ}js/1.chunk.js`]);
    });

    it('sticks to the working public path for subsequent chunks', async () => {
        const harness = createHarness({deadPaths: [CDN]});

        await harness.ensureChunk('a');
        await harness.ensureChunk('b');
        await harness.ensureChunk('c');

        // Only the first chunk pays for the degraded CDN
        expect(harness.requests).toEqual([
            `${CDN}js/a.chunk.js`,
            `${LOCAL}js/a.chunk.js`,
            `${LOCAL}js/b.chunk.js`,
            `${LOCAL}js/c.chunk.js`,
        ]);
        expect(harness.getPublicPath()).toBe(LOCAL);
    });

    it('does not leave a temporary public path observable after ensureChunk returns', async () => {
        const harness = createHarness();

        const promise = harness.ensureChunk('1');
        expect(harness.getPublicPath()).toBe(CDN);

        await promise;
    });

    it('rethrows the original error when every candidate is exhausted', async () => {
        const harness = createHarness({deadPaths: [CDN, LOCAL]});

        await expect(harness.ensureChunk('9')).rejects.toMatchObject({name: 'ChunkLoadError'});
        expect(harness.requests).toEqual([`${CDN}js/9.chunk.js`, `${LOCAL}js/9.chunk.js`]);
        expect(harness.warnings.at(-1)).toContain('no fallbacks left');
    });

    it('tries the page-provided public path first even when it is not in the list', async () => {
        const pagePath = 'https://shard1.cdn.example.com/build/';
        const harness = createHarness({deadPaths: [pagePath], initialPath: pagePath});

        await harness.ensureChunk('5');

        expect(harness.requests).toEqual([`${pagePath}js/5.chunk.js`, `${CDN}js/5.chunk.js`]);
    });

    it('walks the configured backups when only they are listed', async () => {
        const harness = createHarness({
            deadPaths: [CDN],
            fallbacks: BACKUPS_ONLY,
            hostname: 'app.example.ru',
        });

        await harness.ensureChunk('1');

        expect(harness.requests).toEqual([`${CDN}js/1.chunk.js`, `${RU}js/1.chunk.js`]);
    });

    /*
     * The on-call fix for an outage is to point the page at a backup. Chunks must follow it
     * immediately rather than keep probing the dead primary on every session.
     */
    it('does not probe a dead primary once the page points at a backup', async () => {
        const harness = createHarness({
            deadPaths: [CDN],
            fallbacks: BACKUPS_ONLY,
            hostname: 'app.example.ru',
            initialPath: RU,
        });

        await harness.ensureChunk('1');

        expect(harness.requests).toEqual([`${RU}js/1.chunk.js`]);
    });

    it('does not patch chunk loading when there is nothing to fall back to', async () => {
        const harness = createHarness({
            deadPaths: [LOCAL],
            fallbacks: [{publicPath: LOCAL}],
            initialPath: LOCAL,
        });

        await expect(harness.ensureChunk('1')).rejects.toThrow();
        expect(harness.requests).toEqual([`${LOCAL}js/1.chunk.js`]);
        expect(harness.warnings).toEqual([]);
    });
});
