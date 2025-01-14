/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

jest.mock('dotenv', () => ({
    config: jest.fn(),
  }));
  
describe('index.js', () => {
  test.skip('Exports expected modules', () => {
    const index = require('../../../../index.js');
    const randomPhrase = require('../../../../src/lib/randomphrase').default;
    const words = require('../../../../src/lib/randomphrase/words.json');
    expect(typeof index.Server).toBe('function');
    expect(typeof index.UIAPIServerMiddleware).toBe('object');
    expect(typeof index.Router).toBe('function');
    expect(typeof index.Validate).toBe('function');
    expect(typeof index.RandomPhrase).toBe('function');
    expect(typeof index.Log).toBe('object');
  });
});
describe('RandomPhrase Generator', () => {
  const randomPhrase = require('../../../../src/lib/randomphrase').default;
  const words = require('../../../../src/lib/randomphrase/words.json');

  test('should generate a phrase with default separator', () => {
    const phrase = randomPhrase();
    const parts = phrase.split('-');
    expect(parts.length).toBe(4);
    parts.forEach(part => {
      expect(words.adjectives.includes(part) || words.nouns.includes(part)).toBe(true);
    });
  });

  test('should generate a phrase with custom separator', () => {
    const separator = '_';
    const phrase = randomPhrase(separator);
    const parts = phrase.split(separator);
    expect(parts.length).toBe(4);
    parts.forEach(part => {
      expect(words.adjectives.includes(part) || words.nouns.includes(part)).toBe(true);
    });
  });

  test('should generate different phrases on subsequent calls', () => {
    const phrase1 = randomPhrase();
    const phrase2 = randomPhrase();
    expect(phrase1).not.toBe(phrase2);
  });
});
