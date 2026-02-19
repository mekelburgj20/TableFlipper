# Active Tasks
(None)

# Future Considerations
1. **Admin Nomination Override:** Allow Moderators/Admins to use `/nominate-picker` to designate a picker if the winner is unresponsive, preventing a random timeout selection.
2. **Channel-Specific Context:** Restrict/default `/picktable` and other commands based on the Discord channel (e.g., `/picktable` in `#wg-vpxs` defaults to `WG-VPXS`).
3. **AI-Powered Score Verification:** Integrate OCR to automatically verify scores from submitted photos.
4. **Persistent Live Leaderboards:** Maintain a pinned, auto-updating standings message in each tournament channel.
5. **Player Profiles & Achievements:** Track all-time wins, "Dynasty" triggers, and unique tables per player with a `/profile` command.
6. **Proactive Picker DMs:** Send friendly DM reminders to winners before their picking window expires.
7. **iScored Health Dashboard:** Add a moderator command to monitor site sync status and browser automation health.
8. **Style Previewer:** Show a preview of the learned table style during the `/picktable` flow.
9. **Global "Hall of Fame":** Track arcade-wide records (e.g., all-time high score across all grinds).
10. **Tournament Seasons:** Implement quarterly leaderboards to give players fresh starts.
11. **Table "Heat Map":** Suggest tables that haven't been in rotation for a long time.
12. **Monthly "Themes":** Allow moderators to restrict `/picktable` choices based on monthly themes (e.g., "90s Bally").
13. **Multi-Arcade Support:** Refactor config to support managing multiple iScored gamerooms from one instance.
14. **Last Played:** When picking a game for the next grind, once a title is chosen, the bot should show when the last time the game was played was and ask for confirmation to proceed. This should also be a slash command 'last-played' with parameter 'table-name:' and do a match on the text string entered (in case the exact name of the game played is not found).

# Completed History
1. [COMPLETED] **Lineup Repositioning (DOM-based):** Implemented automated reordering of the iScored Lineup using physical DOM manipulation and internal iScored save mechanisms. The bot now ensures that Active tournament games appear farthest left (top of list), followed by recent history, maintaining a logical flow for the scoreboard. Configurable via `LINEUP_TYPE_ORDER`.
2. [COMPLETED] **Community Styles:** Added support for iScored Community Styles. The bot now looks up `style_id` in the database and automatically applies the correct style when creating a game on iScored.
2. [COMPLETED] **Tag-Based Identification:** Formalized the use of iScored tags as the primary identifier for tournament types. Removed the requirement for mandatory name suffixes (e.g., " DG") in favor of Tags.
3. [COMPLETED] **VPXS API Integration:** Integrated the Virtual Pinball Spreadsheet API to allow selection of a wider range of games for WG-VPXS via autocomplete.
4. [COMPLETED] **Robust Cleanup Sweep:** Implemented a comprehensive cleanup routine that removes old locked or stray visible games while protecting the official active tournament.
   - Added `waitForBusyModal` and `evaluate`-based clicks for high reliability.
   - Implemented "Auto-Sync" to handle untracked games during cleanup.
   - Consolidated into a single `/trigger-cleanup [ALL]` command.
5. [COMPLETED] **Maintenance Refinement:** Scheduled cleanup for Wednesday at 11 PM Central to allow weekly visibility of Daily Grinds.
6. [COMPLETED] **Enhanced Persistent Logging:** Refactored core modules to log all browser automation and maintenance steps to `data/bot.log` for reliable troubleshooting.
7. [COMPLETED] **Rename Score Submission:** Renamed `/submitscore-dg` to `/submit-score` and parameter `game-type` to `grind-type` globally.
8. [COMPLETED] **Confirmation UI:** Added interactive confirmation (Yes/Cancel) to `/submit-score` displaying the target table.
9. [COMPLETED] **Dynasty Rule:** Prevent repeat winners from picking consecutive tables.
10. [COMPLETED] **Table Database & Validation:** Integrated Google Sheet catalog (`sync-tables`) and platform-specific autocomplete filtering.
11. [COMPLETED] **Active Table List:** Added `/list-active` command.
