# One Active Promoted Repository Per User

StarBuddy will allow each user to have only one active promoted repository in the star task pool at a time. Users may own or submit other public repositories, but only one can be active for promotion, because the scarce resource is not repository storage but other users' attention and available star actions.

**Considered Options**

- Allow unlimited active promoted repositories per user: simple, but lets one user flood the task pool and makes the number of promoted repositories grow faster than available star actors.
- Allow two active promoted repositories per user: gives users more flexibility, but still lets repository supply grow faster than the human contribution base in early usage.
- Allow one active promoted repository per user: stricter, but keeps the promotion economy closer to one user contributing attention and receiving attention for one current target.

**Consequences**

Users may switch which promoted repository occupies their promotion slot, but only once per server-local calendar day rather than on a rolling 24-hour cooldown. The first repository placed into an empty promotion slot does not consume the daily switch. The frontend should show the server-provided time remaining until the next switch reset and update that countdown live. Task distribution should still be fair across users, not merely across repositories, because the active repository cap alone does not solve scheduling fairness.

Users may pause the repository currently occupying their promotion slot, but they may not remove it as a way to regain an empty slot. A paused promoted repository still occupies the promotion slot. Pausing only stops task-pool eligibility; it does not erase the promoted repository or bypass the daily switch rule. Resuming the same paused promoted repository does not consume the daily switch.

Promoted repositories remain stored even when they are not occupying the user's promotion slot, so users can switch back later without losing repository history.

Each promoted repository keeps its star task even when it is not active. Eligibility is controlled by whether the repository occupies the user's promotion slot, whether it is paused, and whether the owner has enough credits.

When a user switches from one promoted repository to another, the previous repository becomes inactive, not paused. Active means occupying the promotion slot and eligible for distribution, paused means occupying the promotion slot but temporarily not eligible, and inactive means retained but not occupying the promotion slot.

Switching back to a previously active promoted repository consumes the daily promotion switch, because the promotion slot changed to a different repository.

When the daily promotion switch has already been used, the frontend should disable controls that would change the promotion slot and show a live countdown until the next server-local switch reset. Actions that do not change the promotion slot remain available: pausing the current active repository, resuming the current paused repository, and submitting another repository without making it active.
