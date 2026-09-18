"""One-time, exact edit of prototype help text when the refresh schedule is installed.
Only the Seans application's known local file is changed; all changes are tested before commit.
"""
from pathlib import Path
import json,os
root=Path(__file__).resolve().parents[1]
assert json.loads((root/'project.json').read_text())['repositoryId']==1376451444
assert os.environ.get('GITHUB_REPOSITORY','KADARstudio/seans')=='KADARstudio/seans'
p=root/'docs/app.js';text=p.read_text(encoding='utf-8')
old='Automatyczne pobieranie nowych ofert nie jest jeszcze włączone.'
new='Pobieranie nowych ofert zaplanowano co godzinę; może się opóźnić lub nie udać. Przy błędzie zachowujemy ostatnią udaną kopię z jej prawdziwą datą.'
assert text.count(old)==1 or text.count(new)==1,'Unexpected source version; do not modify'
if old in text:p.write_text(text.replace(old,new),encoding='utf-8')
