import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Project } from '../types';
import { useT } from '../i18n';
import { useProjectRunStatuses } from '../hooks/useProjectRunStatuses';
import { STATUS_LABEL_KEYS } from '../state/projectRunStatus';
import { Icon } from './Icon';
import {
  hasRunStatusGlyph,
  ProjectRunStatusIcon,
  STATUS_BALL_SIZE,
} from './ProjectRunStatusIcon';
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
 *
 * Each row also answers "which project is running?" — this rail is the ONLY
 * project list on screen once a project is open (the entry rail's 最近项目 and
 * the tab switcher's dropdown both unmount with their surfaces), so leaving it
 * as bare initial avatars meant a user watching two runs had no way to tell
 * which one was still going. The glyph comes from `ProjectRunStatusIcon` off
 * the shared run-status feed, the same pair the other two lists use, so all
 * three read one story about one project.
 */

const COLLAPSE_STORAGE_KEY = 'od.projects-rail.collapsed';
const WIDTH_STORAGE_KEY = 'od.projects-rail.width';
const DEFAULT_WIDTH = 208;
const MIN_WIDTH = 160;
const MAX_WIDTH = 360;

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function readWidthPreference(): number {
  try {
    const stored = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

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
  onRenameProject,
  onNewProject,
  onOpenSettings,
  onDeleteProject,
  folderAction,
}: {
  projects: Project[];
  activeProjectId: string;
  onOpenProject: (id: string) => void;
  onBrowseProjects: () => void;
  onRenameProject?: (id: string, name: string) => Promise<unknown> | void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onDeleteProject?: ProjectsRailDeleteHandler;
  folderAction?: ReactNode;
}) {
  const t = useT();
  // Every row is on screen or a scroll away, so every row asks. `enabled` is
  // deliberately not gated: the rail stays mounted for as long as the user is
  // in a project, and that is exactly when a run status matters. The feed is
  // one read per project on subscribe plus the shared 4s poll, and it coalesces
  // ids across surfaces, so the cost is the user's own project count.
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const runStatusByProjectId = useProjectRunStatuses(projectIds);
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsedPreference());
  const [width, setWidth] = useState(readWidthPreference);
  const dragRef = useRef<{ pointerId: number; startX: number; width: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
    } catch { /* A storage restriction must not prevent resizing. */ }
  }, [width]);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  // Rename happens in place on the row: a design tool's file panel should not
  // send the user to another screen to fix a name.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
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
        style={collapsed ? undefined : { width }}
        aria-label={t('entry.primaryNavAria')}
        data-testid="projects-rail"
      >
        {!collapsed ? (
          <div
            className={`${styles.resizeHandle}${resizing ? ` ${styles.resizing}` : ''}`}
            role="separator"
            aria-label={t('entry.resizeAria')}
            aria-orientation="vertical"
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            tabIndex={0}
            onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 32 : 8;
              const next = event.key === 'ArrowLeft' ? width - step
                : event.key === 'ArrowRight' ? width + step
                  : event.key === 'Home' ? MIN_WIDTH
                    : event.key === 'End' ? MAX_WIDTH : null;
              if (next === null) return;
              event.preventDefault();
              setWidth(clampWidth(next));
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { pointerId: event.pointerId, startX: event.clientX, width };
              setResizing(true);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
              setWidth(clampWidth(drag.width + direction * (event.clientX - drag.startX)));
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId !== event.pointerId) return;
              dragRef.current = null;
              setResizing(false);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onLostPointerCapture={() => { dragRef.current = null; setResizing(false); }}
            onPointerCancel={() => { dragRef.current = null; setResizing(false); }}
          />
        ) : null}
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
            // `succeeded` counts here too: the blue ball is the shared mark for
            // a finished run nobody has opened since, and opening the project
            // (this rail's own click, or the chat) is what spends it.
            const runStatus = runStatusByProjectId.get(project.id);
            const statusGlyph = runStatus && hasRunStatusGlyph(runStatus) ? runStatus : null;
            return (
              <div
                key={project.id}
                className={`${styles.row}${active ? ` ${styles.rowActive}` : ''}`}
                data-testid="projects-rail-row"
                data-active={active ? 'true' : undefined}
              >
                {renamingId === project.id ? (
                  <form
                    className={styles.rowMain}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const next = renameDraft.trim();
                      setRenamingId(null);
                      if (!next || next === name) return;
                      void onRenameProject?.(project.id, next);
                    }}
                  >
                    <input
                      className={styles.renameInput}
                      value={renameDraft}
                      autoFocus
                      aria-label={t('designs.menuRename')}
                      data-testid="projects-rail-rename-input"
                      onChange={(event) => setRenameDraft(event.currentTarget.value)}
                      onBlur={() => setRenamingId(null)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setRenamingId(null);
                      }}
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    className={styles.rowMain}
                    aria-current={active ? 'true' : undefined}
                    data-testid="projects-rail-row-open"
                    onClick={() => onOpenProject(project.id)}
                    title={collapsed ? name : undefined}
                  >
                    {collapsed ? (
                      <span className={styles.avatar}>
                        <span aria-hidden>{initialFor(name)}</span>
                        {statusGlyph ? (
                          <span className={styles.statusBadge} data-testid="projects-rail-status">
                            <ProjectRunStatusIcon
                              status={statusGlyph}
                              size={STATUS_BALL_SIZE}
                              label={t(STATUS_LABEL_KEYS[statusGlyph])}
                            />
                          </span>
                        ) : null}
                      </span>
                    ) : statusGlyph ? (
                      <span className={styles.statusSlot} data-testid="projects-rail-status">
                        <ProjectRunStatusIcon
                          status={statusGlyph}
                          size={STATUS_BALL_SIZE}
                          label={t(STATUS_LABEL_KEYS[statusGlyph])}
                        />
                      </span>
                    ) : (
                      <span className={styles.avatar} aria-hidden>{initialFor(name)}</span>
                    )}
                    {collapsed ? <span className={styles.srOnly}>{name}</span> : (
                      <span className={styles.name}>{name}</span>
                    )}
                  </button>
                )}
                {onRenameProject && !collapsed && renamingId !== project.id ? (
                  <button
                    type="button"
                    className={styles.rowDelete}
                    onClick={() => {
                      setRenamingId(project.id);
                      setRenameDraft(project.name ?? '');
                    }}
                    aria-label={t('designs.menuRename')}
                    title={t('designs.menuRename')}
                    data-testid="projects-rail-rename"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                ) : null}
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
          {folderAction ? <div className={styles.folderAction}>{folderAction}</div> : null}
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
