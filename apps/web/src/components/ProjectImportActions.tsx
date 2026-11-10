import { useRef, useState } from 'react';
import { Button } from '@open-design/components';
import type { OpenDesignHostProjectImportSuccess } from '@open-design/host';
import type { ImportClaudeDesignOutcome } from './NewProjectPanel';
import { useOpenFolderImport } from './useOpenFolderImport';
import { useT } from '../i18n';
import { Icon } from './Icon';
import styles from './ProjectImportActions.module.css';

export function ProjectImportActions({ onImportFolder, onImportFolderResponse, onImportClaudeDesign }: {
  onImportFolder?: (baseDir: string) => Promise<void> | void;
  onImportFolderResponse?: (result: OpenDesignHostProjectImportSuccess) => Promise<void> | void;
  onImportClaudeDesign?: (file: File) => Promise<ImportClaudeDesignOutcome | void> | ImportClaudeDesignOutcome | void;
}) {
  const t = useT();
  const folder = useOpenFolderImport({ onImportFolder, onImportFolderResponse });
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.actions}>
      {folder.available ? <Button variant="ghost" disabled={folder.importing || busy} onClick={() => void folder.openFolder()} title={t('newproj.openFolder')} aria-label={t(folder.importing ? 'newproj.openingFolder' : 'newproj.openFolder')}>
        <Icon name="folder" size={14} /><span className={styles.label}>{t(folder.importing ? 'newproj.openingFolder' : 'newproj.openFolder')}</span>
      </Button> : null}
      {onImportClaudeDesign ? <>
        <input hidden type="file" accept=".zip,application/zip" ref={inputRef} onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file || busy) return;
          setBusy(true); setError(null);
          try {
            const result = await onImportClaudeDesign(file);
            if (result?.ok === false) setError(result.message ?? t('newproj.importClaudeZipTitle'));
          } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
          finally { setBusy(false); }
        }} />
        <Button variant="ghost" disabled={busy || folder.importing} onClick={() => inputRef.current?.click()}>
          <Icon name="import" size={14} />{t(busy ? 'newproj.importingClaudeZip' : 'newproj.importClaudeZip')}
        </Button>
      </> : null}
      {error || folder.error ? <span role="alert">{error ?? folder.error?.message}</span> : null}
    </div>
  );
}
