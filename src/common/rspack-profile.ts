import * as fs from 'node:fs';
import * as path from 'node:path';

export type RspackTraceLayer = 'logger' | 'perfetto';

export interface RspackProfileOptions {
    filter: string;
    layer?: RspackTraceLayer;
    output?: string;
}

export interface RspackProfileCliArgs {
    rspackProfile?: string;
    rspackTraceLayer?: RspackTraceLayer;
    rspackTraceOutput?: string;
}

export interface RspackProfileSession {
    filter: string;
    layer: RspackTraceLayer;
    output: string;
    cleanup: () => Promise<void>;
}

export interface GlobalTraceApi {
    register: (filter: string, layer: RspackTraceLayer, output: string) => Promise<void>;
    cleanup: () => Promise<void>;
}

export interface StartRspackProfileOptions extends RspackProfileOptions {
    cwd?: string;
    pid?: number;
    timestamp?: number;
    traceApi?: GlobalTraceApi;
}

let activeTraceApi: GlobalTraceApi | undefined;
let activeSession: RspackProfileSession | undefined;
let cleanupPromise: Promise<void> | undefined;
let signalHandlersInstalled = false;

export function getRspackProfileOptions(
    args: RspackProfileCliArgs,
    env: Readonly<Record<string, string | undefined>> = process.env,
): RspackProfileOptions | undefined {
    const filter = args.rspackProfile || env.RSPACK_PROFILE;
    if (!filter) {
        return undefined;
    }

    return {
        filter,
        layer:
            args.rspackTraceLayer ||
            (env.RSPACK_TRACE_LAYER as RspackTraceLayer | undefined) ||
            'perfetto',
        output: args.rspackTraceOutput || env.RSPACK_TRACE_OUTPUT,
    };
}

export async function startRspackProfile(
    options: StartRspackProfileOptions,
): Promise<RspackProfileSession> {
    if (activeSession) {
        return activeSession;
    }

    const layer = options.layer || 'perfetto';
    if (layer !== 'logger' && layer !== 'perfetto') {
        throw new Error(`Unsupported Rspack trace layer: ${layer}`);
    }

    const cwd = options.cwd || process.cwd();
    const timestamp = options.timestamp ?? Date.now();
    const pid = options.pid ?? process.pid;
    const outputDirectory = path.resolve(cwd, `.rspack-profile-${timestamp}-${pid}`);
    const output = resolveTraceOutput(layer, outputDirectory, options.output);

    if (output !== 'stdout' && output !== 'stderr') {
        await fs.promises.mkdir(path.dirname(output), {recursive: true});
    }

    const traceApi = options.traceApi || (await loadGlobalTraceApi());
    try {
        await traceApi.register(options.filter, layer, output);
    } catch (error) {
        await traceApi.cleanup().catch(() => undefined);
        if (
            layer === 'perfetto' &&
            error instanceof Error &&
            error.message.includes('Perfetto trace layer is not enabled')
        ) {
            throw new Error(
                'This Rspack binary was built without Perfetto tracing. Use the logger layer or a Rspack binding built with the perfetto feature.',
                {cause: error},
            );
        }
        throw error;
    }

    activeTraceApi = traceApi;
    activeSession = {
        filter: options.filter,
        layer,
        output,
        cleanup: cleanupRspackProfile,
    };
    installSignalHandlers();

    return activeSession;
}

export async function cleanupRspackProfile(): Promise<void> {
    if (!activeTraceApi) {
        return Promise.resolve();
    }

    cleanupPromise ||= Promise.resolve()
        .then(() => activeTraceApi?.cleanup())
        .then(() => undefined)
        .finally(() => {
            activeTraceApi = undefined;
            activeSession = undefined;
            cleanupPromise = undefined;
        });

    return cleanupPromise;
}

function resolveTraceOutput(
    layer: RspackTraceLayer,
    outputDirectory: string,
    configuredOutput?: string,
): string {
    if (configuredOutput === 'stdout' || configuredOutput === 'stderr') {
        return configuredOutput;
    }
    if (configuredOutput) {
        return path.resolve(outputDirectory, configuredOutput);
    }
    return layer === 'perfetto' ? path.resolve(outputDirectory, 'rspack.pftrace') : 'stdout';
}

async function loadGlobalTraceApi(): Promise<GlobalTraceApi> {
    // TypeScript 5.6 does not know that modern Node.js can require synchronous ESM.
    // @ts-ignore -- @rspack/core 2 is ESM and requires Node.js >=20.19.
    const {rspack} = await import('@rspack/core');
    return rspack.experiments.globalTrace;
}

function installSignalHandlers() {
    if (signalHandlersInstalled) {
        return;
    }
    signalHandlersInstalled = true;

    const finish = (exitCode: number) =>
        cleanupRspackProfile().then(
            () => process.exit(exitCode),
            () => process.exit(exitCode),
        );

    process.once('SIGINT', () => finish(130));
    process.once('SIGTERM', () => finish(143));
}
