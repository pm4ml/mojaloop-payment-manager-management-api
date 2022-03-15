/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

//const { Errors } = require('@mojaloop/sdk-standard-components');


class Transfer {
    constructor(opts) {
        this._db = opts.db;
        this._logger = opts.logger;
    }

    static STATUSES = {
        null: 'PENDING',
        1: 'SUCCESS',
        0: 'ERROR',
    };

    _convertToApiFormat(transfer) {
        const raw = JSON.parse(transfer.raw);

        return {
            id: transfer.id,
            batchId: transfer.batch_id,
            institution: transfer.dfsp,
            direction: transfer.direction > 0 ? 'OUTBOUND' : 'INBOUND',
            currency: transfer.currency,
            amount: transfer.amount,
            type: 'P2P',
            status: Transfer.STATUSES[transfer.success],
            initiatedTimestamp: new Date(transfer.created_at).toISOString(),
            confirmationNumber: 0, // TODO: Implement
            sender: transfer.sender,
            recipient: transfer.recipient,
            details: transfer.details,
            errorType: transfer.success === 0 ? Transfer._transferLastErrorToErrorType(raw.lastError) : null,
        };
    }

    static _transferLastErrorToErrorType(err) {
        if (err.mojaloopError) {
            return err.mojaloopError.errorInformation.errorDescription;
        }
        return `HTTP ${err.httpStatusCode}`;
    }

    _parseRawTransferRequestBodies(transferRaw) {
        // operate on a copy of incoming object...we dont want side effects
        const raw = JSON.parse(JSON.stringify(transferRaw));

        if(raw.getPartiesRequest && typeof(raw.getPartiesRequest.body) === 'string') {
            raw.getPartiesRequest.body = JSON.parse(raw.getPartiesRequest.body);
        }
        if(raw.quoteRequest && typeof(raw.quoteRequest.body) === 'string') {
            raw.quoteRequest.body = JSON.parse(raw.quoteRequest.body);
        }
        if(raw.quoteResponse && typeof(raw.quoteResponse.body) === 'string') {
            raw.quoteResponse.body = JSON.parse(raw.quoteResponse.body);
        }
        if(raw.prepare && typeof(raw.prepare.body) === 'string') {
            raw.prepare.body = JSON.parse(raw.prepare.body);
        }
        if(raw.fulfil && typeof(raw.fulfil.body) === 'string') {
            raw.fulfil.body = JSON.parse(raw.fulfil.body);
        }

        return raw;
    }

    _convertToApiDetailFormat(transfer) {
        let raw = JSON.parse(transfer.raw);
        raw = this._parseRawTransferRequestBodies(raw);

        return {
            id: transfer.id,
            amount: transfer.amount,
            currency: transfer.currency,
            type: raw.transactionType,
            institution: transfer.dfsp,
            direction: transfer.direction > 0 ? 'OUTBOUND' : 'INBOUND',
            status: Transfer.STATUSES[transfer.success],
            confirmationNumber: 0, // TODO: Implement
            sender: transfer.sender,
            recipient: transfer.recipient,
            details: transfer.details,
            initiatedTimestamp: raw.initiatedTimestamp,
            technicalDetails: {
                schemeTransferId: raw.transferId,
                homeTransferId: raw.homeTransactionId,
                quoteId: raw.quoteRequest && raw.quoteRequest.body && raw.quoteRequest.body.quoteId,
                transactionId: raw.quoteRequest && raw.quoteRequest.body && raw.quoteRequest.body.transactionId,
                transferState: raw.currentState,
                payerParty: this._getPartyFromQuoteRequest(raw.quoteRequest, 'payer'),
                payeeParty: this._getPartyFromQuoteRequest(raw.quoteRequest, 'payee'),
                getPartiesRequest: {
                    headers: raw.getPartiesRequest && raw.getPartiesRequest.headers,
                    body: raw.getPartiesRequest && raw.getPartiesRequest.body,
                },
                getPartiesResponse: raw.getPartiesResponse,
                quoteRequest: {
                    headers: raw.quoteRequest && raw.quoteRequest.headers,
                    body: raw.quoteRequest && raw.quoteRequest.body,
                },
                quoteResponse: raw.quoteResponse,
                transferPrepare: {
                    headers: raw.prepare && raw.prepare.headers,
                    body: raw.prepare && raw.prepare.body,
                },
                transferFulfilment: raw.fulfil,
                lastError: raw.lastError,
            }
        };
    }

    _getPartyFromQuoteRequest(qr, partyType) {

        if(qr == undefined) {
            return {
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
            };
        }

        const p = qr.body[partyType];

        if(!p) {
            return;
        }

        return {
            idType: p.partyIdInfo && p.partyIdInfo.partyIdType,
            idValue: p.partyIdInfo && p.partyIdInfo.partyIdentifier,
            idSubType: p.partyIdInfo && p.partyIdInfo.partySubIdOrType,
            displayName: p.name || (p.personalInfo && this._complexNameToDisplayName(p.personalInfo.complexName)),
            firstName: p.personalInfo && p.personalInfo.complexName && p.personalInfo.complexName.firstName,
            middleName: p.personalInfo && p.personalInfo.complexName && p.personalInfo.complexName.middleName,
            lastName: p.personalInfo && p.personalInfo.complexName && p.personalInfo.complexName.lastName,
            dateOfBirth: p.personalInfo && p.personalInfo.dateOfBirth,
            merchantClassificationCode: p.merchantClassificationCode,
            fspId: p.partyIdInfo && p.partyIdInfo.fspId,
            extensionList: p.partyIdInfo && p.partyIdInfo.extensionList && p.partyIdInfo.extensionList.extension,
        };
    }

    _complexNameToDisplayName(p) {
        if(!p) {
            return;
        }
        // Since any of the firstName/middleName/lastName can be undefined/null we need to concatenate conditionally and then trim
        return `${p.firstName ? p.firstName : ''}${p.middleName ? ' ' + p.middleName : ''} ${p.lastName ? p.lastName : ''}`.trim();
    }

    _convertToTransferParty(party) {
        return {
            type: '',
            idType: party.idType,
            idValue: party.idValue,
            idSubType: party.idSubType,
            displayName: party.displayName || `${party.firstName ? party.firstName : ''}${party.middleName ? ' ' + party.middleName : ''} ${party.lastName ? party.lastName : ''}`.trim(),
            firstName: party.firstName,
            middleName: party.middleName,
            lastName: party.lastName,
            dateOfBirth: party.dateOfBirth,
            merchantClassificationCode: party.merchantClassificationCode,
            fspId: party.fspId,
            extensionList: party.extensionList,
        };
    }

    /**
     *
     * @param opts {Object}
     * @param [opts.startTimestamp] {string}
     * @param [opts.endTimestamp] {string}
     * @param [opts.recipient] {string}
     * @param [opts.direction] {string}     
     * @param [opts.institution] {string}
     * @param [opts.batchId] {number}
     * @param [opts.status] {string}
     * @param [opts.limit] {number}
     * @param [opts.offset] {number}
     */
    async findAll(opts) {
        const DEFAULT_LIMIT = 100;

        const query = this._db('transfer').whereRaw('true');
        if (opts.id) {
            query.andWhere('id', 'LIKE', `%${opts.id}%`);
        }
        if (opts.startTimestamp) {
            query.andWhere('created_at', '>=', new Date(opts.startTimestamp).getTime());
        }
        if (opts.endTimestamp) {
            query.andWhere('created_at', '<', new Date(opts.endTimestamp).getTime());
        }
        if (opts.recipient) {
            query.andWhere('recipient', 'LIKE', `%${opts.recipient}%`);
        }
        if (opts.direction) {
            query.andWhere('direction', 'LIKE', `%${opts.direction}%`);
        }
        if (opts.institution) {
            query.andWhere('dfsp', 'LIKE', `%${opts.institution}%`);
        }
        if (opts.batchId) {
            query.andWhere('batchId', 'LIKE', `%${opts.batchId}%`);
        }
        if (opts.status) {
            if (opts.status === 'PENDING') {
                query.andWhereRaw('success IS NULL');
            } else {
                query.andWhere('success', opts.status === 'SUCCESS');
            }
        }
        if (opts.offset) {
            query.offset(opts.offset);
        }
        query.limit(opts.limit || DEFAULT_LIMIT);
        query.orderBy('created_at');

        const rows = await query;
        return rows.map(this._convertToApiFormat.bind(this));
    }

    /**
     *
     * @param id {string}
     */
    async findOne(id) {
        const row = await this._db('transfer').where('id', id);
        return this._convertToApiFormat(row);
    }

    /**
     *
     * @param id {string}
     */
    async findOneDetail(id) {
        const rows = await this._db('transfer').where('id', id);
        if(rows.length > 0) {
            return this._convertToApiDetailFormat(rows[0]);
        }
        return null;
    }


    async findErrors() {
        const rows = await this._db('transfer').where('success', false);
        return rows.map(this._convertToApiFormat.bind(this));
    }


    /**
     *
     * @param opts {Object}
     * @param [opts.minutePrevious] {number}
     */
    async successRate(opts) {
        const now = Date.now();
        const statQuery = (successOnly) => {
            const query = this._db('transfer')
                .count('id as count')
                .select(this._db.raw('MIN(((created_at) / (60 * 1000)) * 60 * 1000) as timestamp'))  // trunc (milli)seconds
                .whereRaw(`(${now} - created_at) < ${(opts.minutePrevious || 10) * 60 * 1000}`);
            if (successOnly) {
                query.andWhere('success', true);
            }
            query.groupByRaw('created_at / (60 * 1000)');
            return query;
        };

        const successStat = await statQuery(true);
        const allStat = await statQuery(false);
        return allStat.map(({timestamp, count}) => {
            const successRow = successStat.find(row => row.timestamp === timestamp);
            const successCount = successRow ? successRow.count : 0;
            return {
                timestamp,
                percentage: Math.trunc((successCount / count) * 100),
            };
        });
    }

    /**
     *
     * @param opts {Object}
     * @param [opts.minutePrevious] {number}
     */
    async avgResponseTime(opts) {
        const now = Date.now();
        const avgRespTimeQuery = () => {
            return this._db('transfer')
                .select(this._db.raw('AVG(completed_at - created_at) as averageResponseTime'))  // trunc (milli)seconds
                .select(this._db.raw('MIN(((created_at) / (60 * 1000)) * 60 * 1000) as timestamp'))  // trunc (milli)seconds
                .whereRaw(`(${now} - created_at) < ${(opts.minutePrevious || 10) * 60 * 1000}`)
                .andWhereRaw('success IS NOT NULL')
                .andWhereRaw('completed_at IS NOT NULL')
                .andWhereRaw('created_at IS NOT NULL')
                .groupByRaw('created_at / (60 * 1000)');
        };

        const rows = await avgRespTimeQuery();
        return rows;
    }

    /**
     *
     * @param opts {Object}
     * @param [opts.hoursPrevious] {number}
     */
    async hourlyFlow(opts) {
        const now = Date.now();
        const flowQuery = () => {
            return this._db('transfer')
                .select('direction', 'currency')
                .sum('amount as sum')
                .select(this._db.raw('MIN(((created_at) / (3600 * 1000)) * 3600 * 1000) as timestamp'))  // trunc (milli)seconds
                .whereRaw(`(${now} - created_at) < ${(opts.hoursPrevious || 10) * 3600 * 1000}`)
                // .andWhere('success', true)
                .groupByRaw('created_at / (3600 * 1000), currency, direction');
        };

        const flowStat = await flowQuery();
        const stat = {};
        for (const row of flowStat) {
            const k = `${row.timestamp}_${row.currency}`;
            if (!stat[k]) {
                stat[k] = {
                    timestamp: row.timestamp,
                    currency: row.currency,
                    inbound: 0,
                    outbound: 0,
                };
            }
            if (row.direction > 0) {
                stat[k].outbound = row.sum;
            } else {
                stat[k].inbound = row.sum;
            }
        }
        return Object.values(stat);
    }

    /**
     *
     * @param opts {Object}
     * @param [opts.startTimestamp] {string}
     * @param [opts.endTimestamp] {string}
     */
    async statusSummary(opts) {
        const statusQuery = () => {
            const query = this._db('transfer')
                .select('success')
                .count('id as count').whereRaw('true');
            if (opts.startTimestamp) {
                query.andWhere('created_at', '>=', new Date(opts.startTimestamp).getTime());
            }
            if (opts.endTimestamp) {
                query.andWhere('created_at', '<', new Date(opts.endTimestamp).getTime());
            }
            query.groupBy('success');
            return query;
        };
        const rows = await statusQuery();

        let ret = {};

        Object.keys(Transfer.STATUSES).map(k => {
            ret[Transfer.STATUSES[k]] = {
                status: Transfer.STATUSES[k],
                count: 0,
            };
        });

        rows.forEach(r => {
            ret[Transfer.STATUSES[r.success]] = {
                status: Transfer.STATUSES[r.success],
                count: r.count
            };
        });

        return Object.keys(ret).map(r => ret[r]);
    }
}

Transfer.cachedKeys = [];

module.exports = Transfer;
