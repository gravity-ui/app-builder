/* eslint-env browser */
/* eslint-disable camelcase, no-console */
/* global __webpack_require__, __webpack_public_path__:writable, __PUBLIC_PATH_FALLBACKS__ */

/*
 * app-builder - sticky public path fallback for async chunk loading.
 *
 * Prepended to every client entry directly AFTER public-path.js, and only when
 * `client.publicPathFallback` resolves to more than one candidate.
 * See `getRuntimeEntries` in config.ts.
 *
 * Keep the syntax at ES2020 or below: this file ships as-is inside the published
 * package and is bundled from node_modules, where `createJavaScriptRule` does not
 * apply - it gets no babel/swc transform and no browserslist downleveling.
 * A syntax error here does not disable the feature, it kills the whole entry chunk.
 */

const STATE_KEY = '__PUBLIC_PATH_FALLBACK_STATE__';
const PREFIX = '[app-builder] ';

install();

function install() {
    // SSR (no window) and web/service workers (no document - they load chunks with
    // importScripts from self.__PUBLIC_PATH__) are both excluded here.
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    // A property write on a plain object, so this does not depend on whether the
    // bundler allows assigning the `__webpack_chunk_load__` module variable.
    const req = __webpack_require__;
    const originalEnsure = req && req.e;
    if (typeof originalEnsure !== 'function') {
        return; // no async chunks in this build
    }

    const candidates = selectCandidates(__PUBLIC_PATH_FALLBACKS__, getHostname());

    // public-path.js has already applied window.__PUBLIC_PATH__. If the page pointed
    // at something outside the build-time list, keep it as the first candidate so that
    // this module is strictly additive and never redirects the first attempt.
    const initial = __webpack_public_path__;
    if (typeof initial === 'string' && initial && candidates.indexOf(initial) === -1) {
        candidates.unshift(initial);
    }

    if (candidates.length < 2) {
        return;
    }

    // State lives on window so that several webpack runtimes on one page (an embedded
    // second bundle, a micro-frontend shell) share one verdict about a dead CDN.
    let state = window[STATE_KEY];
    if (!state) {
        state = window[STATE_KEY] = {dead: [], active: null};
    }
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
            // A handler threw synchronously, e.g. a trusted-types policy rejection
            return handleFailure(chunkId, state.active, error);
        }

        if (!promise || typeof promise.then !== 'function') {
            return promise;
        }

        return promise.then(null, (error) => handleFailure(chunkId, state.active, error));
    }

    /*
     * Sets the public path, calls the original ensureChunk and restores the previous
     * value - all synchronously.
     *
     * __webpack_require__.e invokes every __webpack_require__.f.* handler synchronously,
     * and each handler computes `__webpack_require__.p + name` and appends its
     * <script>/<link> synchronously. So there is no suspension point between the two
     * setPublicPath calls and no concurrent load can ever observe the temporary value.
     */
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

    // Always returns a promise, so both the sync and the async failure path are safe.
    function handleFailure(chunkId, failedPath, error) {
        if (!isLoadError(error)) {
            return Promise.reject(error);
        }

        markDead(failedPath, chunkId, error);

        // markDead has already promoted state.active to the next live candidate
        if (state.active === failedPath) {
            return Promise.reject(error); // every candidate is exhausted
        }

        return start(chunkId);
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

        // Promote on failure rather than on success, so that subsequent chunk loads
        // start from a live path and asset URLs built later also pick it up.
        if (next && next !== state.active) {
            state.active = next;
            setPublicPath(next);
        }
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

/*
 * Public paths of the entries whose host patterns match the current hostname,
 * in declaration order. An entry without patterns matches every host.
 * `fallbacks` is the DefinePlugin-injected list of `PublicPathFallback` objects.
 */
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
        } catch {
            return false; // an unsupported RegExp feature in this browser
        }
    });
}

function isLoadError(error) {
    if (!error) {
        return false;
    }
    if (error.name === 'ChunkLoadError') {
        return true; // webpack + rspack jsonp chunk loading
    }
    if (error.code === 'CSS_CHUNK_LOAD_FAILED') {
        return true; // mini-css-extract-plugin + CssExtractRspackPlugin
    }
    return (
        typeof error.message === 'string' &&
        /Loading (?:CSS )?chunk [\s\S]*failed/i.test(error.message)
    );
}
