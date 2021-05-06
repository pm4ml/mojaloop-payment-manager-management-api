/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

class Storage {
    getSecret(key) {
        console.log('getSecret not implemented using key ', key);
    }

    setSecret(key, value) {
        console.log(`setSecret not implemented using key ${key} and value ${value} `);
    }

    deleteSecret(key) {
        console.log('getSecret not implemented using key ', key);
    }
}

module.exports = Storage;
