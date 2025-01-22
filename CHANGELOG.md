# Changelog

## [0.14.1](https://github.com/gravity-ui/app-builder/compare/v0.14.0...v0.14.1) (2025-01-22)


### Bug Fixes

* **babel:** remove @babel/plugin-transform-class-properties from presets ([#175](https://github.com/gravity-ui/app-builder/issues/175)) ([ff0e41e](https://github.com/gravity-ui/app-builder/commit/ff0e41e3cc6eb30f95452e31442c552cf58175ef))

## [0.14.0](https://github.com/gravity-ui/app-builder/compare/v0.13.2...v0.14.0) (2025-01-14)


### Features

* support SSR ([#166](https://github.com/gravity-ui/app-builder/issues/166)) ([77292c6](https://github.com/gravity-ui/app-builder/commit/77292c6ca410d32e8e86d66c79e7d32af95a1f86))

## [0.13.2](https://github.com/gravity-ui/app-builder/compare/v0.13.1...v0.13.2) (2024-12-27)


### Features

* **server:** enable source map support for stack traces in dev ([#172](https://github.com/gravity-ui/app-builder/issues/172)) ([079ba60](https://github.com/gravity-ui/app-builder/commit/079ba60df2aa9d5af1ab688cd76ee2ec4bc49cc5))


### Bug Fixes

* support ts configs with comments ([#167](https://github.com/gravity-ui/app-builder/issues/167)) ([e6021bc](https://github.com/gravity-ui/app-builder/commit/e6021bc6c91b6ef8a1b2d373c842df3d2d783742))

## [0.13.1](https://github.com/gravity-ui/app-builder/compare/v0.13.0...v0.13.1) (2024-10-24)


### Bug Fixes

* **css-loader:** correctly set importLoaders ([#163](https://github.com/gravity-ui/app-builder/issues/163)) ([e28e573](https://github.com/gravity-ui/app-builder/commit/e28e573640c295232d2fadabb811ac3c83021f87))

## [0.13.0](https://github.com/gravity-ui/app-builder/compare/v0.12.1...v0.13.0) (2024-10-11)


### Features

* update dependencies ([#160](https://github.com/gravity-ui/app-builder/issues/160)) ([148aac0](https://github.com/gravity-ui/app-builder/commit/148aac021ef105979a4b78169b7a9bec8ca859bd))

## [0.12.1](https://github.com/gravity-ui/app-builder/compare/v0.12.0...v0.12.1) (2024-10-09)


### Bug Fixes

* **dev:** wait for both manifest plugins to emit files ([#157](https://github.com/gravity-ui/app-builder/issues/157)) ([a87b9e5](https://github.com/gravity-ui/app-builder/commit/a87b9e5b4a709e7c8b946ad24e48f8257f3da1f7))

## [0.12.0](https://github.com/gravity-ui/app-builder/compare/v0.11.3...v0.12.0) (2024-09-11)


### Features

* **Client:** add react-refresh plugin options to config ([#154](https://github.com/gravity-ui/app-builder/issues/154)) ([7b8c1af](https://github.com/gravity-ui/app-builder/commit/7b8c1af7794ed0dbe4edda9cef26f8d656397d81))

## [0.11.3](https://github.com/gravity-ui/app-builder/compare/v0.11.2...v0.11.3) (2024-07-18)


### Bug Fixes

* **worker-lodaer:** correctly return errors from loader ([#151](https://github.com/gravity-ui/app-builder/issues/151)) ([0042132](https://github.com/gravity-ui/app-builder/commit/00421325fe317ad6538bb72f22bec60fd3b51e6e))

## [0.11.2](https://github.com/gravity-ui/app-builder/compare/v0.11.1...v0.11.2) (2024-07-17)


### Bug Fixes

* **storybook:** generate valid source-maps ([#148](https://github.com/gravity-ui/app-builder/issues/148)) ([91e4dcc](https://github.com/gravity-ui/app-builder/commit/91e4dccc03b235dd65a7fb92e15cd4aa3d817a2a))

## [0.11.1](https://github.com/gravity-ui/app-builder/compare/v0.11.0...v0.11.1) (2024-07-08)


### Bug Fixes

* incorrect import from @sentry/webpack-plugin ([#146](https://github.com/gravity-ui/app-builder/issues/146)) ([5685222](https://github.com/gravity-ui/app-builder/commit/5685222b8aa0d8a0d3a543adf386c63fd7dd73b3))

## [0.11.0](https://github.com/gravity-ui/app-builder/compare/v0.10.0...v0.11.0) (2024-07-04)


### Features

* update dependencies ([#138](https://github.com/gravity-ui/app-builder/issues/138)) ([5f52f1f](https://github.com/gravity-ui/app-builder/commit/5f52f1fdd0e413d01eb42491f417911341f4c536))

## [0.10.0](https://github.com/gravity-ui/app-builder/compare/v0.9.5...v0.10.0) (2024-06-20)


### Features

* make css-modules class names human-readable ([#143](https://github.com/gravity-ui/app-builder/issues/143)) ([e324a8b](https://github.com/gravity-ui/app-builder/commit/e324a8bf094b4c5a0b5692333925b0361e2e2fe1))

## [0.9.5](https://github.com/gravity-ui/app-builder/compare/v0.9.4...v0.9.5) (2024-05-22)


### Bug Fixes

* **storybook:** preserve storybook module rules ([#141](https://github.com/gravity-ui/app-builder/issues/141)) ([5e09118](https://github.com/gravity-ui/app-builder/commit/5e09118ae19f836a57c0434682c7afb2ffcf395f))

## [0.9.4](https://github.com/gravity-ui/app-builder/compare/v0.9.3...v0.9.4) (2024-04-26)


### Bug Fixes

* **service:** always generate server source maps in dev ([#135](https://github.com/gravity-ui/app-builder/issues/135)) ([33996ef](https://github.com/gravity-ui/app-builder/commit/33996efc9a8f60eed847064efbd4b77b075d179b))

## [0.9.3](https://github.com/gravity-ui/app-builder/compare/v0.9.2...v0.9.3) (2024-04-24)


### Bug Fixes

* **client:** transform class private methods ([#133](https://github.com/gravity-ui/app-builder/issues/133)) ([4121b38](https://github.com/gravity-ui/app-builder/commit/4121b388e7cb7ae9115810635dfcec3f2b5100d3))

## [0.9.2](https://github.com/gravity-ui/app-builder/compare/v0.9.1...v0.9.2) (2024-04-10)


### Bug Fixes

* **client:** update some of webpack deps ([#128](https://github.com/gravity-ui/app-builder/issues/128)) ([eacd035](https://github.com/gravity-ui/app-builder/commit/eacd03511ff58f3998cbf26db1f75cd6e129be0f))

## [0.9.1](https://github.com/gravity-ui/app-builder/compare/v0.9.0...v0.9.1) (2024-04-03)


### Bug Fixes

* update @babel/core ([#129](https://github.com/gravity-ui/app-builder/issues/129)) ([d4a1402](https://github.com/gravity-ui/app-builder/commit/d4a1402167e5c412e620fb4ea5621dc32798c935))

## [0.9.0](https://github.com/gravity-ui/app-builder/compare/v0.8.7...v0.9.0) (2024-03-27)


### Features

* **client:** allow to pass terser options ([#126](https://github.com/gravity-ui/app-builder/issues/126)) ([0eabea9](https://github.com/gravity-ui/app-builder/commit/0eabea9499011906d89522b67ef437cd6e28dbcd))
* make some deps optional ([#127](https://github.com/gravity-ui/app-builder/issues/127)) ([e2793ea](https://github.com/gravity-ui/app-builder/commit/e2793ea94e3cdc6b428ef482d18659f63247549e))
* **monaco:** set default filename template for worker scripts for production build ([#124](https://github.com/gravity-ui/app-builder/issues/124)) ([9cebc38](https://github.com/gravity-ui/app-builder/commit/9cebc38750e9338ad08cf3a4d139291edb80c0ac))

## [0.8.7](https://github.com/gravity-ui/app-builder/compare/v0.8.6...v0.8.7) (2024-03-11)


### Bug Fixes

* **worker:** fix public path in worker ([#122](https://github.com/gravity-ui/app-builder/issues/122)) ([95babef](https://github.com/gravity-ui/app-builder/commit/95babef0e6aadbbcd2c694bd9706ce4b7a2329cd))

## [0.8.6](https://github.com/gravity-ui/app-builder/compare/v0.8.5...v0.8.6) (2024-01-24)


### Features

* **S3UploadPlugin:** added ability to pass or calc CacheControl parameter to S3 ([#117](https://github.com/gravity-ui/app-builder/issues/117)) ([d2bbb06](https://github.com/gravity-ui/app-builder/commit/d2bbb0622a5ebf2e91fe94120a9751cc700c8631))

## [0.8.5](https://github.com/gravity-ui/app-builder/compare/v0.8.4...v0.8.5) (2024-01-08)


### Bug Fixes

* redundant JS chunks for each CSS chunk ([#115](https://github.com/gravity-ui/app-builder/issues/115)) ([5aa6fcc](https://github.com/gravity-ui/app-builder/commit/5aa6fcc5174c45905b1b8ba36056513df2059314))

## [0.8.4](https://github.com/gravity-ui/app-builder/compare/v0.8.3...v0.8.4) (2024-01-03)


### Features

* **build:** support typescript v5.3 ([#114](https://github.com/gravity-ui/app-builder/issues/114)) ([7de7c87](https://github.com/gravity-ui/app-builder/commit/7de7c8725581f45ccddf4c0e5e2cbaabe3cc2991))
* **s3-upload:** pass logger to s3 uploader ([#113](https://github.com/gravity-ui/app-builder/issues/113)) ([50f0755](https://github.com/gravity-ui/app-builder/commit/50f075535b088db535eb77e2e761ca12b7176462))


### Bug Fixes

* **S3UploadPlugin:** do not upload files if compilation finished with errors ([#111](https://github.com/gravity-ui/app-builder/issues/111)) ([e6d63e1](https://github.com/gravity-ui/app-builder/commit/e6d63e10755a961ef4b735a460fe2ca583af759d))

## [0.8.3](https://github.com/gravity-ui/app-builder/compare/v0.8.2...v0.8.3) (2023-11-24)


### Bug Fixes

* ponyfill SharedWorker ([#109](https://github.com/gravity-ui/app-builder/issues/109)) ([af37266](https://github.com/gravity-ui/app-builder/commit/af372662229c264a87a03981d75ce79d7e8b3e57))

## [0.8.2](https://github.com/gravity-ui/app-builder/compare/v0.8.1...v0.8.2) (2023-11-15)


### Features

* support shared workers with newWebWorkerSyntax enabled ([#105](https://github.com/gravity-ui/app-builder/issues/105)) ([6527cc3](https://github.com/gravity-ui/app-builder/commit/6527cc3bf10f9445e7bc910db95c7c08b75b3817))

## [0.8.1](https://github.com/gravity-ui/app-builder/compare/v0.8.0...v0.8.1) (2023-11-15)


### Bug Fixes

* exclude node_modules from being processed by react-refresh ([#103](https://github.com/gravity-ui/app-builder/issues/103)) ([2d25374](https://github.com/gravity-ui/app-builder/commit/2d253748d841de451befd7fccc30f820cf7b2a75))

## [0.8.0](https://github.com/gravity-ui/app-builder/compare/v0.7.1...v0.8.0) (2023-11-10)


### ⚠ BREAKING CHANGES

* **build-library:** ignore babel.config.json file ([#98](https://github.com/gravity-ui/app-builder/issues/98))

### Features

* **service:** allow override babel transform options ([#102](https://github.com/gravity-ui/app-builder/issues/102)) ([5725e0c](https://github.com/gravity-ui/app-builder/commit/5725e0c5d49121c9fe386b9b60720904b7f30098))
* **service:** allow override the default webpack configuration ([#100](https://github.com/gravity-ui/app-builder/issues/100)) ([ca9354c](https://github.com/gravity-ui/app-builder/commit/ca9354cfffb4a0126d81fdaa6febac3fe0670c21))
* **services:** add --debug-webpack cli option to show final webpack config ([#101](https://github.com/gravity-ui/app-builder/issues/101)) ([b7ee812](https://github.com/gravity-ui/app-builder/commit/b7ee812f782b98147618c7956f83046846daf790))


### Bug Fixes

* **build-library:** ignore babel.config.json file ([#98](https://github.com/gravity-ui/app-builder/issues/98)) ([695c4b3](https://github.com/gravity-ui/app-builder/commit/695c4b3ed4195b803dd858399833f794f612d972))

## [0.7.1](https://github.com/gravity-ui/app-builder/compare/v0.7.0...v0.7.1) (2023-11-01)


### Bug Fixes

* move transform-class-properties to presets ([#97](https://github.com/gravity-ui/app-builder/issues/97)) ([1a6b7ea](https://github.com/gravity-ui/app-builder/commit/1a6b7eac0e98969a89c972a83726d67cc12ce17a))
* remove useless dependencies ([#92](https://github.com/gravity-ui/app-builder/issues/92)) ([47faf6a](https://github.com/gravity-ui/app-builder/commit/47faf6aa1b4c317b083fec862e303bc92f66c15d))

## [0.7.0](https://github.com/gravity-ui/app-builder/compare/v0.6.11...v0.7.0) (2023-10-31)


### ⚠ BREAKING CHANGES

* minimum supported node v18 ([#85](https://github.com/gravity-ui/app-builder/issues/85)) ([99476a9](https://github.com/gravity-ui/app-builder/commit/99476a973b508784719039d01062b82500e118e0))
* **build-lib:** ignore .babelrc file ([#88](https://github.com/gravity-ui/app-builder/issues/88))
* **build-lib:** preserve css imports in CommonJS ([#93](https://github.com/gravity-ui/app-builder/issues/93)) ([63718ba](https://github.com/gravity-ui/app-builder/commit/63718baa4f8d03668bc0bf2a9d3e9e5ced3ecc74))

### Features

* allow overwrite vendors list ([#94](https://github.com/gravity-ui/app-builder/issues/94)) ([3eec2cf](https://github.com/gravity-ui/app-builder/commit/3eec2cf4ad923d9ef6e3a12c3f7015ff298e7706))
* minimum supported node v18 ([#85](https://github.com/gravity-ui/app-builder/issues/85)) ([99476a9](https://github.com/gravity-ui/app-builder/commit/99476a973b508784719039d01062b82500e118e0))


### Bug Fixes

* add @babel/plugin-transform-class-properties to workaround bug in Safari 15 ([#91](https://github.com/gravity-ui/app-builder/issues/91)) ([c69b82e](https://github.com/gravity-ui/app-builder/commit/c69b82eb2e381312da47edfaf08d9fc0ed54a3e0))
* **build-lib:** ignore .babelrc file ([#88](https://github.com/gravity-ui/app-builder/issues/88)) ([0524ec0](https://github.com/gravity-ui/app-builder/commit/0524ec010e0e4425a2f251b4ee6cfbe351179899))
* **build-lib:** preserve css imports in CommonJS ([#93](https://github.com/gravity-ui/app-builder/issues/93)) ([63718ba](https://github.com/gravity-ui/app-builder/commit/63718baa4f8d03668bc0bf2a9d3e9e5ced3ecc74))
* **build-lib:** replace deprecated sass api with a new one ([#95](https://github.com/gravity-ui/app-builder/issues/95)) ([7f11da1](https://github.com/gravity-ui/app-builder/commit/7f11da1ba8fd371cf7325af1bb65739787139593))

## [0.6.11](https://github.com/gravity-ui/app-builder/compare/v0.6.10...v0.6.11) (2023-10-02)


### Bug Fixes

* **config:** set explicitly verbose false by default ([#83](https://github.com/gravity-ui/app-builder/issues/83)) ([368a69d](https://github.com/gravity-ui/app-builder/commit/368a69d7bff6fe4ed1b3dda745c880c5628480bb))

## [0.6.10](https://github.com/gravity-ui/app-builder/compare/v0.6.9...v0.6.10) (2023-09-22)


### Features

* **build:** support sentry webpack plugin ([#80](https://github.com/gravity-ui/app-builder/issues/80)) ([d7932d8](https://github.com/gravity-ui/app-builder/commit/d7932d8d7df389aa4c7a0fbd30a3fe9fba0d1b8c))

## [0.6.9](https://github.com/gravity-ui/app-builder/compare/v0.6.8...v0.6.9) (2023-09-18)


### Bug Fixes

* pass correct version to semver ([#77](https://github.com/gravity-ui/app-builder/issues/77)) ([d3f8ed8](https://github.com/gravity-ui/app-builder/commit/d3f8ed8d210995d9d7325f6fd16f0e7e57193105))

## [0.6.8](https://github.com/gravity-ui/app-builder/compare/v0.6.7...v0.6.8) (2023-09-18)


### Bug Fixes

* config fails to load ([#75](https://github.com/gravity-ui/app-builder/issues/75)) ([1847dc7](https://github.com/gravity-ui/app-builder/commit/1847dc7ddb6270b61d73836f84ad1944e04d96a7))
* get-port v5 incorrectly detects empty port ([#73](https://github.com/gravity-ui/app-builder/issues/73)) ([3d7b4df](https://github.com/gravity-ui/app-builder/commit/3d7b4dfd0ba244b1d03b2965beffd9234b328cd6))

## [0.6.7](https://github.com/gravity-ui/app-builder/compare/v0.6.6...v0.6.7) (2023-09-06)


### Bug Fixes

* **build-lib:** replace babel-plugin-lodash with babel-plugin-import ([#70](https://github.com/gravity-ui/app-builder/issues/70)) ([e193fb7](https://github.com/gravity-ui/app-builder/commit/e193fb71f6707dbaf2d09062cfb1a0eb0ba46643))

## [0.6.6](https://github.com/gravity-ui/app-builder/compare/v0.6.5...v0.6.6) (2023-09-04)


### Bug Fixes

* respect verbose property defined in config ([#68](https://github.com/gravity-ui/app-builder/issues/68)) ([6cba27c](https://github.com/gravity-ui/app-builder/commit/6cba27c1d1321874694446724fa4c37ef9788a93)), closes [#67](https://github.com/gravity-ui/app-builder/issues/67)

## [0.6.5](https://github.com/gravity-ui/app-builder/compare/v0.6.4...v0.6.5) (2023-08-16)


### Bug Fixes

* replace babel-plugin-lodash with babel-plugin-import ([#65](https://github.com/gravity-ui/app-builder/issues/65)) ([73b6a3e](https://github.com/gravity-ui/app-builder/commit/73b6a3e5bd340ea3b41ecfc7e61575668eb5f474))

## [0.6.4](https://github.com/gravity-ui/app-builder/compare/v0.6.3...v0.6.4) (2023-08-04)


### Bug Fixes

* **build-library:** correctly write esm code to file ([#62](https://github.com/gravity-ui/app-builder/issues/62)) ([b1f1be2](https://github.com/gravity-ui/app-builder/commit/b1f1be2dfd93d79b54ee8c99e99cea945c0b6f16)), closes [#61](https://github.com/gravity-ui/app-builder/issues/61)

## [0.6.3](https://github.com/gravity-ui/app-builder/compare/v0.6.2...v0.6.3) (2023-07-31)


### Bug Fixes

* **build-lib:** replace style and svg paths with babel plugin ([#60](https://github.com/gravity-ui/app-builder/issues/60)) ([3b7760e](https://github.com/gravity-ui/app-builder/commit/3b7760e0af7350e60c9d3c7a704e510958d46050))
* **build:** always dedupe css modules ([#55](https://github.com/gravity-ui/app-builder/issues/55)) ([6ea483e](https://github.com/gravity-ui/app-builder/commit/6ea483eb335eb24f80f9dddc33943f0a12336281))
* **css:** disable sass loaders for pure css ([#56](https://github.com/gravity-ui/app-builder/issues/56)) ([1c23832](https://github.com/gravity-ui/app-builder/commit/1c2383299f1f4cbbc826acdd2b6231c15ab26956))
* **webworker:** correctly handle licenses and do not emit assets twice ([#58](https://github.com/gravity-ui/app-builder/issues/58)) ([e514bc6](https://github.com/gravity-ui/app-builder/commit/e514bc68ac9bed6cbbfaeddbaa95d8ea8f459acc))

## [0.6.2](https://github.com/gravity-ui/app-builder/compare/v0.6.1...v0.6.2) (2023-07-24)


### Bug Fixes

* **build-lib:** correctly transform svg icons ([#53](https://github.com/gravity-ui/app-builder/issues/53)) ([9c9d3a6](https://github.com/gravity-ui/app-builder/commit/9c9d3a626ea6375a9edf93462fe0f7b367046b16))

## [0.6.1](https://github.com/gravity-ui/app-builder/compare/v0.6.0...v0.6.1) (2023-07-24)


### Features

* **css:** use Lightning CSS ([#52](https://github.com/gravity-ui/app-builder/issues/52)) ([d16cd09](https://github.com/gravity-ui/app-builder/commit/d16cd09067276eee9b0952f2c198e6e4e6365c3d))


### Bug Fixes

* **s3-client:** add charset to content type ([#50](https://github.com/gravity-ui/app-builder/issues/50)) ([8b1a944](https://github.com/gravity-ui/app-builder/commit/8b1a944d675e0f1b88f80fa43d0929148ce82a05))

## [0.6.0](https://github.com/gravity-ui/app-builder/compare/v0.5.6...v0.6.0) (2023-07-23)


### Features

* add caching to worker loader ([#48](https://github.com/gravity-ui/app-builder/issues/48)) ([c7db4fb](https://github.com/gravity-ui/app-builder/commit/c7db4fb2786729a173e5fbe0f62c679639b9a99a))

## [0.5.6](https://github.com/gravity-ui/app-builder/compare/v0.5.5...v0.5.6) (2023-07-21)


### Features

* add webpack cache option ([#47](https://github.com/gravity-ui/app-builder/issues/47)) ([fb5311a](https://github.com/gravity-ui/app-builder/commit/fb5311a5635dfc95051434fdeb878b4c34c457c2))


### Bug Fixes

* make statoscope config fields optional ([#45](https://github.com/gravity-ui/app-builder/issues/45)) ([1e80938](https://github.com/gravity-ui/app-builder/commit/1e809384b3af358ed4837d57c28928a291e99a4e))

## [0.5.5](https://github.com/gravity-ui/app-builder/compare/v0.5.4...v0.5.5) (2023-07-07)


### Features

* statoscope can be configured ([#42](https://github.com/gravity-ui/app-builder/issues/42)) ([9a21979](https://github.com/gravity-ui/app-builder/commit/9a219798ad416811dfd6d448c9dfa4e330e0659c))

## [0.5.4](https://github.com/gravity-ui/app-builder/compare/v0.5.3...v0.5.4) (2023-07-06)


### Features

* **ForkTSCheckerWebpackPlugin:** allow overwrite config ([#40](https://github.com/gravity-ui/app-builder/issues/40)) ([7490647](https://github.com/gravity-ui/app-builder/commit/74906477d707973dc885b0050ecc018ad6e43a00))

## [0.5.3](https://github.com/gravity-ui/app-builder/compare/v0.5.2...v0.5.3) (2023-06-30)


### Bug Fixes

* **storybook:** support storybook 7 ([#38](https://github.com/gravity-ui/app-builder/issues/38)) ([1e51ac3](https://github.com/gravity-ui/app-builder/commit/1e51ac3dca99acd9b5a2a53a2525bcd90224e861))

## [0.5.2](https://github.com/gravity-ui/app-builder/compare/v0.5.1...v0.5.2) (2023-06-28)


### Bug Fixes

* add missing entries typings to lazy compilation feature ([#34](https://github.com/gravity-ui/app-builder/issues/34)) ([5c49611](https://github.com/gravity-ui/app-builder/commit/5c49611769f496f79ab1e810a366672908cfc29b))

## [0.5.1](https://github.com/gravity-ui/app-builder/compare/v0.5.0...v0.5.1) (2023-06-26)


### Features

* added the ability to disable entries for webpack lazy compilation ([#32](https://github.com/gravity-ui/app-builder/issues/32)) ([fed462a](https://github.com/gravity-ui/app-builder/commit/fed462a9803f4891ea0aff300133dec45c708fb9))

## [0.5.0](https://github.com/gravity-ui/app-builder/compare/v0.4.3...v0.5.0) (2023-06-17)


### Features

* **build:** remove the use of @babel/plugin-proposal-decorators ([#27](https://github.com/gravity-ui/app-builder/issues/27)) ([2b09510](https://github.com/gravity-ui/app-builder/commit/2b09510130232578e503cc8042010e8995cb237f))

## [0.4.3](https://github.com/gravity-ui/app-builder/compare/v0.4.2...v0.4.3) (2023-06-05)


### Bug Fixes

* return babel-plugin-inline-react-svg to deps ([#28](https://github.com/gravity-ui/app-builder/issues/28)) ([7609c2b](https://github.com/gravity-ui/app-builder/commit/7609c2b0e9ad6c24d88bef9f2b7b22029d77c3ff))

## [0.4.2](https://github.com/gravity-ui/app-builder/compare/v0.4.1...v0.4.2) (2023-05-25)


### Bug Fixes

* **build:** add to build all source files ([#24](https://github.com/gravity-ui/app-builder/issues/24)) ([9dfc536](https://github.com/gravity-ui/app-builder/commit/9dfc5360786d6462b01bcb5f96c9936ece05a4eb))
* **dev:** delete run folder only on full build ([#25](https://github.com/gravity-ui/app-builder/issues/25)) ([f491489](https://github.com/gravity-ui/app-builder/commit/f491489e92583b4cbba327d7ee86ba42cd0add97))

## [0.4.1](https://github.com/gravity-ui/app-builder/compare/v0.4.0...v0.4.1) (2023-05-19)


### Bug Fixes

* **worker-loader:** correctly get main worker asset ([#22](https://github.com/gravity-ui/app-builder/issues/22)) ([31984c9](https://github.com/gravity-ui/app-builder/commit/31984c9c057a915233db3d9aed470ce6d4040db4))

## [0.4.0](https://github.com/gravity-ui/app-builder/compare/v0.3.0...v0.4.0) (2023-05-19)


### ⚠ BREAKING CHANGES

* **Client:** change default value for setting `client.symlinks`, used default (true) from webpack.

### Features

* **Client:** add setting to watch changes in node_modules ([#21](https://github.com/gravity-ui/app-builder/issues/21)) ([3a5dea6](https://github.com/gravity-ui/app-builder/commit/3a5dea6284f3a768650b388115a83136ba1b7a07))
* **WebWorker:** support webpack 5 web workers syntax ([#19](https://github.com/gravity-ui/app-builder/issues/19)) ([bf784bb](https://github.com/gravity-ui/app-builder/commit/bf784bb6480c60497bc79c93e70d61aaead80909))

## [0.3.0](https://github.com/gravity-ui/app-builder/compare/v0.2.2...v0.3.0) (2023-05-08)


### ⚠ BREAKING CHANGES

* **LibraryConfig:** move newJsxTransform option under lib property

### Features

* **config:** add defineConfig helper ([31daecc](https://github.com/gravity-ui/app-builder/commit/31daecccc33fc58bc14d85c217b990c1f4302218))
* **server:** use APP_PORT env variable to pass port to server ([6b14651](https://github.com/gravity-ui/app-builder/commit/6b14651adae6cf18f0da7447636d2a8363979166))
* **storybook:** use configureServiceWebpackConfig for libraries too ([4204cf9](https://github.com/gravity-ui/app-builder/commit/4204cf9e1e5e63e16e7631477beb251e496d2690))


### Bug Fixes

* **client:** use newJsxTransform in svgr options ([cd01f55](https://github.com/gravity-ui/app-builder/commit/cd01f552177c73b20de7e95ca65cf770e8b63dbc))
* **LibraryConfig:** move newJsxTransform option under lib property ([847a38c](https://github.com/gravity-ui/app-builder/commit/847a38cc4138741559f053ba594bcdd997c44063))


### docs

* add documentation for services ([d78b63b](https://github.com/gravity-ui/app-builder/commit/d78b63beb03c0e446e060d977942787dc33eee2c))

## [0.2.2](https://github.com/gravity-ui/app-builder/compare/v0.2.1...v0.2.2) (2023-05-05)


### Features

* allow upload of additional files to CDN ([#15](https://github.com/gravity-ui/app-builder/issues/15)) ([dcdf8e0](https://github.com/gravity-ui/app-builder/commit/dcdf8e06d4d19a50fce3f6bbc48f4cf9ac2c7926))

## [0.2.1](https://github.com/gravity-ui/app-builder/compare/v0.2.0...v0.2.1) (2023-04-24)


### Bug Fixes

* **cli:** correctly consider --inspect/--inspect-brk options without value ([#11](https://github.com/gravity-ui/app-builder/issues/11)) ([a5c74c3](https://github.com/gravity-ui/app-builder/commit/a5c74c39e64d6fc57bf10eb3e49596d96a9e8dcb))
* sove fixes ([#13](https://github.com/gravity-ui/app-builder/issues/13)) ([e4f9e1a](https://github.com/gravity-ui/app-builder/commit/e4f9e1a14c9e71197e91586a9c254db880f8ac11))

## [0.2.0](https://github.com/gravity-ui/app-builder/compare/v0.1.1...v0.2.0) (2023-03-10)


### Features

* allow upload to many s3 destinations ([#7](https://github.com/gravity-ui/app-builder/issues/7)) ([406c4b2](https://github.com/gravity-ui/app-builder/commit/406c4b2362793528f85384ec3247f49ce8cbda16))
* enable verbose mode in `CleanWebpackPlugin` ([#5](https://github.com/gravity-ui/app-builder/issues/5)) ([945f28a](https://github.com/gravity-ui/app-builder/commit/945f28a0875312256af143ca5e98c42fe414691f))

## [0.1.1](https://github.com/gravity-ui/app-builder/compare/v0.1.0...v0.1.1) (2023-03-10)


### Bug Fixes

* correctly load dayjs locales ([#6](https://github.com/gravity-ui/app-builder/issues/6)) ([412dfd6](https://github.com/gravity-ui/app-builder/commit/412dfd6d89dccbda9652a96baa36491db2e6b4dc))

## [0.1.0](https://github.com/gravity-ui/app-builder/compare/v0.0.2...v0.1.0) (2023-02-07)


### Features

* limit load of dayjs locales ([#3](https://github.com/gravity-ui/app-builder/issues/3)) ([a7ff218](https://github.com/gravity-ui/app-builder/commit/a7ff2189ad99473e51f7470bc7e9ee32c490b64c))

## [0.0.2](https://github.com/gravity-ui/app-builder/compare/v0.0.1...v0.0.2) (2022-12-19)


### Bug Fixes

* **cli:** do not restrict value of the CDN parametr ([9f62c9e](https://github.com/gravity-ui/app-builder/commit/9f62c9e97f04e96567a068a85038776e0f88973d))
* do not use postcss feature that would need an extra browser library ([a788d9c](https://github.com/gravity-ui/app-builder/commit/a788d9cf334d6306a6feb49ae5a08d4f7518dfa3))

## 0.0.1 (2022-12-06)


### Features

* add client and server keys to confg ([79d968f](https://github.com/gravity-ui/app-builder/commit/79d968f275b972d7376c90dba1b6cacfe05e4310))
* upload to s3 ([e6e5fbc](https://github.com/gravity-ui/app-builder/commit/e6e5fbc89e402ad595db8b1aee8c17f7adb41e2c))


### chore

* release 0.0.1 ([3d58428](https://github.com/gravity-ui/app-builder/commit/3d58428c4df316f098c23dbc7264219cf2e08bf7))
