import {generateWorkerLoader} from './generate-worker-loader';

export class SharedWebWorker extends SharedWorker {
    constructor(url: string | URL, options?: string | WorkerOptions) {
        const objectURL = generateWorkerLoader(url);
        super(objectURL, options);
        URL.revokeObjectURL(objectURL);
    }
}
