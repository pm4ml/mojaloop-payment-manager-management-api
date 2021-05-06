/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

'use strict';

jest.mock('dotenv', () => ({
    config: jest.fn()
}));


describe('index.js', () => {
    test.skip('Exports expected modules', () => {
        const index = require('../../index.js');
        expect(typeof(index.Server)).toBe('function');
        expect(typeof(index.UIAPIServerMiddleware)).toBe('object');
        expect(typeof(index.Router)).toBe('function');
        expect(typeof(index.Validate)).toBe('function');
        expect(typeof(index.RandomPhrase)).toBe('function');
        expect(typeof(index.Log)).toBe('object');
    });
});
