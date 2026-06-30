# StarBuddy Context

StarBuddy coordinates deliberate GitHub stars between users. The language below defines the product economy around repositories, active promotion, claims, and credits.

## Language

**User**:
A GitHub-authenticated participant who can promote one repository and star other users' promoted repositories.
_Avoid_: Account, member

**Repository**:
A public GitHub repository known to StarBuddy.
_Avoid_: Project when referring to the GitHub object

**Promoted Repository**:
A repository submitted by its owner to receive stars through StarBuddy.
Promoted repositories are retained even when they are not occupying the user's promotion slot.
_Avoid_: Bound repository, linked repository

**Active Promoted Repository**:
The single promoted repository from a user that is currently eligible to appear in the star task pool.
_Avoid_: Active binding, selected project

**Paused Promoted Repository**:
A promoted repository that remains in the user's promotion slot but is temporarily not eligible to appear in the star task pool.
It still occupies the promotion slot.
_Avoid_: Removed repository, deleted promotion

**Inactive Promoted Repository**:
A retained promoted repository that does not occupy the user's promotion slot and is not eligible to appear in the star task pool.
_Avoid_: Paused repository when the repository no longer occupies the promotion slot

**Promotion Slot**:
The right for a user to have one active promoted repository at a time.
_Avoid_: Repository limit, binding limit

**Promotion Switch**:
A user's change to which promoted repository occupies their promotion slot, limited to once per server-local calendar day.
The first repository placed into an empty promotion slot is not a promotion switch.
Pausing a promoted repository does not remove it from the promotion slot.
Resuming the same paused promoted repository is not a promotion switch.
Switching back to a previously active promoted repository is a promotion switch.
_Avoid_: Rebind, relink

**Switch Reset Time**:
The next server-local calendar-day boundary when a user may make another promotion switch.
_Avoid_: Cooldown when referring to calendar-day reset

**Star Task**:
An available opportunity for another user to star an active promoted repository.
A promoted repository keeps its star task even when it is not currently eligible; eligibility is controlled by promotion-slot occupancy, pause state, and owner credits.
_Avoid_: Job, campaign

**Fair Task Rotation**:
The task distribution rule that gives each eligible user-owned promotion slot a fair chance to receive star actions instead of favoring older repositories.
Fairness is measured by rewarded star actions received by the active promoted repository, not by impressions, claims, skips, expirations, or failed actions.
_Avoid_: FIFO queue, oldest repository first

**Task Claim**:
A temporary reservation of a star task by a user before they complete, skip, or let it expire.
_Avoid_: Assignment, lock

**Star Action**:
A recorded attempt by a user to star a promoted repository, whether rewarded or not.
_Avoid_: Like, vote

**Credit**:
The internal unit spent by promoted repository owners and earned by users who complete rewarded star actions.
_Avoid_: Point, token

**Eligible Promotion**:
An active promoted repository whose owner has enough credits to pay for a rewarded star action.
Eligibility returns automatically when the owner earns enough credits again.
_Avoid_: Available repository when eligibility depends on credits
