// eslint-disable-next-line camelcase
declare let __webpack_public_path__: string;

class WebWorker extends Worker {
    constructor(url: string | URL, options?: WorkerOptions) {
        // eslint-disable-next-line camelcase
        const publicPath = __webpack_public_path__;
        const workerPublicPath = publicPath.match(/^https?:\/\//)
            ? publicPath
            : new URL(publicPath, window.location.href).toString();
        const objectURL = URL.createObjectURL(
            new Blob(
                [
                    [
                        `self.__PUBLIC_PATH__ = ${JSON.stringify(workerPublicPath)}`,
                        `importScripts(${JSON.stringify(url.toString())});`,
                    ].join('\n'),
                ],
                {
                    type: 'application/javascript',
                },
            ),
        );
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}

export {WebWorker as Worker};
