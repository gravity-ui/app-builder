"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClient = buildClient;
const compile_1 = require("../../../common/webpack/compile");
function buildClient(config) {
    return (0, compile_1.clientCompile)(config.client);
}
