import {jest} from '@jest/globals';

import {handlerP} from './cli-handler.js';
import {startRspackProfile} from './rspack-profile.js';

const originalExitCode = process.exitCode;

beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});

afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
});

describe('command completion', () => {
    it.each([undefined, false])('exits by default (keepAlive: %s)', async (keepAlive) => {
        await handlerP(async () => undefined)({_: ['build'], $0: 'app-builder', keepAlive});

        expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('cleans up profiling while leaving plugin services alive when requested', async () => {
        const cleanup = jest.fn<() => Promise<void>>(async () => undefined);
        await startRspackProfile({
            filter: 'ALL',
            layer: 'logger',
            traceApi: {
                register: async () => undefined,
                cleanup,
            },
        });
        process.exitCode = 1;

        await handlerP(async () => undefined)({
            _: ['build'],
            $0: 'app-builder',
            keepAlive: true,
        });

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(process.exit).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it('still exits on a failed build with keep-alive enabled', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        await handlerP(async () => {
            throw new Error('Build failed');
        })({_: ['build'], $0: 'app-builder', keepAlive: true});

        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
