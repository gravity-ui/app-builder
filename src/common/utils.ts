import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import paths from './paths';

export function createRunFolder(moduleFederationName?: string) {
    const appRunPath = path.resolve(paths.appRun, moduleFederationName || '');

    if (!fs.existsSync(appRunPath)) {
        fs.mkdirSync(appRunPath, {recursive: true});
    }
}

export function shouldCompileTarget(target: 'client' | 'server' | undefined, targetName: string) {
    return target === undefined || target === targetName;
}

export async function getCacheDir() {
    const {default: findCacheDirectory} = await import('find-cache-dir');
    return findCacheDirectory({name: '@gravity-ui/app-builder', create: true}) || os.tmpdir();
}

export async function getPort({port}: {port: number}) {
    const {default: getPortDefault, portNumbers} = await import('get-port');
    return getPortDefault({port: portNumbers(port, port + 100)});
}

export function deferredPromise<T>() {
    let resolve: (value?: T) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T | undefined>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    // @ts-expect-error Promise callback executes synchronously, so resolve and reject are initialized here
    return {promise, resolve, reject};
}
