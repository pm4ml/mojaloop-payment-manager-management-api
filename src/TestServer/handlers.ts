/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

const healthCheck = async (ctx) => {
  ctx.body = { status: 'ok' };
};

const getStateMachineContext = async (ctx) => {
  ctx.body = ctx.state.stateMachine.getContext();
};

const started = async (ctx) => {
  ctx.body = ctx.state.stateMachine.started;
};

export const createHandlers = () => ({
  '/ready': {
    get: started,
  },
  '/health': {
    get: healthCheck,
  },
  '/state': {
    get: getStateMachineContext,
  },
});
