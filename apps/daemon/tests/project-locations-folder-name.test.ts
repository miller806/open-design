import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createLocationProjectDir,
  projectFolderNameFromTitle,
  sanitizeProjectFolderName,
} from '../src/project-locations.js';

// Personal mode gives the user the project folder instead of naming it after a
// project id. Two behaviours carry that promise and are pinned here:
//   1. a name the filesystem cannot hold is REJECTED (the create request fails
//      loudly) rather than silently replaced by the daemon-managed id folder;
//   2. the directory on disk is the requested name, and a second project with
//      the same name gets a suffixed sibling instead of colliding.
describe('sanitizeProjectFolderName', () => {
  it('accepts a plain folder name, including spaces and non-ASCII', () => {
    expect(sanitizeProjectFolderName('My Poster')).toBe('My Poster');
    expect(sanitizeProjectFolderName('  季度汇报  ')).toBe('季度汇报');
    expect(sanitizeProjectFolderName('brand-2_0')).toBe('brand-2_0');
  });

  it('rejects anything that is not a single, addressable path segment', () => {
    // Separators and drive letters would escape the project location.
    expect(sanitizeProjectFolderName('a/b')).toBeNull();
    expect(sanitizeProjectFolderName('a\\b')).toBeNull();
    expect(sanitizeProjectFolderName('C:')).toBeNull();
    expect(sanitizeProjectFolderName('..')).toBeNull();
    expect(sanitizeProjectFolderName('.')).toBeNull();
    // Hidden names are the same segments the imported-folder file API refuses.
    expect(sanitizeProjectFolderName('.ssh')).toBeNull();
    // Windows device names and trailing dots cannot name a directory.
    expect(sanitizeProjectFolderName('con')).toBeNull();
    expect(sanitizeProjectFolderName('LPT1')).toBeNull();
    expect(sanitizeProjectFolderName('trailing.')).toBeNull();
    // Reserved characters and control characters.
    expect(sanitizeProjectFolderName('a<b')).toBeNull();
    expect(sanitizeProjectFolderName('a|b')).toBeNull();
    expect(sanitizeProjectFolderName('a\u0000b')).toBeNull();
    // Empty and non-string input.
    expect(sanitizeProjectFolderName('   ')).toBeNull();
    expect(sanitizeProjectFolderName(undefined)).toBeNull();
    expect(sanitizeProjectFolderName(42)).toBeNull();
  });

  it('caps the segment length instead of rejecting a long title', () => {
    const capped = sanitizeProjectFolderName('x'.repeat(200));
    expect(capped).toHaveLength(64);
  });
});

describe('projectFolderNameFromTitle', () => {
  it('turns a title into a folder name rather than failing the create', () => {
    expect(projectFolderNameFromTitle('Q3 / Launch', 'id-1')).toBe('Q3 Launch');
    expect(projectFolderNameFromTitle('  ', 'id-2')).toBe('id-2');
    expect(projectFolderNameFromTitle('.hidden', 'id-3')).toBe('id-3');
    expect(projectFolderNameFromTitle(undefined, 'id-4')).toBe('id-4');
  });
});

describe('createLocationProjectDir folder naming', () => {
  let locationRoot: string;

  beforeEach(async () => {
    locationRoot = await mkdtemp(path.join(tmpdir(), 'od-location-'));
  });

  afterEach(async () => {
    await rm(locationRoot, { recursive: true, force: true });
  });

  const location = () => ({ id: 'loc', name: 'Loc', path: locationRoot });

  it('creates the folder under the requested name', async () => {
    const dir = await createLocationProjectDir(location(), 'project-id', {
      folderName: 'My Poster',
    });
    expect(path.basename(dir)).toBe('My Poster');
    expect(await readdir(locationRoot)).toEqual(['My Poster']);
  });

  it('falls back to the project id when no name was supplied', async () => {
    const dir = await createLocationProjectDir(location(), 'project-id');
    expect(path.basename(dir)).toBe('project-id');
  });

  it('suffixes a colliding name instead of claiming the existing folder', async () => {
    const first = await createLocationProjectDir(location(), 'project-one', {
      folderName: 'Landing',
    });
    const second = await createLocationProjectDir(location(), 'project-two', {
      folderName: 'Landing',
    });
    expect(path.basename(first)).toBe('Landing');
    expect(path.basename(second)).toBe('Landing (2)');
    expect(await readdir(locationRoot)).toEqual(['Landing', 'Landing (2)']);
  });
});
