declare module 'postcss-preset-env' {
    import {Plugin} from 'postcss';
    import {Options as AutoprefixerOptions} from 'autoprefixer';

    function postcssPresetEnv(options?: postcssPresetEnv.Options): Plugin;

    namespace postcssPresetEnv {
        interface Options {
            /**
             * The stage option determines which CSS features to polyfill,
             * based upon their stability in the process of becoming
             * implemented web standards.
             *
             * `postcssPresetEnv({ stage: 0 })`
             *
             * The `stage` can be `0` (experimental) through `4` (stable), or false.
             * Setting stage to false will disable every polyfill. Doing this would only
             * be useful if you intended to exclusively use the `features` option.
             *
             * Without any configuration options, PostCSS Preset Env enables
             * **Stage 2** features.
             */
            stage?: number | undefined;

            /**
             * The features option enables or disables specific polyfills by ID.
             * Passing true to a specific feature ID will enable its polyfill,
             * while passing false will disable it.
             *
             * Passing an object to a specific feature ID will both enable and
             * configure it.
             *
             * Any polyfills not explicitly enabled or disabled through `features`
             * are determined by the `stage` option.
             */
            features?: Options.Features | undefined;

            /**
             * The browsers option determines which polyfills are required based upon
             * the browsers you are supporting.
             *
             * PostCSS Preset Env supports any standard browserslist configuration,
             * which can be a `.browserslistrc` file, a `browserslist` key in
             * `package.json`, or `browserslist` environment variables.
             *
             * The `browsers` option should only be used when a standard browserslist
             * configuration is not available.
             *
             * @default default
             */
            browsers?: string | string[] | undefined;

            /**
             * The `insertAfter` keys allow you to insert other PostCSS plugins
             * into the chain. This is only useful if you are also using sugary
             * PostCSS plugins that must execute before or after certain polyfills.
             * `insertAfter` support chaining one or multiple plugins.
             */
            insertAfter?: object | undefined;

            /**
             * The `insertBefore` keys allow you to insert other PostCSS plugins
             * into the chain. This is only useful if you are also using sugary
             * PostCSS plugins that must execute before or after certain polyfills.
             * `insertBefore` support chaining one or multiple plugins.
             */
            insertBefore?: object | undefined;

            /**
             * PostCSS Preset Env includes
             * [autoprefixer](https://github.com/postcss/autoprefixer)
             * and `browsers` option will be passed to it automatically.
             *
             * Specifying the `autoprefixer` option enables passing
             * [additional options](https://github.com/postcss/autoprefixer#options)
             * into autoprefixer.
             *
             * Passing `autoprefixer: false` disables autoprefixer.
             */
            autoprefixer?: boolean | AutoprefixerOptions | undefined;

            /**
             * The `preserve` option determines whether all plugins should receive
             * a `preserve` option, which may preserve or remove otherwise-polyfilled CSS.
             * By default, this option is not configured.
             */
            preserve?: boolean | undefined;

            /**
             * The `importFrom` option specifies sources where variables like
             * Custom Media, Custom Properties, Custom Selectors, and
             * Environment Variables can be imported from, which might be
             * CSS, JS, and JSON files, functions, and directly passed objects.
             */
            importFrom?: string | any[] | undefined;

            /**
             * The `exportTo` option specifies destinations where variables like
             * Custom Media, Custom Properties, Custom Selectors, and
             * Environment Variables can be exported to, which might be
             * CSS, JS, and JSON files, functions, and directly passed objects.
             */
            exportTo?: string | any[] | undefined;

            /**
             * The enableClientSidePolyfills enables any feature that would need
             * an extra browser library to be loaded into the page for it to work.
             *
             * Defaults to true.
             */
            enableClientSidePolyfills?: boolean;

            /**
             * The debug option enables debugging messages to stdout which should
             * be useful to help you debug which features have been enabled/disabled
             * and why.
             */
            debug?: boolean;
        }

        namespace Options {
            interface Features {
                'all-property'?: boolean | object | undefined;
                'any-link-pseudo-class'?: boolean | object | undefined;
                'blank-pseudo-class'?: boolean | object | undefined;
                'break-properties'?: boolean | object | undefined;
                'cascade-layers'?: boolean | object | undefined;
                'case-insensitive-attributes'?: boolean | object | undefined;
                clamp?: boolean | object | undefined;
                'color-function'?: boolean | object | undefined;
                'color-functional-notation'?: boolean | object | undefined;
                'custom-media-queries'?: boolean | object | undefined;
                'custom-properties'?: boolean | object | undefined;
                'custom-selectors'?: boolean | object | undefined;
                'dir-pseudo-class'?: boolean | object | undefined;
                'display-two-values'?: boolean | object | undefined;
                'double-position-gradients'?: boolean | object | undefined;
                'environment-variables'?: boolean | object | undefined;
                'focus-visible-pseudo-class'?: boolean | object | undefined;
                'focus-within-pseudo-class'?: boolean | object | undefined;
                'font-format-keywords'?: boolean | object | undefined;
                'font-variant-property'?: boolean | object | undefined;
                'gap-properties'?: boolean | object | undefined;
                'has-pseudo-class'?: boolean | object | undefined;
                'hexadecimal-alpha-notation'?: boolean | object | undefined;
                'hwb-function'?: boolean | object | undefined;
                'ic-unit'?: boolean | object | undefined;
                'image-set-function'?: boolean | object | undefined;
                'is-pseudo-class'?: boolean | object | undefined;
                'lab-function'?: boolean | object | undefined;
                'logical-properties-and-values'?: boolean | object | undefined;
                'media-query-ranges'?: boolean | object | undefined;
                'nesting-rules'?: boolean | object | undefined;
                'not-pseudo-class'?: boolean | object | undefined;
                'oklab-function'?: boolean | object | undefined;
                'opacity-percentage'?: boolean | object | undefined;
                'overflow-property'?: boolean | object | undefined;
                'overflow-wrap-property'?: boolean | object | undefined;
                'place-properties'?: boolean | object | undefined;
                'prefers-color-scheme-query'?: boolean | object | undefined;
                'rebeccapurple-color'?: boolean | object | undefined;
                'stepped-value-functions'?: boolean | object | undefined;
                'system-ui-font-family'?: boolean | object | undefined;
                'trigonometric-functions'?: boolean | object | undefined;
                'unset-value'?: boolean | object | undefined;
            }
        }
    }

    export = postcssPresetEnv;
}
