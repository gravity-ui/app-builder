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
exports.nodeExternals = nodeExternals;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const paths_1 = __importDefault(require("../paths"));
const webpackInternal = /^webpack\/container\/reference\//;
function nodeExternals({ noExternal = [], module }) {
    const noExternals = Array().concat(webpackInternal).concat(noExternal);
    const nodeModules = readPackagesNames(paths_1.default.appNodeModules);
    return async (data) => {
        const { request, dependencyType } = data;
        if (!request) {
            return undefined;
        }
        const moduleName = getModuleName(request);
        if (!request ||
            !containsPattern(nodeModules, moduleName) ||
            containsPattern(noExternals, request)) {
            return undefined;
        }
        if (!module) {
            return `commonjs ${request}`;
        }
        if (dependencyType === 'commonjs' ||
            // lodash and lodash/something without extension can't be imported so always require it
            (moduleName === 'lodash' &&
                (request === 'lodash' || request.match(/^lodash\/[\w_]+($|\/[\w_]+$)/)))) {
            return `node-commonjs ${request}`;
        }
        return `module-import ${request}`;
    };
}
function readPackagesNames(dirName) {
    if (!fs.existsSync(dirName)) {
        return [];
    }
    try {
        return fs
            .readdirSync(dirName)
            .map((module) => {
            if (module.startsWith('.') ||
                !fs.statSync(path.join(dirName, module)).isDirectory()) {
                return undefined;
            }
            if (module.startsWith('@')) {
                try {
                    return fs.readdirSync(path.join(dirName, module)).map(function (scopedMod) {
                        return module + '/' + scopedMod;
                    });
                }
                catch (e) {
                    return [module];
                }
            }
            return module;
        })
            .flat()
            .filter((v) => v !== undefined);
    }
    catch (e) {
        return [];
    }
}
function containsPattern(patterns, value) {
    return patterns.some((pattern) => {
        if (pattern instanceof RegExp) {
            return pattern.test(value);
        }
        else if (typeof pattern === 'function') {
            return pattern(value);
        }
        else {
            return pattern === value;
        }
    });
}
function getModuleName(request) {
    const req = request;
    const delimiter = '/';
    // check if scoped module
    if (req.startsWith('@')) {
        const parts = req.split(delimiter, 2);
        if (parts.length === 2) {
            return parts.join(delimiter);
        }
    }
    return req.split(delimiter, 1)[0] || '';
}
