"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.babelPreset = exports.defineConfig = exports.createTransformPathsToLocalModules = exports.configureServiceWebpackConfig = exports.configureWebpackConfigForStorybook = void 0;
var storybook_1 = require("./common/webpack/storybook");
Object.defineProperty(exports, "configureWebpackConfigForStorybook", { enumerable: true, get: function () { return storybook_1.configureWebpackConfigForStorybook; } });
Object.defineProperty(exports, "configureServiceWebpackConfig", { enumerable: true, get: function () { return storybook_1.configureServiceWebpackConfig; } });
__exportStar(require("./common/s3-upload"), exports);
var transformers_1 = require("./common/typescript/transformers");
Object.defineProperty(exports, "createTransformPathsToLocalModules", { enumerable: true, get: function () { return transformers_1.createTransformPathsToLocalModules; } });
var models_1 = require("./common/models");
Object.defineProperty(exports, "defineConfig", { enumerable: true, get: function () { return models_1.defineConfig; } });
var babel_1 = require("./common/babel");
Object.defineProperty(exports, "babelPreset", { enumerable: true, get: function () { return babel_1.babelPreset; } });
