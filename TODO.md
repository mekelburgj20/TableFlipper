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
1. [COMPLETED] **Multi-Slot Weekly Grinds:** Support for multiple active games per tournament type.
2. [COMPLETED] **Forensic Style Sniffing:** Automated style learning via Community Style ID extraction.
3. [COMPLETED] **Non-Tournament Submission:** Support for score entry on non-grind active games (type 'OTHER').
4. [COMPLETED] **Unified Standings & Submissions:** Refactored `/list-scores` and `/submit-score` into flexible commands supporting both tournament and table-based parameters with intelligent autocomplete.
5. [COMPLETED] **Immediate Rotation:** Implemented zero-buffer activation for Weekly and Monthly grinds, allowing them to go live as soon as a winner picks.
6. [COMPLETED] **State Reconciliation:** Added automatic cleanup logic to `sync-state` and maintenance sweeps to identify and hide "ghost" games in the database that are no longer on iScored.
7. [COMPLETED] **Scheduled Maintenance Refinement:** Updated Weekly maintenance to trigger at 11:00 PM Central on Wednesdays.
8. [COMPLETED] **Multi-Channel Routing:** Implemented tournament-specific Discord webhooks for announcements and timeout notifications.
9. [COMPLETED] **Lineup Repositioning (DOM-based):** Implemented automated reordering of the iScored Lineup using physical DOM manipulation. Now integrated into both maintenance and state sync.
10. [COMPLETED] **Community Styles:** Added support for iScored Community Styles.
11. [COMPLETED] **Tag-Based Identification:** Formalized the use of iScored tags as the primary identifier for tournament types.
12. [COMPLETED] **VPXS API Integration:** Integrated the Virtual Pinball Spreadsheet API for expanded WG-VPXS autocomplete.
13. [COMPLETED] **Enhanced Persistent Logging:** Refactored core modules to log all browser automation and maintenance steps to `data/bot.log`.
14. [COMPLETED] **Dynasty Rule:** Prevent repeat winners from picking consecutive tables.
15. [COMPLETED] **Table Database & Validation:** Integrated Google Sheet catalog and platform-specific filtering.
16. [COMPLETED] **Scoreboard Wipe Utility:** CLI tool to clear the iScored board.
17. [COMPLETED] **Automated Header Removal:** Global toggle to strip logos from new games.
