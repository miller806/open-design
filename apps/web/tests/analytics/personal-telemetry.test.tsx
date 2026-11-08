// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider, useAnalytics } from '../../src/analytics/provider';
import { applyConsent, applyIdentity, getAnalyticsClient, getResolvedDeviceId } from '../../src/analytics/client';
import { DEFAULT_CONFIG, mergeDaemonConfig } from '../../src/state/config';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('personal telemetry', () => {
  it('renders without fetching analytics config, tracking identity, or replacing fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    function Consumer() {
      const analytics = useAnalytics();
      analytics.setConsent(true);
      analytics.setIdentity('legacy-installation');
      analytics.track('page_view', { page_name: 'home' });
      return <span>Local design</span>;
    }
    render(<AnalyticsProvider><Consumer /></AnalyticsProvider>);
    expect(screen.getByText('Local design')).toBeTruthy();
    applyConsent(true);
    applyIdentity('legacy-installation');
    expect(await getAnalyticsClient({ anonymousId: 'legacy', sessionId: 'test', clientType: 'web', locale: 'en', appVersion: 'test' })).toBeNull();
    expect(getResolvedDeviceId()).toBeNull();
    expect(globalThis.fetch).toBe(fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not restore saved telemetry opt-ins or mint a new tracking identity', () => {
    const config = mergeDaemonConfig({ ...DEFAULT_CONFIG }, {
      telemetry: { metrics: true, content: true, artifactManifest: true },
    });
    expect(config.telemetry).toEqual({ metrics: false, content: false, artifactManifest: false });
    expect(config.installationId).toBeFalsy();
  });
});
