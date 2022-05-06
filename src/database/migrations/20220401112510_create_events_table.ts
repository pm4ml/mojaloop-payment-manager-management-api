/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/
import { Knex } from 'knex';

const TABLE_NAME = 'events';

exports.up = (knex: Knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.string('id').primary();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.integer('created_by');
    table.string('type');
    table.json('data');
  });

exports.down = (knex: Knex) => knex.schema.dropTableIfExists(TABLE_NAME);
