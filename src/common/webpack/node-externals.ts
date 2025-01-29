import * as fs from 'node:fs';
import * as path from 'node:path';
import paths from '../paths';

type Pattern = RegExp | ((v: string) => boolean) | string;

export interface NodeExternalsOptions {
    noExternal?: Pattern | Pattern[];
    module?: boolean;
}

const webpackInternal = /^webpack\/container\/reference\//;

export function nodeExternals({noExternal = [], module}: NodeExternalsOptions) {
    const noExternals = Array<Pattern>().concat(webpackInternal).concat(noExternal);

    const nodeModules = readPackagesNames(paths.appNodeModules);

    return async (data: {request?: string; dependencyType?: string}) => {
        const {request, dependencyType} = data;
        if (!request) {
            return undefined;
        }

        const moduleName = getModuleName(request);
        if (
            !request ||
            !containsPattern(nodeModules, moduleName) ||
            containsPattern(noExternals, request)
        ) {
            return undefined;
        }

        if (!module) {
            return `commonjs ${request}`;
        }

        if (
            dependencyType === 'commonjs' ||
            // lodash/something without extension can't be imported so always require it
            (moduleName === 'lodash' && request.match(/^lodash\/[\w_]+($|\/[\w_]+$)/))
        ) {
            return `node-commonjs ${request}`;
        }

        return `module-import ${request}`;
    };
}

function readPackagesNames(dirName: string) {
    if (!fs.existsSync(dirName)) {
        return [];
    }

    try {
        return fs
            .readdirSync(dirName)
            .map((module) => {
                if (
                    module.startsWith('.') ||
                    !fs.statSync(path.join(dirName, module)).isDirectory()
                ) {
                    return undefined;
                }
                if (module.startsWith('@')) {
                    try {
                        return fs.readdirSync(path.join(dirName, module)).map(function (scopedMod) {
                            return module + '/' + scopedMod;
                        });
                    } catch (e) {
                        return [module];
                    }
                }
                return module;
            })
            .flat()
            .filter((v) => v !== undefined);
    } catch (e) {
        return [];
    }
}

function containsPattern(patterns: Pattern[], value: string) {
    return patterns.some((pattern) => {
        if (pattern instanceof RegExp) {
            return pattern.test(value);
        } else if (typeof pattern === 'function') {
            return pattern(value);
        } else {
            return pattern === value;
        }
    });
}

function getModuleName(request: string) {
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
