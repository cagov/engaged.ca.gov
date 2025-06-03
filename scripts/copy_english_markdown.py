import glob, os, subprocess

wildpaths = ['./site/en/lafires-recovery/*.mmmd']

languages = ['es', 'fa', 'hy', 'ko', 'tl', 'vi','zh-hans', 'zh-hant']


for wildpath in wildpaths:
    for filename in glob.glob(wildpath):
        for lang in languages:
            langpath = filename.replace('/en/', '/'+lang+'/')
            if not os.path.exists(langpath) or os.path.getmtime(filename) > os.path.getmtime(langpath):
                print("Missing or outdated: ", langpath)
                # make dirs
                os.makedirs(os.path.dirname(langpath), exist_ok=True)
                # copy filename to langpath
                cmd = f"cp '{filename}' '{langpath}'"
                subprocess.run(cmd, shell=True)
