"""Generate only docs/icon.png for this exact project; no downloads or dependencies."""
from pathlib import Path
import json,os,struct,zlib
root=Path(__file__).resolve().parents[1]
p=json.loads((root/'project.json').read_text())
assert p['repository']=='KADARstudio/seans' and p['repositoryId']==1376451444
assert os.environ.get('GITHUB_REPOSITORY','KADARstudio/seans')=='KADARstudio/seans'
n=192;rows=[]
for y in range(n):
 row=bytearray([0])
 for x in range(n):
  # A simple play symbol with safe maskable-icon padding.
  inside=64<=x<=140 and abs(y-96)<=(140-x)*0.72
  row.extend((217,250,112) if inside else (17,19,16))
 rows.append(row)
def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',n,n,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
(root/'docs/icon.png').write_bytes(data)
print('Prepared Seans icon:',len(data),'bytes')
