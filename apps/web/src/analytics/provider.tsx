'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AnalyticsConfigureGlobals } from '@open-design/contracts/analytics';
import { APP_VERSION_PLACEHOLDER } from './app-version';
import { setChatCorrelation } from '../observability/chat-context';
import { randomUUID } from '../utils/uuid';

interface AnalyticsContextValue {
  // The track helper accepts any event/props pair; per-event safety is
  // enforced by the typed wrappers in events.ts that consumers use.
  track: (
    event: string,
    properties: Record<string, unknown>,
    options?: { requestId?: string; insertId?: string },
  ) => void;
  // Toggle PostHog capture without unmounting the provider. App.tsx calls
  // this from a useEffect that watches `config.telemetry?.metrics` so a
  // Privacy toggle takes effect immediately, not on next reload.
  setConsent: (granted: boolean) => void;
  // Switch PostHog's distinct_id to the new installationId after a
  // Delete-my-data rotation. App.tsx watches `config.installationId` and
  // calls this whenever the daemon rotates it; PostHog's localStorage
  // state is reset() then identify()'d to the new id so the next event
  // batch is fully decoupled from the deleted identity.
  setIdentity: (installationId: string | null) => void;
  // Push the configure-state triplet (has_available_configure_cli /
  // configure_type / configure_availability) to the PostHog global
  // register so every subsequent capture inherits it. Called from
  // App.tsx whenever the user's execution-mode config changes (mode
  // switch, agent select, BYOK save, CLI rescan).
  setConfigureGlobals: (next: AnalyticsConfigureGlobals) => void;
  // Register / unregister the AMR account id as the `user_id` public
  // param. Called from App.tsx whenever the AMR login status resolves;
  // null on logout so later events drop the stale id.
  setUserId: (userId: string | null) => void;
  anonymousId: string;
  sessionId: string;
  newRequestId: () => string;
}

let runtimeAppVersion: string | null = null;
let runtimeAppVersionPromise: Promise<string | null> | null = null;

// Shared single-flight fetch of the daemon-pinned version. Cached at module
// scope so the hook, the capture paths, and repeated calls all settle on one
// /api/version round-trip and the same resolved value.
async function loadRuntimeAppVersion(): Promise<string | null> {
  if (runtimeAppVersion) return runtimeAppVersion;
  if (!runtimeAppVersionPromise) {
    runtimeAppVersionPromise = (async () => {
      try {
        const res = await fetch('/api/version');
        if (!res.ok) return null;
        const body = (await res.json()) as {
          version?: { version?: string; channel?: string };
        };
        // The daemon has always answered with `channel` alongside `version`
        // (see `resolveAppVersionInfo`); we simply dropped it on the floor.
        // It is the one dimension that separates "the packaged stable build
        // is janky" from "a dev daemon is janky", so a chat-health dashboard
        // without it cannot tell a real regression from local noise. Stamped
        // before the early return below so a daemon that reports a channel but
        // no version still contributes it.
        setChatCorrelation({ release_channel: body?.version?.channel });
        const next = body?.version?.version;
        if (!next) return null;
        runtimeAppVersion = next;
        return next;
      } catch {
        return null;
      } finally {
        // Allow a retry on the next call when the fetch yielded nothing.
        if (!runtimeAppVersion) runtimeAppVersionPromise = null;
      }
    })();
  }
  return runtimeAppVersionPromise;
}

// Capture paths call this before emitting so an event never ships with the
// placeholder once the real version is knowable. When the caller already has
// a real version (state resolved) it returns immediately; otherwise it awaits
// the shared fetch. This closes the race where high-frequency early events
// (page_view in particular) fired before the version-resolving effect re-ran
// and re-registered the PostHog super-property, permanently stamping them
// with app_version='0.0.0'.
export async function resolveAppVersionForCapture(current: string): Promise<string> {
  if (current && current !== APP_VERSION_PLACEHOLDER) return current;
  return (await loadRuntimeAppVersion()) ?? current;
}

// App version is read from a runtime endpoint rather than at build time so
// the same web bundle reports the daemon-pinned version even when running
// against a newer/older daemon during dev. The hook exposes the placeholder
// for first paint, but capture() paths call resolveAppVersionForCapture() so
// early events wait for the real value instead of permanently shipping with
// app_version='0.0.0'. Earlier `useRef` shape silently broke even the hook:
// ref writes don't trigger re-renders, so every event shipped with '0.0.0'.
export function useAppVersion(): string {
  const [version, setVersion] = useState(APP_VERSION_PLACEHOLDER);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await loadRuntimeAppVersion();
      if (!cancelled && next) setVersion(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return version;
}


// Keep instrumentation call sites inert while their owning cloud features are
// removed. This provider installs no fetch wrapper, listeners, or identities.
const LOCAL_ANALYTICS: AnalyticsContextValue = {
  track: () => undefined,
  setConsent: () => undefined,
  setIdentity: () => undefined,
  setConfigureGlobals: () => undefined,
  setUserId: () => undefined,
  anonymousId: '',
  sessionId: '',
  newRequestId: () => randomUUID(),
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAnalytics(): AnalyticsContextValue {
  return LOCAL_ANALYTICS;
}
