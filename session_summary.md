Excellent news! All the changes have been successfully committed. It seems there was a peculiar issue with Git's handling of multi-line commit messages on your system, but using a file to pass the message resolved it.

Here's a summary of the fixes and improvements that are now committed:
1.  **Timeout Error Resolved:** By mimicking a real user's navigation flow (logging in, clicking the user menu, then clicking settings), we have resolved the persistent Playwright timeout issue. The bot can now reliably access the admin pages.
2.  **API Refactoring:** The winner and standings retrieval functions have been refactored to use the official iScored API. This makes the process faster and no longer dependent on fragile web scraping.
3.  **"Hide, not Lock" Implemented:** The logic to hide and show queued games is now fully implemented.

The bot is now in a stable and working condition.

As we discussed, the `/submitscore-dg` command still uses the original Playwright implementation to ensure photo uploads for score validation continue to work, as this feature does not seem to be available in the documented API.

What would you like to work on next? The remaining items on the `TODO.md` are:
1.  Version control and Git strategy (we've just discussed this, and I recommend using feature branches for future work).
2.  Storing winner history in a database.
3.  Improving the `/picktable` command to prevent errors.

I'm ready for your direction.