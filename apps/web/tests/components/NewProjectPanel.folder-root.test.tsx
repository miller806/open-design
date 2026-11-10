// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewProjectPanel } from '../../src/components/NewProjectPanel';
import { I18nProvider } from '../../src/i18n';

/** A required folder must reach the full creation payload without losing form selections. */
const pickedFolder = 'C:/Users/me/designs/landing-page';
const importFolder = vi.fn(async (_baseDir: string, _name: string) => undefined);
const onCreate = vi.fn();

vi.mock('../../src/providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/providers/registry')>();
  return {
    ...actual,
    // The native picker is a daemon dialog; the test supplies its answer.
    openFolderDialog: async () => pickedFolder,
  };
});

function renderPanel() {
  return render(
    <I18nProvider initial="en">
      <NewProjectPanel
        skills={[]}
        designSystems={[]}
        defaultDesignSystemId={null}
        templates={[]}
        promptTemplates={[]}
        onCreate={onCreate}
        requireProjectFolder
        mediaProviders={{}}
        connectors={[]}
        connectorsLoading={false}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  onCreate.mockReset();
  importFolder.mockReset();
  // jsdom ships no ResizeObserver; the panel observes its tab strip.
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('creates the project in the folder the user picked', async () => {
  renderPanel();

  fireEvent.click(await screen.findByTestId('new-project-choose-folder'));
  await waitFor(() => expect(screen.getByTestId('new-project-folder-path')).toHaveValue(pickedFolder));

  fireEvent.click(screen.getByTestId('create-project'));

  await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({metadata: expect.objectContaining({userWorkingDir: pickedFolder, kind: 'prototype'})}));
  expect(importFolder).not.toHaveBeenCalled();
});

it('uses the name the user typed for the chosen folder', async () => {
  renderPanel();
  fireEvent.change(await screen.findByPlaceholderText(/project name/i), {
    target: { value: 'Q3 Landing' },
  });
  fireEvent.click(screen.getByTestId('new-project-choose-folder'));
  await waitFor(() => expect(screen.getByTestId('new-project-folder-path')).toBeTruthy());
  fireEvent.click(screen.getByTestId('create-project'));
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({name: 'Q3 Landing', metadata: expect.objectContaining({userWorkingDir: pickedFolder})})));
});

it('cannot create a project before a folder is chosen', async () => {
  renderPanel();
  const create = await screen.findByTestId('create-project');
  expect(create).toBeDisabled();
  fireEvent.click(create);
  expect(onCreate).not.toHaveBeenCalled();
  expect(importFolder).not.toHaveBeenCalled();
});

it('accepts a pasted folder path and keeps the selected project type', async () => {
  renderPanel();
  fireEvent.click(screen.getByRole('tab', {name: 'Slide deck'}));
  fireEvent.change(screen.getByTestId('new-project-folder-path'), {target: {value: pickedFolder}});
  fireEvent.click(screen.getByTestId('create-project'));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({metadata: expect.objectContaining({kind: 'deck', userWorkingDir: pickedFolder})}));
});
