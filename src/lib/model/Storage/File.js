/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

const fs = require('fs');
const path = require('path');
const Storage = require('./Storage');

const readFileAsync = fs.promises.readFile;
const writeFileAsync = fs.promises.writeFile;
const unlinkAsync = fs.promises.unlink;

class File extends Storage {

    /**
     * @param opts {object}
     * @param opts.dirName {string}
     */
    constructor(opts) {
        super();
        this._dirName = opts.dirName;
    }

    _getKeyPath(key) {
        /*
        const keyFile = crypto.createHash('md5').update(key).digest('hex');
        return path.join(this._dirName, keyFile);
         */
        return path.join(this._dirName, key);
    }

    getSecret(key) {
        const keyPath = this._getKeyPath(key);
        return readFileAsync(keyPath);
    }

    getSecretAsString(key) {
        const keyPath = this._getKeyPath(key);
        return readFileAsync(keyPath, 'utf-8');
    }

    setSecret(key, value) {
        const keyPath = this._getKeyPath(key);
        return writeFileAsync(keyPath, value);
    }

    deleteSecret(key) {
        const keyPath = this._getKeyPath(key);
        return unlinkAsync(keyPath);
    }
}

module.exports = File;
