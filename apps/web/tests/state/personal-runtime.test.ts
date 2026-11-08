import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, mergeDaemonConfig } from '../../src/state/config';

describe('personal edition runtime migration', () => {
  it('does not restore an official cloud selection from daemon preferences', () => {
    const next = mergeDaemonConfig({ ...DEFAULT_CONFIG }, {
      agentId: 'amr', onboardingCompleted: true,
      agentModels: { amr: { model: 'cloud-model' }, codex: { model: 'default' } },
    });
    expect(next.agentId).toBeNull();
    expect(next.onboardingCompleted).toBe(false);
    expect(next.agentModels).toEqual({ codex: { model: 'default' } });
  });

  it('preserves a configured local agent and its selected model', () => {
    const next = mergeDaemonConfig({ ...DEFAULT_CONFIG }, {
      agentId: 'codex', onboardingCompleted: true,
      agentModels: { codex: { model: 'default' } },
    });
    expect(next.agentId).toBe('codex');
    expect(next.onboardingCompleted).toBe(true);
    expect(next.agentModels?.codex?.model).toBe('default');
  });

  it('preserves API mode and onboarding when only a stale cloud agent id remains', () => {
    const next = mergeDaemonConfig({ ...DEFAULT_CONFIG, mode: 'api', agentId: 'amr', onboardingCompleted: true }, null);
    expect(next.mode).toBe('api');
    expect(next.agentId).toBeNull();
    expect(next.onboardingCompleted).toBe(true);
  });
});
