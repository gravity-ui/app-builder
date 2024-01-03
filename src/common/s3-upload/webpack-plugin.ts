import {WebpackError} from 'webpack';
import {globSync} from 'fast-glob';

import {uploadFiles} from './upload.js';

import type {Compiler} from 'webpack';
import type {UploadOptions} from './upload.js';
import type {S3ClientOptions} from './s3-client.js';

interface S3UploadPluginOptions {
    include?: Rule | Rule[];
    exclude?: Rule | Rule[];
    compress?: boolean;
    s3ClientOptions: S3ClientOptions;
    s3UploadOptions: Pick<UploadOptions, 'bucket' | 'targetPath' | 'existsBehavior'>;
    additionalPattern?: string | string[];
}
export class S3UploadPlugin {
    private options: S3UploadPluginOptions;

    constructor(options: S3UploadPluginOptions) {
        this.options = options;
    }

    apply(compiler: Compiler) {
        compiler.hooks.done.tapPromise('s3-upload-plugin', async (stats) => {
            if (stats.hasErrors()) {
                stats.compilation.warnings.push(
                    new WebpackError(
                        's3-upload-plugin: skipped upload to s3 due to compilation errors',
                    ),
                );
                return;
            }

            let fileNames = Object.keys(stats.compilation.assets);

            if (this.options.additionalPattern) {
                const additionalFiles = globSync(this.options.additionalPattern, {
                    cwd: stats.compilation.outputOptions.path,
                });
                fileNames = fileNames.concat(additionalFiles);
            }

            fileNames = fileNames.filter((name) => {
                const fullPath = stats.compilation.outputOptions.path + '/' + name;
                return this.isIncludeAndNotExclude(fullPath);
            });

            try {
                await uploadFiles(fileNames, {
                    s3: this.options.s3ClientOptions,
                    compress: this.options.compress,
                    options: {
                        ...this.options.s3UploadOptions,
                        sourcePath: stats.compilation.outputOptions.path ?? '',
                    },
                });
            } catch (e) {
                const error = new WebpackError(
                    `s3-upload-plugin: ${e instanceof Error ? e.message : e}`,
                );
                stats.compilation.errors.push(error);
            }
        });
    }

    private isIncludeAndNotExclude(fileName: string) {
        const {include, exclude} = this.options;
        const isInclude = include ? testRule(include, fileName) : true;
        const isExclude = exclude ? testRule(exclude, fileName) : false;

        return isInclude && !isExclude;
    }
}

type Rule = RegExp | string | ((s: string) => boolean);

function testRule(rule: Rule | Rule[], source: string): boolean {
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
