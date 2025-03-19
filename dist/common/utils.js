"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRunFolder = createRunFolder;
exports.shouldCompileTarget = shouldCompileTarget;
exports.getCacheDir = getCacheDir;
exports.getPort = getPort;
exports.deferredPromise = deferredPromise;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const paths_1 = __importDefault(require("./paths"));
function createRunFolder() {
    const runPath = paths_1.default.appRun;
    if (!node_fs_1.default.existsSync(runPath)) {
        node_fs_1.default.mkdirSync(runPath, { recursive: true });
    }
}
function shouldCompileTarget(target, targetName) {
    return target === undefined || target === targetName;
}
async function getCacheDir() {
    const { default: findCacheDirectory } = await import('find-cache-dir');
    return findCacheDirectory({ name: '@gravity-ui/app-builder', create: true }) || node_os_1.default.tmpdir();
}
async function getPort({ port }) {
    const { default: getPortDefault, portNumbers } = await import('get-port');
    return getPortDefault({ port: portNumbers(port, port + 100) });
}
function deferredPromise() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    // @ts-expect-error Promise callback executes synchronously, so resolve and reject are initialized here
    return { promise, resolve, reject };
}
