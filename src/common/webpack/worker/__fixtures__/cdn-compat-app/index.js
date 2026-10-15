export const worker = new Worker(
    /* webpackChunkName: "worker" */ new URL('./worker.js', import.meta.url),
);

import('./lazy.js');
