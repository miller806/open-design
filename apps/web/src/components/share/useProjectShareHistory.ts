import { useEffect, useState } from 'react';
import type { ProjectShareHistoryResponse, WorkspaceCollabContext } from '@open-design/contracts';
import { currentWorkspaceAccountGeneration, workspaceAccountScopedCacheKey, workspaceProjectHeaders } from '../../collab/workspace-identity';
import { AMR_LOGIN_STATUS_EVENT } from '../amrLoginPolling';
import { PROJECT_SHARE_HISTORY_CHANGED_EVENT } from './share-publication-events';

export function isProjectShareHistory(value: unknown, projectId: string): value is ProjectShareHistoryResponse {
  if (!value || typeof value !== 'object') return false;
  return 'projectId' in value && value.projectId === projectId
    && 'hasEverShared' in value && typeof value.hasEverShared === 'boolean'
    && 'bindingExists' in value && value.bindingExists === value.hasEverShared
    && 'publications' in value && Array.isArray(value.publications)
    && (value.hasEverShared || value.publications.length === 0)
    && value.publications.every(row => row && typeof row === 'object'
      && typeof row.sourceFilePath === 'string' && typeof row.slug === 'string'
      && (row.status === 'active' || row.status === 'stopped'));
}

/** Includes stopped bindings. Failed reads are unknown, never "never shared". */
export type ProjectShareReadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useProjectShareHistoryState(projectId: string | undefined, context: WorkspaceCollabContext | null | undefined, publicationKey: string) {
  // No cloud read is made. Unknown history must never be presented as "never shared".
  return { history: null as ProjectShareHistoryResponse | null, status: 'idle' as ProjectShareReadStatus };
}

export function useProjectShareHistory(projectId: string | undefined, context: WorkspaceCollabContext | null | undefined, publicationKey: string) {
  return useProjectShareHistoryState(projectId, context, publicationKey).history;
}
