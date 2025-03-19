"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const utils_1 = require("../../../common/utils");
function default_1(config) {
    const shouldCompileClient = (0, utils_1.shouldCompileTarget)(config.target, 'client');
    const shouldCompileServer = (0, utils_1.shouldCompileTarget)(config.target, 'server');
    const compilations = [];
    if (shouldCompileClient) {
        compilations.push((async () => {
            const { buildClient } = await import('./client.js');
            return buildClient(config);
        })());
    }
    if (shouldCompileServer) {
        compilations.push((async () => {
            const { buildServer } = await import('./server.js');
            return buildServer(config);
        })());
    }
    return Promise.all(compilations);
}
