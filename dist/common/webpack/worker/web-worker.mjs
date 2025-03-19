import { SharedWorkerPolyfill } from '@okikio/sharedworker';
class WebWorker extends Worker {
    constructor(url, options) {
        const objectURL = generateWorkerLoader(url);
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}
class SharedWebWorker extends SharedWorkerPolyfill {
    constructor(url, options) {
        const objectURL = generateWorkerLoader(url);
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}
export { WebWorker as Worker, SharedWebWorker as SharedWorker };
function generateWorkerLoader(url) {
    // eslint-disable-next-line camelcase
    const publicPath = __webpack_public_path__;
    const workerPublicPath = publicPath.match(/^https?:\/\//)
        ? publicPath
        : new URL(publicPath, window.location.origin).toString();
    const objectURL = URL.createObjectURL(new Blob([
        [
            `self.__PUBLIC_PATH__ = ${JSON.stringify(workerPublicPath)}`,
            `importScripts(${JSON.stringify(url.toString())});`,
        ].join('\n'),
    ], {
        type: 'application/javascript',
    }));
    return objectURL;
}
