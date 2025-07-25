const CONFIG = {
    // Google Drive CSV file details
    csvFileId: 'y1SUJb-AcW7-8vMPQxMva9xOrWmwUjZfe8', // From the CSV file URL: drive.google.com/file/d/FILE-ID/view
    csvFileName: 'comments.csv', // Alternative: search by filename if you don't have the ID
    csvFolderId: '1m7r0HRzcqxtVKaSyMTjM40RvY8Js67V6', // Optional: limit search to specific folder

    // Google Sheets details
    spreadsheetId: '1tpwxT05MsYVin975Rdk9n8iglEki_uRRdSlsReAFeoU', // From the URL: docs.google.com/spreadsheets/d/SPREADSHEET-ID/edit
    sheetName: 'comment', // Name of the sheet tab

    // Options
    clearExistingData: true, // Set to false to append data instead
    addTimestamp: true, // Add a timestamp column
    checkFileModified: true // Only import if CSV has been modified since last import
};

function importFileFromDrive() {
    try {
        const file = getCsvFromDrive();
        const blob = file.getBlob();
        const content = blob.getDataAsString();

        // Parse CSV data
        const rows = Utilities.parseCsv(content);

        const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
        const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

        sheet.clear();
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

        Logger.log('Import completed successfully');

    } catch (error) {
        Logger.log('Error: ' + error.toString());
    }
}

function getCsvFromDrive() {

    if (CONFIG.csvFileName) {
        let files;

        // Search within specific folder if provided
        if (CONFIG.csvFolderId) {
            const folder = DriveApp.getFolderById(CONFIG.csvFolderId);
            files = folder.getFilesByName(CONFIG.csvFileName);
        } else {
            // Search in entire Drive
            files = DriveApp.getFilesByName(CONFIG.csvFileName);
        }

        if (files.hasNext()) {
            const csvFile = files.next();
            console.log('Found CSV file by name: ' + csvFile.getName());
            return csvFile;
        }
    }
}
