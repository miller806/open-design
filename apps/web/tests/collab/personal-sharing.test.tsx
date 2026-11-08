// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPublishPublicFile } from '../../src/collab/public-file-publish';
import { useProjectShareHistoryState } from '../../src/components/share/useProjectShareHistory';
import { useShareGuideAppUserId } from '../../src/components/share/useShareGuideAppUserId';
import { workspaceContextFixture } from '../helpers/workspace-context';

afterEach(() => vi.unstubAllGlobals());

describe('personal edition sharing', () => {
  it('does not re-enable publication from a stale signed-in workspace', () => {
    expect(canPublishPublicFile(workspaceContextFixture({ workspaceId: 'retired', workspaceMemberId: 'retired-member' }))).toBe(false);
  });

  it('opens artifacts without discovering an official identity or reading sharing history', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => ({
      accountId: useShareGuideAppUserId(),
      sharing: useProjectShareHistoryState('local-project', null, 'local-file'),
    }));
    expect(result.current.accountId).toBeNull();
    expect(result.current.sharing).toEqual({ history: null, status: 'idle' });
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
  });
});
