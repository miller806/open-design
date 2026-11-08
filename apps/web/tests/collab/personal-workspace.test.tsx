// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveCurrentWorkspaceContextReadWitness,
  useWorkspaceContext,
} from '../../src/collab/useWorkspaceContext';

afterEach(() => vi.unstubAllGlobals());

describe('personal workspace', () => {
  it('settles as local without discovering or polling an official account', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useWorkspaceContext());
    expect(result.current).toMatchObject({
      context: null, resourceReadIdentity: null, loading: false,
      identityChangePending: false, failure: 'unsupported',
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
