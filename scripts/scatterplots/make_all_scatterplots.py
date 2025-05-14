# make scatterplots
import subprocess

languages = ['en', 'es', 'fa', 'hy', 'ko', 'tl','vi', 'zh-hans', 'zh-hant']

theme_recs = [{'theme':'Public v Private', 'filename_root':'public_private'},
              {'theme':'Individual v. Collective Mitigation', 'filename_root':'ind_vs_collective'},
              {'theme':'Financial Aid Distribution', 'filename_root':'financial_aid'},
              {'theme':'Build Faster v. Build Better', 'filename_root':'build_faster_vs_better'},
              {'theme':'Density v. Safety', 'filename_root':'density_vs_safety'}]

out_dir = './plots'

for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['filename_root']
    # output just the dots here...
    cmd = f'python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "{theme}" -out {out_dir}/{filename_root}_plot.svg'
    print(cmd)
    subprocess.run(cmd, shell=True)
    for language in languages:
        print(f"Making {theme} legend in {language}")
        # make scatterplot
        cmd = f'python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "{theme}" -legend -lang {language} -out {out_dir}/{filename_root}_{language}_legend.svg'
        print(cmd)
        subprocess.run(cmd, shell=True)


# python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "Public v Private" plots/public_private.svg
# python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "Individual v. Collective Mitigation" plots/ind_vs_collective.svg
# python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "Financial Aid Distribution" plots/financial_aid.svg
# python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "Build Faster v. Build Better" plots/build_faster_vs_better.svg
# python3 make_scatterplot.py engca_comment_scatterplot_source_V2.json "Density v. Safety" plots/density_vs_safety.svg
