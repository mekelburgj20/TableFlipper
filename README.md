# TableFlipper - iScored Tournament Discord Bot

## 1. Project Overview

TableFlipper is a Node.js Discord bot designed to automate and manage pinball tournaments hosted on the iScored.info platform. It supports Daily, Weekly, and Monthly tournament formats, automating score submission, game rotation, winner announcements, and providing rich user interaction through slash commands. The bot leverages Playwright for robust browser automation and interaction with iScored.info.

## 2. Features

*   **Automated Tournament Management:**
    *   **Multi-Format Support:** Manages Daily Grind (`DG`), Weekly Grinds (`WG-VPXS`, `WG-VR`), and Monthly Grind (`MG`) tournaments.
    *   **Dual-Slot Weekly Grind:** Supports multiple active games for the same tournament type (e.g., two `WG-VPXS` tables running simultaneously).
    *   **Non-Tournament Support:** Automatically identifies and tracks non-tournament games (type `OTHER`), allowing score submission for any unlocked game on the board.
    *   **Channel-Specific Announcements:** Supports dedicated Discord webhooks for each tournament type, allowing winners and status updates to be routed to specific channels (e.g., `#daily-grind`, `#monthly-grind`) with a general fallback.
    *   **Scheduled Maintenance:** Automatically and reliably locks completed games, accurately determines winners, unlocks new games, and sends Discord announcements based on predefined schedules (Daily at 12 AM Central, Weekly on Wednesdays, Monthly on the 1st).
    *   **Delayed Cleanup:** Daily and Weekly tables remain visible (locked) until Wednesday night at 11 PM Central, allowing players to view the week's history.
    *   **Manual Trigger:** Maintenance routines and cleanup sweeps can be manually triggered via moderator-restricted Discord slash commands.
*   **Dynamic Winner Picking Flow:**
    *   **Pre-pick Queue:** Users can now set their table preferences in advance using `/pick-table`. If they win, their selection is applied **instantly** without waiting for the manual picking window.
    *   **Runner-Up Fallback:** If a winner fails to pick a table within 1 hour, picking rights automatically transfer to the runner-up (2nd place). If the runner-up also fails (30 min window), the bot selects a random compatible table.
    *   **Yearly Eligibility Rule:** Prevents repetitive rotations by enforcing a strict "Calendar Year" rule; a table cannot be selected for a grind if it has already been played in that grind type during the current year.
    *   **Proactive Identity Mapping:** The bot automatically scrapes active standings 1 hour before rotation and attempts to "auto-map" iScored users to Discord by searching the server for matching names/nicknames.
    *   **Winner Picking Rights:** Tournament winners are granted the exclusive right to pick the next table.
*   **Robust iScored Automation:**
    *   **Tag-Based Management:** Uses iScored Tags (e.g., `DG`, `WG-VPXS`) as the primary key for tournament identification, allowing for clean game names without mandatory suffixes.
    *   **Style Sniffing & Learning:** Automatically "sniffs" the Community Style ID from active games and saves them to the local database. Re-applies these styles (plus custom CSS tweaks) during future rotations.
    *   **Automated Header Removal:** Optional global configuration to automatically remove game logos (header images) after creation for a cleaner, community-preferred look.
    *   **Reliable Interaction:** Uses direct browser execution and modal handling to navigate complex Single Page Application transitions, bypassing "busy" overlays and UI lag.
    *   **Full State Reconciliation:** The sync routine automatically identifies and hides "ghost" games (including queued entries) that are no longer present on the live iScored lineup.
*   **Comprehensive Discord Slash Commands:**
    *   **`/submit-score`**: Submit your score and a photo for validation. Choose to submit by tournament type (`grind-type`) or specific table name (`table-name`). Confirmations are interactive.
        *   ⚠️ **Note**: Discord caches autocomplete results aggressively. If you switch the `grind-type` and the list doesn't update, you must **restart the slash command** (hit Esc and type it again) to see the correct tables.
    *   **`/pick-table`**: Allows the designated winner to choose the next table. Weekly and Monthly picks activate immediately; Daily picks have a 24-hour buffer.
    *   **`/nominate-picker`**: Allows a repeat winner to nominate another player to pick the table.
    *   **`/map-user`**: (Moderator only) Manually maps an iScored username to a Discord account to ensure picking rights and history tracking work correctly.
    *   **`/list-active`**: Shows the currently active table for any or all tournament types.
    *   **`/list-winners`**: Lists past winners (chronological) or a leaderboard (win counts) for tournaments. Ephemeral results.
    *   **`/list-scores`**: High-speed lookup of current standings. View all active grinds at once, or filter by `grind-type` or `table-name`.
    *   **`/view-stats`**: Displays play count and high score records for a specific table.
    *   **`/run-cleanup`**: (Moderator only) Manually sweeps away old locked or stray visible games.
    *   **`/run-maintenance-[dg/weekly/monthly]`**: (Moderator only) Manually triggers rotation for specific tournament types.
    *   **`/sync-state`**: (Moderator only) Manually synchronizes the bot's database with the live iScored lineup and performs reconciliation.
    *   **`/pause-pick`**: (Moderator only) Overwrites the next scheduled tournament slot with a special game choice.
*   **Data Management:**
    *   **Automatic Initialization:** The SQLite database (`data/tableflipper.db`) is automatically created and initialized with the correct schema the first time the bot starts.
    *   **Local Persistence:** All tournament history and user mappings are stored locally.
    *   **Git Ignored:** To prevent bloat and potential data loss during merges, the database file is excluded from version control. **Users should perform regular manual backups of the `data/` folder.**
    *   **Logs:** Persistent logs are maintained in `data/bot.log`.

## 3. Setup and Installation

### Prerequisites

*   Node.js (v18 or later recommended)
*   A registered Discord Bot application with token and client ID.
*   An administrator account for your iScored.info arcade.
*   A publicly accessible Google Sheet for the table catalog.

### Installation Steps

1.  **Clone and Install:**
    ```bash
    git clone <repository_url>
    cd TableFlipper
    npm install
    ```

2.  **Configure Environment:**
    Create a `.env` file from the example and fill in your credentials:
    ```bash
    cp .env.example .env
    ```

3.  **Sync Tables & State:**
    Populate the master table list and sync the current tournament state:
    ```bash
    npm run sync-tables
    npm run sync-state
    ```

### Running the Bot

To start the bot in development mode (auto-compiling):
```bash
npm run dev
```

To register/update slash commands:
```bash
npm run deploy-commands
```

## 4. Key Scripts

*   `npm run sync-tables`: Updates the `tables` database from the Google Sheet catalog.
*   `npm run sync-state`: Scrapes iScored to align the database with the live site (Active/Queued/Completed/Other games).
*   `npm run migrate-user-mapping`: Migrates existing user mappings from `userMapping.json` into the SQLite database.
*   `npm run scoreboard-wipe`: (CLI only) Deletes EVERY game currently on the iScored lineup. Use with extreme caution.
*   `npm run build`: Compiles TypeScript to the `dist/` folder.

## 6. Backup and Restore

TableFlipper supports full system backups, preserving the database, configuration, and **all games currently on the iScored lineup** (including non-tournament games), along with their scores and photos.

### Creating a Backup
Backups are triggered via a Discord slash command (Moderator only):
*   `/create-backup`: Creates a timestamped folder in the `backups/` directory (e.g., `backups/2026-02-19_14-30-00`). This process first synchronizes the tournament state, then scrapes the entire iScored lineup.

### Restoring a Backup
**⚠️ Warning:** Restoring is a destructive action. It will **wipe the ENTIRE iScored lineup** (deleting all games) and overwrite the local database. It should only be performed when the server is stopped or maintenance mode is active.

To restore a backup, use the CLI command from the server terminal:
```bash
npm run restore-backup -- <backup_folder_name>
```
**Example:**
```bash
npm run restore-backup -- 2026-02-19_14-30-00
```
This will:
1.  **Delete ALL** games currently on the iScored lineup.
2.  **Recreate** all games from the backup state (restoring names, tags, hidden/locked status).
3.  **Restore** the local database and configuration files.
4.  **Re-submit** all original scores and photos.

**Note:** For photo restoration to work, ensure `ISCORED_PUBLIC_URL` is set in your `.env` file (e.g., `ISCORED_PUBLIC_URL=https://www.iscored.info/your-arcade`).

## 7. Logs

The bot maintains detailed logs in `data/bot.log`. Check this file for troubleshooting browser automation steps or maintenance failures.

## 8. Release Notes

### v1.2.0 (Current)
*   **Dual-Slot Weekly Grinds:** Refactored maintenance and sync logic to support multiple active tables for a single tournament type. Includes logic for multiple winners and double-pick rights.
*   **Forensic Style Sniffing:** Implemented advanced style learning that extracts the Community Style ID from background image URLs, ensuring 100% visual fidelity during rotations.
*   **Non-Tournament Game Support:** Any unlocked game on iScored is now tracked as type `OTHER` and available for score submission via `/submit-score`.
*   **Scoreboard Wipe Utility:** Added a dedicated CLI command to clear the entire iScored board for special events or resets.
*   **Ghost Game Reconciliation:** Fixed a bug where deleted queued games remained in the database; reconciliation now covers all visible and hidden tournament slots.
*   **Global Header Removal Toggle:** Added `REMOVE_HEADER_IMAGE` to `.env` to automatically strip logos from new games.
*   **Autocomplete Optimization:** Refined the Discord autocomplete UX with better labeling and strict tournament-type filtering.

### v1.1.0
*   **Dynamic Notification Headers:** Refactored Discord announcements to dynamically identify the tournament type in the message header (e.g., "The Monthly Grind is Closed!").
*   **Lineup Repositioning (DOM-based):** Added automated reordering of tournament games using physical DOM injection. The active Daily Grind is now always pushed to the farthest left position on the scoreboard, with historical grinds following in chronological order.
*   **Style Learning & Sync:** The bot now automatically "learns" your manual styling changes (CSS, fonts, backgrounds) from active games every night and reapplies them to future rotations.
*   **Tag-Based Identification:** Transitioned to using iScored tags as the primary "key" for tournament games. Mandatory name suffixes (e.g., " DG") are no longer required for new games.
    *   **Schedule Stability (Pause Fix):** Updated `/pause-pick` to overwrite the next available slot rather than shifting the entire queue, preventing "infinite queue growth" and keeping the tournament buffer stable.*   **Optimized Standings Lookup:** Refactored `/current-dg-scores` to use the local database and public iScored API, resulting in near-instant responses and eliminating browser timeouts.
*   **VPXS API Integration:** Expanded the table catalog for `WG-VPXS` by integrating the Virtual Pinball Spreadsheet API.
*   **Robust iScored UI Engine:** Implemented `waitForBusyModal` and direct JavaScript execution (`evaluate`) for reliable automation.
*   **Advanced Cleanup Logic:** Automated removal of old locked games on Wednesdays at 11 PM Central.
