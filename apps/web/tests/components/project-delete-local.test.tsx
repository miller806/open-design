// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectDeleteConfirmDialog } from '../../src/components/project-actions/ProjectDeleteConfirmDialog';
import { useProjectDeleteFlow } from '../../src/components/project-actions/useProjectDeleteFlow';
import type { Project } from '../../src/types';

// A local project has no cloud workspace, so the retired sharing read must not
// gate deletion: the confirm button has to stay usable offline.
const project: Project = {
  id: 'project',
  name: 'Local prototype',
  skillId: null,
  designSystemId: null,
  createdAt: 1,
  updatedAt: 1,
};
const remove = vi.fn(async () => true);
const request = vi.fn<typeof fetch>();

function Harness() {
  const flow = useProjectDeleteFlow({ onDelete: remove, analyticsPage: 'home', workspaceContext: null });
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
  remove.mockClear();
  request.mockReset();
  vi.stubGlobal('fetch', request);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('deletes a local project without waiting for a cloud sharing read', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('Request delete'));

  const accept = await screen.findByTestId('project-delete-confirm-accept');
  expect(screen.getByText('Delete "Local prototype"?')).toBeVisible();
  expect(accept).toBeEnabled();
  expect(request).not.toHaveBeenCalled();

  fireEvent.click(accept);
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith('project'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});
