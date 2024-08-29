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

const TABLE_NAME = 'transfer';

export async function up(knex: Knex): Promise<any> {
  return knex.schema.createTable(TABLE_NAME, (table: Knex.TableBuilder) => {
    table.string('id').primary();
    table.string('redis_key').primary();
    table.boolean('success'); // TRUE - Fulfill, FALSE - Error, NULL - Pending
    table.string('sender');
    table.string('sender_id_type');
    table.string('sender_id_sub_value');
    table.string('sender_id_value');
    table.string('sender_currency');
    table.string('sender_amount');
    table.string('recipient');
    table.string('recipient_id_type');
    table.string('recipient_id_sub_value');
    table.string('recipient_id_value');
    table.string('amount');
    table.string('currency');
    table.integer('direction');
    table.string('batch_id');
    table.string('details');
    table.string('dfsp');
    table.integer('created_at');
    table.integer('completed_at');
    table.string('raw');
  });
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema.dropTable(TABLE_NAME);
}
