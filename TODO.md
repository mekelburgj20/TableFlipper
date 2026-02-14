# Active Tasks
(None)

# Future Considerations
1. **Community Styles:** Investigate associating tables with iScored 'Community Styles' (e.g., `loadStylePreview(2924)`). Load these into the database so the bot can automatically apply the correct style when creating a game.
2. **Admin Nomination Override:** Allow Moderators/Admins to use `/nominate-picker` to designate a picker if the winner is unresponsive, preventing a random timeout selection.
3. **Channel-Specific Context:** Restrict/default `/picktable` and other commands based on the Discord channel (e.g., `/picktable` in `#wg-vpxs` defaults to `WG-VPXS`).

# Completed History
1. [COMPLETED] **Maintenance Cleanup:** Implemented logic to clear out (delete) old locked games from iScored during maintenance.
   - Updates `maintenance.ts` to scrape and save *all* standings/scores to the DB before deletion.
   - Deletes the active game after processing.
   - Includes `cleanupOldGames` routine to find and remove any other "Locked" but visible games (cleaning up backlog).
   - Ensures data integrity by confirming scores exist in DB before deletion.
   - **Refined Cleanup:** Daily and Weekly tables now remain visible (locked) until Wednesday at 11:00 PM Central, at which point a separate scheduled task clears them out.
   - **Manual Cleanup:** Added `/trigger-cleanup [grind-type]` command for moderators to manually run the cleanup routine if needed.
2. [COMPLETED] **Persistent Logging:** We need persistent logging for troubleshooting inspection in case issues arise. Currently logs are ephemeral console outputs.
2. [COMPLETED] **Show active game when posting score:** When a user uses /submit-score grind-type , we should display the active game for each grind-type so they can validate which game they are in fact submitting a score for. This functionality exists in the /list-active command already, however this needs to be added to /submit-score for additional quick confirmation during score submission.
3. [COMPLETED] **Use Tags for Grind-Type ID** The iscored Lineup has an optional 'Tags' for each Game. I'd like to consider switching the grind-type identifier from the current text string in the Game Name (example "DG" = Daily Grind) to a Tag we can apply during each game creation. I would like to add the appropriate Tag that identifies the grind-type for each game created rather than put the ID text in the Game Name. See @Tags_outerHTML for the outerHTML for this capability.
4. [COMPLETED] For the game selection database (games available to choose from for each grind-type) there are a lot of additional games available on VPXS. These are contained and maintained in a .json database and is accessible via API. If the game is available in this database, it can be selected for wg-vpxs. When choosing a wg-vpxs table, autocomplete and table list should pull from this database to show users their options. The API instructions are here @virtualpinballspreadsheet_API
5. [COMPLETED] During /picktable, a standard canned message displays "✅ Thank you, @Krobs! The table Fish Tales DG has been selected and created. It will be the table for the tournament in 2 days." However, this table pick occurred during the buffer period and in fact the game will be active about 10 hours from the posting of that message. What needs to happen instead is that the message should display the time and date the game will be active. So like "It will be the table for the tournament beginning 2/14/2026 at 12:00am Central" or whatever.
6. [COMPLETED] I want to remove all emoticons like checkboxes, etc from all messaging. 
7. [COMPLETED] **Version Control:** Project is version controlled in git.
8. [COMPLETED] **Daily Grind Logic:** Daily Grind tables are hidden until active. Winner picks for the tournament 2 days in advance.
9. [COMPLETED] **Winner Tracking:** Winners are stored in a SQLite database (`winners` table) for reporting.
10. [COMPLETED] **Table Database & Validation:** 
   - Implemented `tables` table in SQLite with platform flags (`is_atgames`, `is_wg_vr`, `is_wg_vpxs`).
   - Added `npm run sync-tables` to load data from the Google Sheet.
   - Updated `/picktable` with Autocomplete and strict filtering logic for DG, WG-VR, and WG-VPXS.
   - Added "Surprise Me" random picker.
   - Monthly Grind (MG) remains flexible (no filtering).
11. [COMPLETED] **Active Table List:** Added `/list-active` command to check the current game for any tournament type. 