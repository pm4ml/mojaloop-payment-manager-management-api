/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2025 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 **************************************************************************/

/**
 * Jest Setup File - Global Test Environment Configuration
 *
 * This file runs before each test suite to configure the test environment.
 *
 * FILE API POLYFILL:
 * ------------------
 * We polyfill the File and Blob APIs for Node.js test environments because
 * the upgrade to @mojaloop/sdk-standard-components 19.18.0 introduced a
 * dependency chain that requires browser File APIs:
 *
 *   @mojaloop/sdk-standard-components 19.18.0
 *   └─> @mojaloop/ml-schema-transformer-lib
 *       └─> @mojaloop/central-services-shared
 *           └─> shins (HTML documentation generator)
 *               └─> cheerio (HTML parser)
 *                   └─> undici (HTTP client with WebIDL support)
 *                       └─> Requires File API for WebIDL compliance
 *
 * The File API is a browser standard that was added to Node.js 20+, but it's
 * not always available in Jest test environments, particularly in CI.
 *
 * Issue introduced: Commit d26a8d8 (Oct 16, 2025)
 * Failed CI Job: https://app.circleci.com/pipelines/github/pm4ml/mojaloop-payment-manager-management-api/678/workflows/ddc8aaec-45e1-45dc-95d1-29fee6beaf08/jobs/3401
 *
 * Error without this polyfill:
 *   ReferenceError: File is not defined
 *     at Object.<anonymous> (node_modules/undici/lib/web/webidl/index.js:531:48)
 *
 * This polyfill provides minimal File and Blob implementations that satisfy
 * undici's WebIDL requirements without affecting test behavior, as our unit
 * tests don't actually use file upload functionality.
 */

// Polyfill File and Blob APIs for undici/WebIDL in Node.js test environment
if (typeof globalThis.File === 'undefined') {
  const { Blob } = require('buffer');

  // Ensure Blob is available globally
  globalThis.Blob = Blob;

  // File constructor polyfill
  // Extends Blob with name and lastModified properties per File API spec
  globalThis.File = class File extends Blob {
    constructor(bits, name, options = {}) {
      super(bits, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}
