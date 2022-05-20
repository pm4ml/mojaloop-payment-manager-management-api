/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { AnyEventObject, assign, DoneEventObject, MachineConfig } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import _ from 'lodash';

export namespace ConnectorConfig {
  interface ConnectorConfig {
    peerJWSKeys?: Record<string, string>;
    jwsSigningKey?: string;
    outbound?: {
      tls: {
        creds: {
          cert?: string;
          key?: string;
        };
      };
    };
  }
  export interface Context {
    connectorConfig?: ConnectorConfig;
  }

  type UpdateAction =
    | { type: 'UPDATE_CONNECTOR_CONFIG'; config: ConnectorConfig }
    | { type: 'REQUEST_CONNECTOR_CONFIG' };

  export type Event = UpdateAction | DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'connectorConfig',
    initial: 'idle',
    on: {
      UPDATE_CONNECTOR_CONFIG: {
        target: '.updatingConfig',
        internal: false,
      },
      REQUEST_CONNECTOR_CONFIG: {
        target: '.propagatingConnectorConfig',
        internal: false,
      },
    },
    states: {
      idle: {},
      updatingConfig: {
        entry: assign({
          connectorConfig: (ctx: TContext, event: AnyEventObject) => ({
            ..._.merge({}, ctx.connectorConfig, event.config),
            ...(event.config?.peerJWSKeys && {
              peerJWSKeys: event.config.peerJWSKeys,
            }),
          }),
        }) as any,
        always: {
          target: 'propagatingConnectorConfig',
        },
      },
      propagatingConnectorConfig: {
        invoke: {
          id: 'propagateConnectorConfig',
          src: (ctx) =>
            invokeRetry({
              id: 'propagateConnectorConfig',
              logger: opts.logger,
              service: async () => opts.ControlServer.changeConfig(ctx.connectorConfig),
            }),
          onDone: {
            target: 'idle',
          },
        },
      },
    },
  });
}
