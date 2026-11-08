import { describe, expect, it, vi } from 'vitest';
import { captureStartupFailure } from '../src/startup-telemetry.js';

describe('personal packaged telemetry', () => {
  it('does not transmit startup reports even with a baked upstream key', async () => {
    const fetchImpl = vi.fn();
    const onCaptured = vi.fn();
    await captureStartupFailure({
      posthogKey: 'legacy-baked-key', posthogHost: 'https://metrics.example',
      distinctId: 'legacy-installation', event: 'packaged_runtime_failed',
      properties: { error_message: 'Local startup failure' },
    }, { fetchImpl, onCaptured });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onCaptured).not.toHaveBeenCalled();
  });
});
