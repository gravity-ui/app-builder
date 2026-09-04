/* eslint-env browser */
/* eslint-disable camelcase, no-console */
/* global __webpack_require__, __webpack_public_path__:writable, __PUBLIC_PATH_FALLBACKS__ */

/*
 * Sticky public path fallback for async chunk loading, prepended to every client entry
 * right after public-path.js. Runs in the browser.
 */

import {BrowserEvents, dispatchBrowserEvent} from './browser-events.js';

const STATE_KEY = '__PUBLIC_PATH_FALLBACK_STATE__';
const PREFIX = '[app-builder] ';

install();

function install() {
    if (isUnsupportedRuntime()) {
        return;
    }

    const req = __webpack_require__;
    const originalEnsure = req && req.e;

    const hasAsyncChunks = typeof originalEnsure === 'function';
    if (!hasAsyncChunks) {
        return;
    }

    const candidates = buildCandidateList();
    if (candidates.length < 2) {
        return;
    }

    const state = getOrCreateState();
    state.candidates = candidates;
    if (!state.active || candidates.indexOf(state.active) === -1) {
        state.active = firstAlive() || candidates[0];
    }
    setPublicPath(state.active);

    req.e = (chunkId) => start(chunkId);

    if (req.e === originalEnsure) {
        console.warn(
            PREFIX + 'public path fallback is inactive: __webpack_require__.e is not writable.',
        );
    }

    function start(chunkId) {
        let promise;

        try {
            promise = attempt(chunkId, state.active);
        } catch (error) {
            return handleFailure(chunkId, state.active, error);
        }

        if (!promise || typeof promise.then !== 'function') {
            return promise;
        }

        return promise.then(null, (error) => handleFailure(chunkId, state.active, error));
    }

    function attempt(chunkId, candidate) {
        const previous = __webpack_public_path__;

        if (candidate === previous) {
            return originalEnsure.call(req, chunkId);
        }

        setPublicPath(candidate);
        try {
            return originalEnsure.call(req, chunkId);
        } finally {
            setPublicPath(previous);
        }
    }

    function handleFailure(chunkId, failedPath, error) {
        if (!isLoadError(error)) {
            return Promise.reject(error);
        }

        const promoted = markDead(failedPath, chunkId, error);
        return promoted ? start(chunkId) : Promise.reject(error);
    }

    function markDead(deadPath, chunkId, error) {
        if (state.dead.indexOf(deadPath) === -1) {
            state.dead.push(deadPath);
        }

        const next = firstAlive();

        console.warn(
            PREFIX +
                `failed to load chunk "${chunkId}" from "${deadPath}"` +
                (next ? `; switching public path to "${next}"` : '; no fallbacks left'),
            error,
        );

        dispatchBrowserEvent(BrowserEvents.PublicPathFallback, {
            chunkId,
            deadPath,
            nextPath: next,
            error,
        });

        if (!next) {
            return false;
        }

        if (next !== state.active) {
            state.active = next;
            setPublicPath(next);
        }

        return true;
    }

    function firstAlive() {
        for (const candidate of state.candidates) {
            if (state.dead.indexOf(candidate) === -1) {
                return candidate;
            }
        }
        return null;
    }
}

function isUnsupportedRuntime() {
    return typeof window === 'undefined' || typeof document === 'undefined';
}

function buildCandidateList() {
    const candidates = selectCandidates(__PUBLIC_PATH_FALLBACKS__, getHostname());

    const initial = __webpack_public_path__;
    if (typeof initial === 'string' && initial) {
        moveToFront(candidates, initial);
    }

    return candidates;
}

function moveToFront(list, value) {
    const at = list.indexOf(value);
    if (at !== -1) {
        list.splice(at, 1);
    }
    list.unshift(value);
}

function getOrCreateState() {
    // Shared via window, not a closure, so multiple webpack runtimes on one page
    // (a micro-frontend shell, an embedded second bundle) agree on one dead CDN.
    if (!window[STATE_KEY]) {
        window[STATE_KEY] = {dead: [], active: null};
    }

    return window[STATE_KEY];
}

function setPublicPath(value) {
    // Compiles to `__webpack_require__.p = value` in both webpack and rspack
    __webpack_public_path__ = value;
}

function getHostname() {
    try {
        return window.location.hostname || '';
    } catch {
        return '';
    }
}

function selectCandidates(fallbacks, hostname) {
    const result = [];

    if (!Array.isArray(fallbacks)) {
        return result;
    }

    for (const fallback of fallbacks) {
        if (!fallback || typeof fallback.publicPath !== 'string' || !fallback.publicPath) {
            continue;
        }

        if (matchesHost(fallback.hosts, hostname) && result.indexOf(fallback.publicPath) === -1) {
            result.push(fallback.publicPath);
        }
    }

    return result;
}

function matchesHost(hosts, hostname) {
    if (!Array.isArray(hosts) || hosts.length === 0) {
        return true;
    }

    return hosts.some((host) => {
        try {
            // eslint-disable-next-line security/detect-non-literal-regexp
            return new RegExp(host.source, host.flags).test(hostname);
        } catch (error) {
            console.warn(PREFIX + `invalid host pattern "/${host.source}/${host.flags}"`, error);
            return false;
        }
    });
}

function isLoadError(error) {
    return (
        Boolean(error) &&
        (isJsChunkLoadError(error) || isCssChunkLoadError(error) || hasLoadFailureMessage(error))
    );
}

function isJsChunkLoadError(error) {
    return error.name === 'ChunkLoadError'; // webpack + rspack jsonp chunk loading
}

function isCssChunkLoadError(error) {
    return error.code === 'CSS_CHUNK_LOAD_FAILED'; // mini-css-extract-plugin + CssExtractRspackPlugin
}

function hasLoadFailureMessage(error) {
    return (
        typeof error.message === 'string' &&
        /Loading (?:CSS )?chunk [\s\S]*failed/i.test(error.message)
    );
}
