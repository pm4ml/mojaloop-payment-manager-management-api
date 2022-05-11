import { assign, createMachine, forwardTo, interpret } from 'xstate';

describe('persistence', () => {
  it('persists actor state', (done) => {
    const machine = createMachine({
      id: 'parent',
      initial: 'inactive',
      states: {
        inactive: {
          on: { NEXT: 'active' },
        },
        active: {
          invoke: {
            id: 'counter',
            src: createMachine<{ count: number }>({
              initial: 'counting',
              context: { count: 40 },
              states: {
                counting: {
                  on: {
                    INC: {
                      target: 'checking',
                      actions: assign({ count: (ctx) => ctx.count + 1 }),
                    },
                  },
                },
                checking: {
                  always: [{ target: 'success', cond: (ctx) => ctx.count === 42 }, { target: 'counting' }],
                },
                success: {
                  type: 'final',
                },
              },
            }),
            onDone: 'success',
          },
          on: {
            INC: { actions: forwardTo('counter') },
          },
        },
        success: {
          type: 'final',
        },
      },
    });

    const service = interpret(machine).start();
    service.send('NEXT'); // counter invoked
    service.send('INC');

    const snapshot = service.getSnapshot();

    // delete (snapshot as any).actions;

    service.stop();

    const restoredService = interpret(machine)
      .onDone(() => {
        done();
      })
      .start(snapshot);

    expect(restoredService.children.get('counter')?.getSnapshot().context).toEqual({ count: 41 });

    restoredService.send('INC');
  });
});
