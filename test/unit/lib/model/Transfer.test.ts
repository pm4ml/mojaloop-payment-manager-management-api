/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

jest.mock('redis');

import * as uuid from 'uuid';
import MockDate from 'mockdate';
import Transfer from '../../../../src/lib/model/Transfer';
import { addTransferToCache, createTestDb } from '../utils';

describe('Transfer', () => {
  let db;
  let transfer;

  beforeEach(async () => {
    db = await createTestDb();
    transfer = new Transfer({ db });
    MockDate.set('2000-11-22');
  });

  afterEach(async () => {
    await db.redisCache().disconnect();
    db.destroy();
    MockDate.reset();
  });

  const populateCache = async (currency, startTime, seq) => {
    const createTimestamp = (secondsAdd) => new Date(startTime + (secondsAdd || 0) * 1e3 + seq).toISOString();
    return Promise.all([
      addTransferToCache(db, {
        currency: currency,
        amount: '50',
        transferId: uuid.v4(),
        currentState: 'succeeded',
        initiatedTimestamp: createTimestamp(15),
        completedTimestamp: createTimestamp(17),
      }),
      addTransferToCache(db, {
        currency: currency,
        amount: '60',
        transferId: uuid.v4(),
        currentState: 'succeeded',
        initiatedTimestamp: createTimestamp(20),
        completedTimestamp: createTimestamp(22),
      }),
      addTransferToCache(db, {
        currency: currency,
        amount: '70',
        transferId: uuid.v4(),
        currentState: 'errored',
        initiatedTimestamp: createTimestamp(30),
        completedTimestamp: createTimestamp(32),
      }),
      addTransferToCache(db, {
        currency: currency,
        amount: '80',
        transferId: uuid.v4(),
        currentState: 'payeeResolved',
        initiatedTimestamp: createTimestamp(40),
      }),
      addTransferToCache(db, {
        currency: currency,
        amount: '90',
        transferId: uuid.v4(),
        currentState: 'payeeResolved',
        initiatedTimestamp: createTimestamp(50),
      }),
    ]);
  };

  const populateByMinutes = async (now, minutes) => {
    const MINUTE = 60 * 1000;
    const transfers: Promise<any>[] = [];
    for (let i = 1; i <= minutes; i++) {
      transfers.push(populateCache('EUR', new Date(now - i * MINUTE).getTime(), i));
      transfers.push(populateCache('USD', new Date(now - i * MINUTE).getTime(), 10 * i));
    }
    const sortFn = (a, b) => a.initiatedTimestamp.localeCompare(b.initiatedTimestamp);
    const result = (await Promise.all(transfers)).flat(Infinity);
    result.sort(sortFn);
    return result;
  };

  const populateByHours = async (now, hours) => {
    const HOUR = 3600 * 1000;
    const transfers: Promise<any>[] = [];
    for (let i = 1; i <= hours; i++) {
      transfers.push(populateCache('EUR', new Date(now - i * HOUR).getTime(), i));
      transfers.push(populateCache('USD', new Date(now - i * HOUR).getTime(), 10 * i));
    }
    const sortFn = (a, b) => a.initiatedTimestamp.localeCompare(b.initiatedTimestamp);
    const result = (await Promise.all(transfers)).flat(Infinity);
    result.sort(sortFn);
    return result;
  };

  test.skip('/transfers', async () => {
    const now = Date.now();
    const MINUTE = 60 * 1000;
    const populated = await populateByMinutes(now, 5);
    await db.sync();
    const result = await transfer.findAll({
      startTimestamp: new Date(now - 4 * MINUTE).toISOString(),
      endTimestamp: new Date(now - MINUTE).toISOString(),
    });

    expect(result.length).toBe(30);

    populated.splice(0, 10);
    populated.splice(30, 10);

    const expected = populated.map((item) => ({
      currency: item.currency,
      amount: item.amount,
    }));

    expect(result).toMatchObject(expected);
  });

  test('/transfers by direction outbound', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      direction: 'OUTBOUND',
    });

    expect(result.length).toBe(50);
    result.forEach((element) => expect(element.direction).toBe('OUTBOUND'));
  });

  test('/transfers by direction inbound', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      direction: 'INBOUND',
    });

    expect(result.length).toBe(0);
  });

  test('/transfers by payee alias MSISDN', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      recipientIdType: 'MSISDN',
      recipientIdValue: '987654321',
    });

    expect(result.length).toBe(50);

    result.forEach((element) => expect(element.recipientIdType).toBe('MSISDN'));
    result.forEach((element) => expect(element.recipientIdValue).toBe('987654321'));
  });

  test('/transfers by payee alias ACCOUNT_ID', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      recipientIdType: 'ACCOUNT_ID',
      recipientIdValue: '1298765432',
    });

    expect(result.length).toBe(0);
  });

  test('/hourlyFlow', async () => {
    const now = Date.now();
    await populateByHours(now, 5);
    await db.sync();
    const result = await transfer.hourlyFlow({ hoursPrevious: 3 });

    const expected: { currency: string; outbound: number }[] = [];
    for (let i = 0; i < 3; i++) {
      for (const currency of ['EUR', 'USD']) {
        expected.push({
          currency,
          outbound: 50 + 60 + 70 + 80 + 90,
        });
      }
    }

    expect(result).toMatchObject(expected);
  });

  test('/minuteSuccessfulTransferPerc', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);
    await db.sync();
    const result = await transfer.successRate({ minutePrevious: 3 });

    expect(result.length).toBe(3);
    expect(result[0]).toMatchObject({ percentage: (2 / 5) * 100 });
  });

  test('/minuteAverageTransferResponseTime', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);
    await db.sync();
    const result = await transfer.avgResponseTime({ minutePrevious: 3 });

    expect(result.length).toBe(3);
    expect(result[0]).toMatchObject({ averageResponseTime: 2 * 1000 });
  });

  test('/transfers by currency', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      currency: 'EUR',
    });

    const expectedCount = 5 * 2;
    expect(result.length).toBe(expectedCount);

    result.forEach((element) => expect(element.currency).toBe('EUR'));
  });

  test('/transfers by amount range', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      minAmount: '60',
      maxAmount: '80',
    });

    console.log(result);

    const expectedCount = 5 * 2 * 3;
    expect(result.length).toBe(expectedCount);

    result.forEach((element) => {
      const amount = parseFloat(element.amount);
      expect(amount).toBeGreaterThanOrEqual(60);
      expect(amount).toBeLessThanOrEqual(80);
    });
  });

  test('/transfers by status', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      status: 'SUCCESS',
    });

    expect(result.length).toBe(20);
    result.forEach((element) => expect(element.status).toBe('SUCCESS'));
  });

  test.skip('/transfers by batchId', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      batchId: 1,
    });

    expect(result.length).toBe(0);
  });

  test('/transfers overlapping timestamps', async () => {
    const now = Date.now();
    const MINUTE = 60 * 1000;
    await populateByMinutes(now, 2);
    await db.sync();

    const result = await transfer.findAll({
      startTimestamp: new Date(now - 3 * MINUTE).toISOString(),
      endTimestamp: new Date(now - MINUTE).toISOString(),
    });

    expect(result.length).toBeGreaterThan(0);
    result.forEach((item) => {
      const initiatedTime = new Date(item.initiatedTimestamp).getTime();
      expect(initiatedTime).toBeGreaterThanOrEqual(now - 3 * MINUTE);
      expect(initiatedTime).toBeLessThanOrEqual(now - MINUTE);
    });
  });

  test('/transfers empty dataset', async () => {
    const opts = {};
    await db.sync();
    const result = await transfer.findAll(opts);

    expect(result.length).toBe(0);
  });

  test('/transfers with mixed statuses', async () => {
    const now = Date.now();
    const MINUTE = 60 * 1000;

    await populateByMinutes(now, 5);
    await db.sync();

    const result = await transfer.findAll({
      startTimestamp: new Date(now - 4 * MINUTE).toISOString(),
      endTimestamp: new Date(now - MINUTE).toISOString(),
    });

    expect(result.length).toBe(30);

    result.forEach((item) => {
      console.log(item.status);
      expect(['SUCCESS', 'ERROR']).toContain(item.status);
    });
  });
  test('/transferStatusSummary', async () => {
    const now = Date.now();
    const MINUTE = 60 * 1000;
    await populateByMinutes(now, 5);
    await db.sync();
    const result = await transfer.statusSummary({
      startTimestamp: new Date(now - 4 * MINUTE).toISOString(),
      endTimestamp: new Date(now - MINUTE).toISOString(),
    });

    const expected = [
      { status: 'SUCCESS', count: 2 * 2 * 3 },
      { status: 'PENDING', count: 2 * 2 * 3 },
      { status: 'ERROR', count: 2 * 3 },
    ].sort((a, b) => a.status.localeCompare(b.status));
    expected.forEach((item) => {
      const matchingItem = result.find((r) => r.status === item.status);
      expect(matchingItem).toBeDefined();
      expect(matchingItem.count).toBe(item.count);
    });
  });

  test('/hourlyFlow no transfers', async () => {
    await db.sync();
    const result = await transfer.hourlyFlow({ hoursPrevious: 3 });

    expect(result).toEqual([]);
  });

  test('/minuteAverageTransferResponseTime no transfers', async () => {
    const now = Date.now();
    await db.sync();
    const result = await transfer.avgResponseTime({ minutePrevious: 3 });

    expect(result.length).toBe(0);
  });

  test('/transfers partial match on payee alias', async () => {
    const now = Date.now();
    await populateByMinutes(now, 5);

    await db.sync();
    const result = await transfer.findAll({
      recipientIdType: 'MSISDN',
    });

    expect(result.length).toBeGreaterThan(0);
    result.forEach((item) => {
      expect(item.recipientIdType).toBe('MSISDN');
    });
  });

  describe('Transfer - _transferLastErrorToErrorType', () => {
    test('should return errorDescription from mojaloopError when mojaloopError is present', () => {
      const err = {
        mojaloopError: {
          errorInformation: {
            errorDescription: 'Mojaloop error occurred',
          },
        },
      };

      const result = Transfer._transferLastErrorToErrorType(err);
      expect(result).toBe('Mojaloop error occurred');
    });

    test('should return HTTP status message when mojaloopError is not present', () => {
      const err = {
        httpStatusCode: 404,
      };

      const result = Transfer._transferLastErrorToErrorType(err);
      expect(result).toBe('HTTP 404');
    });

    test('should handle undefined error gracefully', () => {
      const err = {}; // Undefined error scenario
      const result = Transfer._transferLastErrorToErrorType(err);
      expect(result).toBe('HTTP undefined');
    });
  });

  describe('Transfer - _parseRawTransferRequestBodies', () => {
    test('should correctly parse stringified body fields to objects', () => {
      const transferRaw = {
        getPartiesRequest: { body: '{"field": "value"}' },
        quoteRequest: { body: '{"quote": "abc"}' },
        quoteResponse: { body: '{"response": "xyz"}' },
        prepare: { body: '{"prepare": true}' },
        fulfil: { body: '{"fulfilled": false}' },
      };

      const result = transfer._parseRawTransferRequestBodies(transferRaw);

      expect(result.getPartiesRequest.body).toEqual({ field: 'value' });
      expect(result.quoteRequest.body).toEqual({ quote: 'abc' });
      expect(result.quoteResponse.body).toEqual({ response: 'xyz' });
      expect(result.prepare.body).toEqual({ prepare: true });
      expect(result.fulfil.body).toEqual({ fulfilled: false });
    });

    test('should not modify body if it is already an object', () => {
      const transferRaw = {
        getPartiesRequest: { body: { field: 'value' } },
        quoteRequest: { body: { quote: 'abc' } },
        quoteResponse: { body: { response: 'xyz' } },
        prepare: { body: { prepare: true } },
        fulfil: { body: { fulfilled: false } },
      };

      const result = transfer._parseRawTransferRequestBodies(transferRaw);

      expect(result.getPartiesRequest.body).toEqual({ field: 'value' });
      expect(result.quoteRequest.body).toEqual({ quote: 'abc' });
      expect(result.quoteResponse.body).toEqual({ response: 'xyz' });
      expect(result.prepare.body).toEqual({ prepare: true });
      expect(result.fulfil.body).toEqual({ fulfilled: false });
    });

    test('should handle missing body fields without error', () => {
      const transferRaw = {
        getPartiesRequest: {},
        quoteRequest: {},
        quoteResponse: {},
        prepare: {},
        fulfil: {},
      };

      const result = transfer._parseRawTransferRequestBodies(transferRaw);

      expect(result.getPartiesRequest.body).toBeUndefined();
      expect(result.quoteRequest.body).toBeUndefined();
      expect(result.quoteResponse.body).toBeUndefined();
      expect(result.prepare.body).toBeUndefined();
      expect(result.fulfil.body).toBeUndefined();
    });
    test('should not mutate the original input object (no side-effects)', () => {
      const transferRaw = {
        getPartiesRequest: { body: '{"field": "value"}' },
        quoteRequest: { body: '{"quote": "abc"}' },
      };

      const clonedTransferRaw = JSON.parse(JSON.stringify(transferRaw)); // deep clone the input

      transfer._parseRawTransferRequestBodies(transferRaw);

      expect(transferRaw).toEqual(clonedTransferRaw); // ensure original object remains the same
    });
  });

  test('_convertToApiDetailFormat should correctly convert transfer data to API detail format', () => {
    const mockTransfer = {
      id: 'transfer-id',
      amount: '100.00',
      currency: 'USD',
      dfsp: 'bank-institution',
      direction: 1,
      success: 1,
      sender: 'sender-id',
      recipient: 'recipient-id',
      details: 'Transfer details here',
      raw: JSON.stringify({
        transactionType: 'payment',
        initiatedTimestamp: '2025-01-01T12:00:00Z',
        transferId: 'scheme-id',
        homeTransactionId: 'home-id',
        quoteRequest: {
          body: { quoteId: 'quote-id', transactionId: 'tx-id' },
          headers: { 'x-quote-header': 'header-value' },
        },
        quoteResponse: 'quote-response',
        getPartiesRequest: {
          headers: { 'x-header': 'header-value' },
          body: { party: 'payer' },
        },
        getPartiesResponse: 'get-parties-response',
        prepare: { headers: { 'x-prepare-header': 'value' }, body: { prepare: 'data' } },
        fulfil: 'fulfil-data',
        lastError: 'error-data',
      }),
    };

    const mockParsedRaw = {
      transactionType: 'payment',
      initiatedTimestamp: '2025-01-01T12:00:00Z',
      transferId: 'scheme-id',
      homeTransactionId: 'home-id',
      quoteRequest: {
        body: { quoteId: 'quote-id', transactionId: 'tx-id' },
        headers: { 'x-quote-header': 'header-value' },
      },
      quoteResponse: 'quote-response',
      getPartiesRequest: {
        headers: { 'x-header': 'header-value' },
        body: { party: 'payer' },
      },
      getPartiesResponse: 'get-parties-response',
      prepare: { headers: { 'x-prepare-header': 'value' }, body: { prepare: 'data' } },
      fulfil: 'fulfil-data',
      lastError: 'error-data',
    };

    const parseRawTransferRequestBodiesMock = jest.fn().mockReturnValue(mockParsedRaw);
    const getPartyFromQuoteRequestMock = jest.fn().mockReturnValue({ party: 'payer' });

    transfer._parseRawTransferRequestBodies = parseRawTransferRequestBodiesMock;
    transfer._getPartyFromQuoteRequest = getPartyFromQuoteRequestMock;

    const expectedResult = {
      id: 'transfer-id',
      amount: '100.00',
      currency: 'USD',
      type: 'payment',
      institution: 'bank-institution',
      direction: 'OUTBOUND',
      status: 'SUCCESS',
      confirmationNumber: 0,
      sender: 'sender-id',
      recipient: 'recipient-id',
      details: 'Transfer details here',
      initiatedTimestamp: '2025-01-01T12:00:00Z',
      technicalDetails: {
        schemeTransferId: 'scheme-id',
        homeTransferId: 'home-id',
        quoteId: 'quote-id',
        transactionId: 'tx-id',
        transferState: undefined,
        payerParty: { party: 'payer' },
        payeeParty: { party: 'payer' },
        getPartiesRequest: {
          headers: { 'x-header': 'header-value' },
          body: { party: 'payer' },
        },
        getPartiesResponse: 'get-parties-response',
        quoteRequest: {
          headers: { 'x-quote-header': 'header-value' },
          body: { quoteId: 'quote-id', transactionId: 'tx-id' },
        },
        quoteResponse: 'quote-response',
        transferPrepare: {
          headers: { 'x-prepare-header': 'value' },
          body: { prepare: 'data' },
        },
        transferFulfilment: 'fulfil-data',
        lastError: 'error-data',
      },
    };

    const result = transfer._convertToApiDetailFormat(mockTransfer);

    expect(result).toEqual(expectedResult);
    expect(parseRawTransferRequestBodiesMock).toHaveBeenCalledTimes(1);
    expect(getPartyFromQuoteRequestMock).toHaveBeenCalledTimes(2);
  });

  test('_getPartyFromQuoteRequest should return default values for undefined qr', () => {
    const result = transfer._getPartyFromQuoteRequest(undefined, 'payer');

    expect(result).toEqual({
      idType: '',
      idValue: '',
      idSubType: '',
      displayName: '',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      merchantClassificationCode: '',
      fspId: '',
      extensionList: '',
    });
  });

  test('_getPartyFromQuoteRequest should return correct party details for valid qr and payer', () => {
    const qr = {
      body: {
        payer: {
          partyIdInfo: {
            partyIdType: 'MSISDN',
            partyIdentifier: '12345',
            partySubIdOrType: 'subType',
            fspId: 'fsp-1',
          },
          name: 'Payer Name',
          personalInfo: {
            complexName: {
              firstName: 'First',
              middleName: 'Middle',
              lastName: 'Last',
            },
            dateOfBirth: '1990-01-01',
          },
          merchantClassificationCode: '1234',
        },
      },
    };

    const result = transfer._getPartyFromQuoteRequest(qr, 'payer');

    expect(result).toEqual({
      idType: 'MSISDN',
      idValue: '12345',
      idSubType: 'subType',
      displayName: 'Payer Name',
      firstName: 'First',
      middleName: 'Middle',
      lastName: 'Last',
      dateOfBirth: '1990-01-01',
      merchantClassificationCode: '1234',
      fspId: 'fsp-1',
      extensionList: undefined,
    });
  });

  test('_getPartyFromQuoteRequest should return undefined for invalid party type', () => {
    const qr = {
      body: {
        payer: {
          partyIdInfo: {
            partyIdType: 'MSISDN',
            partyIdentifier: '12345',
            partySubIdOrType: 'subType',
            fspId: 'fsp-1',
          },
          name: 'Payer Name',
          personalInfo: {
            complexName: {
              firstName: 'First',
              middleName: 'Middle',
              lastName: 'Last',
            },
            dateOfBirth: '1990-01-01',
          },
          merchantClassificationCode: '1234',
        },
      },
    };

    const result = transfer._getPartyFromQuoteRequest(qr, 'payee');

    expect(result).toBeUndefined();
  });

  describe('_complexNameToDisplayName', () => {
    test('should return undefined for null or undefined input', () => {
      const resultNull = transfer._complexNameToDisplayName(null);
      const resultUndefined = transfer._complexNameToDisplayName(undefined);

      expect(resultNull).toBeUndefined();
      expect(resultUndefined).toBeUndefined();
    });

    test('should return full name when all fields are present', () => {
      const complexName = {
        firstName: 'John',
        middleName: 'Paul',
        lastName: 'Doe',
      };

      const result = transfer._complexNameToDisplayName(complexName);

      expect(result).toBe('John Paul Doe');
    });

    test('should return name without middle name if middleName is missing', () => {
      const complexName = {
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = transfer._complexNameToDisplayName(complexName);

      expect(result).toBe('John Doe');
    });

    test('should return name with only first and middle names if last name is missing', () => {
      const complexName = {
        firstName: 'John',
        middleName: 'Paul',
      };

      const result = transfer._complexNameToDisplayName(complexName);

      expect(result).toBe('John Paul');
    });

    test('should return first name if middle and last names are missing', () => {
      const complexName = {
        firstName: 'John',
      };

      const result = transfer._complexNameToDisplayName(complexName);

      expect(result).toBe('John');
    });

    test('should handle missing first name', () => {
      const complexName = {
        middleName: 'Paul',
        lastName: 'Doe',
      };

      const result = transfer._complexNameToDisplayName(complexName);

      expect(result).toBe('Paul Doe');
    });

    test('should handle missing middle and last names', () => {
      const complexName = {
        firstName: 'John',
      };

      const result = transfer._complexNameToDisplayName(complexName);

      expect(result).toBe('John');
    });
  });

  describe('_convertToTransferParty', () => {
    test('should convert party object to transfer party format with displayName', () => {
      const party = {
        idType: 'some-id-type',
        idValue: 'some-id-value',
        idSubType: 'some-id-subtype',
        firstName: 'John',
        middleName: 'Paul',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        merchantClassificationCode: '12345',
        fspId: 'fsp-id',
        extensionList: ['extension1', 'extension2'],
      };

      const result = transfer._convertToTransferParty(party);

      expect(result).toEqual({
        type: '',
        idType: 'some-id-type',
        idValue: 'some-id-value',
        idSubType: 'some-id-subtype',
        displayName: 'John Paul Doe',
        firstName: 'John',
        middleName: 'Paul',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        merchantClassificationCode: '12345',
        fspId: 'fsp-id',
        extensionList: ['extension1', 'extension2'],
      });
    });

    test('should handle missing middle and last name, using only first name for displayName', () => {
      const party = {
        idType: 'some-id-type',
        idValue: 'some-id-value',
        idSubType: 'some-id-subtype',
        firstName: 'John',
      };

      const result = transfer._convertToTransferParty(party);

      expect(result.displayName).toBe('John');
    });

    test('should handle missing first and last name, using only middle name for displayName', () => {
      const party = {
        idType: 'some-id-type',
        idValue: 'some-id-value',
        idSubType: 'some-id-subtype',
        middleName: 'Paul',
      };

      const result = transfer._convertToTransferParty(party);

      expect(result.displayName).toBe('Paul');
    });

    test('should handle missing first and middle names, using only last name for displayName', () => {
      const party = {
        idType: 'some-id-type',
        idValue: 'some-id-value',
        idSubType: 'some-id-subtype',
        lastName: 'Doe',
      };

      const result = transfer._convertToTransferParty(party);

      expect(result.displayName).toBe('Doe');
    });

    test('should handle missing first, middle, and last names, returning an empty displayName', () => {
      const party = {
        idType: 'some-id-type',
        idValue: 'some-id-value',
        idSubType: 'some-id-subtype',
      };

      const result = transfer._convertToTransferParty(party);

      expect(result.displayName).toBe('');
    });
  });

  test('/findErrors', async () => {
    transfer._convertToApiFormat = jest.fn((row) => ({
      id: row.id,
      success: row.success === 1 ? true : false,
      amount: parseFloat(row.amount),
      currency: row.currency,
      dfsp: row.dfsp || 'mojaloop-sdk',
      direction: row.direction === 1 ? 'OUTBOUND' : 'INBOUND',
      sender: row.sender,
      recipient: row.recipient,
      details: row.details,
      status: 'ERROR',
      type: 'error',
      confirmationNumber: 0,
      initiatedTimestamp: row.initiatedTimestamp || undefined,
      institution: row.institution || 'bank',
      technicalDetails: {
        schemeTransferId: row.schemeTransferId || undefined,
        homeTransferId: row.homeTransferId || undefined,
        quoteId: row.quoteId || undefined,
        transactionId: row.transactionId || undefined,
        transferState: row.transferState || undefined,
        payerParty: row.payerParty || undefined,
        payeeParty: row.payeeParty || undefined,
      },
    }));

    const now = Date.now();
    await populateCache('USD', now, 1);
    await populateCache('EUR', now, 2);
    await db.sync();

    const result = await transfer.findErrors();

    const expected = [
      {
        id: expect.any(String),
        success: false,
        amount: 70,
        currency: 'USD',
        dfsp: 'mojaloop-sdk',
        direction: 'OUTBOUND',
        sender: expect.any(String),
        recipient: expect.any(String),
        details: expect.any(String),
        status: 'ERROR',
        type: 'error',
        confirmationNumber: 0,
        initiatedTimestamp: undefined,
        institution: 'bank',
        technicalDetails: {
          schemeTransferId: undefined,
          homeTransferId: undefined,
          quoteId: undefined,
          transactionId: undefined,
          transferState: undefined,
          payerParty: undefined,
          payeeParty: undefined,
        },
      },
      {
        id: expect.any(String),
        success: false,
        amount: 70,
        currency: 'EUR',
        dfsp: 'mojaloop-sdk',
        direction: 'OUTBOUND',
        sender: expect.any(String),
        recipient: expect.any(String),
        details: expect.any(String),
        status: 'ERROR',
        type: 'error',
        confirmationNumber: 0,
        initiatedTimestamp: undefined,
        institution: 'bank',
        technicalDetails: {
          schemeTransferId: undefined,
          homeTransferId: undefined,
          quoteId: undefined,
          transactionId: undefined,
          transferState: undefined,
          payerParty: undefined,
          payeeParty: undefined,
        },
      },
    ];

    expect(result).toMatchObject(expected);
    expect(transfer._convertToApiFormat).toHaveBeenCalledTimes(result.length);
  });
});
