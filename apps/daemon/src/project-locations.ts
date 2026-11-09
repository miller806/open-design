import { lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectLocationPrefs } from './app-config.js';
import { expandHomePrefix } from './home-expansion.js';
import { isSafeId } from './projects.js';

export const BUILT_IN_PROJECT_LOCATION_ID = 'default';
export const PROJECT_MANIFEST_RELATIVE_PATH = path.join('.open-design', 'project.json');

export interface ProjectLocation extends ProjectLocationPrefs {
  builtIn?: boolean;
}

export interface ProjectManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  skillId?: string | null;
  designSystemId?: string | null;
}

export function builtInProjectLocation(projectsDir: string): ProjectLocation {
  return {
    id: BUILT_IN_PROJECT_LOCATION_ID,
    name: 'OpenDesign projects',
    path: projectsDir,
    builtIn: true,
  };
}

export function allProjectLocations(projectsDir: string, external: ProjectLocationPrefs[] | undefined): ProjectLocation[] {
  return [builtInProjectLocation(projectsDir), ...(external ?? [])];
}

export function locationProjectDir(location: ProjectLocation, projectId: string): string {
  if (!isSafeId(projectId)) throw new Error('invalid project id');
  return path.join(location.path, projectId);
}

// Characters Windows forbids in a directory name, plus control characters that
// would make the folder unaddressable from a shell. A project folder is ONE path
// segment inside a location: no separators, no drive letters, no traversal.
const INVALID_FOLDER_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
// Device names Windows reserves at every level; a directory may not be called
// `con`, `nul`, `com1`, … even with an extension.
const WINDOWS_RESERVED_FOLDER_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const PROJECT_FOLDER_NAME_MAX = 64;

/**
 * Validate a user-supplied project folder name.
 *
 * Returns the cleaned single segment, or `null` when the name cannot be a
 * folder inside a project location. This is the create-time gate for
 * `POST /api/projects`'s `folderName`: a rejected name fails the request loudly
 * instead of silently falling back to the daemon-managed id folder, because the
 * whole point of the field is that the user chose the folder.
 */
export function sanitizeProjectFolderName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (INVALID_FOLDER_NAME_CHARS.test(trimmed)) return null;
  if (trimmed === '.' || trimmed === '..') return null;
  // Leading dots are hidden segments, which the imported-folder file API refuses
  // to traverse anyway; ending with a dot/double space is a Windows-only trap.
  if (trimmed.startsWith('.') || /\.$/.test(trimmed)) return null;
  if (WINDOWS_RESERVED_FOLDER_NAME.test(trimmed.replace(/\.[^.]*$/, ''))) return null;
  const capped = Array.from(trimmed).slice(0, PROJECT_FOLDER_NAME_MAX).join('').trim();
  if (!capped) return null;
  return capped;
}

/**
 * Best-effort folder name derived from a project title, for callers that want a
 * human-readable directory without asking the user to type one. Never rejects:
 * a title that cannot be a folder name falls back to `fallback` (the project
 * id), so project creation always succeeds.
 */
export function projectFolderNameFromTitle(title: unknown, fallback: string): string {
  if (typeof title === 'string') {
    // Collapse separators into single spaces first: `A/B` should become `A B`,
    // not be rejected, because the title is not a user folder choice.
    const softened = title.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
    const sanitized = sanitizeProjectFolderName(softened);
    if (sanitized) return sanitized;
  }
  return fallback;
}

function assertInsideLocation(locationRoot: string, projectDir: string): void {
  const relative = path.relative(locationRoot, projectDir);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('project directory escapes project location');
  }
}

export async function createLocationProjectDir(
  location: ProjectLocation,
  projectId: string,
  options: { folderName?: string | null } = {},
): Promise<string> {
  const root = await realpath(location.path);
  // The folder name is the user's choice when they supplied one; the project id
  // is only the fallback. Either way the directory is created, never adopted:
  // an existing folder must not be silently claimed as a brand-new project.
  const requested = options.folderName ? sanitizeProjectFolderName(options.folderName) : null;
  const base = requested ?? projectId;
  let candidate = base;
  for (let attempt = 2; attempt <= 500; attempt += 1) {
    const target = path.join(root, candidate);
    try {
      await mkdir(target, { recursive: false });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'EEXIST') {
        // A real directory already using this name is a genuine title collision
        // between two projects — suffix and continue. Anything else squatting
        // the name (a symlink, a file, a junction) is not adopted and not
        // routed around: fail the create rather than quietly landing in
        // `<name> (2)` while the user believes their chosen folder was used.
        let existing: Awaited<ReturnType<typeof lstat>> | null = null;
        try {
          existing = await lstat(target);
        } catch {
          existing = null;
        }
        if (!existing || existing.isSymbolicLink() || !existing.isDirectory()) {
          throw new Error('project directory must be a real directory');
        }
        candidate = `${base} (${attempt})`;
        continue;
      }
      throw err;
    }
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('project directory must be a real directory');
    const canonical = await realpath(target);
    assertInsideLocation(root, canonical);
    return canonical;
  }
  throw new Error('could not allocate a project directory inside the project location');
}

/**
 * A single directory name that cannot escape its parent.
 *
 * Scan/adoption reads directories the USER created, so a name only has to be a
 * plain path segment — project-id shape is not required (personal mode names
 * folders after the project title: `Q3 Launch`, `季度汇报`). The realpath +
 * containment check that follows is what actually keeps the result inside the
 * location.
 */
function isPlainChildSegment(name: string): boolean {
  if (!name) return false;
  if (name === '.' || name === '..') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return true;
}

export async function canonicalLocationChildDir(location: ProjectLocation, childName: string): Promise<string> {
  const root = await realpath(location.path);
  if (!isPlainChildSegment(childName)) throw new Error('invalid project directory name');
  const target = path.join(root, childName);
  const info = await lstat(target);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('project directory must be a real directory');
  const canonical = await realpath(target);
  assertInsideLocation(root, canonical);
  return canonical;
}

export function manifestPath(projectDir: string): string {
  return path.join(projectDir, PROJECT_MANIFEST_RELATIVE_PATH);
}

export async function ensureProjectLocation(locationPath: string): Promise<string> {
  const expanded = expandHomePrefix(locationPath.trim());
  if (!path.isAbsolute(expanded)) throw new Error(`project location must be an absolute path: ${locationPath}`);
  await mkdir(expanded, { recursive: true });
  return realpath(expanded);
}

export async function writeProjectManifest(projectDir: string, manifest: ProjectManifest): Promise<void> {
  const file = manifestPath(projectDir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(manifest, null, 2), 'utf8');
}

export async function readProjectManifest(projectDir: string): Promise<ProjectManifest | null> {
  try {
    const raw = await readFile(manifestPath(projectDir), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.schemaVersion !== 1) return null;
    if (typeof obj.id !== 'string' || !isSafeId(obj.id)) return null;
    if (typeof obj.name !== 'string' || !obj.name.trim()) return null;
    const createdAt = typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : Date.now();
    const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : createdAt;
    return {
      schemaVersion: 1,
      id: obj.id,
      name: obj.name.trim(),
      createdAt,
      updatedAt,
      skillId: typeof obj.skillId === 'string' ? obj.skillId : null,
      designSystemId: typeof obj.designSystemId === 'string' ? obj.designSystemId : null,
    };
  } catch (err: unknown) {
    const e = err as { code?: string; name?: string };
    if (e.code === 'ENOENT' || e.name === 'SyntaxError') return null;
    throw err;
  }
}

export async function scanProjectLocation(location: ProjectLocation): Promise<Array<{ dir: string; manifest: ProjectManifest }>> {
  const entries = await readdir(location.path, { withFileTypes: true });
  const found: Array<{ dir: string; manifest: ProjectManifest }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let dir: string;
    try {
      dir = await canonicalLocationChildDir(location, entry.name);
    } catch {
      continue;
    }
    const manifest = await readProjectManifest(dir);
    if (manifest) found.push({ dir, manifest });
  }
  return found;
}
