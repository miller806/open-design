// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectFolderChip } from '../../src/components/ProjectFolderChip';

const copy = vi.hoisted(() => ({ copyToClipboard: vi.fn(async () => true) }));
vi.mock('../../src/lib/copy-to-clipboard', () => ({ copyToClipboard: copy.copyToClipboard }));

afterEach(() => {
  cleanup();
  copy.copyToClipboard.mockClear();
});

const windowsDir = 'G:\\design\\personal-projects\\我的海报';

describe('project folder chip', () => {
  // Personal mode gives the folder to the user, so the conversation page has to
  // name it. Right-truncating a long path would drop the leaf, which is the only
  // segment that identifies the folder — the chip shows the tail instead and keeps
  // the full path in the tooltip and the clipboard payload.
  it('labels the last two path segments and keeps the full path available', () => {
    render(<ProjectFolderChip dir={windowsDir} />);
    const chip = screen.getByTestId('project-folder-chip');
    expect(chip.textContent).toContain('personal-projects\\我的海报');
    expect(chip.getAttribute('title')).toBe(windowsDir);
  });

  it('copies the full path on click', () => {
    render(<ProjectFolderChip dir={windowsDir} />);
    fireEvent.click(screen.getByTestId('project-folder-chip'));
    expect(copy.copyToClipboard).toHaveBeenCalledWith(windowsDir);
  });

  it('renders nothing when the directory is unknown', () => {
    render(<ProjectFolderChip dir={null} />);
    expect(screen.queryByTestId('project-folder-chip')).toBeNull();
  });
});
