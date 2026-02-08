import PublicGoogleSheetsParser from 'public-google-sheets-parser';

const sheetId = process.env.GOOGLE_SHEET_ID;

/**
 * Fetches a list of tables from the configured Google Sheet.
 * Assumes the sheet has a column named 'Table Name'.
 * @param gid The specific sheet GID to parse.
 * @returns A promise that resolves to an array of table names.
 */
interface SheetItem {
    'Table Name': string;
    // Add other expected properties if necessary
}

export async function getTablesFromSheet(gid: string): Promise<string[]> {
    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID is not defined in the environment variables.');
    }

    // @ts-ignore
    const parser = new PublicGoogleSheetsParser(sheetId);
    
    try {
        console.log(`Fetching table list from Google Sheet ID: ${sheetId}, GID: ${gid}`);
        const items = await parser.parse(sheetId, gid) as SheetItem[];
        
        if (!items || items.length === 0) {
            console.log('No items found in the Google Sheet.');
            return [];
        }

        const tableNames = items.map(item => item['Table Name']).filter(Boolean);
        
        console.log(`✅ Found ${tableNames.length} tables from the sheet.`);
        return tableNames;

    } catch (error) {
        console.error('❌ Error parsing Google Sheet:', error);
        throw new Error('Could not fetch the table list from Google Sheets.');
    }
}
