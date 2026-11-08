// Compatibility surface for instrumentation callers during personal-edition
// cleanup. There is no browser SDK, tracking identity, or network transport.
import type { PostHog } from 'posthog-js';
import type { AnalyticsClientType, AnalyticsConfigureGlobals } from '@open-design/contracts/analytics';

interface AnalyticsContext {
  anonymousId: string;
  sessionId: string;
  clientType: AnalyticsClientType;
  locale: string;
  appVersion: string;
  // Whether this is the install's first analytics session (see
  // identity.ts#isFirstSession). Optional so callers that don't care
  // (error tracking) can omit it.
  isFirstSession?: boolean;
}

let configureGlobals: AnalyticsConfigureGlobals = {
  has_available_configure_cli: false,
  configure_type: 'unknown',
  configure_availability: 'unknown',
  runtime_type: 'none',
  cli_runnable: false,
  byok_runnable: false,
  amr_runnable: false,
};

export function getResolvedAnonymousId(): string | null { return null; }
export function getResolvedDeviceId(): string | null { return null; }
export function getConfigureGlobals(): AnalyticsConfigureGlobals { return configureGlobals; }
export function setConfigureGlobals(next: AnalyticsConfigureGlobals): void { configureGlobals = { ...next }; }
export function setAnalyticsUserId(_userId: string | null): void {}
export function setAnalyticsPersonProperties(_properties: Record<string, unknown>): void {}
export async function bootstrapExceptionTracking(_context: AnalyticsContext): Promise<void> {}
export async function getAnalyticsClient(_context: AnalyticsContext): Promise<PostHog | null> { return null; }
export function applyConsent(_consentGranted: boolean): void {}
export function applyIdentity(_installationId: string | null): void {}
export function capture(_client: PostHog | null, _args: {
  event: string; properties: Record<string, unknown>; insertId: string; requestId?: string | null;
}): void {}
