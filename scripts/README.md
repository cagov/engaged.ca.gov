
## Utility scripts 

This folder contains scripts used to prepare content for submission to the translation service.

The scripts convert the contents of site/data/i18n.js into individual xls files per language.

These files are not part of the build process.

## To prepare for new translations.
1. Copy the records from site/_data/i18n.js into translation_table_contents.py
2. If you haven't already instal pandas (brew install pandas, or pip install pandas)
    `python3 -m venv ./venv`
    `source ./venv/bin/activate # note: this is useful https://github.com/Tarrasch/zsh-autoenv`
    `pip install pandas`
3. `cd scripts; python3 make_translations_table.py`
   (New spreadsheets are written to spreadsheets_src. Send these to translator.)

## To assemble re-translated spreadsheets.
1. Put the newly translated spreadsheets into spreadsheets_translated and give them a once over.
2. cd scripts; python3 assemble_translations_table.py >i18n_candidate.js
3. carefully compare i18n_candidate.js with site/_data/i18n.js and replace it if ready.

