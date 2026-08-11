import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {cleanupRspackProfile, getRspackProfileOptions, startRspackProfile} from './rspack-profile';
import type {GlobalTraceApi} from './rspack-profile';

function createTraceApi() {
    const register = jest.fn<
        ReturnType<GlobalTraceApi['register']>,
        Parameters<GlobalTraceApi['register']>
    >(async () => undefined);
    const cleanup = jest.fn<
        ReturnType<GlobalTraceApi['cleanup']>,
        Parameters<GlobalTraceApi['cleanup']>
    >(async () => undefined);

    return {register, cleanup};
}

let testCwd: string;

beforeEach(async () => {
    testCwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-profile-'));
});

afterEach(async () => {
    await cleanupRspackProfile();
    await fs.promises.rm(testCwd, {recursive: true, force: true});
});

describe('getRspackProfileOptions', () => {
    it('returns undefined when profiling is not requested', () => {
        expect(getRspackProfileOptions({}, {})).toBeUndefined();
    });

    it('reads the official Rspack environment variables', () => {
        expect(
            getRspackProfileOptions(
                {},
                {
                    RSPACK_PROFILE: 'rspack_core=info',
                    RSPACK_TRACE_LAYER: 'logger',
                    RSPACK_TRACE_OUTPUT: 'trace.log',
                },
            ),
        ).toEqual({
            filter: 'rspack_core=info',
            layer: 'logger',
            output: 'trace.log',
        });
    });

    it('prefers CLI options over environment variables', () => {
        expect(
            getRspackProfileOptions(
                {
                    rspackProfile: 'ALL',
                    rspackTraceLayer: 'perfetto',
                    rspackTraceOutput: 'cli.pftrace',
                },
                {
                    RSPACK_PROFILE: 'info',
                    RSPACK_TRACE_LAYER: 'logger',
                    RSPACK_TRACE_OUTPUT: 'env.log',
                },
            ),
        ).toEqual({
            filter: 'ALL',
            layer: 'perfetto',
            output: 'cli.pftrace',
        });
    });
});

describe('startRspackProfile', () => {
    it('registers a Perfetto trace and cleans it up once', async () => {
        const traceApi = createTraceApi();
        const session = await startRspackProfile({
            filter: 'rspack_core=info',
            cwd: testCwd,
            pid: 42,
            timestamp: 1000,
            traceApi,
        });

        expect(session.output).toBe(
            path.resolve(testCwd, '.rspack-profile-1000-42/rspack.pftrace'),
        );
        expect(traceApi.register).toHaveBeenCalledWith(
            'rspack_core=info',
            'perfetto',
            session.output,
        );

        await Promise.all([session.cleanup(), session.cleanup()]);
        expect(traceApi.cleanup).toHaveBeenCalledTimes(1);
    });

    it('cleans up and explains when the Rspack binary has no Perfetto support', async () => {
        const traceApi = createTraceApi();
        traceApi.register.mockRejectedValueOnce(
            new Error('Perfetto trace layer is not enabled in this build.'),
        );

        await expect(
            startRspackProfile({
                filter: 'info',
                cwd: testCwd,
                traceApi,
            }),
        ).rejects.toThrow('This Rspack binary was built without Perfetto tracing');
        expect(traceApi.cleanup).toHaveBeenCalledTimes(1);
    });

    it('uses stdout by default for the logger layer', async () => {
        const traceApi = createTraceApi();
        const session = await startRspackProfile({
            filter: 'info',
            layer: 'logger',
            traceApi,
        });

        expect(session.output).toBe('stdout');
        expect(traceApi.register).toHaveBeenCalledWith('info', 'logger', 'stdout');
    });

    it('places a custom filename inside the generated profile directory', async () => {
        const traceApi = createTraceApi();
        const session = await startRspackProfile({
            filter: 'info',
            output: 'custom.pftrace',
            cwd: testCwd,
            pid: 7,
            timestamp: 2000,
            traceApi,
        });

        expect(session.output).toBe(path.resolve(testCwd, '.rspack-profile-2000-7/custom.pftrace'));
    });
});
