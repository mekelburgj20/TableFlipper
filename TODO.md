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
15. **Manual Table Creation & UI Customization:** Implement a `/create-table-manual` command for moderators to create non-tournament tables on the fly with optional tags and styles. Also include a configuration option to automatically remove the default style header image upon creation.

# Completed History
1. [COMPLETED] **Unified Standings & Submissions:** Refactored `/list-scores` and `/submit-score` into flexible commands supporting both tournament and table-based parameters with intelligent autocomplete.
2. [COMPLETED] **Immediate Rotation:** Implemented zero-buffer activation for Weekly and Monthly grinds, allowing them to go live as soon as a winner picks.
3. [COMPLETED] **State Reconciliation:** Added automatic cleanup logic to `sync-state` and maintenance sweeps to identify and hide "ghost" games in the database that are no longer on iScored.
4. [COMPLETED] **Scheduled Maintenance Refinement:** Updated Weekly maintenance to trigger at 11:00 PM Central on Wednesdays.
5. [COMPLETED] **Multi-Channel Routing:** Implemented tournament-specific Discord webhooks for announcements and timeout notifications.
6. [COMPLETED] **Lineup Repositioning (DOM-based):** Implemented automated reordering of the iScored Lineup using physical DOM manipulation. Now integrated into both maintenance and state sync.
7. [COMPLETED] **Community Styles:** Added support for iScored Community Styles.
8. [COMPLETED] **Tag-Based Identification:** Formalized the use of iScored tags as the primary identifier for tournament types.
9. [COMPLETED] **VPXS API Integration:** Integrated the Virtual Pinball Spreadsheet API for expanded WG-VPXS autocomplete.
10. [COMPLETED] **Enhanced Persistent Logging:** Refactored core modules to log all browser automation and maintenance steps to `data/bot.log`.
11. [COMPLETED] **Dynasty Rule:** Prevent repeat winners from picking consecutive tables.
12. [COMPLETED] **Table Database & Validation:** Integrated Google Sheet catalog and platform-specific filtering.
