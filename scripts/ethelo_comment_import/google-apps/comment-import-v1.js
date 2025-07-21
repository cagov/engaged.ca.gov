function importFileFromDrive() {
    const fileId = '1SUJb-AcW7-8vMPQxMva9xOrWmwUjZfe8';
    const spreadsheetId = '1tpwxT05MsYVin975Rdk9n8iglEki_uRRdSlsReAFeoU';
    const sheetName = 'comment'; // or whatever your sheet name is

    try {
        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        const content = blob.getDataAsString();

        const rows = Utilities.parseCsv(content);

        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);

        sheet.clear();
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

        Logger.log('Import completed successfully');

    } catch (error) {
        Logger.log('Error: ' + error.toString());
    }
}