# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.
## [7.1.1](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v7.1.0...v7.1.1) (2025-01-13)


### Chores

* bump deps ([#88](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/88)) ([3b4231b](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/3b4231b))


## [7.1.0](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v7.0.0...v7.1.0) (2025-01-08)


### Features

* add automatic fsp jws rotation ([#86](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/86)) ([744f11b](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/744f11b))


## [7.0.0](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.11.1...v7.0.0) (2024-11-04)


### ⚠ BREAKING CHANGES

* This release introduces a breaking change to the DFSP server certificate state machine by standardizing and simplifying how certificate expiration is handled. To use the new certificate rotation feature, pm4mls need to be reonboarded.

### Features

* dfsp server cert rotation ([#85](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/85)) ([7f4b3d3](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/7f4b3d3))
* upgrade @pm4ml/mcm-client to v4.0.0 with DFSP server certificate rotation when expired
* replace vault-dev service with new vault service and automated init-vault container


## [6.11.0](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.10.0...v6.11.0) (2024-10-03)


### Features

* update deps and add token refresh configurations ([#81](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/81))


## [6.10.0](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.9.0...v6.10.0) (2024-10-01)


### Features

* recreate tls client certs ([#82](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/82)) ([11fc1bb](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/11fc1bb))


## [6.9.0](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.8.2...v6.9.0) (2024-09-11)


### Features

* reonboard functionality ([#73](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/73))


### Bug Fixes

* small workaround ([#79](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/79)) ([c570d18](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/c570d18))


### [6.8.2](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.8.1...v6.8.2) (2024-08-22)


### Features

* enable state machine introspection ([#75](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/75))


### Bug Fixes

* improve config sanitization to not mutate original object ([#78](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/78)) ([fa8468d](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/fa8468d))


### [6.8.1](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.8.0...v6.8.1) (2024-08-19)


### Chores

* sanitize errors and secrets ([#77](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/77)) ([fcf15bf](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/fcf15bf))


## [6.8.0](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.7.3...v6.8.0) (2024-06-27)


### Features

* extend API to include onboarding status results and invalidate option ([#53](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/53))
* state, recreate and revoke api ([#54](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/54))
* code coverage improvements ([#38](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/38), [#39](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/39), [#40](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/40), [#41](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/41), [#42](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/42), [#43](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/43), [#44](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/44), [#45](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/45), [#46](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/46), [#47](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/47), [#49](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/49))


### Bug Fixes

* updated logger usage ([#70](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/70))
* used mcm-client 3.6.3 to upload DFSP states status ([#71](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/71))
* dependency and lint issues ([#48](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/48), [#50](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/50), [#51](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/51))


### Chores

* updated SDK-SC for better error response logging ([#72](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/72))
* bump mcm-client ([#76](https://github.com/pm4ml/mojaloop-payment-manager-management-api/pull/76)) ([6af845f](https://github.com/pm4ml/mojaloop-payment-manager-management-api/commit/6af845f))


### [6.7.3](https://github.com/pm4ml/mojaloop-payment-manager-management-api/compare/v6.7.1...v6.7.3) (2025-05-27)
