"""Extract explicit vocabulary columns from the official Grade K scope PDF.
Usage: python3 scripts/import-wonders-gk-scope.py /path/to/official.pdf
The original PDF stays outside the repository and is checked against the recorded hash.
"""
import hashlib,json,re,sys
from pathlib import Path
import pdfplumber
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'data/vocabulary/wonders-gk.json').read_text())
pdf=Path(sys.argv[1])
if hashlib.sha256(pdf.read_bytes()).hexdigest()!=manifest['sources']['official-scope']['sha256']:
    raise ValueError('Official PDF hash differs; review the edition before importing')
rows=[]
words=lambda s:re.findall(r'[A-Za-z]+',s)
with pdfplumber.open(pdf) as doc:
    for pi,page in enumerate(doc.pages):
        table=page.find_tables()[0].extract();headers=table[1]
        ix={key:next(i for i,c in enumerate(headers) if c and label in c) for key,label in [('vocabulary','Vocabulary'),('frequency','Frequency'),('phonics','Phonics')]}
        for cells in table:
            if not re.match(r'Week [123]\b',cells[0] or ''):continue
            unit=0 if pi==0 else int(re.search(r'Unit (\d+)',page.extract_text()).group(1))
            row={'id':f'u{unit}w{cells[0][5]}','page':pi+1,**{k:cells[i] for k,i in ix.items()}}
            oral=re.search(r'Words:\n(.*?)\nCategory Words:',row['vocabulary'],re.S)
            row['oral']=oral.group(1).strip().split('\n') if oral else []
            frequency=row['frequency'].split('ELA.')[0].replace('Build Your\nWord Bank:','|').split('|')
            row['highFrequency']=words(frequency[0]);row['wordBank']=words(frequency[1]) if len(frequency)>1 else []
            spelling=re.search(r'Spelling(?: Pattern)?: (.*?)Handwriting:',row['phonics'],re.S)
            part=spelling.group(1) if spelling else ''
            row['spelling']=[]
            for group in re.findall(r'\(([^()]+)\)',part):
                if ',' in group and re.fullmatch(r'[a-z ,]+',group):row['spelling']+=words(group)
            if ';' in part:row['spelling']+=words(part.split(';',1)[1])
            row['spelling']=list(dict.fromkeys(row['spelling']))
            row['category']=row['vocabulary'].split('Category Words:')[1].split('ELA.')[0].strip().replace('\n',' ')
            if unit and len(row['oral'])!=5:raise ValueError(f'Expected five oral targets in {row["id"]}')
            rows.append(row)
if len(rows)!=33:raise ValueError('Expected 33 weeks')
result={'source':'official-scope','extraction':'Table columns located by header, including the extra Unit 10 column. Targets are explicitly listed oral, high-frequency, word-bank and spelling words. Category labels, book titles, letter sounds and consonant blends are not vocabulary targets. Unit 2 Week 1 has we in High-Frequency and a in Spelling; both are retained with column provenance.','weeks':rows}
(root/'data/vocabulary/wonders-gk-scope.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'{len(rows)} weeks; {len(set(s.lower() for r in rows for k in ["oral","highFrequency","wordBank","spelling"] for s in r[k]))} explicit unique spellings')
