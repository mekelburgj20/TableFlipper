# Active Tasks
1. **Persistent Logging:** We need persistent logging for troubleshooting inspection in case issues arise. Currently logs are ephemeral console outputs.

# Future Considerations
1. **Community Styles:** Investigate associating tables with iScored 'Community Styles' (e.g., `loadStylePreview(2924)`). Load these into the database so the bot can automatically apply the correct style when creating a game.
2. **Admin Nomination Override:** Allow Moderators/Admins to use `/nominate-picker` to designate a picker if the winner is unresponsive, preventing a random timeout selection.
3. **Channel-Specific Context:** Restrict/default `/picktable` and other commands based on the Discord channel (e.g., `/picktable` in `#wg-vpxs` defaults to `WG-VPXS`).

# Completed History
1. [COMPLETED] **Version Control:** Project is version controlled in git.
2. [COMPLETED] **Daily Grind Logic:** Daily Grind tables are hidden until active. Winner picks for the tournament 2 days in advance.
3. [COMPLETED] **Winner Tracking:** Winners are stored in a SQLite database (`winners` table) for reporting.
4. [COMPLETED] **Table Database & Validation:** 
   - Implemented `tables` table in SQLite with platform flags (`is_atgames`, `is_wg_vr`, `is_wg_vpxs`).
   - Added `npm run sync-tables` to load data from the Google Sheet.
   - Updated `/picktable` with Autocomplete and strict filtering logic for DG, WG-VR, and WG-VPXS.
   - Added "Surprise Me" random picker.
   - Monthly Grind (MG) remains flexible (no filtering).
5. [COMPLETED] **Active Table List:** Added `/list-active` command to check the current game for any tournament type. 