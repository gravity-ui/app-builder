import fs from 'fs';

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
