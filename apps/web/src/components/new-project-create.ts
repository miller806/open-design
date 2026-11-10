// Shared "what does pressing Create / Send mean" adapters for starting a
// project from the entry surfaces.
//
// Two surfaces turn a user's inputs into a `POST /api/projects` body:
//
// - the New Project panel, which collects a form (`CreateInput`);
// - Home's composer, which collects a prompt plus whatever plugin, design
//   system, working directory and attachments the user picked
//   (`PluginLoopSubmit`).
//
// Both must agree on the parts that are not panel-specific — kind → default
// scenario binding, the automatic OD Next route, and what a picked folder
// means — so those live here rather than in either shell. `App`'s own
// `handleCreateProject` receives the already-derived input and does not
// re-derive it.

import {
  automaticStrategyTaskProfileForProjectMetadata,
  defaultScenarioPluginIdForProjectMetadata,
  type ChatSessionMode,
  type CreateProjectExampleReference,
  type LocalCatalogScope,
  type ProjectMetadata,
  type ProjectScenarioTaskProfile,
  type RunContextSelection,
} from '@open-design/contracts';
import type { OpenDesignHostProjectImportSuccess } from '@open-design/host';
import type { OnboardingEntry } from '../onboarding/onboarding-entry';
import type { AmrBalanceGateScope } from '../runtime/amr-balance-gate';
import { summarizeProjectNameFromPrompt } from '../utils/projectName';
import { entryStrategyRoutingFields } from './entry-strategy-routing';
import type { PluginLoopSubmit } from './PluginLoopHome';
import type { CreateInput, ImportClaudeDesignOutcome } from './NewProjectPanel';

/**
 * The create request an entry surface hands to `App.createProject`.
 *
 * A superset of the panel's `CreateInput`: Home's composer and the optimistic
 * hand-off both attach fields the panel form has no opinion on.
 */
export type EntryCreateProjectInput = Omit<CreateInput, 'metadata'> & {
  metadata?: CreateInput['metadata'];
  pendingPrompt?: string;
  pluginId?: string;
  pluginSource?: string;
  skillCatalogScope?: LocalCatalogScope | null;
  designSystemCatalogScope?: LocalCatalogScope | null;
  pluginType?: string;
  appliedPluginSnapshotId?: string;
  pluginInputs?: Record<string, unknown>;
  automaticStrategyTaskProfile?: ProjectScenarioTaskProfile;
  /** Official example card the user picked under the automatic route. */
  exampleReference?: CreateProjectExampleReference;
  initialRunContext?: RunContextSelection | null;
  conversationMode?: ChatSessionMode;
  autoSendFirstMessage?: boolean;
  /** Exact workspace/member authority checked by the Home AMR preflight. */
  amrGatePrecheckWitness?: AmrBalanceGateScope;
  /**
   * The optimistic project already flushed by the Home hand-off. The create
   * reuses this id (the daemon accepts a caller-minted id) instead of
   * starting a second hand-off.
   */
  optimisticProjectId?: string;
  requestId?: string;
  pendingFiles?: File[];
  userWorkingDirToken?: string;
  linkedDirs?: string[] | null;
  onboardingEntry?: OnboardingEntry;
};

/** Everything the panel needs from its owner, independent of which shell mounts it. */
export interface NewProjectPanelHostProps {
  onCreate: (input: CreateInput & { requestId?: string }) => Promise<boolean> | boolean | void;
  onClose: () => void;
  onImportClaudeDesign?: (
    file: File,
  ) => Promise<ImportClaudeDesignOutcome | void> | ImportClaudeDesignOutcome | void;
  onImportFolder?: (baseDir: string) => Promise<void> | void;
  onImportFolderResponse?: (response: OpenDesignHostProjectImportSuccess) => Promise<void> | void;
  onOpenConnectorsTab?: () => void;
}

function defaultPluginIdForMetadata(
  metadata: CreateInput['metadata'],
): string | null {
  return defaultScenarioPluginIdForProjectMetadata(metadata);
}

function defaultPluginInputsForCreate(
  input: CreateInput,
  pluginId: string | null,
): Record<string, unknown> | null {
  const kind = input.metadata.kind;
  const projectName = input.name.trim();

  if (pluginId === 'example-web-prototype') {
    return {
      artifactKind: input.metadata.includeLandingPage
        ? 'landing page'
        : 'web prototype',
      fidelity: input.metadata.fidelity ?? 'high-fidelity',
      audience: 'product evaluators',
      designSystem: 'the active project design system',
      template: input.metadata.templateLabel ?? 'the bundled web prototype seed',
    };
  }

  if (pluginId === 'example-simple-deck') {
    return {
      deckType: 'pitch deck',
      topic: projectName || 'the user brief',
      audience: 'decision makers',
      slideCount: '10-15 pages',
      speakerNotes: input.metadata.speakerNotes
        ? 'include speaker notes'
        : 'no speaker notes',
      designSystem: 'the active project design system',
    };
  }

  if (pluginId === 'od-new-generation') {
    const templateLabel = input.metadata.templateLabel?.trim();
    const artifactKind =
      kind === 'template'
        ? 'artifact based on a saved template'
        : kind === 'other'
          ? 'custom design artifact'
          : `${kind} artifact`;
    return {
      artifactKind,
      audience: 'product and design reviewers',
      topic: templateLabel || projectName || 'the user brief',
    };
  }

  if (pluginId !== 'od-media-generation') return null;
  if (kind !== 'image' && kind !== 'video' && kind !== 'audio') return null;

  const promptTemplate = input.metadata.promptTemplate;
  const subject =
    promptTemplate?.prompt?.trim()
    || projectName
    || promptTemplate?.title?.trim()
    || `${kind} concept`;
  const style =
    promptTemplate?.summary?.trim()
    || 'cinematic, high-quality, on-brand';
  const aspect =
    kind === 'image'
      ? input.metadata.imageAspect
      : kind === 'video'
        ? input.metadata.videoAspect
        : undefined;

  return {
    mediaKind: kind,
    subject,
    style,
    ...(aspect ? { aspect } : {}),
  };
}

/**
 * Bind a New Project form submission to the pipeline it creates.
 *
 * Every project kind is silently bound to its default scenario pipeline at
 * creation time so the user lands in a running flow without reasoning about
 * pipeline internals. The mapping is explicit so a future kind-specific
 * scenario can take over a single row without touching the form.
 *
 * The Blank card historically persisted a hidden default Skill (for example
 * agent-browser) even though the automatic scenario already owns the task
 * workflow. When OD Next replaces that scenario, carrying the hidden Skill
 * makes it look user-selected and can correctly trip the planning-only
 * validator. Explicit template/Skill picks stay exact; only the UI's implicit
 * default is dropped on the four automatic routes.
 */
export function createProjectInputFromPanel(input: CreateInput): EntryCreateProjectInput {
  const pluginId = defaultPluginIdForMetadata(input.metadata);
  const pluginInputs = defaultPluginInputsForCreate(input, pluginId);
  const { skillSelectionProvenance, ...projectInput } = input;
  const automaticStrategyRoute = skillSelectionProvenance === 'explicit-user'
    ? null
    : (automaticStrategyTaskProfileForProjectMetadata(input.metadata) ?? null);
  return {
    ...projectInput,
    ...(automaticStrategyRoute && skillSelectionProvenance === 'automatic-default'
      ? { skillId: null }
      : {}),
    ...(automaticStrategyRoute
      ? { automaticStrategyTaskProfile: automaticStrategyRoute }
      : pluginInputs
        ? { pluginInputs }
        : {}),
  };
}

/**
 * The create request a Home composer send turns into. Pure: it reads only the
 * payload, so it can be computed before the optimistic hand-off and reused by
 * the create that follows the admission check.
 */
export function createProjectInputFromComposer(
  payload: PluginLoopSubmit,
): EntryCreateProjectInput {
  const summarizedName = summarizeProjectNameFromPrompt(payload.prompt);
  const head = payload.prompt.trim().split(/\s+/).slice(0, 8).join(' ');
  const firstAttachmentName = payload.attachments?.[0]?.name ?? '';
  const fallbackName =
    summarizedName || (head.length > 0 ? head : firstAttachmentName || 'Untitled');
  const name =
    payload.pluginTitle && payload.pluginTitle.trim().length > 0
      ? payload.pluginTitle.trim()
      : fallbackName;
  // Only an explicit multi-folder @-mention list stays read-only awareness
  // (`--add-dir`). The picked working directory is the project root now, so
  // it is not ALSO granted as an added directory.
  const linkedDirs = Array.from(
    new Set(
      (payload.linkedDirs ?? [])
        .map((dir) => dir.trim())
        .filter(Boolean),
    ),
  );
  const workingDir = payload.workingDir?.trim() ?? '';
  const metadata: ProjectMetadata = {
    ...(payload.projectMetadata ?? {}),
    kind: payload.projectKind ?? payload.projectMetadata?.kind ?? 'prototype',
    nameSource: 'prompt',
    ...(payload.contextPlugins && payload.contextPlugins.length > 0
      ? { contextPlugins: payload.contextPlugins }
      : {}),
    ...(payload.contextMcpServers && payload.contextMcpServers.length > 0
      ? { contextMcpServers: payload.contextMcpServers }
      : {}),
    ...(payload.contextConnectors && payload.contextConnectors.length > 0
      ? { contextConnectors: payload.contextConnectors }
      : {}),
    // Home's working-directory picker names the folder the project should LIVE
    // in. Treating it as read-only awareness instead was the reported
    // confusion: the user picked a folder and the project still landed in the
    // managed `.od/projects/<uuid>` root. `userWorkingDir` is a create-body
    // hint only (the daemon never reads it back out of metadata);
    // `App.handleCreateProject` spends it on the post-create
    // `POST /api/projects/:id/working-dir` call that rewrites
    // `metadata.baseDir` onto the picked folder.
    ...(workingDir ? { userWorkingDir: workingDir } : {}),
    ...(linkedDirs.length > 0 ? { linkedDirs } : {}),
    ...(payload.examplePromptContext ? {
      examplePrompt: true,
      examplePromptTitle: payload.examplePromptContext.title,
      examplePromptBrief: payload.examplePromptContext.brief,
    } : {}),
  };
  const strategyRoutingFields = entryStrategyRoutingFields(payload, metadata);
  return {
    name,
    ...strategyRoutingFields,
    ...(strategyRoutingFields.skillId && payload.skillCatalogScope
      ? { skillCatalogScope: payload.skillCatalogScope }
      : {}),
    designSystemId: payload.designSystemId ?? null,
    ...(payload.designSystemCatalogScope
      ? { designSystemCatalogScope: payload.designSystemCatalogScope }
      : {}),
    metadata,
    pendingPrompt: payload.prompt,
    ...(payload.pluginId && !payload.pluginSelectionProvenance
      ? { pluginId: payload.pluginId }
      : {}),
    ...(payload.pluginSource && !payload.pluginSelectionProvenance
      ? { pluginSource: payload.pluginSource }
      : {}),
    ...(payload.pluginType && !payload.pluginSelectionProvenance
      ? { pluginType: payload.pluginType }
      : {}),
    ...(payload.appliedPluginSnapshotId && !payload.pluginSelectionProvenance
      ? { appliedPluginSnapshotId: payload.appliedPluginSnapshotId }
      : {}),
    ...(payload.initialRunContext ? { initialRunContext: payload.initialRunContext } : {}),
    ...(payload.conversationMode ? { conversationMode: payload.conversationMode } : {}),
    ...(payload.attachments && payload.attachments.length > 0
      ? { pendingFiles: payload.attachments }
      : {}),
    // The desktop host mints a single-use token for the folder it returned,
    // and the post-create working-dir POST is gated on it. Web picks carry no
    // token because that gate is inactive there (see HomeView's
    // handlePickWorkingDir), so omitting it is the normal web shape.
    ...(payload.workingDirToken ? { userWorkingDirToken: payload.workingDirToken } : {}),
    autoSendFirstMessage: true,
  };
}
