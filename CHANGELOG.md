# Changelog

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
