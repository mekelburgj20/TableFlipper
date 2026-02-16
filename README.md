# TableFlipper - iScored Tournament Discord Bot

## 1. Project Overview

TableFlipper is a Node.js Discord bot designed to automate and manage pinball tournaments hosted on the iScored.info platform. It supports Daily, Weekly, and Monthly tournament formats, automating score submission, game rotation, winner announcements, and providing rich user interaction through slash commands. The bot leverages Playwright for robust browser automation and interaction with iScored.info.

## 2. Features

*   **Automated Tournament Management:**
    *   **Multi-Format Support:** Manages Daily Grind (`DG`), Weekly Grinds (`WG-VPXS`, `WG-VR`), and Monthly Grind (`MG`) tournaments.
    *   **Scheduled Maintenance:** Automatically and reliably locks completed games, accurately determines winners, unlocks new games, and sends Discord announcements based on predefined schedules (Daily at 12 AM Central, Weekly on Wednesdays, Monthly on the 1st).
    *   **Delayed Cleanup:** Daily and Weekly tables remain visible (locked) until Wednesday night at 11 PM Central, allowing players to view the week's history.
    *   **Manual Trigger:** Maintenance routines and cleanup sweeps can be manually triggered via moderator-restricted Discord slash commands.
*   **Dynamic Winner Picking Flow:**
    *   **Winner Picking Rights:** Tournament winners are granted the exclusive right to pick the next table (for play two days in advance).
    *   **Dynasty Rule Enforcement:** Prevents consecutive wins from giving picking rights to the same player. Repeat winners must `/nominate-picker` another user.
    *   **Picker Timeout:** If a designated picker or nominee fails to select a table within 18 hours, the bot automatically selects a random compatible table.
*   **Robust iScored Automation:**
    *   **Tag-Based Management:** Uses iScored Tags (e.g., `DG`, `WG-VPXS`) as the primary key for tournament identification, allowing for clean game names without mandatory suffixes.
    *   **Style Learning System:** Automatically scrapes and saves CSS, fonts, and background settings from active games every night, ensuring a consistent look for future rotations.
    *   **Reliable Interaction:** Uses direct browser execution and modal handling to navigate complex Single Page Application transitions, bypassing "busy" overlays and UI lag.
    *   **Automatic Sync:** The cleanup routine automatically imports unknown games from iScored into the local database to ensure safe management.
*   **Comprehensive Discord Slash Commands:**
    *   **`/submit-score`**: Submit your score and a photo for validation with interactive confirmation.
    *   **`/picktable`**: Allows the designated winner to choose the next table. Includes strict platform filtering and Autocomplete.
    *   **`/nominate-picker`**: Allows a repeat winner to nominate another player to pick the table.
    *   **`/list-active`**: Shows the currently active table for any or all tournament types.
    *   **`/list-winners`**: Lists past winners for a specified tournament and period.
    *   **`/current-dg-scores`**: High-speed lookup of current standings using the local database and public iScored API.
    *   **`/table-stats`**: Displays play count and high score records for a specific table.
    *   **`/trigger-cleanup`**: Manually sweeps away old locked or stray visible games (All tournaments or specific type).
    *   **`/trigger-maintenance-[dg/weekly/monthly]`**: Manually triggers rotation for specific tournament types.
    *   **`/pause-dg-pick`**: (Moderator only) Overwrites the next scheduled tournament slot with a special game choice, keeping the overall schedule on track.
*   **Data Management:** Stores all history and live state in a SQLite database (`data/tableflipper.db`). Persistent logs are maintained in `data/bot.log`.

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
*   `npm run sync-state`: Scrapes iScored to align the database with the live site (Active/Queued/Completed games).
*   `npm run build`: Compiles TypeScript to the `dist/` folder.

## 5. Logs

The bot maintains detailed logs in `data/bot.log`. Check this file for troubleshooting browser automation steps or maintenance failures.

## 6. Release Notes

### v1.1.0 (Current)
*   **Style Learning & Sync:** The bot now automatically "learns" your manual styling changes (CSS, fonts, backgrounds) from active games every night and reapplies them to future rotations.
*   **Tag-Based Identification:** Transitioned to using iScored tags as the primary "key" for tournament games. Mandatory name suffixes (e.g., " DG") are no longer required for new games.
*   **Schedule Stability (Pause Fix):** Updated `/pause-dg-pick` to overwrite the next available slot rather than shifting the entire queue, preventing "infinite queue growth" and keeping the tournament buffer stable.
*   **Optimized Standings Lookup:** Refactored `/current-dg-scores` to use the local database and public iScored API, resulting in near-instant responses and eliminating browser timeouts.
*   **VPXS API Integration:** Expanded the table catalog for `WG-VPXS` by integrating the Virtual Pinball Spreadsheet API.
*   **Robust iScored UI Engine:** Implemented `waitForBusyModal` and direct JavaScript execution (`evaluate`) for reliable automation.
*   **Advanced Cleanup Logic:** Automated removal of old locked games on Wednesdays at 11 PM Central.
