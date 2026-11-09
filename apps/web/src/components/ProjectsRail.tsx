import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { useT } from '../i18n';
import { Icon } from './Icon';
import {
  ProjectDeleteConfirmDialog,
} from './project-actions/ProjectDeleteConfirmDialog';
import styles from './ProjectsRail.module.css';

/**
 * Persistent project rail for the project workbench.
 *
 * The entry rail (Home / 全部项目 / 设计体系 / 插件 / 设置) used to disappear the
 * moment a project opened, so switching took a trip back to Home. This rail keeps
 * the project list — and the ways out of it — on screen while a project is open,
 * the way a design tool's file panel does. It is deliberately narrow and quiet:
 * the project workbench already owns its chat panel and Design Files tabs, and
 * this column only answers "which project am I in, and which one do I want".
 *
 * Rows carry their own delete action (hover/focus reveals it) because the
 * workbench had no way to remove a project at all: deleting meant going back to
 * Home, opening the card menu, and coming back. It deletes through the SAME
 * confirmation dialog every other project entry point uses, so a stray click
 * still cannot destroy a project from here.
 */

const COLLAPSE_STORAGE_KEY = 'od.projects-rail.collapsed';

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  // Array.from keeps a multi-unit glyph (emoji, CJK-extension) whole instead of
  // splitting a surrogate pair into a replacement character.
  const first = Array.from(trimmed)[0] ?? '·';
  return first.toUpperCase();
}

/**
 * `nextProjectId` names the row that takes the deleted row's place, so the
 * workbench can move there instead of falling back to Home — the rail is the
 * surface that deletes, so it must survive the delete.
 */
export type ProjectsRailDeleteHandler = (
  id: string,
  options?: { nextProjectId?: string | null },
) => Promise<boolean | void> | boolean | void;

export function ProjectsRail({
  projects,
  activeProjectId,
  onOpenProject,
  onBrowseProjects,
  onNewProject,
  onOpenSettings,
  onDeleteProject,
}: {
  projects: Project[];
  activeProjectId: string;
  onOpenProject: (id: string) => void;
  onBrowseProjects: () => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onDeleteProject?: ProjectsRailDeleteHandler;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsedPreference());
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInFlightRef = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Preference is a nicety; a blocked storage quota must not break the rail.
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((current) => !current), []);

  const cancelDelete = useCallback(() => {
    if (deleteInFlightRef.current) return;
    setDeleteTarget(null);
    setDeleteFailed(false);
    setDeleteError(null);
  }, []);

  const commitDelete = useCallback(async () => {
    const target = deleteTarget;
    if (!target || !onDeleteProject || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeletePending(true);
    setDeleteFailed(false);
    setDeleteError(null);
    try {
      // The row that takes the deleted row's place (or the previous one when the
      // last row is removed) becomes the next open project.
      const index = projects.findIndex((project) => project.id === target.id);
      const remaining = projects.filter((project) => project.id !== target.id);
      const nextProjectId = remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ?? null;
      const result = await onDeleteProject(target.id, { nextProjectId });
      // `false` means the daemon refused; the dialog stays open and says so
      // rather than closing as though the project were gone.
      if (result === false) {
        setDeleteFailed(true);
        return;
      }
      setDeleteTarget(null);
    } catch (error) {
      setDeleteFailed(true);
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      deleteInFlightRef.current = false;
      setDeletePending(false);
    }
  }, [deleteTarget, onDeleteProject, projects]);

  return (
    <>
      <nav
        className={`${styles.rail}${collapsed ? ` ${styles.railCollapsed}` : ''}`}
        aria-label={t('entry.primaryNavAria')}
        data-testid="projects-rail"
      >
        <div className={styles.header}>
          {collapsed ? null : <span className={styles.title}>{t('entry.navProjects')}</span>}
          <button
            type="button"
            className={styles.iconButton}
            onClick={toggle}
            aria-label={collapsed ? t('entry.navExpand') : t('entry.navCollapse')}
            aria-expanded={!collapsed}
            title={collapsed ? t('entry.navExpand') : t('entry.navCollapse')}
            data-testid="projects-rail-toggle"
          >
            <Icon name="panel-left" size={16} />
          </button>
        </div>

        <div className={styles.list}>
          {projects.map((project) => {
            const active = project.id === activeProjectId;
            const name = project.name?.trim() || t('common.untitled');
            return (
              <div
                key={project.id}
                className={`${styles.row}${active ? ` ${styles.rowActive}` : ''}`}
                data-testid="projects-rail-row"
                data-active={active ? 'true' : undefined}
              >
                <button
                  type="button"
                  className={styles.rowMain}
                  aria-current={active ? 'true' : undefined}
                  data-testid="projects-rail-row-open"
                  onClick={() => onOpenProject(project.id)}
                  title={collapsed ? name : undefined}
                >
                  <span className={styles.avatar} aria-hidden>{initialFor(name)}</span>
                  {collapsed ? <span className={styles.srOnly}>{name}</span> : (
                    <span className={styles.name}>{name}</span>
                  )}
                </button>
                {onDeleteProject && !collapsed ? (
                  <button
                    type="button"
                    className={styles.rowDelete}
                    onClick={() => setDeleteTarget(project)}
                    aria-label={t('designs.deleteTitle')}
                    title={t('designs.deleteTitle')}
                    data-testid="projects-rail-delete"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
          {projects.length === 0 ? (
            <p className={styles.empty}>{collapsed ? '·' : t('recentProjects.empty')}</p>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.action}
            onClick={onNewProject}
            title={t('entry.navNewProject')}
            aria-label={t('entry.navNewProject')}
          >
            <Icon name="plus" size={15} />
            {collapsed ? null : <span>{t('entry.navNewProject')}</span>}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={onBrowseProjects}
            title={t('recentProjects.viewAll')}
            aria-label={t('recentProjects.viewAll')}
          >
            <Icon name="folder" size={15} />
            {collapsed ? null : <span>{t('recentProjects.viewAll')}</span>}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={onOpenSettings}
            title={t('entry.accountSettings')}
            aria-label={t('entry.accountSettings')}
          >
            <Icon name="settings" size={15} />
            {collapsed ? null : <span>{t('entry.accountSettings')}</span>}
          </button>
        </div>
      </nav>

      {deleteTarget ? (
        <ProjectDeleteConfirmDialog
          projectName={deleteTarget.name?.trim() || t('common.untitled')}
          // Personal mode has no cloud share history to read: the project either
          // has active public links the daemon still knows about, or it does not.
          activeShareCount={0}
          shareReadStatus="ready"
          pending={deletePending}
          failed={deleteFailed}
          errorMessage={deleteError}
          onCancel={cancelDelete}
          onConfirm={() => void commitDelete()}
        />
      ) : null}
    </>
  );
}
