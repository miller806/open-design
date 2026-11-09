// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n';
import { ProjectsRail } from '../../src/components/ProjectsRail';
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