# make_translations_table.py
from translation_config import languages

# import a library for producing spreadsheet files

import pandas as pd
import argparse
import json
import openpyxl.styles

parser = argparse.ArgumentParser(description='Make translations spreadsheets')
parser.add_argument('json_name', type=str, help='Name of the JSON file to use for translations')
args = parser.parse_args()

json_name = args.json_name

with open(json_name, 'r') as f:
    translations = json.load(f)

# create a dataframe from the translations dictionary
# df = pd.DataFrame(translations)

keys_to_ignore = ['engaged-california-untranslated']

for language in languages:
    if language == 'en':
        continue
    # Create a DataFrame with keys and translations for the specific language
    data = {
        'Key': [],
        'EN Translation': [],
        f'{language.upper()} Translation': []
    }
    
    for key, translations_dict in translations.items():
        if key not in keys_to_ignore:
            data['Key'].append(key)
            data['EN Translation'].append(translations_dict['en'])
            # data[f'{language.upper()} Translation'].append(translations_dict[language])
            data[f'{language.upper()} Translation'].append('')
    
    df = pd.DataFrame(data)

    # df.to_excel(f'translations_{language}.xlsx', index=False)
    with pd.ExcelWriter(f'./spreadsheets_src/translations_{language}.xlsx', engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
        worksheet = writer.sheets['Sheet1']
        # Set column widths (adjust numbers as needed)
        worksheet.column_dimensions['A'].width = 40  # Key column
        worksheet.column_dimensions['B'].width = 40  # EN Translation
        worksheet.column_dimensions['C'].width = 40  # Language Translation
        for row in worksheet.iter_rows(min_row=1, max_row=worksheet.max_row):
            for idx in range(1,3):
                if row[idx].value:
                    row[idx].alignment = openpyxl.styles.Alignment(wrap_text=True)
