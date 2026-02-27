# TableFlipper - iScored Tournament Discord Bot

## 1. Project Overview

TableFlipper is a Node.js Discord bot designed to automate and manage pinball tournaments hosted on the iScored.info platform. It supports Daily, Weekly, and Monthly tournament formats, automating score submission, game rotation, winner announcements, and providing rich user interaction through slash commands. The bot leverages Playwright for robust browser automation and interaction with iScored.info.

## 2. Core Capabilities

### 🏆 Tournament & Lineup Automation
*   **Multi-Grind Support**: Full automation for Daily Grinds (DG), Weekly Grinds (VPXS & VR), and Monthly Grinds (MG).
*   **Multi-Slot Flexibility**: Supports multiple active games per tournament type (e.g., dual Weekly Grinds).
*   **Dynamic iScored Management**: Automatically locks finished games, determines winners, and activates new tables.
*   **Forensic Style Learning**: "Sniffs" Community Style IDs and CSS overrides from active games to ensure perfect visual persistence across rotations.
*   **Physical Lineup Repositioning**: Automatically reorders games on the iScored board (e.g., pushing the active DG to the far left).
*   **State Reconciliation**: Automatically identifies and hides "ghost" games or manual edits to keep the database and iScored in sync.
*   **Automatic Header Stripping**: Option to automatically remove game logos/headers for a cleaner community-preferred aesthetic.

### 🎲 Smart Table Selection & Rotation
*   **Pre-pick Queue**: Users can set table preferences in advance via `/pick-table`. Selections are applied instantly upon winning.
*   **Tiered Runner-Up Fallback**: If a winner fails to pick within 1 hour, picking rights pivot to the runner-up (30 min window).
*   **120-Day Eligibility Rule**: Prevents repetitive rotations by blocking tables played in the last 120 days.
*   **Surprise Me**: Automated random selection based on platform compatibility and play history.
*   **Admin Nomination**: Moderators can manually designate pickers, bypassing the standard winner-only flow.

### 📊 Scoring & Competition
*   **Unified Score Submission**: Submit scores and photo validation directly from Discord to iScored.
*   **Real-time Standings**: Instant lookup of current tournament leaders via `/list-scores`.
*   **Historical Tracking**: View past winners, win counts, and all-time leaderboard rankings.
*   **Table Statistics**: Detailed stats per table, including play counts and all-time high scores.
*   **Non-Tournament Tracking**: Automatically detects and supports scoring for any unlocked "Other" games on the board.

### 👤 Identity & User Management
*   **Database-Backed Mapping**: Reliable storage linking iScored usernames to Discord accounts.
*   **Proactive Identity Mapping**: Automatically scrapes standings and searches the Discord server to auto-map users before they win.
*   **Manual Mapping**: `/map-user` command for moderators to resolve identity or naming conflicts.

### 🛠️ Administrative & Moderation
*   **Full System Backup**: One-command preservation of database, scores, photos, and live iScored state.
*   **Wipe & Restore**: Ability to completely reset the iScored board or restore a previous state from backup.
*   **Manual Overrides**: Commands to force-trigger maintenance, cleanup, or inject special games into the schedule.
*   **Detailed Logging**: Comprehensive diagnostic logs for browser automation and system events.

### ⏰ Scheduled Notifications & Engagement
*   **Lead Announcements**: Daily 10 PM alerts highlighting leaders and encouraging participation.
*   **Interval Reminders**: Automated Discord nudges for pickers at 15-minute and 10-minute intervals.
*   **Maintenance Windows**: Reliable execution of rotations (Daily 12 AM, Weekly 11 PM Wed, Monthly 1st).
*   **Cleanliness Syncs**: Hourly background style learning and scheduled mid-week game cleanup.

### 💬 Comprehensive Discord Slash Commands
*   **`/submit-score`**: Submit your score and a photo for validation. Choose to submit by tournament type (`grind-type`) or specific table name (`table-name`).
*   **`/pick-table`**: Unified command for designating winners or queuing future preferences. Includes "Surprise Me" random selection.
*   **`/nominate-picker`**: Allows a repeat winner to nominate another player to pick the next table.
*   **`/map-user`**: (Moderator only) Manually maps an iScored username to a Discord account to ensure picking rights and history tracking.
*   **`/list-active`**: Shows the currently active table for any or all tournament types.
*   **`/list-winners`**: Lists past winners or a win-count leaderboard.
*   **`/list-scores`**: High-speed lookup of current standings for any active grind.
*   **`/view-stats`**: Displays play count and high score records for a specific table.
*   **`/run-cleanup`**: (Moderator only) Manually sweeps away old locked or stray visible games.
*   **`/run-maintenance-[dg/weekly/monthly]`**: (Moderator only) Manually triggers rotation for specific tournament types.
*   **`/sync-state`**: (Moderator only) Manually synchronizes the bot's database with the live iScored lineup.
*   **`/pause-pick`**: (Moderator only) Overwrites the next scheduled tournament slot with a special game choice.
*   **`/create-backup`**: (Moderator only) Triggers a full system state backup.

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
