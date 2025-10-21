import SDK from '@mojaloop/sdk-standard-components';

export type Logger = SDK.Logger.SdkLogger;
export const logger = new SDK.Logger.SdkLogger('MAN_API');
