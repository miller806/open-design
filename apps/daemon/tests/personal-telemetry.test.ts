import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPosthogConfig, readPublicConfigResponse } from '../src/analytics.js';
import { readAppConfig, readMetricsConsent, writeAppConfig } from '../src/app-config.js';
import { diagnosticRelayUrl } from '../src/integrations/diagnostic-relay.js';
import {
  readLangfuseConfig, readTelemetrySinkConfig, readRunTelemetrySinkConfig,
  readTaskTelemetrySinkConfig, readFeedbackTelemetrySinkConfig,
} from '../src/langfuse-trace.js';

describe('personal edition has no telemetry destination', () => {
  const env = {
    POSTHOG_KEY: 'legacy-key', POSTHOG_HOST: 'https://metrics.example',
    LANGFUSE_PUBLIC_KEY: 'legacy-public', LANGFUSE_SECRET_KEY: 'legacy-secret',
    OPEN_DESIGN_TELEMETRY_RELAY_URL: 'https://relay.example/ingest',
    OPEN_DESIGN_VELA_TELEMETRY: 'true',
  };

  it('ignores inherited telemetry settings instead of enabling an uploader', () => {
    expect(readPosthogConfig(env)).toBeNull();
    expect(readPublicConfigResponse(env)).toMatchObject({ enabled: false, key: null, host: null });
    expect(readLangfuseConfig(env)).toBeNull();
    expect(readTelemetrySinkConfig(env)).toBeNull();
    expect(readRunTelemetrySinkConfig(env)).toBeNull();
    expect(readTaskTelemetrySinkConfig(env)).toBeNull();
    expect(readFeedbackTelemetrySinkConfig(env)).toBeNull();
    expect(diagnosticRelayUrl(env)).toBeNull();
  });

  it('normalizes saved opt-ins on read and persists disabled channels on write', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'od-personal-telemetry-'));
    const disabled = { metrics: false, content: false, artifactManifest: false };
    try {
      await writeFile(path.join(dataDir, 'app-config.json'), JSON.stringify({
        telemetry: { metrics: true, content: true, artifactManifest: true },
        designSystemId: 'vercel',
      }));
      expect((await readAppConfig(dataDir)).telemetry).toEqual(disabled);
      expect((await readMetricsConsent(dataDir)).metrics).toBe(false);
      await writeAppConfig(dataDir, { telemetry: { metrics: true, content: true } });
      const saved = JSON.parse(await readFile(path.join(dataDir, 'app-config.json'), 'utf8'));
      expect(saved.telemetry).toEqual(disabled);
      expect(saved.designSystemId).toBe('vercel');
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
