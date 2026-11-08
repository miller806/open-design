// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntryTopRightCluster, WorkspaceTopRightAccountCluster } from '../../src/components/EntryNavRail';
import { workspaceContextFixture } from '../helpers/workspace-context';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('personal edition chrome', () => {
  it('keeps the updater while dropping cloud chrome even with stale workspace props', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<EntryTopRightCluster
      page="home"
      context={workspaceContextFixture({ workspaceId: 'retired-workspace', workspaceMemberId: 'retired-member' })}
      leadingSlot={<span>Cloud campaign</span>}
      inviteSlot={<span>Invite teammates</span>}
      updaterSlot={<span>Local update control</span>}
    />);
    expect(screen.getByText('Local update control')).toBeTruthy();
    expect(screen.queryByText('Cloud campaign')).toBeNull();
    expect(screen.queryByText('Invite teammates')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not read workspace billing when opening a local project', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkspaceTopRightAccountCluster updaterSlot={<span>Local update control</span>} />);
    expect(screen.getByText('Local update control')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
