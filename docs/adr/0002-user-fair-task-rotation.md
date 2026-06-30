# User-Fair Task Rotation

StarBuddy will distribute star tasks by user fairness rather than by repository creation time. Since each user has at most one promotion slot, the scheduler should rotate attention across eligible users' active promoted repositories so early users or early-created repositories do not permanently dominate the task pool. Fairness is measured by rewarded star actions received, not by impressions, claims, skips, expirations, or failed actions.

A promoted repository is only eligible for task rotation while its owner has enough credits to pay for the next rewarded star action. If the owner later earns enough credits again, the promotion becomes eligible automatically; lack of credits is not a paused state.

**Considered Options**

- Order by repository or task creation time: simple, but early promoted repositories can monopolize attention.
- Random selection: simple and less biased than FIFO, but can still produce streaks and is harder for users to reason about.
- User-fair rotation: more implementation work, but matches the product economy where users exchange attention for attention.
