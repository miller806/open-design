import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readAppConfig, writeAppConfig } from '../src/app-config.js';
import { getAgentDef, SHIPPED_AGENT_DEFS } from '../src/runtimes/registry.js';

describe('personal edition runtime', () => {
  it('ships local agents and the BYOK adapter without the official cloud runtime', () => {
    expect(SHIPPED_AGENT_DEFS.map((agent) => agent.id)).toEqual(
      expect.arrayContaining(['codex', 'claude', 'byok-opencode']),
    );
    expect(getAgentDef('amr')).toBeNull();
  });

  it('requires a fresh local selection for a saved cloud runtime without losing project preferences', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'od-personal-runtime-'));
    try {
      const legacy = {
        agentId: 'amr', onboardingCompleted: true,
        designSystemId: 'vercel', agentModels: { amr: { model: 'cloud-model' }, codex: { model: 'default' } },
      };
      await writeFile(path.join(dataDir, 'app-config.json'), JSON.stringify(legacy));
      const config = await readAppConfig(dataDir);
      expect(config.agentId).toBeNull();
      expect(config.onboardingCompleted).toBe(false);
      expect(config.designSystemId).toBe('vercel');
      expect(config.agentModels).toEqual({ codex: { model: 'default' } });
      await writeAppConfig(dataDir, legacy);
      expect((await readAppConfig(dataDir)).agentId).toBeNull();
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
