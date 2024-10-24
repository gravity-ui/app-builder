import type webpack from 'webpack';
import {setImportLoaders} from './utils';

describe('setImportLoaders', () => {
    test('should set correct `importLoaders` to `css-loader` rule', () => {
        const cssLoader = {
            loader: 'foo/css-loader/bar.js',
            options: {
                importLoaders: 2,
            },
        };
        const loaders: webpack.RuleSetUseItem[] = [
            'style-loader',
            cssLoader,
            'postcss-loader',
            'resolve-url-loader',
            'sass-loader',
        ];

        setImportLoaders(loaders);

        expect(cssLoader.options.importLoaders).toBe(3);
    });
});
