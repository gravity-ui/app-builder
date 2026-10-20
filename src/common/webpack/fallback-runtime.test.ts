}
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {describe, expect, it} from '@jest/globals';
import {Parser} from 'acorn';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack from 'webpack';
import type * as Rspack from '@rspack/core';

import type {NormalizedClientConfig} from '../models/index.js';
import {fallbackRuntimeSource} from './fallback-runtime-source.js';
import {createPublicPathFallbackPlugin} from './public-path-fallback-plugin.js';

const nodeRequire = process.getBuiltinModule('node:module').createRequire(import.meta.url);
const {rspack}: typeof Rspack = nodeRequire('@rspack/core');

it('emits self-contained ES2017 runtime source', () => {
    expect(() => Parser.parse(fallbackRuntimeSource, {ecmaVersion: 2017})).not.toThrow();

    const runtime = runInNewContext(
        fallbackRuntimeSource,
    ) as typeof import('./fallback-controller.js');

    expect(typeof runtime.installChunkFallback).toBe('function');
    expect(typeof runtime.createStylesheetMonitor).toBe('function');
    expect(
        runtime.createFallbackController({
            root: '/build/',
            scope: '',
            federated: false,
            fallbacks: [],
        }),
    ).toBeNull();
});

const config = {
    browserPublicPath: '/build/',
    publicPathFallbacks: [{publicPath: '/backup/'}],
} as NormalizedClientConfig;

for (const [name, bundler] of [
    ['webpack', webpack],
    ['rspack', rspack as unknown as typeof webpack],
] as const) {
    describe(name, () => {
        it.each([undefined, 2300, 0])('preserves explicit chunk timeout %s', async (timeout) => {
            const compiler = bundler({
                mode: 'production',
                output: timeout === undefined ? {} : {chunkLoadTimeout: timeout},
                plugins: [createPublicPathFallbackPlugin(config)],
            });

            try {
                expect(compiler.options.output.chunkLoadTimeout).toBe(timeout ?? 15000);
            } finally {
                await new Promise<void>((resolve, reject) =>
                    compiler.close((error) => (error ? reject(error) : resolve())),
                );
            }
        });

        it('keeps the bundler timeout without the fallback plugin', async () => {
            const compiler = bundler({mode: 'production'});

            try {
                expect(compiler.options.output.chunkLoadTimeout).toBe(120000);
            } finally {
                await new Promise<void>((resolve, reject) =>
                    compiler.close((error) => (error ? reject(error) : resolve())),
                );
            }
        });
    });
}
