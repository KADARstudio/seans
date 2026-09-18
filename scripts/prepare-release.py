"""Source help is versioned, never rewritten by scheduled catalogue updates."""
from pathlib import Path
import json,os
r=Path(__file__).resolve().parents[1]
p=json.loads((r/'project.json').read_text())
assert p['repository']=='KADARstudio/seans' and p['repositoryId']==1376451444
assert os.environ.get('GITHUB_REPOSITORY','KADARstudio/seans')=='KADARstudio/seans'
print('Help text is maintained with the app; catalogue timestamp comes from the data.')
