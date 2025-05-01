/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

import { logger } from '@app/lib/logger';
import { createMemoryCache } from '@app/lib/cacheDatabase';
import transferTemplate from './data/transferTemplate.json';
import lastError from './data/lastError.json';

const createTestDb = async () => {
  return createMemoryCache({
    cacheUrl: 'redis://dummyhost:1234',
    logger,
    manualSync: true,
  });
};

const addTransferToCache = async (db, opts) => {
  const transfer = JSON.parse(JSON.stringify(transferTemplate));
  transfer.transferId = opts.transferId || transfer.transferId;
  transfer.amountType = opts.amountType || transfer.amountType;
  transfer.currency = opts.currency || transfer.currency;
  transfer.amount = opts.amount || transfer.amount;
  transfer.transactionType = opts.transactionType || transfer.transactionType;
  transfer.currentState = opts.currentState || transfer.currentState;
  if (opts.currentState === 'errored') {
    transfer.lastError = JSON.parse(JSON.stringify(lastError));
  }
  transfer.initiatedTimestamp = opts.initiatedTimestamp || transfer.initiatedTimestamp;
  if (opts.isPending) {
    delete transfer.fulfil;
  } else {
    transfer.fulfil.body.completedTimestamp = opts.completedTimestamp || transfer.fulfil.body.completedTimestamp;
  }

  await db.redisCache().set(`transferModel_${opts.transferId}`, JSON.stringify(transfer));

  return transfer;
};

export { createTestDb, addTransferToCache };
