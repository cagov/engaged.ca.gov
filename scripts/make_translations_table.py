# make_translations_table.py
from translation_table_contents import translation_keys, translations, languages



# import a library for producing spreadsheet files

import pandas as pd

# create a dataframe from the translations dictionary
df = pd.DataFrame(translations)

# save the dataframe to an Excel file
# df.to_excel('translations.xlsx', index=False)

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
            data[f'{language.upper()} Translation'].append(translations_dict[language])
    
    df = pd.DataFrame(data)

    # df.to_excel(f'translations_{language}.xlsx', index=False)
    with pd.ExcelWriter(f'./spreadsheets_src/translations_{language}.xlsx', engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
        worksheet = writer.sheets['Sheet1']
        # Set column widths (adjust numbers as needed)
        worksheet.column_dimensions['A'].width = 40  # Key column
        worksheet.column_dimensions['B'].width = 40  # EN Translation
        worksheet.column_dimensions['C'].width = 40  # Language Translation