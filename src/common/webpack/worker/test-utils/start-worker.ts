import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {setImmediate} from 'node:timers/promises';

import type {BuiltApp} from './build-app.js';

const PAGE_ORIGIN = 'https://app.example.com';

export interface StartWorkerOptions {
    /** Where the build output is served from, e.g. a CDN. */
    publicPath: string;
}

export interface StartedWorker {
    requestedScripts: string[];
    failedScripts: string[];
    messages: unknown[];
}

// Emulates `new Worker(url)` from `@gravity-ui/app-builder/worker`: the worker runs from a blob URL
// of the page origin, sets `self.__PUBLIC_PATH__` and imports the worker script.
// Scripts can only be fetched from `publicPath`, like from a CDN serving the build output.
export async function startWorker(
    app: BuiltApp,
    {publicPath}: StartWorkerOptions,
): Promise<StartedWorker> {
    const worker: StartedWorker = {requestedScripts: [], failedScripts: [], messages: []};

    const workerScope = vm.createContext({
        location: new URL(`blob:${PAGE_ORIGIN}/5f8f1c4e-worker`),
        postMessage: (message: unknown) => worker.messages.push(message),
        importScripts: (...urls: string[]) => {
            for (const url of urls) {
                worker.requestedScripts.push(url);
                const script = fetchScript(app, publicPath, url);
                if (script === undefined) {
                    worker.failedScripts.push(url);
                    throw new Error(`Failed to load script: ${url}`);
                }
                vm.runInContext(script, workerScope, {filename: url});
            }
        },
    });
    vm.runInContext('self = globalThis', workerScope);

    try {
        vm.runInContext(
            [
                `self.__PUBLIC_PATH__ = ${JSON.stringify(publicPath)};`,
                `importScripts(${JSON.stringify(publicPath + app.workerScript)});`,
            ].join('\n'),
            workerScope,
        );
    } catch {
        // A worker that fails to load a script never runs its entry module.
    }

    // Startup chunks are loaded synchronously by `importScripts`, then the entry module runs
    // in a microtask, so waiting for one macrotask is enough.
    await setImmediate();

    return worker;
}

function fetchScript(app: BuiltApp, publicPath: string, url: string) {
    if (!url.startsWith(publicPath)) {
        return undefined;
    }
    const file = path.join(app.outputPath, url.slice(publicPath.length));
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : undefined;
}
