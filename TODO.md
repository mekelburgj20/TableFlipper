# Active Tasks
(None)

# Future Considerations
1. **Admin Nomination Override:** Allow Moderators/Admins to use `/nominate-picker` to designate a picker if the winner is unresponsive, preventing a random timeout selection.
2. **Channel-Specific Context:** Restrict/default `/picktable` and other commands based on the Discord channel (e.g., `/picktable` in `#wg-vpxs` defaults to `WG-VPXS`).

# Completed History
1. [COMPLETED] **Community Styles:** Added support for iScored Community Styles. The bot now looks up `style_id` in the database and automatically applies the correct style when creating a game on iScored.
2. [COMPLETED] **Tags for grind-type key:** Formalized the use of iScored tags as the primary identifier for tournament types. Updated `findGames` and `createGame` to use a mapped tag key.
3. [COMPLETED] **VPXS API Integration:** Integrated the Virtual Pinball Spreadsheet API to allow selection of a wider range of games for WG-VPXS via autocomplete.
4. [COMPLETED] **Robust Cleanup Sweep:** Implemented a comprehensive cleanup routine that removes old locked or stray visible games while protecting the official active tournament.
   - Added `waitForBusyModal` and `evaluate`-based clicks for high reliability.
   - Implemented "Auto-Sync" to handle untracked games during cleanup.
   - Consolidated into a single `/trigger-cleanup [ALL]` command.
3. [COMPLETED] **Maintenance Refinement:** Scheduled cleanup for Wednesday at 11 PM Central to allow weekly visibility of Daily Grinds.
4. [COMPLETED] **Automated Suffixing:** `createGame` now automatically appends tournament type (e.g., " DG") to iScored game names.
4. [COMPLETED] **Enhanced Persistent Logging:** Refactored core modules to log all browser automation and maintenance steps to `data/bot.log` for reliable troubleshooting.
5. [COMPLETED] **Rename Score Submission:** Renamed `/submitscore-dg` to `/submit-score` and parameter `game-type` to `grind-type` globally.
6. [COMPLETED] **Confirmation UI:** Added interactive confirmation (Yes/Cancel) to `/submit-score` displaying the target table.
7. [COMPLETED] **Dynasty Rule:** Prevent repeat winners from picking consecutive tables.
8. [COMPLETED] **Table Database & Validation:** Integrated Google Sheet catalog (`sync-tables`) and platform-specific autocomplete filtering.
9. [COMPLETED] **Active Table List:** Added `/list-active` command.
