import {generateWorkerLoader} from './generate-worker-loader';

export class WebWorker extends Worker {
    constructor(url: string | URL, options?: WorkerOptions) {
        const objectURL = generateWorkerLoader(url);
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}
