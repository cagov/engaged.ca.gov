// Import the barchart data
const fs = require('fs');
const path = require('path');

// Read the JSON file
const barchartDataPath = path.join(__dirname, './barchart.json');
const barchartData = JSON.parse(fs.readFileSync(barchartDataPath, 'utf8'));

// Export the data for use in templates
module.exports = barchartData; 