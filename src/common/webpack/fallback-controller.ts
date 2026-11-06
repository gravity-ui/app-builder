/* eslint-env browser */
/* eslint-disable no-console, no-param-reassign */

export interface FallbackRuntimeConfig {
    root: string;
    scope: string;
    federated: boolean;
    fallbacks: {publicPath: string; hosts?: {source: string; flags: string}[]}[];
    retries?: number;
    retryDelay?: number;
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
    f?: Record<string, (chunkId: string | number, promises: Promise<unknown>[]) => void>;
}

interface ChunkLoadLikeError {
    name?: string;
    code?: string;
    message?: string;
    request?: string;
    target?: {src?: string; href?: string};
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

    if (!config.fallbacks.length && !config.retries) {
        return null;
    }

    const state = getSharedState();
    const bases = [...new Set([normalize(config.root), ...state.candidates])];

    return {
        path: (base = state.active) => (forms.get(base) || base) + suffix,
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
        retries: config.retries || 0,
        retryDelay: config.retryDelay || 0,
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
            .map((entry) => remember(entry.publicPath));
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

        if (hostPathMatchesScope) {
            return remember(stripScope(window.__PUBLIC_PATH__ as string));
        }

        return remember(config.federated ? config.root : '/build/');
    }

    function stripScope(value: string) {
        const base = value.replace(/\/?$/, '/');

        return suffix && base.endsWith('/' + suffix) ? base.slice(0, -suffix.length) : base;
    }

    function normalize(value: string) {
        return new URL(value, window.location.href).href.replace(/\/?$/, '/');
    }

    function remember(value: string) {
        const base = normalize(value);

        if (!forms.has(base)) {
            forms.set(base, value.replace(/\/?$/, '/'));
        }

        return base;
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
    timeoutMs = 30000,
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

    function wait(attempt: number) {
        const base = activeController.retryDelay;

        if (!base) {
            return Promise.resolve();
        }

        const delay = Math.min(base * 2 ** attempt * (0.5 + Math.random()), 300000);

        return new Promise<void>((resolve) => {
            setTimeout(resolve, delay);
        });
    }

    function isNonRetryable(error: unknown) {
        const request = requestOf(error);

        return !isChunkLoadError(error) || Boolean(request && !activeController.owns(request));
    }

    // Wait for every resource of the chunk to settle before retrying, not just the
    // first rejection: otherwise a late error from one resource leaks into the next
    // attempt and exhausts its budget before the sibling was retried. A non-retryable
    // error still short-circuits immediately, so a genuine error is not held back by a
    // slow sibling.
    function settleAll(promises: Promise<unknown>[]): Promise<unknown[]> {
        return new Promise<unknown[]>((resolve) => {
            const errors: unknown[] = [];
            let pending = promises.length;
            let done = false;

            if (!pending) {
                resolve(errors);

                return;
            }

            const settleOne = (rejection?: {reason: unknown}) => {
                if (done) {
                    return;
                }

                if (rejection) {
                    errors.push(rejection.reason);
                }

                pending -= 1;

                if ((rejection && isNonRetryable(rejection.reason)) || pending === 0) {
                    done = true;
                    resolve(errors);
                }
            };

            for (const promise of promises) {
                Promise.resolve(promise).then(
                    () => settleOne(),
                    (reason) => settleOne({reason}),
                );
            }
        });
    }

    function settle(chunkId: string | number): Promise<{errors: unknown[]; value?: unknown}> {
        const handlers = req.f;

        // Aggregate per-resource results only when retries are enabled. With retries
        // off, keep the original single-ensure, first-rejection behavior so enabling
        // only publicPathFallback changes nothing.
        if (activeController.retries > 0 && handlers && typeof handlers === 'object') {
            const promises: Promise<unknown>[] = [];

            for (const key of Object.keys(handlers)) {
                try {
                    handlers[key]?.(chunkId, promises);
                } catch (error) {
                    promises.push(Promise.reject(error));
                }
            }

            stylesheets.scan();

            return settleAll(promises).then((errors) => ({errors}));
        }

        let result: Promise<unknown>;

        try {
            result = Promise.resolve(ensure.call(req, chunkId));
        } catch (error) {
            stylesheets.scan();

            return Promise.resolve({errors: [error]});
        }

        stylesheets.scan();

        return result.then(
            (value) => ({errors: [], value}),
            (error) => ({errors: [error]}),
        );
    }

    function load(
        chunkId: string | number,
        attempted: string[],
        attemptedBase = activeController.base(),
        sameBaseAttempt = 0,
    ): Promise<unknown> {
        const path = activeController.path(attemptedBase);
        attempted.push(attemptedBase);
        req.p = path;

        return Promise.resolve()
            .then(() => {
                req.p = path;

                const cssFile = req.miniCssF?.(chunkId);
                const release = cssFile ? stylesheets.track(path + cssFile) : () => {};

                return settle(chunkId).then(
                    (result) => {
                        release();

                        return result;
                    },
                    (error) => {
                        release();

                        return {errors: [error], value: undefined};
                    },
                );
            })
            .then(({errors, value}) => {
                if (!errors.length) {
                    activeController.success(attemptedBase);

                    return value;
                }

                for (const error of errors) {
                    if (isNonRetryable(error)) {
                        throw error;
                    }
                }

                const allFromPreviousBase = errors.every((error) => {
                    const request = requestOf(error);

                    return request && activeController.baseOf(request) !== attemptedBase;
                });

                if (allFromPreviousBase) {
                    return load(chunkId, attempted, attemptedBase, sameBaseAttempt);
                }

                if (sameBaseAttempt < activeController.retries) {
                    return wait(sameBaseAttempt).then(() =>
                        load(chunkId, attempted, attemptedBase, sameBaseAttempt + 1),
                    );
                }

                if (!activeController.fail(attemptedBase, chunkId, errors[0], attempted)) {
                    throw errors[0];
                }

                return load(chunkId, attempted);
            });
    }
}

function isChunkLoadError(error: unknown) {
    const candidate = error as ChunkLoadLikeError | null;

    return Boolean(
        candidate &&
            (candidate.name === 'ChunkLoadError' ||
                candidate.code === 'CSS_CHUNK_LOAD_FAILED' ||
                (typeof candidate.message === 'string' &&
                    /Loading (?:CSS )?chunk [\s\S]*failed/i.test(candidate.message))),
    );
}

function requestOf(error: unknown) {
    const candidate = error as ChunkLoadLikeError | null;

    return candidate && (candidate.request || candidate.target?.src || candidate.target?.href);
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
