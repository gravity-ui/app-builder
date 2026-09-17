import {jest} from '@jest/globals';

const cleanupRspackProfile = jest.fn<() => Promise<void>>(async () => undefined);
jest.unstable_mockModule('./rspack-profile.js', () => ({cleanupRspackProfile}));

const {handlerP} = await import('./cli-handler.js');

const originalExitCode = process.exitCode;

beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});

afterEach(() => {
    process.exitCode = originalExitCode;
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

describe('command completion', () => {
    it('exits by default', async () => {
        await handlerP(async () => undefined)({_: ['build'], $0: 'app-builder'});

        expect(cleanupRspackProfile).toHaveBeenCalledTimes(1);
        expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('cleans up profiling while leaving plugin services alive when requested', async () => {
        await handlerP(async () => undefined)({
            _: ['build'],
            $0: 'app-builder',
            keepAlive: true,
        });

        expect(cleanupRspackProfile).toHaveBeenCalledTimes(1);
        expect(process.exit).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it('exits with 0 on SIGINT after a successful keep-alive build', async () => {
        await handlerP(async () => undefined)({
            _: ['build'],
            $0: 'app-builder',
            keepAlive: true,
        });

        process.emit('SIGINT');

        expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('still exits on a failed build with keep-alive enabled', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        await handlerP(async () => {
            throw new Error('Build failed');
        })({_: ['build'], $0: 'app-builder', keepAlive: true});

        expect(cleanupRspackProfile).toHaveBeenCalledTimes(1);
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
