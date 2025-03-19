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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchServerCompilation = watchServerCompilation;
const path = __importStar(require("node:path"));
const rimraf_1 = require("rimraf");
const controllable_script_1 = require("../../common/child-process/controllable-script");
const utils_1 = require("../../common/utils");
const paths_1 = __importDefault(require("../../common/paths"));
async function watchServerCompilation(config) {
    const serverPath = path.resolve(paths_1.default.appDist, 'server');
    rimraf_1.rimraf.sync(serverPath);
    (0, utils_1.createRunFolder)();
    const build = new controllable_script_1.ControllableScript(`
        let ts;
        try {
            ts = require('typescript');
        } catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND') {
                throw e;
            }
            ts = require(${JSON.stringify(require.resolve('typescript'))});
        }
        const {Logger} = require(${JSON.stringify(require.resolve('../../common/logger'))});
        const {watch} = require(${JSON.stringify(require.resolve('../../common/typescript/watch'))});

        const logger = new Logger('server', ${config.verbose});
        watch(
            ts,
            ${JSON.stringify(paths_1.default.appServer)},
            {
                logger,
                onAfterFilesEmitted: () => {
                    process.send({type: 'Emitted'});
                },
                enableSourceMap: true
            }
        );
        `, null);
    await build.start();
    return build;
}
