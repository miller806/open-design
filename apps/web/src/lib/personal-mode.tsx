import { createContext, useContext, type ReactNode } from 'react';

/**
 * Personal (single-machine, no-cloud) mode.
 *
 * This fork runs without the cloud account system: no AMR Cloud sign-in, no
 * Workspace switcher, no invites/team members, no billing or credits, and every
 * project folder lives on the local filesystem. The execution path is a local
 * agent CLI or a BYOK provider.
 *
 * The switch lives in `AppConfig.personalMode` (default ON for this build) and
 * reaches the daemon through `PUT /api/app-config`, where `OD_PERSONAL_MODE`
 * can pin it for packaged personal builds.
 *
 * The gates are deliberately placed on ENTRY POINTS, not inside the cloud
 * components themselves: `InviteDialog`, `WorkspaceSwitcher` and friends keep
 * rendering correctly for their own tests, they are simply never opened while
 * personal mode is on. Anything that mounts a cloud surface should read
 * `usePersonalMode()` and render nothing.
 *
 * Default `false` (cloud-capable) for any tree rendered without a provider, so
 * component tests that mount a single component are unaffected.
 */
const PersonalModeContext = createContext(false);

/**
 * Module-level mirror of the switch, for code that is not a React child of the
 * provider: fetch helpers, collab clients and cache modules that run outside any
 * component tree (or above the provider, like App's own boot effects). Reading a
 * module flag is the only way those paths can honour personal mode without
 * threading a prop through every collab module.
 */
let personalModeFlag = false;

/** Set by App on every render, before its children mount. */
export function setPersonalModeFlag(enabled: boolean): void {
  personalModeFlag = enabled;
}

/** True when personal mode is on, for non-React call sites. */
export function isPersonalModeEnabled(): boolean {
  return personalModeFlag;
}

export function PersonalModeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <PersonalModeContext.Provider value={enabled}>
      {children}
    </PersonalModeContext.Provider>
  );
}

/** True when the shell must hide every cloud account surface. */
export function usePersonalMode(): boolean {
  return useContext(PersonalModeContext);
}
