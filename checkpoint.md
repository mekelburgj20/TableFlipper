<!-- AI HANDOVER PROMPT -->
**Project Status:** 
"TableFlipper" is a fully functional Discord bot for managing pinball tournaments. The codebase features robust iScored automation, intelligent state reconciliation, and a highly flexible command structure.

**Recent Work:**
1.  **Unified Commands:** Refactored `/list-scores` and `/submit-score` to support both tournament-based and table-based interaction. Implemented autocomplete for all current lineup games.
2.  **Immediate Weekly Activation:** Refined `createGame` logic so that Weekly and Monthly table picks activate immediately on iScored, while Daily picks retain their 24-hour buffer.
3.  **State Reconciliation:** Implemented automatic DB cleanup during sync/maintenance sweeps to identify and hide "ghost" games that are no longer present on iScored.
4.  **Scheduled Maintenance Refinement:** Updated Weekly maintenance to trigger at 11:00 PM Central on Wednesdays.
5.  **Multi-Channel Routing:** Fully operational routing for tournament-specific Discord announcements and timeout notifications.

**Current Context:**
*   The bot handles DG, WG, and MG cycles autonomously.
*   Weekly maintenance/cleanup is at 11 PM Central on Wednesdays.
*   Database state is automatically reconciled against iScored during sync.
*   Autocomplete lists are strictly limited to active/lineup games.

**Next Actions:**
1.  **Community Styles:** Investigate applying styles to games via the DB.
2.  **Admin Override:** Implement moderator nomination overrides.
3.  **OCR Verification:** Research lightweight OCR for automatic score validation.

**Files to Watch:**
*   `src/discordBot.ts` (Command handlers & Autocomplete)
*   `src/database.ts` (State & search logic)
*   `src/sync-state.ts` (Reconciliation logic)
*   `src/maintenance.ts` (Phase 0 sync sweeps)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project (Update 6)

**Date:** February 18, 2026

## Project Summary: Command Unification & State Intelligence

This update represents a significant leap in the bot's UX and backend reliability. It unifies the command structure for better flexibility and introduces "State Intelligence" to ensure the bot's local memory always matches the live iScored lineup.

### Key Changes Implemented:

#### 1. Unified Standings & Submissions
*   **Refactored `/list-scores`**: A single command that can show all active grinds (default), or be filtered by specific tournament type or table name.
*   **Refactored `/submit-score`**: Users can now submit scores by selecting a specific active table from an autocomplete list OR by tournament type.
*   **Intelligent Autocomplete**: Autocomplete lists now filter based on context:
    *   Listings: Shows all games currently in the lineup (Active or Locked).
    *   Submissions: Shows ONLY active (unlocked) games.

#### 2. Immediate Weekly Rotation
*   **Zero-Buffer Weekly/Monthly**: Weekly and Monthly grinds now skip the 24-hour buffer. When a winner picks a table, it is immediately unlocked and unhidden on iScored.
*   **Preserved DG Buffer**: The Daily Grind maintains its 1-day lead time to ensure a consistent daily cycle.
*   **Announcement Accuracy**: Discord messages now dynamically state whether a game is "ready for play right now" or starting at a future time.

#### 3. Automatic State Reconciliation
*   **Ghost Game Elimination**: Implemented a reconciliation phase in `runStateSync` and the daily maintenance sweep. The bot now automatically identifies games in its DB that have been deleted from iScored and marks them as `HIDDEN`.
*   **Lineup Accuracy**: This ensures that autocomplete lists never show old historical games or deleted test entries.
*   **Maintenance "Phase 0"**: Added an initial sync sweep to the maintenance routine to ensure manually created games on iScored are "adopted" and promoted correctly.

#### 4. Scheduling Precision
*   **WG End Time**: Successfully moved Weekly maintenance to 11:00 PM Central on Wednesdays to align with the community's desired end-of-week timing.

## Final Status
The bot is now more intuitive for users and more self-healing for administrators. State synchronization is robust, and the new command structure provides a professional, streamlined interface for tournament participation.
