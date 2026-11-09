// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveCurrentWorkspaceContextReadWitness,
  useWorkspaceContext,
} from '../../src/collab/useWorkspaceContext';
import { PersonalModeProvider, setPersonalModeFlag } from '../../src/lib/personal-mode';

beforeEach(() => {
  // Upstream disables personal mode under NODE_ENV=test; this spec is about it.
  setPersonalModeFlag(true);
});

afterEach(() => {
  setPersonalModeFlag(false);
  vi.unstubAllGlobals();
});

describe('personal workspace', () => {
  it('settles as local without discovering or polling an official account', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // The hook reads the context; the module flag covers non-React call sites.
    const { result, unmount } = renderHook(() => useWorkspaceContext(), {
      wrapper: ({ children }) => <PersonalModeProvider enabled>{children}</PersonalModeProvider>,
    });
    expect(result.current).toMatchObject({
      context: null, resourceReadIdentity: null, loading: false,
      identityChangePending: false,
    });
    unmount();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens an unbound project without consulting the cloud workspace directory', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const witness = await resolveCurrentWorkspaceContextReadWitness({ fresh: true });
    expect(witness.context).toBeNull();
    expect(witness.isStillCurrent()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
