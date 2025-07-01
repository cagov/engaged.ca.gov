# Scatterplot docs

## Scripts

### make_all_scatterplots.py
Top level script.
  1. Converts csv files to json as needed, by running convert_csv_to_json.py
  2. Produces chart SVGs and legend SVGs, by running the script make_scatterplot.py

### make_all_legends.py
Top level script.
Generates legend json files to ./plot-legends/ using make_scatter_plot_legend_json.py

### make_cumulative_comments_json.py
Top levels script.
Generates cumulative comments file, used for comment pop-ups.
Saves it to ../../src/public/data/engca_comment_scatterplot_source.json

### convert_csv_to_json.py
Converts the CSV files provided by the data team to json.
Files are stored in ./data/
Originally, this was one large file, which is why the make_scatterplot.py has code to filter on category (it is no longer needed, now that the files are kept separate).

### make_scatterplot.py
Constructs SVG files (both for plots and translated legends).

### make_scatterplot_legend_json.py
Constructs scatterplot legend json file, used to create interactive legends.  Data stored for each legend includes it's translation key, color, and list of associated comment-ids.

### scatterplot_config.py
Stores common settings for import.

