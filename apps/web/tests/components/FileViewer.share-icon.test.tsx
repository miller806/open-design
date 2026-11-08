// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { FileOpsSummary } from '../../src/components/FileOpsSummary';
import { FileViewer } from '../../src/components/FileViewer';
import type { ProjectFile } from '../../src/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('keeps local export without exposing toolbar or artifact-card publication', () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({})));
  const file: ProjectFile = {
    name: 'index.html', path: 'index.html', type: 'file', size: 100,
    mtime: 1710000000, kind: 'html', mime: 'text/html',
    artifactManifest: {
      version: 1, kind: 'html', title: 'Page', entry: 'index.html',
      renderer: 'html', exports: ['html'],
    },
  };
  render(
    <FileOpsSummary projectId="project-1" onPublish={vi.fn()} entries={[{
      path: 'index.html', fullPath: '/repo/index.html', ops: ['write'],
      opCounts: { read: 0, write: 1, edit: 0, delete: 0 }, total: 1, status: 'done',
    }]} />
  );
  const viewer = render(<FileViewer projectId="project-1" projectKind="prototype" file={file}
    liveHtml="<html><body>Hello</body></html>" />);
  const exportButton = within(viewer.container).getByRole('button', { name: /^Export$/ });
  expect(exportButton).toHaveAttribute('data-artifact-anchor');
  expect(within(viewer.container).queryByRole('button', { name: /^Share$/ })).toBeNull();
  expect(screen.queryByTestId('artifact-card-publish-index.html')).toBeNull();
});
