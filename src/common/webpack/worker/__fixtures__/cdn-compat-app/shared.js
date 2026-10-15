// Stands in for the dev helper modules from #371: it is imported by both the worker and
// the lazy chunk, so it is extracted into a chunk that the worker has to load before
// its entry module executes.
export const message = 'worker started';
