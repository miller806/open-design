// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n';
import { ProjectsRail } from '../../src/components/ProjectsRail';
import { resetProjectRunStatusStore } from '../../src/hooks/useProjectRunStatuses';
import type { Project } from '../../src/types';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function project(id: string, name: string): Project {
  return {
    id,
    name,
    skillId: null,
    designSystemId: null,
    createdAt: 1,
    updatedAt: 1,
  } as Project;
}

function view(overrides: Partial<Parameters<typeof ProjectsRail>[0]> = {}) {
  const onOpenProject = vi.fn();
  const onDeleteProject = vi.fn(async () => true);
  render(
    <I18nProvider initial="zh-CN">
      <ProjectsRail
        projects={[project('one', '我的海报'), project('two', 'Q3 Launch')]}
        activeProjectId="one"
        onOpenProject={onOpenProject}
        onBrowseProjects={vi.fn()}
        onNewProject={vi.fn()}
        onOpenSettings={vi.fn()}
        onDeleteProject={onDeleteProject}
        {...overrides}
      />
    </I18nProvider>,
  );
  return { onOpenProject, onDeleteProject };
}

describe('projects rail', () => {
  it('resizes within bounds, remembers width, and restores it after expanding', () => {
    view();
    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle.getAttribute('aria-valuenow')).toBe('216');
    expect(window.localStorage.getItem('od.projects-rail.width')).toBe('216');
    cleanup();
    view();
    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('216');
    fireEvent.click(screen.getByTestId('projects-rail-toggle'));
    expect(screen.queryByRole('separator')).toBeNull();
    fireEvent.click(screen.getByTestId('projects-rail-toggle'));
    const restored = screen.getByRole('separator');
    expect(restored.getAttribute('aria-valuenow')).toBe('216');
    fireEvent.keyDown(restored, { key: 'End' });
    fireEvent.keyDown(restored, { key: 'ArrowRight' });
    expect(restored.getAttribute('aria-valuenow')).toBe('360');
    fireEvent.keyDown(restored, { key: 'Home' });
    fireEvent.keyDown(restored, { key: 'ArrowLeft' });
    expect(restored.getAttribute('aria-valuenow')).toBe('160');
    fireEvent.doubleClick(restored);
    expect(restored.getAttribute('aria-valuenow')).toBe('208');
  });
  it('renames a project in place from its row', async () => {
    const onRenameProject = vi.fn();
    view({ onRenameProject });
    const [row] = screen.getAllByTestId('projects-rail-row');
    if (!row) throw new Error('row missing');
    fireEvent.click(within(row).getByTestId('projects-rail-rename'));
    const input = within(row).getByTestId('projects-rail-rename-input');
    fireEvent.change(input, { target: { value: '春季海报' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(onRenameProject).toHaveBeenCalledWith('one', '春季海报'));
  });

  // The workbench used to hide the entry rail the moment a project opened, so
  // switching projects meant going back to Home. The rail is the fix: it has to
  // list every project, mark the one that is open, and switch in one click.
  it('lists every project and marks the open one', () => {
    view();
    const rows = screen.getAllByTestId('projects-rail-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.getAttribute('data-active')).toBe('true');
    expect(rows[1]!.getAttribute('data-active')).toBeNull();
    expect(rows[1]!.textContent).toContain('Q3 Launch');
  });

  it('switches to the clicked project', () => {
    const { onOpenProject } = view();
    fireEvent.click(screen.getAllByTestId('projects-rail-row-open')[1]!);
    expect(onOpenProject).toHaveBeenCalledWith('two');
  });

  // Collapsing keeps the rail mounted (switching must stay one click away) and
  // the preference survives a remount, so the user's choice sticks.
  it('collapses to the icon column and remembers the choice', () => {
    view();
    fireEvent.click(screen.getByTestId('projects-rail-toggle'));
    expect(screen.getAllByTestId('projects-rail-row')).toHaveLength(2);
    expect(window.localStorage.getItem('od.projects-rail.collapsed')).toBe('1');

    cleanup();
    view();
    expect(screen.getByTestId('projects-rail-toggle').getAttribute('aria-expanded')).toBe('false');
  });

  // The workbench had no way to delete a project at all: it meant going back to
  // Home and opening the card menu. The rail's row action deletes through the
  // SAME confirmation dialog every other entry point uses, so a stray click
  // cannot destroy a project from here.
  it('deletes through the shared confirmation dialog', async () => {
    const { onDeleteProject } = view();
    // Nothing is deleted until the dialog is confirmed.
    expect(onDeleteProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByTestId('projects-rail-delete')[1]!);
    const dialog = screen.getByTestId('project-delete-confirm-dialog');
    expect(dialog.textContent).toContain('Q3 Launch');
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }));
    // The row that takes the deleted row's place travels with the delete, so the
    // workbench moves there instead of falling back to Home — being sent Home is
    // what made "delete another one" impossible.
    await waitFor(() => expect(onDeleteProject).toHaveBeenCalledWith('two', { nextProjectId: 'one' }));
  });

  it('sends no next project when the last one is deleted', async () => {
    const onDeleteProject = vi.fn(async () => true);
    render(
      <I18nProvider initial="zh-CN">
        <ProjectsRail
          projects={[project('only', '项目唯一')]}
          activeProjectId="only"
          onOpenProject={vi.fn()}
          onBrowseProjects={vi.fn()}
          onNewProject={vi.fn()}
          onOpenSettings={vi.fn()}
          onDeleteProject={onDeleteProject}
        />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByTestId('projects-rail-delete'));
    const dialog = screen.getByTestId('project-delete-confirm-dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }));
    await waitFor(() => expect(onDeleteProject).toHaveBeenCalledWith('only', { nextProjectId: null }));
  });

  it('hides the delete action when the caller cannot delete', () => {
    view({ onDeleteProject: undefined });
    expect(screen.queryAllByTestId('projects-rail-delete')).toHaveLength(0);
  });
});

// Once a project is open, this rail is the ONLY project list on screen — the
// entry rail's 最近项目 list and the tab switcher's dropdown both unmount with
// their surfaces. A run in flight therefore had nowhere to show itself, and two
// projects were indistinguishable to a user waiting on one of them.
const originalFetch = globalThis.fetch;
let runsByProject: Record<string, { status: string }> = {};

function stubRunsFeed() {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = /^\/api\/runs\?projectId=([^&]+)$/.exec(url);
    const projectId = match ? decodeURIComponent(match[1]!) : null;
    const fixture = projectId ? runsByProject[projectId] : undefined;
    const runs = fixture && projectId
      ? [{
          id: `run-${projectId}`,
          projectId,
          conversationId: null,
          assistantMessageId: null,
          agentId: 'claude',
          status: fixture.status,
          createdAt: 1,
          updatedAt: 2,
        }]
      : [];
    return new Response(
      JSON.stringify({ runs, awaitingInputProjectIds: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

describe('projects rail run status', () => {
  it('preserves distinct initials beside status badges when collapsed', async () => {
    runsByProject = { one: { status: 'running' }, two: { status: 'running' } };
    view();
    fireEvent.click(screen.getByTestId('projects-rail-toggle'));
    await waitFor(() => expect(screen.getAllByTestId('projects-rail-status')).toHaveLength(2));
    const buttons = screen.getAllByTestId('projects-rail-row-open');
    expect(within(buttons[0]!).getByText('我')).toBeTruthy();
    expect(within(buttons[1]!).getByText('Q')).toBeTruthy();
    fireEvent.click(buttons[1]!);
    expect(buttons[1]!.getAttribute('title')).toBe('Q3 Launch');
  });
  beforeEach(() => {
    // The run-status store is module-level on purpose (a status must survive a
    // surface remount), so a test boundary has to clear it explicitly.
    resetProjectRunStatusStore();
    runsByProject = {};
    stubRunsFeed();
  });

  afterEach(() => {
    resetProjectRunStatusStore();
    globalThis.fetch = originalFetch;
  });

  it('leads a running project with its status ball instead of its initial', async () => {
    runsByProject = { one: { status: 'running' } };
    view();
    const [runningRow, idleRow] = screen.getAllByTestId('projects-rail-row');
    if (!runningRow || !idleRow) throw new Error('rows missing');

    await waitFor(() => expect(within(runningRow).getByTestId('projects-rail-status')).toBeTruthy());
    // The ball TAKES the avatar slot rather than joining it: one mark per row.
    expect(runningRow.querySelector('span')?.textContent).not.toBe('我');
    // A project with nothing live keeps the initial it always had, so the rail
    // does not turn into a wall of balls.
    expect(within(idleRow).queryByTestId('projects-rail-status')).toBeNull();
    expect(idleRow.textContent).toContain('Q3 Launch');
  });

  it('shows the ball for a finished run the user has not opened yet', async () => {
    runsByProject = { two: { status: 'succeeded' } };
    view();
    const rows = screen.getAllByTestId('projects-rail-row');
    await waitFor(() => expect(within(rows[1]!).getByTestId('projects-rail-status')).toBeTruthy());
    expect(within(rows[0]!).queryByTestId('projects-rail-status')).toBeNull();
  });

  it('keeps every row on its initial when nothing has ever run', () => {
    view();
    expect(screen.queryAllByTestId('projects-rail-status')).toHaveLength(0);
    expect(screen.getAllByTestId('projects-rail-row')[0]!.textContent).toContain('我的海报');
  });
});
