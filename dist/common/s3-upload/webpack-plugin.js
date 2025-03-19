"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3UploadPlugin = void 0;
const fast_glob_1 = require("fast-glob");
const upload_js_1 = require("./upload.js");
class S3UploadPlugin {
    options;
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.done.tapPromise('s3-upload-plugin', async (stats) => {
            if (stats.hasErrors()) {
                stats.compilation.warnings.push(new compiler.webpack.WebpackError('s3-upload-plugin: skipped upload to s3 due to compilation errors'));
                return;
            }
            let fileNames = Object.keys(stats.compilation.assets);
            if (this.options.additionalPattern) {
                const additionalFiles = (0, fast_glob_1.globSync)(this.options.additionalPattern, {
                    cwd: stats.compilation.outputOptions.path,
                });
                fileNames = fileNames.concat(additionalFiles);
            }
            fileNames = fileNames.filter((name) => {
                const fullPath = stats.compilation.outputOptions.path + '/' + name;
                return this.isIncludeAndNotExclude(fullPath);
            });
            try {
                await (0, upload_js_1.uploadFiles)(fileNames, {
                    s3: this.options.s3ClientOptions,
                    compress: this.options.compress,
                    options: {
                        ...this.options.s3UploadOptions,
                        sourcePath: stats.compilation.outputOptions.path ?? '',
                    },
                    logger: this.options.logger,
                });
                this.options.logger?.success(`Files successfully uploaded to bucket ${this.options.s3UploadOptions.bucket}`);
            }
            catch (e) {
                const error = new compiler.webpack.WebpackError(`s3-upload-plugin: ${e instanceof Error ? e.message : e}`);
                stats.compilation.errors.push(error);
            }
        });
    }
    isIncludeAndNotExclude(fileName) {
        const { include, exclude } = this.options;
        const isInclude = include ? testRule(include, fileName) : true;
        const isExclude = exclude ? testRule(exclude, fileName) : false;
        return isInclude && !isExclude;
    }
}
exports.S3UploadPlugin = S3UploadPlugin;
function testRule(rule, source) {
    if (rule instanceof RegExp) {
        return rule.test(source);
    }
    if (typeof rule === 'function') {
        return Boolean(rule(source));
    }
    if (typeof rule === 'string') {
        // eslint-disable-next-line security/detect-non-literal-regexp
        return new RegExp(rule).test(source);
    }
    if (Array.isArray(rule)) {
        return rule.some((condition) => testRule(condition, source));
    }
    throw new Error('Unknown type of rule');
}
