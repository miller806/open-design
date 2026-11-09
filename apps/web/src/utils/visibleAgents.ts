import type { AgentInfo } from '../types';

const HIDDEN_LOCAL_CLI_AGENT_IDS = new Set(['byok-opencode']);

/**
 * Whether an agent belongs in a "local CLI" list.
 *
 * `personalMode` additionally hides the AMR Cloud agent (`amr`): that entry is a
 * cloud-account sign-in path for credits, and a personal install has no cloud
 * identity to sign into. It stays visible by default so the cloud-capable shell
 * and every existing component test keep their current list.
 */
export function isVisibleLocalCliAgent(
  agent: Pick<AgentInfo, 'id'>,
  options: { personalMode?: boolean } = {},
): boolean {
  if (HIDDEN_LOCAL_CLI_AGENT_IDS.has(agent.id)) return false;
  if (options.personalMode && agent.id === 'amr') return false;
  return true;
}

/**
 * How many detected agents the picker will actually present as usable.
 *
 * Counting the raw detection list instead would include agents that are
 * deliberately hidden from the UI, so a rescan could announce more CLIs than
 * the list beneath it ever renders — "3 available" above a list of two.
 */
export function availableVisibleAgentCount(agents: AgentInfo[]): number {
  return agents.filter((agent) => isVisibleLocalCliAgent(agent) && agent.available)
    .length;
}

export function deepSeekHarnessNeedsSetup(agent: AgentInfo): boolean {
  return (
    agent.id === 'deepseek-harness' &&
    !agent.available &&
    Boolean(agent.path) &&
    Boolean(
      agent.diagnostics?.some(
        (diagnostic) => diagnostic.reason === 'runtime-profile-incompatible',
      ),
    )
  );
}
