import { SharedWorkerPolyfill } from '@okikio/sharedworker';
declare class WebWorker extends Worker {
    constructor(url: string | URL, options?: WorkerOptions);
}
declare class SharedWebWorker extends SharedWorkerPolyfill {
    constructor(url: string | URL, options?: WorkerOptions);
}
export { WebWorker as Worker, SharedWebWorker as SharedWorker };
