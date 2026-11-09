import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/copy-to-clipboard';
import { Icon } from './Icon';
import styles from './ProjectFolderChip.module.css';

/**
 * A path is too long for a chrome row, and truncating its right edge would drop
 * the one segment that identifies the folder. Show the last two segments
 * (`personal-projects/我的海报`) and keep the full path in the tooltip and the
 * clipboard payload.
 */
function compactDirLabel(dir: string): string {
  const separator = dir.includes('\\') ? '\\' : '/';
  const segments = dir.split(/[\\/]+/).filter(Boolean);
  if (segments.length === 0) return dir;
  const tail = segments.length === 1 ? segments : segments.slice(-2);
  const label = tail.join(separator);
  // A single very long segment (a folder literally named with a sentence) is
  // still bounded by the chip's CSS ellipsis.
  return label;
}

/**
 * Where this project actually lives on disk.
 *
 * Personal mode gives the user the project folder — they choose the location and
 * the folder is named after the project — so the conversation page has to say
 * which directory the agent is working in. Without it the folder is invisible
 * until something goes wrong and a path shows up in an error.
 *
 * Shows the folder NAME with the full path in the tooltip, and clicking copies
 * the full path (that is what someone who wants the directory actually does with
 * it: paste it into a terminal or a file manager).
 */
export function ProjectFolderChip({ dir }: { dir: string | null }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (!dir) return;
    const ok = await copyToClipboard(dir);
    if (!ok) return;
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = undefined;
    }, 1600);
  }, [dir]);

  if (!dir) return null;
  const name = compactDirLabel(dir);

  return (
    <button
      type="button"
      className={`${styles.chip}${copied ? ` ${styles.copied}` : ''}`}
      onClick={() => void copy()}
      title={dir}
      aria-label={dir}
      data-testid="project-folder-chip"
      data-copied={copied ? 'true' : undefined}
    >
      <Icon name="folder" size={13} />
      <span className={styles.name}>{name}</span>
    </button>
  );
}
