// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProjectDeleteFlow } from '../../../src/components/project-actions/useProjectDeleteFlow';
import type { Project } from '../../../src/types';

afterEach(cleanup);

const project = {
  id: 'project-one',
  name: 'Example',
  skillId: null,
  designSystemId: null,
  createdAt: 1,
  updatedAt: 1,
} as Project;

describe('project delete flow without a Workspace', () => {
  // Personal mode has no Workspace context, and therefore no public-share plane
  // to read. Reporting that absence as a failed read left the confirmation
  // dialog's 删除 button permanently disabled: the dialog opened and nothing
  // could be deleted from Home (the "再删除就没法删除了" report).
  it('treats a missing Workspace as "nothing shared" instead of a read failure', async () => {
    const onDelete = vi.fn(async () => true);
    const { result } = renderHook(() =>
      useProjectDeleteFlow({ onDelete, analyticsPage: 'all_projects', workspaceContext: null }),
    );

    act(() => result.current.request(project));
    expect(result.current.shareReadStatus).toBe('ready');
    expect(result.current.activeShareCount).toBe(0);

    await act(async () => {
      await result.current.commit();
    });
    expect(onDelete).toHaveBeenCalledWith('project-one');
    expect(result.current.target).toBeNull();
  });

  it('keeps a failed delete open so the failure is visible', async () => {
    const onDelete = vi.fn(async () => false);
    const { result } = renderHook(() =>
      useProjectDeleteFlow({ onDelete, analyticsPage: 'all_projects', workspaceContext: null }),
    );

    act(() => result.current.request(project));
    await act(async () => {
      await result.current.commit();
    });
    expect(result.current.target).not.toBeNull();
    expect(result.current.failed).toBe(true);
  });
});
