"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const models_1 = require("../../common/models");
async function default_1(config) {
    process.env.NODE_ENV = 'production';
    // eslint-disable-next-line security/detect-non-literal-require
    const { default: build } = require((0, models_1.isLibraryConfig)(config) ? './build-lib' : './build-service');
    return build(config);
}
