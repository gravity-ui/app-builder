import crypto from 'crypto';
import path from 'path';
import * as fs from 'fs-extra';

const RANDOM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function randomChars(howMany: number) {
    const value: string[] = [];
    let rnd = null;

    // make sure that we do not fail because we ran out of entropy
    try {
        rnd = crypto.randomBytes(howMany);
    } catch (e) {
        // eslint-disable-next-line security/detect-pseudoRandomBytes
        rnd = crypto.pseudoRandomBytes(howMany);
    }

    for (let i = 0; i < howMany; i++) {
        value.push(RANDOM_CHARS[(rnd[i] ?? 0) % RANDOM_CHARS.length] ?? '0');
    }

    return value.join('');
}

function generateTmpName(tmpDir: string) {
    const name = ['tmp', '-', process.pid, '-', randomChars(12)].join('');
    return path.join(tmpDir, name);
}

export function tmpNameSync(tmpDir: string, retries = 3) {
    let tries = retries;
    do {
        const name = generateTmpName(tmpDir);
        try {
            fs.statSync(name);
        } catch (e) {
            return name;
        }
    } while (tries-- > 0);

    throw new Error('Could not get a unique tmp filename, max tries reached');
}
