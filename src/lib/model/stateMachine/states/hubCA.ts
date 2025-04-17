/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { AnyEventObject, assign, DoneEventObject, MachineConfig, send } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace HubCA {
  export type Context = {
    hubCa?: {
      intermediateChain: string;
      rootCertificate: string;
    };
  };

  export type Event =
    | DoneEventObject
    | { type: 'NEW_HUB_CA_FETCHED' }
    | { type: 'FETCHING_HUB_CA' }
    | { type: 'HUB_CA_CHECKING_NEW' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'hubCA',
    initial: 'gettingHubCA',
    states: {
      gettingHubCA: {
        entry: send('FETCHING_HUB_CA'),
        invoke: {
          id: 'getHubCA',
          src: () =>
            invokeRetry({
              id: 'getHubCA',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'HUB_CA',
              state: 'gettingHubCA',
              service: async () => opts.hubCertificateModel.getHubCA(),
            }),
          onDone: [
            {
              target: 'gotNewCA',
              actions: [
                assign({
                  hubCa: (context, { data }) => data,
                }),
                send((ctx) => ({
                  type: 'UPDATE_CONNECTOR_CONFIG',
                  config: {
                    outbound: {
                      tls: {
                        creds: {
                          ca: `${ctx.hubCa!.intermediateChain || ''}\n${ctx.hubCa!.rootCertificate}`.trim(),
                        },
                      },
                    },
                  },
                })),
              ],
              cond: 'hasNewHubCA',
            },
            { target: 'retry' },
          ],
        },
      },
      gotNewCA: {
        entry: send('HUB_CA_CHECKING_NEW'),
        always: {
          target: 'retry',
          actions: send('NEW_HUB_CA_FETCHED'),
        },
      },
      retry: {
        after: {
          [opts.refreshIntervalSeconds * 1000]: { target: 'gettingHubCA' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>() => ({
    hasNewHubCA: (ctx: TContext, event: AnyEventObject) =>
      event.data.rootCertificate !== ctx.hubCa?.rootCertificate ||
      event.data.intermediateChain !== ctx.hubCa?.intermediateChain,
  });
}
