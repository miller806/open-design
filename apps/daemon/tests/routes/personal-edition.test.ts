import express from 'express';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { isRetiredCloudApiPath, registerPersonalEditionRoutes } from '../../src/routes/personal-edition.js';

describe('retired cloud endpoints', () => {
  it.each([
    '/api/amr/models', '/api/integrations/vela/login', '/api/workspace/billing',
    '/api/workspaces/old/projects', '/api/projects/local/presence/heartbeat',
    '/api/projects/local/collab/publish', '/api/projects/local/share-state',
    '/api/projects/local/files/pages/index.html/publish-public',
    '/api/projects/local/files/index.html/share-plan', '/api/design-systems/brand/share',
    '/api/skills/team', '/api/plugins/plugin/share', '/api/public-file-stops/retry',
  ])('retires %s', (path) => expect(isRetiredCloudApiPath(path)).toBe(true));

  it.each([
    '/api/projects', '/api/projects/local', '/api/projects/local/files',
    '/api/projects/local/files/share-plan.html', '/api/projects/local/files/pages/index.html/versions',
    '/api/projects/local/export/html', '/api/agents', '/api/test/connection',
    '/api/provider/models', '/api/design-systems', '/api/skills', '/api/plugins',
    '/api/workspace-tools-local', '/api/projects/local/events',
  ])('keeps local API %s', (path) => expect(isRetiredCloudApiPath(path)).toBe(false));

  it('returns a machine-readable retirement error without invoking a legacy handler', async () => {
    const app = express();
    registerPersonalEditionRoutes(app);
    let legacyCalls = 0;
    app.post('/api/integrations/vela/login', (_req, res) => { legacyCalls += 1; res.json({ unexpected: true }); });
    app.get('/api/projects', (_req, res) => { res.json({ projects: [] }); });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const retired = await fetch(`${base}/api/integrations/vela/login`, { method: 'POST' });
      expect(retired.status).toBe(410);
      expect(await retired.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
      expect(legacyCalls).toBe(0);
      expect((await fetch(`${base}/api/projects`)).status).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
