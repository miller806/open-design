import { describe, expect, it } from 'vitest';
import {
  createProjectInputFromComposer,
  createProjectInputFromPanel,
} from '../../src/components/new-project-create';
import type { PluginLoopSubmit } from '../../src/components/PluginLoopHome';

/**
 * A picked working directory is the folder the project should LIVE in, not a
 * read-only attachment next to a managed `.od/projects/<uuid>` root. The
 * create body carries it as `metadata.userWorkingDir`, which
 * `App.handleCreateProject` turns into the post-create
 * `POST /api/projects/:id/working-dir` that rewrites `metadata.baseDir`.
 *
 * Regression: the composer adapter used to fold the pick into `linkedDirs`
 * only, so the daemon created the project in the managed root and the folder
 * the user chose was never used for anything except `--add-dir`.
 */
describe('createProjectInputFromComposer working directory', () => {
  const base = {
    prompt: '22',
    projectKind: 'prototype',
  } as PluginLoopSubmit;

  it('turns the picked folder into userWorkingDir', () => {
    const input = createProjectInputFromComposer({
      ...base,
      workingDir: 'F:/code/designs/moon-habitat',
    });

    expect(input.metadata?.userWorkingDir).toBe('F:/code/designs/moon-habitat');
    // The root is not also granted as an added directory — it IS the project.
    expect(input.metadata?.linkedDirs ?? []).toEqual([]);
  });

  it('keeps explicit @-mentioned folders as read-only linkedDirs', () => {
    const input = createProjectInputFromComposer({
      ...base,
      workingDir: 'F:/code/designs/moon-habitat',
      linkedDirs: ['F:/code/reference-repo'],
    });

    expect(input.metadata?.userWorkingDir).toBe('F:/code/designs/moon-habitat');
    expect(input.metadata?.linkedDirs).toEqual(['F:/code/reference-repo']);
  });

  it('omits userWorkingDir when no folder was picked', () => {
    const input = createProjectInputFromComposer(base);

    expect(input.metadata?.userWorkingDir).toBeUndefined();
    expect(input.metadata?.linkedDirs).toBeUndefined();
  });

  it('carries the desktop picker token through to the create body', () => {
    const input = createProjectInputFromComposer({
      ...base,
      workingDir: 'F:/code/designs/moon-habitat',
      workingDirToken: 'nonce.2026-01-01T00:00:00Z.signature',
    });

    expect(input.userWorkingDirToken).toBe('nonce.2026-01-01T00:00:00Z.signature');
  });

  it('leaves the form adapter free of userWorkingDir — the panel imports instead', () => {
    const input = createProjectInputFromPanel({
      name: 'Landing page',
      skillId: null,
      designSystemId: null,
      metadata: { kind: 'prototype', nameSource: 'user' },
    });

    expect(input.metadata?.userWorkingDir).toBeUndefined();
  });
});
