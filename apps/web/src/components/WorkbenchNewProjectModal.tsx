import { useEffect, useState, type ComponentProps } from 'react';
import type { ConnectorDetail } from '@open-design/contracts';
import { NewProjectModal } from './NewProjectModal';
import { fetchConnectorCatalogSnapshot } from './connectors-state';

/** Workbench-local host: opening and cancelling never changes the project route. */
export function WorkbenchNewProjectModal(props: ComponentProps<typeof NewProjectModal>) {
  const [connectors, setConnectors] = useState<ConnectorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void fetchConnectorCatalogSnapshot().then((next) => {
      if (!cancelled) {
        setConnectors(next);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  return <NewProjectModal {...props} connectors={connectors} connectorsLoading={loading} />;
}
