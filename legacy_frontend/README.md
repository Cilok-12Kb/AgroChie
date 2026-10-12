# Legacy frontend snapshot (reference only)

These files were moved out of `agrochie-web/src` because the previous frontend routes used mock repositories, fake login or local-only predictions and did not call Express API.

They are retained to preserve prior logic for comparison. **They are not compiled into the active Next.js application.** To migrate any past business behavior, review it carefully against the actual backend contract before reintroducing it in `agrochie-web/src/features/console`.
