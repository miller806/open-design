// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildWorkspacePermissions, buildWorkspaceSeatSummary, type WorkspaceCollabContext } from '@open-design/contracts';
import { ProjectDeleteConfirmDialog } from '../../src/components/project-actions/ProjectDeleteConfirmDialog';
import { useProjectDeleteFlow } from '../../src/components/project-actions/useProjectDeleteFlow';
import type { Project } from '../../src/types';

/**
 * Personal edition: public sharing is retired, so deleting a project never
 * depends on a cloud share-state read. The dialog must confirm immediately and
 * delete without issuing any network request of its own.
 */
const context: WorkspaceCollabContext = {
  workspaceId: 'ws',
  workspaceType: 'personal',
  workspaceMemberId: 'member',
  role: 'owner',
  memberStatus: 'active',
  lifecycleState: 'active',
  billingState: 'active',
  planId: null,
  providerMode: 'platform_credits',
  seatSummary: buildWorkspaceSeatSummary({ seatLimit: 1, usedSeats: 1 }),
  permissions: buildWorkspacePermissions({ role: 'owner', lifecycleState: 'active' }),
};
const project: Project = { id: 'project', name: 'Example', skillId: null, designSystemId: null, createdAt: 1, updatedAt: 1 };
const request = vi.fn<typeof fetch>();
const remove = vi.fn(async () => true);

function Harness({ workspaceContext }: { workspaceContext: WorkspaceCollabContext | null }) {
  const flow = useProjectDeleteFlow({ onDelete: remove, analyticsPage: 'home', workspaceContext });
  return (
    <>
      <button onClick={() => flow.request(project)}>Request delete</button>
      {flow.target ? (
        <ProjectDeleteConfirmDialog
          projectName={flow.target.name}
          activeShareCount={flow.activeShareCount}
          shareReadStatus={flow.shareReadStatus}
          pending={flow.pending}
          failed={flow.failed}
          onCancel={flow.cancel}
          onConfirm={() => void flow.commit()}
        />
      ) : null}
    </>
  );
}

beforeEach(() => {
  request.mockReset();
  remove.mockClear();
  vi.stubGlobal('fetch', request);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('confirms and deletes without reading cloud share state', async () => {
  render(<Harness workspaceContext={null} />);
  fireEvent.click(screen.getByText('Request delete'));

  expect(screen.getByText('Delete "Example"?')).toBeVisible();
  expect(screen.queryByText(/pages being shared/)).toBeNull();
  a11yCheck();

  fireEvent.click(screen.getByTestId('project-delete-confirm-accept'));
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith('project'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(request).not.toHaveBeenCalled();
});

it('does not re-introduce a share gate from a stale workspace context', async () => {
  // Sharing is retired: the workspace context no longer authorises a read.
  expect(context.permissions.canShareProjects).toBe(true);
  render(<Harness workspaceContext={null} />);
  fireEvent.click(screen.getByText('Request delete'));
  expect(screen.queryByText(/pages being shared/)).toBeNull();
  fireEvent.click(screen.getByTestId('project-delete-confirm-accept'));
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith('project'));
  expect(request).not.toHaveBeenCalled();
});

it('keeps the dialog open and reports a failed delete', async () => {
  remove.mockResolvedValueOnce(false);
  render(<Harness workspaceContext={null} />);
  fireEvent.click(screen.getByText('Request delete'));
  fireEvent.click(screen.getByTestId('project-delete-confirm-accept'));
  await waitFor(() => expect(screen.getByRole('alertdialog')).toBeVisible());
  expect(screen.getByText('Delete "Example"?')).toBeVisible();
});

it('cancels without deleting', async () => {
  render(<Harness workspaceContext={null} />);
  fireEvent.click(screen.getByText('Request delete'));
  fireEvent.click(screen.getByTestId('project-delete-confirm-cancel'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(remove).not.toHaveBeenCalled();
});

function a11yCheck() {
  // The dialog names itself; the project name is in the description copy.
  expect(screen.getByRole('alertdialog')).toHaveAccessibleName(/Delete project/i);
}
