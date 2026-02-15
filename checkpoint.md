<!-- AI HANDOVER PROMPT -->
**Project Status:** 
"TableFlipper" is a fully functional Discord bot for managing pinball tournaments. The codebase is on the `feature/tasks-update` branch, featuring robust iScored automation and state-of-the-art cleanup logic.

**Recent Work:**
1.  **Cleanup Overhaul:** Implemented a reliable cleanup sweep that deletes old locked tables while preserving active games. Combined into a single `/trigger-cleanup` command.
2.  **Robust Automation:** Rewrote iScored UI interactions to use direct JavaScript execution (`evaluate`) and `busyModal` detection, significantly improving stability during SPA transitions.
3.  **Automated Suffixes:** `createGame` now automatically appends tournament suffixes (e.g., " DG") to game names on iScored.
4.  **State Management:** Enhanced `sync-state` and cleanup logic to automatically handle manually created or untracked games by importing them as `COMPLETED` records.
5.  **Logging:** Consolidated all maintenance and automation logs into the persistent `data/bot.log` file.

**Current Context:**
*   The bot handles DG, WG, and MG cycles autonomously.
*   Cleanup is scheduled for Wednesdays at 11 PM Central.
*   Database schema is mature and synchronized.

**Next Actions:**
1.  **Community Styles:** Investigate applying styles to games via the DB.
2.  **Admin Override:** Implement moderator nomination overrides.
3.  **VPXS API:** Integrate the Virtual Pinball Spreadsheet API for expanded table lists.

**Files to Watch:**
*   `src/iscored.ts` (Core automation)
*   `src/maintenance.ts` (Maintenance & Cleanup logic)
*   `src/discordBot.ts` (Interaction handling)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project (Update 4)

**Date:** February 15, 2026

## Project Summary: Advanced Automation & Reliable Cleanup Sweep

This update represents a major stabilization of the bot's core automation engine. It addresses timing issues inherent in Single Page Applications (SPA) and implements a sophisticated, safe cleanup routine for tournament history.

### Key Changes Implemented:

#### 1. Robust iScored UI Engine
*   **Bypassing UI Interception:** Implemented `waitForBusyModal` to detect and wait for iScored's "Processing..." overlay, preventing click failures during transitions.
*   **Direct Execution:** Switched critical actions (like clicking "Delete" or "Confirm") from Playwright's `click()` to direct JavaScript `evaluate(() => el.click())`. This ensures actions are performed even if the UI is slow to respond or covered by transparent elements.
*   **Dropdown Resilience:** Rewrote game selection to use internal iScored IDs rather than names, providing 100% accurate targeting in the dropdown menus.

#### 2. Advanced Cleanup & Rotation Logic
*   **Delayed Deletion:** Refined the logic so Daily and Weekly tables remain visible (but locked) until a separate reset event on Wednesday night (11 PM Central).
*   **Consolidated Cleanup:** Added a new `/trigger-cleanup` command that moderator can use to sweep any or all tournament types.
*   **Intelligent Sweep:** The cleanup routine now cross-references every visible game against the DB's `ACTIVE` record. It intelligently deletes stray games or old completed ones while protecting the current tournament.
*   **Auto-Import Fallback:** If the bot finds a game on iScored that isn't in its DB, it now automatically imports it as a `COMPLETED` record so it can be cleaned up safely.

#### 3. UX & Consistency Polish
*   **Automated Naming:** The bot now automatically appends the correct suffix (e.g., " DG") to game names during creation, ensuring consistency across manual and random picks.
*   **Enhanced Logging:** Refactored the entire automation and maintenance suite to use a persistent file logger (`data/bot.log`), providing a detailed audit trail for every browser step.
*   **Interaction Refinement:** Updated `/trigger-cleanup` to provide a summary of all swept tournaments in Discord.

## Final Status
The bot is now highly resilient to website lag and navigation flakiness. The cleanup process is safe, thorough, and can be manually overridden. State synchronization between the site and the database is now handled automatically during the cleanup sweep.
