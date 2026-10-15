import {buildApp, removeBuiltApps} from './test-utils/build-app.js';
import {startWorker} from './test-utils/start-worker.js';

const CDN = 'https://cdn.example.com/build/';

afterEach(removeBuiltApps);

describe.each([
    {name: 'Webpack', bundler: 'webpack', moduleFederation: false},
    {name: 'Webpack with Module Federation', bundler: 'webpack', moduleFederation: true},
    {name: 'Rspack', bundler: 'rspack', moduleFederation: false},
    {name: 'Rspack with Module Federation', bundler: 'rspack', moduleFederation: true},
] as const)(
    'cdn-compat worker built by $name in development mode',
    ({bundler, moduleFederation}) => {
        it('loads the shared startup chunk from the CDN', async () => {
            const app = await buildApp({bundler, moduleFederation, workerPublicPathPlugin: true});

            const worker = await startWorker(app, {publicPath: CDN});

            expect(worker.requestedScripts).toEqual([
                `${CDN}js/worker.chunk.js`,
                `${CDN}js/shared.chunk.js`,
            ]);
            expect(worker.failedScripts).toEqual([]);
            expect(worker.messages).toEqual(['worker started']);
        });

        it('loads the shared startup chunk from the page origin without WorkerPublicPathPlugin', async () => {
            const app = await buildApp({bundler, moduleFederation, workerPublicPathPlugin: false});

            const worker = await startWorker(app, {publicPath: CDN});

            const sharedChunkFromPageOrigin = expect.stringMatching(
                /^(blob:)?https:\/\/app\.example\.com\/.*js\/shared\.chunk\.js$/,
            );
            expect(worker.requestedScripts).toEqual([
                `${CDN}js/worker.chunk.js`,
                sharedChunkFromPageOrigin,
            ]);
            expect(worker.failedScripts).toEqual([sharedChunkFromPageOrigin]);
            expect(worker.messages).toEqual([]);
        });
    },
);
