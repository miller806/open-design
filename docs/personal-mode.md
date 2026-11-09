# Personal mode (single machine, no cloud account)

This build is meant to be used by one person on one machine. **Personal mode** is
on by default and removes the cloud account system from the shell, while keeping
every local capability (agent CLIs, BYOK providers, design systems, skills,
artifacts, live artifacts, exports).

The mode does not delete the cloud code. It hides the *entry points* and changes
the defaults that make the app feel account-centric, so an upstream merge stays
reviewable and the cloud components keep their own tests.

## Two switches, one answer

| Switch | Where | Meaning |
|---|---|---|
| `personalMode` | `app-config.json` (`od config get personalMode`) | Saved preference. Defaults to **on** in this build. |
| `OD_PERSONAL_MODE` | daemon / desktop process env | Process-level pin. `1`/`true` forces the mode on, `0`/`false` forces it off, unset defers to the saved value. Outranks the saved preference so a config reset cannot re-enable cloud surfaces in a packaged personal build. |

Turn it off for a cloud-capable run:

```bash
od config set personalMode false          # saved preference
OD_PERSONAL_MODE=0 pnpm tools-dev         # one process
```

## What personal mode hides

- **Workspace identity**: `useWorkspaceContext()` answers with the local/signed-out
  shape and issues no workspace read at all. That is what keeps billing, member
  directories and the workspace project catalog from being fetched for an account
  this build does not use. `App` resolves the same projection for its own body,
  because App renders outside its own provider.
- **Entry rail**: the cloud account footer (`CloudSignInTip` / syncing /
  recovering states), the invite entry, and the Workspace switcher. The rail
  renders its local dock instead.
- **Top-right chrome**: the credits pill and the 升级 (upgrade) chip are AMR Cloud
  billing surfaces, so neither is rendered.
- **Home**: the invite banner and the registration invite host.
- **Onboarding**: the cloud landing (step 0). First run starts on the local
  runtime setup step with a local CLI preselected, and the CLI scan runs
  immediately. "Back" from that step leaves onboarding instead of returning to a
  cloud sign-in page it can no longer show.
- **Settings → Execution**: the cloud sign-in callout, and the AMR Cloud agent
  card (local CLIs + BYOK only).
- **Composer**: the AMR Cloud entry disappears from the agent menu
  (`isVisibleLocalCliAgent(agent, { personalMode })`).
- **Navigation guard**: the shell no longer bounces to the cloud identity gate
  when an AMR credential is missing, because there is no cloud identity to gate.

Execution therefore runs on an installed agent CLI (`claude`, `codex`, `qwen`,
`deepseek`, …) or a BYOK provider.

## What the daemon changes

Hiding the UI is not enough — the daemon has to stop treating this machine as a
cloud member, or local work gets adopted into a workspace the shell can no longer
see:

| Behaviour | Cloud-capable | Personal mode |
|---|---|---|
| Create with a resolvable Workspace identity | project is bound to that Workspace | never bound (`context` is forced null for the create) |
| `GET /api/projects` | only unbound projects (no-scope catalog) | **every local project** — one user, one machine, no other identity to protect it from |
| Workspace-scoped list | adopts unbound "legacy" projects into the personal Workspace | never adopts |

Without the last two, a project created while a vela session was active would be
bound, then vanish from the headerless catalog the personal shell lists.

## Project folders are yours

Every project lives in a folder you own, named the way you named the project —
not in a daemon-managed directory named after a project id.

1. **Settings → General → 项目位置 (Project locations)**: add a folder (for
   example `D:\design`). Add as many as you like and mark one as the default.
2. New projects are created in `<your location>/<project title>`. With personal
   mode on and no explicit default configured, the daemon picks the **first**
   configured location instead of the daemon-managed directory.
3. Two projects with the same title do not collide: the second becomes
   `<title> (2)`. An existing folder is never adopted as a new project.
4. The folder name can be set explicitly per create:

```bash
# CLI: choose location and folder name
od project create --name "Q3 Launch" --location <location-id> --folder "q3-launch"

# HTTP (what the Web sends)
POST /api/projects { "id": "...", "name": "Q3 Launch",
                     "projectLocationId": "<id>", "folderName": "q3-launch" }
```

`folderName` is exactly one path segment: separators, `.`/`..`, leading dots
(hidden names), Windows device names (`con`, `nul`, `lpt1`, …), trailing dots and
reserved characters are rejected with `400 BAD_REQUEST` rather than silently
falling back to an id folder.

Each project folder carries `.open-design/project.json` (schema version 1) so a
location can be re-scanned after being removed and re-added.

Existing projects keep the folder they already have; nothing is migrated
implicitly. Use a project location to move new work into your own directory
tree.

## Verification

- `apps/daemon/tests/project-locations-folder-name.test.ts` — folder-name
  validation, title derivation, collision suffixing, symlink refusal.
- `apps/daemon/tests/routes/projects.test.ts` — create lands in the named folder,
  rejects an unusable name, scan/adoption of title-named folders.
- `apps/daemon/tests/app-config.test.ts` — `personalMode` persistence and
  `OD_PERSONAL_MODE` precedence.
- `apps/web/tests/utils/visibleAgents.test.ts` — AMR hidden only in personal mode.
