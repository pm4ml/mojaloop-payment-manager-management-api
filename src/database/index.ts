/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2021 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

import knex from 'knex';
import { IConfigDatabase } from '@app/config';
import knexfile from './knexfile';

export default (config: IConfigDatabase) => {
  return knex({
    ...config,
    ...knexfile,
  });
};
