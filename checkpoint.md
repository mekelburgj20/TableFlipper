# Checkpoint for TableFlipper Project

**Date:** February 6, 2026 (Updated: February 8, 2026)

## Project Summary: COMPLETE (Core Features)

All features outlined in the `ai_prompt_02062026.md` have been implemented. The TableFlipper bot is now a comprehensive and fully automated tournament management system for the iScored.info platform.

### Implemented Features:

#### Core Automation & Maintenance
*   **Multi-Tournament Support:** The bot's core logic has been refactored to handle multiple, concurrent tournament types: Daily Grind (`DG`), Weekly Grinds (`WG-VPXS`, `WG-VR`), and a Monthly Grind (`MG`).
*   **Scheduled Lifecycle:** Separate cron jobs automatically manage the lifecycle for each tournament type—locking the previous game, announcing the winner, and unlocking the next game on the correct schedule.
*   **Manual Maintenance Trigger:** Added functionality to manually trigger all maintenance routines, callable via a CLI argument (`node dist/index.js --trigger-maintenance`) or a Discord slash command (`/trigger-maintenance`) restricted to moderator roles.

#### Winner & Picking Flow
*   **Winner Picking:** Winners of a tournament are automatically designated as the picker for a future table, ensuring a continuous queue of games.
*   **Dynasty Rule:** A history of winners is maintained for each game type. If a repeat winner is detected, the "Dynasty Rule" is invoked, and they are prevented from picking again. Repeat winners must `/nominate-picker` another user.
*   **Nomination System:** A `/nominate-picker` command has been implemented, allowing a repeat winner (and only them) to nominate another user to pick the next table.
*   **Picker Timeout:** A scheduled, hourly job checks if any designated picker has failed to choose a table within the 12-hour time limit. If a timeout is detected, the bot automatically selects a random table from a predefined list and creates the game.

#### User-Facing Commands
*   **/submitscore-dg:** The score submission command was updated to handle different game types.
*   **/picktable:** Allows the designated winner or nominee to pick the next table. The command is aware of picking pauses, adjusting the future game's schedule accordingly.
*   **/list-winners (formerly /leaderboard):** Renamed to better reflect its function, this command now lists past winners for any game type. It defaults to the last 7 days if no period is specified.
*   **/dg-table-selection:** Fetches and displays a list of available tables from a user-maintained Google Sheet.
*   **/current-dg-scores:** Allows any user to view the current, up-to-date standings for any active tournament in a private (ephemeral) message.
*   **/pause-dg-pick:** A moderator-only command to pause the normal picking flow and inject a "special" game into the schedule, for events like new table releases.

#### Reporting & History
*   **Persistent History:** All completed tournament results (game, winner, score, date) are now stored in `history.json`.
*   **/table-stats:** A command to view statistics for any table, including total play count and the all-time high score, aggregated from the historical data.

## Post-Implementation Fixes:
*   **Code Duplication:** Fixed a file duplication error in `src/api.ts` that was causing numerous compilation errors.
*   **Module Imports:** Resolved several issues with ES Module imports, particularly for `public-google-sheets-parser`, by using a `// @ts-ignore` comment as a pragmatic solution to a type definition problem.
*   **Command Renaming:** Renamed `/leaderboard` to `/list-winners` and updated its default period to 7 days.
*   **Active Game Detection:** The logic for finding the active tournament for the `/current-dg-scores` command was completely refactored. It no longer relies on scraping the inconsistent public page. Instead, it now uses the reliable admin login to get the active game's ID and name, then uses that ID to find and scrape the correct standings from the public page.
*   **Standings Scraping:** The `getStandingsFromPublicPage` function was rewritten. It no longer attempts to navigate to a new page, but instead scrapes the main arcade page directly, using the game ID and class name correlation to find the correct scoreboxes for the active tournament. It also correctly identifies the top score for each player and ignores their other scores. This resolved the timeout issue and provides accurate standings.
*   **Module Import Placement:** Resolved TypeScript compilation errors (`TS1232`, `TS2307`) in `src/index.ts` by moving all `import` statements to the top-level of the module, ensuring they are not within conditional code blocks.
*   **MOD_ROLE_ID Debugging:** Added `console.log` statements to `src/discordBot.ts` to debug the `MOD_ROLE_ID` not being configured error. This confirmed the environment variable was not being loaded from the `.env` file. (The user has been instructed on how to fix their `.env` file.)
*   **`getWinnerAndScoreFromPublicPage` Fix (Initial):** Modified `getWinnerAndScoreFromPublicPage` to accept `gameId` and correctly scrape winner and score information directly from the public page using ID correlation, fixing a previous issue with unreliable game name matching.
*   **`lockGame` and `unlockGame` Reliability Fix:** Refactored `lockGame` and `unlockGame` in `src/iscored.ts` to remove redundant navigation calls and use explicit waits (`page.waitForTimeout(1000)`) combined with `isChecked()` verification to confirm checkbox state changes after interaction, preventing "element detached" errors and ensuring state persistence.
*   **`getWinnerAndScoreFromPublicPage` Refinement (Final):** Further refined `getWinnerAndScoreAndIdFromPublicPage` in `src/api.ts` to reliably locate the game card by ID (`div.game#a${gameId}`) and extract winner/score, and ensured an authenticated iScored context for scraping by calling `loginToIScored()` within the function, resolving the "N/A" winner/score announcement issue.
*   **Dynasty Rule Temporary Override:** Implemented a `DISABLE_DYNASTY_RULE_TEMPORARILY` flag in `src/maintenance.ts` to allow bypassing the Dynasty Rule for testing purposes, enabling repeat winners to pick tables.
*   **User Mapping Loading Fix:** Corrected `src/index.ts` to ensure `loadUserMapping()` is always called at startup (both normal and `--trigger-maintenance` paths), preventing `winnerDiscordId` from being null and allowing `setPicker` to function. Also refactored `index.ts` into an `async main()` function for cleaner startup orchestration.
*   **Picker State Persistence Fix:** Resolved a critical bug in `src/pickerState.ts` where the `savePickerState` function was writing to `pickerState_debug.json` but `loadPickerState` was reading from `pickerState.json`. Both functions now correctly interact with `pickerState_debug.json`, ensuring state persistence. The "environmental problem" hypothesis was incorrect; it was a code issue.
*   **Game Creation Timeout Fixes (`src/iscored.ts`):**
    *   **Incorrect Iframe Target:** Corrected `createGame` to consistently target the `#main` iframe instead of `iframe.first()`.
    *   **Robust Navigation to Games Tab:** Implemented `navigateToSettingsGamesTab` and updated `createGame` to use a more robust text-based selector (`button:has-text("Add New Game")`) for waiting, preventing timeouts.
    *   **Correct Navigation to Lineup Tab:** Modified `createGame` to explicitly navigate to the "Lineup" tab (`a[href="#order"]`) after creating a game, before attempting to find and lock it. This resolved the "ul#orderGameUL hidden" error. The initial redundant navigation clicks in `navigateToLineupPage` when called from `createGame` were the root cause.
    *   **Rendering Delay for Lineup Tab:** Added a `page.waitForTimeout(2000)` in `navigateToLineupPage` after the `ul#orderGameUL` element becomes visible, providing necessary time for the UI to fully render before subsequent actions.
*   **Picker State Type Refinement:** Modified `PickerInfo` interface in `src/pickerState.ts` to include `nextScheduledGameName` and adjusted `setPicker` to accept `null` for `pickerId` and `nominatorId`.
*   **Picker Game Tracking:** Implemented `gamePicked` function in `src/pickerState.ts` and integrated it into `discordBot.ts` to correctly track the `nextScheduledGameName` and clear picker designation after a game is picked.
*   **Maintenance Routine for Unarchiving:** Refactored `maintenance.ts` to correctly identify and unarchive the `nextScheduledGameName` from `pickerState`, and gracefully handle scenarios where no active game is found.

## Current Debugging Status: Hide Queued Games (Item 2)

**Date:** February 8, 2026

**Status:** COMPLETED

Item 2 from `TODO.md` has been fully implemented: "The table that is queued up but not yet active, I want this to be hidden, not locked." The bot's game management logic has been successfully modified to "hide" newly picked, inactive games from the main scoreboard on iScored.info, and then "show" (make active and visible) them when the tournament is scheduled to begin. This replaces the previous "lock/unlock" mechanism for queued games.

### Discoveries
*   Initial implementation was based on an "Archive Game" feature found via web search. This proved to be incorrect.
*   User-provided HTML of the "Lineup" page revealed a dedicated checkbox for hiding games: `<input type="checkbox" onclick="hideGame('...')" id="hide<gameId>">`. This was the correct UI element to target.

### Progress Made & Resolution
*   The `Game` interface in `src/iscored.ts` was updated to include an `isHidden` property instead of `isLocked`.
*   Functions `archiveGame` and `unarchiveGame` were renamed to `hideGame` and `showGame` respectively in `src/iscored.ts`.
*   `hideGame` and `showGame` functions were implemented to correctly interact with the `#hide<gameId>` checkbox on the Lineup page.
*   The `findGames` and `findGameByName` functions were updated to correctly use the `isHidden` property and the new hide checkbox selectors.
*   `scheduleGameUnlock` in `src/scheduler.ts` was renamed to `scheduleGameShow` and updated to call the new `showGame` function.
*   The `createGame` function in `src/iscored.ts` was refactored to:
    *   Navigate to the Games tab.
    *   Create a new blank game.
    *   Navigate to the Lineup page.
    *   Retrieve the newly created game's ID using `findGameByName`.
    *   Call `hideGame` to hide the newly created game.
    *   Schedule `showGame` for 24 hours in the future using `scheduleGameShow`.
*   The unused `findGameRowInGamesTab` and `navigateToSettingsGamesTab` functions were removed from `src/iscored.ts`.
*   **Resolution of `TimeoutError` in `navigateToLineupPage`:** The persistent `TimeoutError` encountered while waiting for `li.list-group-item` elements to become visible in `navigateToLineupPage` was addressed. The `navigateToLineupPage` function was enhanced by adding `mainFrame.waitForLoadState('domcontentloaded');` after waiting for the `#main` iframe to attach. This ensures that the content within the iframe is fully loaded and rendered before Playwright attempts to find and assert visibility of the list items, resolving the visibility discrepancy.

## Final Status
The project is fully functional for its core features, and the "hide/show" functionality for Item 2 is now successfully implemented and the associated `TimeoutError` resolved. All changes made during this session are on the `main` branch.