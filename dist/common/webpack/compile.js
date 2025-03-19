"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientCompile = clientCompile;
const webpack_1 = __importDefault(require("webpack"));
const core_1 = require("@rspack/core");
const logger_1 = require("../logger");
const config_1 = require("./config");
const utils_1 = require("./utils");
async function clientCompile(config) {
    const logger = new logger_1.Logger('client', config.verbose);
    const webpackConfigs = [];
    const rspackConfigs = [];
    const isSsr = Boolean(config.ssr);
    if (config.bundler === 'rspack') {
        rspackConfigs.push(await (0, config_1.rspackConfigFactory)({ webpackMode: "production" /* WebpackMode.Prod */, config, logger }));
        if (isSsr) {
            const ssrLogger = new logger_1.Logger('client(SSR)', config.verbose);
            rspackConfigs.push(await (0, config_1.rspackConfigFactory)({
                webpackMode: "production" /* WebpackMode.Prod */,
                config,
                logger: ssrLogger,
                isSsr,
            }));
        }
    }
    else {
        webpackConfigs.push(await (0, config_1.webpackConfigFactory)({ webpackMode: "production" /* WebpackMode.Prod */, config, logger }));
        if (isSsr) {
            const ssrLogger = new logger_1.Logger('client(SSR)', config.verbose);
            webpackConfigs.push(await (0, config_1.webpackConfigFactory)({
                webpackMode: "production" /* WebpackMode.Prod */,
                config,
                logger: ssrLogger,
                isSsr,
            }));
        }
    }
    logger.verbose('Config created');
    return new Promise((resolve) => {
        const compilerHandler = (0, utils_1.compilerHandlerFactory)(logger, async () => {
            resolve();
        });
        const compiler = config.bundler === 'rspack'
            ? (0, core_1.rspack)(rspackConfigs, compilerHandler)
            : (0, webpack_1.default)(webpackConfigs, compilerHandler);
        process.on('SIGINT', async () => {
            compiler?.close(() => {
                process.exit(1);
            });
        });
        process.on('SIGTERM', async () => {
            compiler?.close(() => {
                process.exit(1);
            });
        });
    });
}
