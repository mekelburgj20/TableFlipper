<!-- AI HANDOVER PROMPT -->
**Project Status:** 
We are working on "TableFlipper", a Discord bot for managing pinball tournaments. The codebase is currently on the `main` branch, fully up-to-date with recent feature merges.

**Recent Work:**
1.  **Refactoring:** Renamed `/submitscore-dg` to `/submit-score` and parameter `game-type` to `grind-type` globally.
2.  **Reliability:** Fixed critical bugs in score submission (handling disabled inputs via JS) and maintenance navigation (session persistence).
3.  **Features:** Added `/list-active` command, persistent logging (`src/logger.ts`), score submission confirmation UI, "Surprise Me" random picker, and "Manual Override" for game injection.
4.  **Testing:** Created a comprehensive test suite (`src/tests/`) and `TEST_PLAN.md`.

**Current Context:**
*   The bot is running stably in "Headless" mode.
*   Database schema is synced and includes `tables`, `games`, `winners`.
*   `npm run sync-state` is available to fix database/site mismatches.

**Next Actions:**
1.  **VPXS Integration (Item 4 in TODO):** This is BLOCKED. The user was supposed to provide API info in `iScored_API.md` but it contained unrelated info. The user has since updated @TODO.md to reflect the api info is actually here @virtualpinballspreadsheet_API
2.  **Tags Integration (Item 3 in TODO):** Use the provided `Tags_outerHTML` file to implement tagging games with their grind type ID on creation.
3.  **Community Styles (Future):** Investigate applying styles to games.

**Files to Watch:**
*   `src/discordBot.ts` (Command handling)
*   `src/iscored.ts` (Playwright automation)
*   `src/database.ts` (SQLite logic)
*   `TODO.md` (Task list)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project

**Date:** February 10, 2026

## Project Summary: Major Architectural Refactor - Database Driven

This checkpoint marks a significant architectural overhaul, transitioning the bot from a file-based state management system to a robust SQLite database-driven approach. This change addresses critical reliability concerns, improves data integrity, and lays the groundwork for future features.

### Key Changes Implemented:

#### 1. Database Integration (SQLite)
*   **Persistent State Management:** All dynamic bot state, including tournament history, game status (queued, active, completed), and picker information, is now stored in a lightweight SQLite database (`data/tableflipper.db`).
*   **Robustness:** This eliminates the fragility of file-based storage (`history.json`, `pickerState.json`) and provides a single, consistent source of truth, making maintenance operations more idempotent and resilient to partial failures.
*   **Migration:** A one-time migration script (`src/migrate-history.ts`) was implemented and executed to transfer existing winner data from `history.json` into the new SQLite `winners` table.

#### 2. Dynasty Rule Re-enabled
*   **Bug Fix:** The temporary override for the Dynasty Rule (`DISABLE_DYNASTY_RULE_TEMPORARILY`) has been removed, and the rule is now fully active, preventing repeat winners from picking consecutive tables.

#### 3. Granular Maintenance Triggers
*   **Enhanced Control:** The single `/trigger-maintenance` Discord command has been replaced with specific commands for each tournament type: `/trigger-maintenance-dg`, `/trigger-maintenance-weekly`, and `/trigger-maintenance-monthly`. This allows moderators to trigger maintenance routines more precisely.

#### 4. Refactored State Management Modules
*   **`history.ts`:** Completely rewritten to interact with the `winners` table in the database for storing and retrieving tournament results.
*   **`pickerState.ts`:** This module has been deprecated and removed. Its functionality has been absorbed into `src/database.ts` and operates directly on the `games` table.
*   **`database.ts` (New Module):** Introduced as the central point for all database interactions, managing the connection, schema, and providing CRUD operations for `games` and `winners` tables.
*   **`maintenance.ts`:** Underwent a major rewrite to become fully database-driven. It now queries the database for active and queued games, updates their status, and creates shell entries for future games, enhancing its idempotency.
*   **`timeout.ts`:** Rewritten to interact with the database for identifying timed-out pickers and updating game states.

#### 5. Command Handler Updates (`discordBot.ts`)
*   **`/list-winners`:** Updated to fetch winner history directly from the database.
*   **`/table-stats`:** Updated to aggregate statistics from the database.
*   **`/nominate-picker`:** Refactored to use the new database functions for picker management.
*   **`/picktable`:** Rewritten to authorize picker based on database state, create games on iScored, and update the database record with the iScored game ID.

#### 6. Playwright Interaction Enhancements (`iscored.ts`)
*   **Streamlined `createGame`:** The `createGame` function now returns the iScored game ID, which is then used to update the database.
*   **Robust Navigation:** Eliminated redundant navigation calls within functions like `hideGame` and `showGame`, improving stability during Playwright interactions.

#### 7. Temporary File Handling
*   **Reliable Photo Uploads:** The temporary directory for photo uploads (`/submitscore-dg`) now uses `os.tmpdir()`, ensuring cross-platform compatibility and reliability.

## Final Status
The bot's core architecture is now significantly more robust, resilient, and maintainable. All state is persistently managed in a SQLite database, and the maintenance routines are designed to be idempotent. The system is ready for further feature development and extensive testing.

# Checkpoint for TableFlipper Project (Update 2)

**Date:** February 10, 2026 (Part 2)

## Project Summary: Table Management & User Experience Polish

This update focuses on integrating a verified list of tables for the Daily Grind tournament, improving the user experience with Autocomplete, and refining system reliability.

### Key Changes Implemented:

#### 1. Table Database & Google Sheet Sync
*   **New `tables` Table:** Added a `tables` table to the SQLite database to store valid game names and platform availability (`is_atgames`, `is_wg_vr`, `is_wg_vpxs`).
*   **Google Sheet Integration:** Implemented a new script `npm run sync-tables` (and `src/googleSheet.ts`) to fetch table data from a public Google Sheet and populate the local database.
*   **Schema Persistence Fix:** Fixed a critical bug where restarting the bot would wipe the `tables` table. The table data now persists across restarts.

#### 2. Enhanced `/picktable` Command
*   **Autocomplete:** Enabled Discord Autocomplete for the `table-name` parameter. Users now see a searchable list of valid tables when picking for Daily or Weekly tournaments.
*   **Platform-Specific Validation:** Strict filtering logic was added for all competitive modes:
    *   **Daily Grind (DG):** Only shows/allows tables with `atgames=1`.
    *   **Weekly Grind (WG-VPXS):** Only shows/allows tables with `wg-vpxs=1`.
    *   **Weekly Grind (WG-VR):** Only shows/allows tables with `wg-vr=1`.
*   **Monthly Grind:** Remains flexible, allowing free text entry without strict validation.

#### 3. Headless Browser Mode
*   **Silent Operation:** Switched the Playwright browser to run in `headless: true` mode. The bot now performs iScored interactions in the background without opening visible windows on the host machine.

#### 4. Refined Logic & Maintenance
*   **Timeout Adjustment:** Increased the picker timeout from 12 to **18 hours**.
*   **Monthly Grind Exemption:** Excluded Monthly Grind (MG) tournaments from the automatic random picker timeout.
*   **Schema Migration:** Added `src/migrate-games-schema.ts` to ensure the `games` table has all necessary columns (`picker_discord_id`, etc.) without requiring a full database reset.

#### 5. User Experience Improvements
*   **Ephemeral Lists:** The `/dg-table-selection` command now replies ephemerally (visible only to the user), preventing channel clutter when users browse the table list.
*   **Alphabetical Sorting:** Autocomplete results are now explicitly sorted alphabetically.
*   **Retry Logic:** Added retry mechanisms to `submitScoreToIscored` to handle occasional UI unresponsiveness more robustly.

### Current State
The bot now has a fully populated database of ~260 verified tables. Autocomplete works for Daily Grind selections with strict validation, while other modes remain flexible. The system runs silently in the background and is more fault-tolerant.

# Checkpoint for TableFlipper Project (Update 3)

**Date:** February 13, 2026

## Project Summary: Critical Bug Fixes & Reliability Hardening

This update addresses several critical issues discovered during live testing, specifically regarding score submission, maintenance routine reliability, and navigation stability on the iScored platform.

### Key Changes Implemented:

#### 1. Score Submission Overhaul
*   **Disabled Input Workaround:** Implemented a robust workaround for iScored's virtual keyboard that was disabling input fields. The bot now forcefully sets values via JavaScript execution.
*   **Confirmation UI:** The `/submit-score` command now presents an interactive confirmation buttons (Yes/Cancel) *before* attempting submission, showing the active table name to prevent errors.
*   **Unambiguous Targeting:** Score submission now targets the specific Game ID from the local database, preventing the bot from accidentally trying to submit to a locked (but still visible) game.

#### 2. Maintenance & Navigation Stability
*   **Session Persistence:** Fixed a timeout issue where the maintenance routine opened a blank tab (losing session state). It now correctly reuses the logged-in browser context.
*   **Robust Navigation:** Switched navigation strategy to use UI interaction (clicking links) rather than direct URL jumps, which ensures the Single Page Application (SPA) loads correctly.
*   **Empty List Handling:** Relaxed the "wait for game list" check to prevent timeouts if the iScored lineup is momentarily empty or slow to render.

#### 3. Infrastructure & Logging
*   **Persistent Logging:** Added a `src/logger.ts` module. The bot now writes logs to `data/bot.log` in addition to the console, aiding in post-mortem debugging.
*   **Manual Sync Fix:** Updated `npm run sync-state` to correctly import "Queued" (Hidden) games, which was previously causing the maintenance routine to skip activation.

### Current State
The bot is now fully functional in a live environment. It can correctly identify active vs. queued games, submit scores reliably using a confirmed ID, and perform daily maintenance without timing out.
