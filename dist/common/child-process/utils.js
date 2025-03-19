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
Object.defineProperty(exports, "__esModule", { value: true });
exports.tmpNameSync = tmpNameSync;
const crypto = __importStar(require("node:crypto"));
const path = __importStar(require("node:path"));
const fs = __importStar(require("fs-extra"));
const RANDOM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function randomChars(howMany) {
    const value = [];
    let rnd = null;
    // make sure that we do not fail because we ran out of entropy
    try {
        rnd = crypto.randomBytes(howMany);
    }
    catch (e) {
        // eslint-disable-next-line security/detect-pseudoRandomBytes
        rnd = crypto.pseudoRandomBytes(howMany);
    }
    for (let i = 0; i < howMany; i++) {
        value.push(RANDOM_CHARS[(rnd[i] ?? 0) % RANDOM_CHARS.length] ?? '0');
    }
    return value.join('');
}
function generateTmpName(tmpDir) {
    const name = ['tmp', '-', process.pid, '-', randomChars(12)].join('');
    return path.join(tmpDir, name);
}
function tmpNameSync(tmpDir, retries = 3) {
    let tries = retries;
    do {
        const name = generateTmpName(tmpDir);
        try {
            fs.statSync(name);
        }
        catch (e) {
            return name;
        }
    } while (tries-- > 0);
    throw new Error('Could not get a unique tmp filename, max tries reached');
}
