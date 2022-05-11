import { AnyEventObject, assign, DoneEventObject, DoneInvokeEvent, MachineConfig, sendParent } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace HubCA {
  export type Context = {
    hubCa?: {
      intermediateChain: string;
      rootCertificate: string;
    };
  };

  export enum EventOut {
    COMPLETED = 'NEW_HUB_CA_FETCHED',
  }

  type EventIn = DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, EventIn> => ({
    id: 'hubCA',
    initial: 'gettingHubCA',
    states: {
      gettingHubCA: {
        invoke: {
          src: () =>
            invokeRetry({
              id: 'getHubCA',
              logger: opts.logger,
              service: () => opts.hubCertificateModel.getHubCA(),
            }),
        },
        onDone: [
          {
            target: 'populatingHubCA',
            actions: assign({
              hubCa: (context, { data }) => data,
            }),
            cond: 'hasNewHubCA',
          },
          { target: 'retry' },
        ],
      },
      populatingHubCA: {
        invoke: {
          src: (ctx) =>
            invokeRetry({
              id: 'populateOutboundCertSDK',
              logger: opts.logger,
              service: async () =>
                opts.ControlServer.changeConfig({
                  outbound: {
                    tls: {
                      creds: {
                        ca: `${ctx.hubCa!.intermediateChain || ''}\n${ctx.hubCa!.rootCertificate}`.trim(),
                      },
                    },
                  },
                }),
            }),
          onDone: {
            target: 'gotNewCA',
          },
        },
      },
      gotNewCA: {
        always: {
          target: 'retry',
          actions: sendParent(EventOut.COMPLETED),
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
      event.data.rootCertificate !== ctx.hubCa!.rootCertificate ||
      event.data.intermediateChain !== ctx.hubCa!.intermediateChain,
  });
}
