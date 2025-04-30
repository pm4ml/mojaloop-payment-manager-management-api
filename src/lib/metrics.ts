import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import stoppable from 'stoppable';
import mlMetrics from '@mojaloop/central-services-metrics';
import Logger from '@app/lib/logger';

const METRICS_ROUTE = '/metrics';

export type MetricsServer = {
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
};

type MetricsOptions = {
  port: number;
  config: {
    timeout: number; // ms
    prefix: string;
    defaultLabels?: Record<string, string>;
  };
  logger: Logger;
};

export const createMetricsServer = ({ port, config, logger }: MetricsOptions): MetricsServer => {
  mlMetrics.setup(config);

  const server = stoppable(
    createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === METRICS_ROUTE) {
        const metricsData = await mlMetrics.getMetricsForPrometheus();
        const { contentType } = mlMetrics.getDefaultRegister();

        res.setHeader('Content-Type', contentType);
        res.end(metricsData);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }),
    1000,
  );

  return {
    start: async () => {
      return new Promise((resolve) => {
        server.listen(port, () => {
          logger.log(`metrics-server is listening on port ${port}...`);
          resolve(true);
        });
      });
    },
    stop: async () =>
      new Promise((resolve) => {
        server.stop((err) => {
          if (err) {
            logger.warn('metrics-server failed to stop: ', err);
            resolve(false);
          } else {
            logger.log('metrics-server stopped successfully');
            resolve(true);
          }
        });
      }),
  };
};
