// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetDaemonConfigHydratedForTests,
  DEFAULT_CONFIG,
  mergeDaemonConfig,
  syncConfigToDaemon,
} from '../../src/state/config';

// Project locations are daemon-owned state mirrored back by every client. A
// client that has never hydrated holds the default EMPTY list, and pushing that
// is indistinguishable from "the user deleted every location" — which hides every
// project living outside the built-in directory. These cases pin the guard.
function captureBodies(): Array<Record<string, unknown>> {
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: { body?: string }) => {
    if (init?.body) bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return { ok: true, json: async () => ({ config: {} }) } as unknown as Response;
  }));
  return bodies;
}

afterEach(() => {
  vi.unstubAllGlobals();
  __resetDaemonConfigHydratedForTests();
  window.localStorage.clear();
});

describe('daemon config sync: project locations', () => {
  it('omits the location keys from a client that never hydrated', async () => {
    const bodies = captureBodies();
    await syncConfigToDaemon({ ...DEFAULT_CONFIG });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toHaveProperty('projectLocations');
    expect(bodies[0]).not.toHaveProperty('defaultProjectLocationId');
  });

  it('sends the location keys once the daemon config has been merged in', async () => {
    const bodies = captureBodies();
    const merged = mergeDaemonConfig(DEFAULT_CONFIG, {
      projectLocations: [{ id: 'mine', name: 'Mine', path: '/tmp/mine' }],
      defaultProjectLocationId: 'mine',
    });
    await syncConfigToDaemon(merged);
    expect(bodies[0]?.projectLocations).toEqual([{ id: 'mine', name: 'Mine', path: '/tmp/mine' }]);
    expect(bodies[0]?.defaultProjectLocationId).toBe('mine');
  });

  it('still lets a client that never hydrated declare a location it does hold', async () => {
    // The Settings dialog writes locations through the project-locations API, but
    // the mirror still has to carry a non-empty local list (a config restored from
    // disk, say) instead of dropping the user's folders.
    const bodies = captureBodies();
    await syncConfigToDaemon({
      ...DEFAULT_CONFIG,
      projectLocations: [{ id: 'mine', name: 'Mine', path: '/tmp/mine' }],
      defaultProjectLocationId: 'mine',
    });
    expect(bodies[0]?.projectLocations).toHaveLength(1);
    expect(bodies[0]?.defaultProjectLocationId).toBe('mine');
  });
});
