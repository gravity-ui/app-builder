import {generateWorkerLoader} from './generate-worker-loader';

class WebWorker extends Worker {
    constructor(url: string | URL, options?: WorkerOptions) {
        const objectURL = generateWorkerLoader(url);
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}

class SharedWebWorker extends SharedWorker {
    constructor(url: string | URL, options?: string | WorkerOptions) {
        const objectURL = generateWorkerLoader(url);
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}

export {WebWorker as Worker, SharedWebWorker as SharedWorker};
