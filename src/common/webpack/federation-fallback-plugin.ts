/* eslint-env browser */
/* eslint-disable no-param-reassign */

import type {ModuleFederationRuntimePlugin} from '@module-federation/enhanced/runtime';
import type {FallbackRuntimeConfig} from './fallback-controller.js';
import {createFallbackController} from './fallback-controller.js';

declare const __PUBLIC_PATH_FALLBACK_CONFIG__: FallbackRuntimeConfig;

// MF 2.8 declares a nested Promise for this async hook; JavaScript flattens it.
type LoadEntryErrorHook = NonNullable<ModuleFederationRuntimePlugin['loadEntryError']>;
type FallbackPlugin = Omit<ModuleFederationRuntimePlugin, 'loadEntryError'> & {
    loadEntryError?: (
        ...args: Parameters<LoadEntryErrorHook>
    ) => Promise<Awaited<ReturnType<LoadEntryErrorHook>>>;
};

export default function federationFallbackPlugin(): ModuleFederationRuntimePlugin {
    const controller = createFallbackController(__PUBLIC_PATH_FALLBACK_CONFIG__);

    if (!controller) {
        return {name: 'app-builder-public-path-fallback'};
    }

    const activeController = controller;
    const entryAttempts = new WeakMap<object, string>();
    const filteredPreloads = new WeakSet<object>();

    const plugin: FallbackPlugin = {
        name: 'app-builder-public-path-fallback',
        beforeRequest: rewriteRemoteEntries,
        handlePreloadModule: skipManagedStylesheetPreloads,
        fetch: fetchWithFallback,
        loadRemoteSnapshot: rewriteSnapshotPublicPath,
        loadEntry: rememberEntryBase,
        loadEntryError: retryRemoteEntry,
    };

    return plugin as ModuleFederationRuntimePlugin;

    function rewriteRemoteEntries(
        args: Parameters<NonNullable<FallbackPlugin['beforeRequest']>>[0],
    ) {
        args.options.remotes.forEach((remote) => {
            if ('entry' in remote && remote.entry) {
                remote.entry = activeController.rewrite(remote.entry);
            }
        });

        return args;
    }

    function skipManagedStylesheetPreloads({
        preloadConfig,
    }: Parameters<NonNullable<FallbackPlugin['handlePreloadModule']>>[0]) {
        if (filteredPreloads.has(preloadConfig)) {
            return;
        }

        filteredPreloads.add(preloadConfig);

        const originalFilter = preloadConfig.filter;

        preloadConfig.filter = (url) => {
            return !isManagedStylesheet(url) && (!originalFilter || originalFilter(url));
        };
    }

    function fetchWithFallback(url: string, options: RequestInit) {
        if (activeController.relative(url) === null) {
            return undefined;
        }

        return fetchManifest(url, options);
    }

    function rewriteSnapshotPublicPath(
        args: Parameters<NonNullable<FallbackPlugin['loadRemoteSnapshot']>>[0],
    ) {
        const snapshot = args.remoteSnapshot;

        if ('publicPath' in snapshot && typeof snapshot.publicPath === 'string') {
            return {
                ...args,
                remoteSnapshot: {
                    ...snapshot,
                    publicPath: activeController.rewrite(snapshot.publicPath),
                },
            };
        }

        return args;
    }

    function rememberEntryBase({
        remoteInfo,
    }: Parameters<NonNullable<FallbackPlugin['loadEntry']>>[0]) {
        const base = activeController.baseOf(remoteInfo.entry);

        if (base) {
            entryAttempts.set(remoteInfo, base);
        }
    }

    async function retryRemoteEntry({
        getRemoteEntry,
        origin,
        remoteInfo,
        remoteEntryExports,
        globalLoading,
        uniqueKey,
    }: Parameters<NonNullable<FallbackPlugin['loadEntryError']>>[0]) {
        let base = entryAttempts.get(remoteInfo);

        if (!base) {
            return undefined;
        }

        const attempted: string[] = [];
        let error: unknown = new Error('Failed to load federation entry: ' + remoteInfo.entry);

        while (activeController.fail(base, remoteInfo.entry, error, [...attempted, base])) {
            attempted.push(base);
            delete globalLoading[uniqueKey];

            const url = activeController.rewrite(remoteInfo.entry);
            base = activeController.base();

            try {
                const result = await getRemoteEntry({
                    origin,
                    remoteInfo,
                    remoteEntryExports,
                    getEntryUrl: () => url,
                });

                activeController.success(base);

                return result || undefined;
            } catch (loadError) {
                if (!isRetryableEntryError(loadError)) {
                    throw loadError;
                }

                error = loadError;
            }
        }

        delete globalLoading[uniqueKey];
        throw error;
    }

    async function fetchManifest(url: string, options: RequestInit): Promise<Response> {
        const attempted: string[] = [];

        for (;;) {
            const base = activeController.base();
            attempted.push(base);

            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 10000);

            try {
                const response = await fetch(activeController.rewrite(url), {
                    ...options,
                    signal: abort.signal,
                });

                if (!response.ok) {
                    throw new Error('Failed to load federation manifest: HTTP ' + response.status);
                }

                const body = await response.text();
                activeController.success(base);

                return new Response(body, {
                    status: response.status,
                    headers: response.headers,
                });
            } catch (error) {
                if (!activeController.fail(base, url, error, attempted)) {
                    throw error;
                }
            } finally {
                clearTimeout(timer);
            }
        }
    }

    function isManagedStylesheet(url: string) {
        return (
            activeController.relative(url) !== null &&
            new URL(url, window.location.href).pathname.endsWith('.css')
        );
    }

    function isRetryableEntryError(error: unknown) {
        const message = String(error);

        return message.includes('RUNTIME-008') && !message.includes('ScriptExecutionError');
    }
}
