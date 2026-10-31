"""Import a pinned ECDICT subset: python3 scripts/import-local-dictionary.py /path/ecdict.csv."""
import csv, hashlib, json, pathlib, re, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
COMMIT='ab22ad36302cafc6349a050e2b60894855208055'
SHA256='d1ecbdf9ee2b920afb6f430ca6b6bb9f559588cf0dff86e04bd255f9390843cc'
p=pathlib.Path(sys.argv[1]); assert hashlib.sha256(p.read_bytes()).hexdigest()==SHA256, 'Unexpected upstream data'
rows=[]
for r in csv.DictReader(p.open()):
    word=r['word']; rank=int(r['frq'] or 0)
    if len(word)>50 or not re.fullmatch(r"[a-z]+(?:[ '-][a-z]+)*",word) or not r['translation']: continue
    if r['oxford']!='1' and not 0<rank<=5000: continue
    zh=r['translation'].replace('\\r','').replace('\\n','\n').strip()
    tier=1 if 0<rank<=1000 else 2 if 0<rank<=3000 else 3
    rows.append([word,zh,r['phonetic'],rank,tier])
rows.sort(key=lambda r:(r[3] or 999999,r[0]))
assert len({r[0] for r in rows})==len(rows)
(ROOT/'data/reference-dictionary').mkdir(parents=True,exist_ok=True)
(ROOT/'data/reference-dictionary/entries.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
meta={'name':'ECDICT','url':'https://github.com/skywind3000/ECDICT','commit':COMMIT,'csvSha256':SHA256,'license':'MIT (as declared by upstream)','count':len(rows),'selection':'Lowercase English words/phrases up to 50 characters with Chinese translation; oxford=1 OR contemporary frequency rank 1..5000. Not a current official Oxford wordlist.','tiers':{'1':'frq 1..1000','2':'frq 1001..3000','3':'frq >3000 or missing; includes other upstream core entries'},'notices':['Frequency tiers are not CEFR or age levels.','Translations retained from upstream; no generated examples or pictures.','General dictionary entries require parent selection for child practice.','Existing 40 picture cards are project-authored materials and take precedence in completion.']}
(ROOT/'data/reference-dictionary/source.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'count':len(rows),'tiers':{t:sum(r[4]==t for r in rows) for t in [1,2,3]}}))
