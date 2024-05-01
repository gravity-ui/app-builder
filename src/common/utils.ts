import fs from 'node:fs';
import os from 'node:os';

import paths from './paths';

export function createRunFolder() {
    const runPath = paths.appRun;
    if (!fs.existsSync(runPath)) {
        fs.mkdirSync(runPath, {recursive: true});
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
