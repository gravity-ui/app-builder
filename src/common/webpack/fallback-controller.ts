/* eslint-env browser */
/* eslint-disable no-console, no-param-reassign */

export interface FallbackRuntimeConfig {
    root: string;
    scope: string;
    federated: boolean;
    fallbacks: {publicPath: string; hosts?: {source: string; flags: string}[]}[];
}

interface FallbackState {
    candidates: [string, ...string[]];
    active: string;
    dead: string[];
    listeners: ((base: string) => void)[];
    recovering: boolean;
    recoveryAttempts: number;
}

declare global {
    interface Window {
        __APP_BUILDER_FALLBACK_GROUPS__?: Record<string, FallbackState>;
    }
}

interface ChunkRuntime {
    miniCssF?: (chunkId: string | number) => string;
    p: string;
    e?: (chunkId: string | number) => Promise<unknown>;
}

// Self-contained: also embedded in a bundler RuntimeModule before container startup.
export function createFallbackController(config: FallbackRuntimeConfig) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const suffix = config.scope ? config.scope + '/' : '';
    // Absolute URLs are used for matching; `forms` keeps the configured spelling
    // (`/build/` vs `https://host/build/`) for what is written to __webpack_require__.p.
    const forms = new Map<string, string>();
    const backups = getBackupPaths();

    if (!config.fallbacks.length) {
        return null;
    }

    const state = getSharedState();
    const bases = [...new Set([normalize(config.root), ...state.candidates])];

    return {
        path: (base = state.active) => base + suffix,
        owns: (url: string) => {
            const rest = relative(url);

            return rest !== null && rest.startsWith(suffix);
        },
        base: () => state.active,
        relative,
        baseOf,
        rewrite: (url: string) => {
            const rest = relative(url);

            return rest === null ? url : state.active + rest;
        },
        subscribe: (listener: (base: string) => void) => state.listeners.push(listener),
        fail,
        success: (base: string) => {
            if (base === state.candidates[0]) {
                state.recoveryAttempts = 0;
            }
        },
    };

    function getBackupPaths() {
        return config.fallbacks
            .filter(
                (entry) =>
                    !entry.hosts?.length ||
                    entry.hosts.some((host) => {
                        // Patterns are normalized from trusted build configuration.
                        // eslint-disable-next-line security/detect-non-literal-regexp
                        return new RegExp(host.source, host.flags).test(window.location.hostname);
                    }),
            )
            .map((entry) => normalize(entry.publicPath));
    }

    function getSharedState() {
        const key = JSON.stringify([config.root, backups]);
        const registry: Record<string, FallbackState> = (window.__APP_BUILDER_FALLBACK_GROUPS__ ||=
            Object.create(null));
        let initialState = registry[key];

        if (!initialState) {
            const primary = resolvePrimaryForScope();
            const candidates = [...new Set([primary, ...backups])] as [string, ...string[]];

            initialState = registry[key] = {
                candidates,
                active: primary,
                dead: [],
                listeners: [],
                recovering: false,
                recoveryAttempts: 0,
            };
        }

        return initialState;
    }

    function resolvePrimaryForScope() {
        const hostPublicPath = window.__PUBLIC_PATH__ && normalize(window.__PUBLIC_PATH__);
        const hostPathMatchesScope =
            hostPublicPath && (!suffix || hostPublicPath.endsWith('/' + suffix));

        return hostPathMatchesScope
            ? stripScope(hostPublicPath)
            : normalize(config.federated ? config.root : '/build/');
    }

    function stripScope(value: string) {
        const base = normalize(value);

        return suffix && base.endsWith('/' + suffix) ? base.slice(0, -suffix.length) : base;
    }

    function normalize(value: string) {
        return new URL(value, window.location.href).href.replace(/\/?$/, '/');
    }

    function relative(url: string) {
        const base = baseOf(url);

        return base ? new URL(url, window.location.href).href.slice(base.length) : null;
    }

    function baseOf(url: string) {
        const absolute = new URL(url, window.location.href).href;
        const base = bases
            .slice()
            .sort((a, b) => b.length - a.length)
            .find((item) => absolute.startsWith(item));

        return base || null;
    }

    function fail(
        base: string,
        resource: string | number,
        error: unknown,
        attempted: string[] = [],
    ) {
        if (!state.dead.includes(base)) {
            state.dead.push(base);
        }

        schedulePrimaryRecovery(base);

        const next =
            state.candidates.find(
                (item) => !state.dead.includes(item) && !attempted.includes(item),
            ) || null;

        if (next) {
            promote(next);
        }

        console.warn('[app-builder] failed to load ' + resource + ' from ' + base, error);

        if (typeof window.CustomEvent === 'function') {
            window.dispatchEvent(
                new window.CustomEvent('app-builder:public-path-fallback', {
                    detail: {chunkId: resource, deadPath: base, nextPath: next, error},
                }),
            );
        }

        return next;
    }

    function schedulePrimaryRecovery(base: string) {
        if (state.candidates.length > 1 && base === state.candidates[0] && !state.recovering) {
            state.recovering = true;

            const delay = Math.min(3000 * 2 ** state.recoveryAttempts++, 300000);

            setTimeout(
                () => {
                    state.recovering = false;
                    state.dead = state.dead.filter((item) => item !== state.candidates[0]);
                    promote(state.candidates[0]);
                },
                delay * (0.5 + Math.random()),
            );
        }
    }

    function promote(next: string) {
        state.active = next;
        state.listeners.forEach((listener) => listener(next));
    }
}

export function installChunkFallback(
    req: ChunkRuntime,
    controller: ReturnType<typeof createFallbackController>,
    timeoutMs = 15000,
) {
    if (!controller || typeof req.e !== 'function') {
        return;
    }

    req.p = controller.path();
    controller.subscribe(() => {
        req.p = controller.path();
    });

    const ensure = req.e;
    const activeController = controller;
    const stylesheets = createStylesheetMonitor(controller, timeoutMs);

    req.e = (chunkId) => load(chunkId, []);

    function load(
        chunkId: string | number,
        attempted: string[],
        attemptedBase = activeController.base(),
    ): Promise<unknown> {
        const path = activeController.path(attemptedBase);
        attempted.push(attemptedBase);
        req.p = path;

        return Promise.resolve()
            .then(() => {
                req.p = path;

                const cssFile = req.miniCssF?.(chunkId);
                const release = cssFile ? stylesheets.track(path + cssFile) : () => {};

                try {
                    const result = ensure.call(req, chunkId);
                    stylesheets.scan();

                    return Promise.resolve(result).then(
                        (value) => {
                            release();

                            return value;
                        },
                        (error) => {
                            release();
                            throw error;
                        },
                    );
                } catch (error) {
                    stylesheets.scan();
                    release();
                    throw error;
                }
            })
            .then(
                (result) => {
                    activeController.success(attemptedBase);

                    return result;
                },
                (error) => {
                    const isLoadError =
                        error &&
                        (error.name === 'ChunkLoadError' ||
                            error.code === 'CSS_CHUNK_LOAD_FAILED' ||
                            (typeof error.message === 'string' &&
                                /Loading (?:CSS )?chunk [\s\S]*failed/i.test(error.message)));

                    const request =
                        error && (error.request || error.target?.src || error.target?.href);

                    const belongsToAnotherRuntime = request && !activeController.owns(request);

                    if (!isLoadError || belongsToAnotherRuntime) {
                        throw error;
                    }

                    const isLateFailureFromPreviousBase =
                        request && activeController.baseOf(request) !== attemptedBase;

                    if (isLateFailureFromPreviousBase) {
                        return load(chunkId, attempted, attemptedBase);
                    }

                    if (!activeController.fail(attemptedBase, chunkId, error, attempted)) {
                        throw error;
                    }

                    return load(chunkId, attempted);
                },
            );
    }
}

export function createStylesheetMonitor(
    controller: NonNullable<ReturnType<typeof createFallbackController>>,
    timeoutMs: number,
) {
    const pendingUrls = new Map<string, number>();
    const links = new Map<HTMLLinkElement, () => void>();
    let observer: MutationObserver | undefined;

    return {track, scan};

    function track(url: string) {
        const absoluteUrl = new URL(url, window.location.href).href;
        pendingUrls.set(absoluteUrl, (pendingUrls.get(absoluteUrl) || 0) + 1);

        if (!observer && document.head) {
            observer = new MutationObserver(scan);
            observer.observe(document.head, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['href', 'rel'],
            });
        }

        return () => {
            const remaining = (pendingUrls.get(absoluteUrl) || 1) - 1;

            if (remaining) pendingUrls.set(absoluteUrl, remaining);
            else pendingUrls.delete(absoluteUrl);

            disconnectWhenIdle();
        };
    }

    function scan() {
        for (const [link, cleanup] of links) {
            if (!link.isConnected) cleanup();
        }

        if (!document.head) return;

        for (const link of document.head.querySelectorAll<HTMLLinkElement>(
            'link[rel="stylesheet"]',
        )) {
            if (
                pendingUrls.has(link.href) &&
                controller.owns(link.href) &&
                !link.sheet &&
                !links.has(link)
            ) {
                watchLink(link);
            }
        }
    }

    function watchLink(link: HTMLLinkElement) {
        const timer = setTimeout(() => {
            cleanup();
            link.remove();
            link.dispatchEvent(new Event('error'));
        }, timeoutMs);

        links.set(link, cleanup);
        link.addEventListener('load', cleanup);
        link.addEventListener('error', cleanup);

        function cleanup() {
            clearTimeout(timer);
            link.removeEventListener('load', cleanup);
            link.removeEventListener('error', cleanup);
            links.delete(link);
            disconnectWhenIdle();
        }
    }

    function disconnectWhenIdle() {
        if (!pendingUrls.size && !links.size) {
            observer?.disconnect();
            observer = undefined;
        }
    }
}
