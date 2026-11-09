// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryTopRightCluster, WorkspaceTopRightAccountCluster } from '../../src/components/EntryNavRail';
import { PersonalModeProvider, setPersonalModeFlag } from '../../src/lib/personal-mode';
import { workspaceContextFixture } from '../helpers/workspace-context';

beforeEach(() => setPersonalModeFlag(true));

afterEach(() => {
  setPersonalModeFlag(false);
  cleanup();
  vi.unstubAllGlobals();
});

describe('personal edition chrome', () => {
  it('keeps the updater while dropping cloud chrome even with stale workspace props', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<PersonalModeProvider enabled><EntryTopRightCluster
      page="home"
      context={workspaceContextFixture({ workspaceId: 'retired-workspace', workspaceMemberId: 'retired-member' })}
      leadingSlot={<span>Caller slot</span>}
      inviteSlot={<span>Invite teammates</span>}
      updaterSlot={<span>Local update control</span>}
    /></PersonalModeProvider>);
    expect(screen.getByText('Local update control')).toBeTruthy();
    // Invites and the GitHub star chip are community/cloud chrome.
    expect(screen.queryByText('Invite teammates')).toBeNull();
    expect(screen.queryByTestId('entry-top-right-github')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not read workspace billing when opening a local project', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<PersonalModeProvider enabled><WorkspaceTopRightAccountCluster updaterSlot={<span>Local update control</span>} /></PersonalModeProvider>);
    expect(screen.getByText('Local update control')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
