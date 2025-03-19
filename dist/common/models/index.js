"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isServiceConfig = isServiceConfig;
exports.isLibraryConfig = isLibraryConfig;
exports.defineConfig = defineConfig;
function isServiceConfig(config) {
    return !('lib' in config);
}
function isLibraryConfig(config) {
    return 'lib' in config;
}
function defineConfig(config) {
    return config;
}
