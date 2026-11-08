import type { Express } from 'express';
import { sendApiError } from '../http/api-errors.js';

// Retire upstream cloud APIs before their legacy handlers can read account
// credentials or initiate network calls. Local projects, files and exports
// continue through their existing authorization and persistence boundaries.
const RETIRED_CLOUD_PATHS = [
  /^\/api\/(?:amr|workspace|workspaces|collab|public-file-stops)(?:\/|$)/u,
  /^\/api\/integrations\/vela(?:\/|$)/u,
  /^\/api\/projects\/[^/]+\/(?:collab|presence|share-state)(?:\/|$)/u,
  /^\/api\/projects\/[^/]+\/files\/.+\/(?:share-plan|publish-public)(?:\/|$)/u,
  /^\/api\/(?:skills|design-systems|plugins)\/(?:team|[^/]+\/share)(?:\/|$)/u,
  /^\/api\/social-share(?:\/|$)/u,
];

export function isRetiredCloudApiPath(path: string): boolean {
  return RETIRED_CLOUD_PATHS.some((pattern) => pattern.test(path));
}

export function registerPersonalEditionRoutes(app: Express): void {
  app.use((req, res, next) => {
    if (!isRetiredCloudApiPath(req.path)) return next();
    sendApiError(res, 410, 'NOT_FOUND', 'Official cloud features are not available in the personal edition.');
  });
}
