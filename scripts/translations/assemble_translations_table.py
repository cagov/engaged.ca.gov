# make_translations_table.py

import pandas as pd
from translation_table_contents import translation_keys, translations, languages
import json
import sys

# Set UTF-8 encoding for stdout
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# create a dataframe from the translations dictionary
df = pd.DataFrame(translations)

i18n_table = {}

# for each translation_key, add a dictionary to the i18n_table

for key in translation_keys:
    i18n_table[key] = {
        'en': '',
        'fr': '',
        'es': '',
        'ko': '',
        'vi': '',
        'tl': '',
        'zh-hans': '',
        'zh-hant': '',
        'location': translations[key]['location']
    }

# load in individual languages from translated spreadsheets
for language in languages:
    # Create a DataFrame with keys and translations for the specific language
    data = {
        'Key': [],
        'EN Translation': [],
        f'{language.upper()} Translation': []
    }

    xls_name = f'./spreadsheets_translated/translations_{language}.xlsx'
    
    # read the excel file
    try:
        df = pd.read_excel(xls_name)
    except FileNotFoundError:
        print(f"Error: Translation file {xls_name} not found")
        break

    # walk thru the values in column 1 and insert translations from column 3 into the i18n_table
    for index, row in df.iterrows():
        key = row.iloc[0]
        translation = row.iloc[2]
        if key in i18n_table:
            i18n_table[key][language] = translation
        else:
            print(f"Warning: {key} not found in i18n_table")

# print a prettified json version of the i18n_table, with the top-level keys sorted by the order they appear in the translation_keys list, and the languages sorted by the order they appear in the languages list
print('const translations = ' + json.dumps(i18n_table, indent=4, ensure_ascii=False) + ";\n\nexport default translations;\n")
