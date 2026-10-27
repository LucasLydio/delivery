import express, { type Express } from 'express';
import { createApiRoutes, type RouteDependencies } from './routes';
import { exceptionHandler, notFoundHandler } from './shared/exceptions';
import { cors, requestContext } from './shared/middleware';

export function createApp(dependencies: RouteDependencies = {}): Express {
  const app = express();
  app.disable('etag');
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(cors);
  app.use(express.json({ limit: '1mb', type: 'application/json' }));

  const routes = createApiRoutes(dependencies);
  app.use('/api', routes);
  app.use('/.netlify/functions/api', routes);

  app.use(notFoundHandler);
  app.use(exceptionHandler);
  return app;
}

export const app = createApp();
