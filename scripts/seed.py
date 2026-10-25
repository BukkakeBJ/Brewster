"""Numeric reference import; upstream prose is never retained. Run from project root."""
import json,re,xml.etree.ElementTree as E,urllib.request,pathlib
D=pathlib.Path('data')
base='https://raw.githubusercontent.com/Brewtarget/brewtarget/531d5e7523f9e72a0054349bd5b14aa1c7bf16ad/data/'
for f in ['DefaultContent001-OriginalDefaultData.xml','DefaultContent003-Ingredients-Hops-Yeasts.json']:
 p=D/('reference.xml' if f.endswith('xml') else 'reference-extra.json')
 if not p.exists(): p.write_bytes(urllib.request.urlopen(base+f).read())
r=E.fromstring('<ROOT>'+re.sub(r'<\?xml[^>]*>','',(D/'reference.xml').read_text())+'</ROOT>')
s=re.sub(r'^\s*//.*$','',(D/'reference-extra.json').read_text(),flags=re.M); s=re.sub(r',\s*([}\]])',r'\1',s)
b=json.loads(s)['beerjson']
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
def source(file): return dict(title='Brewtarget numeric brewing reference',url='https://github.com/Brewtarget/brewtarget/blob/531d5e7523f9e72a0054349bd5b14aa1c7bf16ad/data/'+file,accessed='2026-10-25',note='Reference values, not lot certificates. Null means unpublished/unknown. Single-point hop ranges represent a reference typical value, not a measured range.')
s1=source('DefaultContent001-OriginalDefaultData.xml');s2=source('DefaultContent003-Ingredients-Hops-Yeasts.json')
malts=[]; seen=set()
for x in r.findall('./FERMENTABLES/FERMENTABLE'):
 name=x.findtext('NAME');key=slug(name)
 if key in seen:continue
 seen.add(key);low=name.lower();typ=x.findtext('TYPE','Grain').lower()
 category='extract' if 'extract' in typ else 'sugar' if typ=='sugar' else 'crystal-caramel' if any(t in low for t in ['crystal','caramel','cara','special b']) else 'roasted' if any(t in low for t in ['roast','black','chocolate','carafa']) else 'adjunct' if any(t in low for t in ['flak','raw','corn','rice','torref','torrif']) else 'specialty' if any(t in low for t in ['biscuit','amber','aromatic','smok','victory','brown','acid','melanoidin']) else 'base'
 def num(k,default=0):
  try:return float(x.findtext(k,default))
  except:return default
 extract=num('YIELD');color=num('COLOR');lactose='lactose' in low
 malts.append(dict(id='m-'+key,kind='malt',name=name,maltster=x.findtext('SUPPLIER') or x.findtext('PRODUCER') or (name.split(' - ')[0] if ' - ' in name else None),type=category,lovibond=color,ebc=round(max(0,2.65*color-1.2),2),ppg=round(extract*.46214,3),extractPercent=extract,diastaticPower=num('DIASTATIC_POWER') or None,requiresMash=category not in ['extract','sugar'],maxPercent=num('MAX_IN_BATCH',100) or 100,fermentabilityNotes='Lactose is treated as nonfermentable.' if lactose else 'Crystal/caramel extract receives a model attenuation penalty.' if category=='crystal-caramel' else 'Actual fermentability depends on mash and fermentation.',bodyContribution='high' if category=='crystal-caramel' or 'oat' in low or lactose else 'medium',source=s1))
hops=[];yeasts=[];notes={}
for x in b['hop_varieties']:
 name=x['name'];i='h-'+slug(name)
 if any(z['id']==i for z in hops):continue
 oil=x.get('oil_content',{});v=lambda a:a.get('value') if isinstance(a,dict) else a
 aa=v(x.get('alpha_acid'))
 if aa is None:continue
 beta=v(x.get('beta_acid'));notes[i]=(x.get('notes','')+' '+oil.get('notes','')).lower()
 hops.append(dict(id=i,kind='hop',name=name,origin=x.get('origin','Unknown'),purpose=x.get('type','dual'),alpha=[aa,aa],beta=[beta,beta] if beta else None,cohumulone=v(oil.get('cohumulone')),totalOil=oil.get('total_oil_ml_per_100g'),oils={k:v(oil.get(k)) for k in ['myrcene','humulene','caryophyllene','farnesene','linalool','geraniol']},substitutes=[s.strip() for s in x.get('substitutes','').split(',') if s.strip()],source=s2))
for x in b['cultures']:
 name=x['name'];code=x.get('product_id','');i='y-'+slug(x.get('producer','')+'-'+code+'-'+name)
 if any(z['id']==i for z in yeasts):continue
 def rng(k,default):
  a=x.get(k,{});return [a.get('minimum',{}).get('value',default[0]),a.get('maximum',{}).get('value',default[1])]
 if not x.get('attenuation_range') or not x.get('temperature_range'):continue
 temp=rng('temperature_range',[16,22]);unit=x['temperature_range'].get('minimum',{}).get('unit','C')
 if unit=='F':temp=[round((t-32)*5/9,2) for t in temp]
 notes[i]=x.get('notes','').lower()
 yeasts.append(dict(id=i,kind='yeast',name=name,lab=x.get('producer','Unknown'),code=code,form=x.get('form','liquid'),type=x.get('type','ale'),attenuation=rng('attenuation_range',[70,80]),flocculation=x.get('flocculation','medium'),tempC=temp,alcoholTolerance=x.get('alcohol_tolerance',{}).get('value'),pof=None,diastaticus=None,source=s2))
groups={'malt':'grainy bready biscuit toasty nutty honey caramel toffee dark-fruit raisin plum chocolate coffee roast burnt smoky','hops':'citrus grapefruit lemon orange tropical mango passionfruit pineapple stone-fruit berry pine resin dank floral herbal grassy earthy spicy woody noble','yeast':'clean banana clove pear apple bubblegum pepper tart funky sulfur','structure':'body sweetness bitterness dryness carbonation astringency'}
axes=['bready','caramel','roast','citrus','tropical','pine','floral','clean','banana','clove','body','sweetness','bitterness','dryness','carbonation','astringency']
vocab=[dict(id=t,parent=parent,label=t.replace('-',' ').title(),axis=t in axes) for parent,terms in groups.items() for t in terms.split()]
des=[]
def add(i,term,intensity,context,label,src,confidence='medium'):
 des.append(dict(id='d-'+str(len(des)+1),ingredientId=i,descriptor=term,intensity=intensity,context=context,usageContext=label,sourceType='literature',confidence=confidence,note='Editorial intensity estimate from reference associations; not an analytical measurement.',source=src))
for m in malts:
 low=m['name'].lower();terms=['bready','grainy'] if m['type']=='base' else ['caramel','toffee'] if m['type']=='crystal-caramel' else ['chocolate','coffee','roast'] if m['type']=='roasted' else ['body'] if m['type']=='adjunct' else ['biscuit','toasty'] if m['type']=='specialty' else ['sweetness']
 if 'smok' in low:terms=['smoky']
 for t in terms:add(m['id'],t,3 if t!='roast' else 4,{},'grist contribution',s1,'low')
 if m['type']=='roasted': add(m['id'],'burnt',5,{'minPercent':10},'>=10% of grist',s1,'low')
for h in hops:
 text=notes[h['id']];terms=[v['id'] for v in vocab if v['parent']=='hops' and v['id'].replace('-',' ') in text]
 for t in terms:
  add(h['id'],t,3.5,{'use':'dry hop'},'dry hop',s2)
  add(h['id'],t,3,{'use':'whirlpool'},'whirlpool / hop stand',s2)
  add(h['id'],t,2.5,{'use':'boil'},'boil; aroma reduced with time',s2)
for y in yeasts:
 text=notes[y['id']];terms=[t for t in groups['yeast'].split() if t in text]
 if not terms:terms=['clean']
 for t in terms:add(y['id'],t,2.8,{},'within strain temperature range',s2,'low' if t=='clean' else 'medium')
 if any(t in terms for t in ['banana','pear','apple','bubblegum']):
  for t in [a for a in terms if a in ['banana','pear','apple','bubblegum']]:add(y['id'],t,4,{'minTempC':sum(y['tempC'])/2},'warm half of strain range',s2)
styles=[]
for x in r.findall('./STYLES/STYLE'):
 def val(k):return float(x.findtext(k,'0'))
 styles.append(dict(id=slug(x.findtext('NAME')),name=x.findtext('NAME'),og=[val('OG_MIN'),val('OG_MAX')],fg=[val('FG_MIN'),val('FG_MAX')],abv=[val('ABV_MIN'),val('ABV_MAX')],ibu=[val('IBU_MIN'),val('IBU_MAX')],srm=[val('COLOR_MIN'),val('COLOR_MAX')],source={**s1,'note':'Legacy numeric style ranges in Brewtarget; not current competition guidance. No guideline prose retained.'}))
for item in malts:
 if item['name'] in {'Carawheat (GR)',"Harraway's Rolled Oats",'Harraways Rolled Barley'}:
  item['maxPercentIsEstimate']=True
  item['source']={**item['source'],'note':item['source']['note']+' Recommended maximum is unspecified; maxPercent=100 is a permissive model cap, not manufacturer advice.'}
overrides=json.loads((D/'overrides.json').read_text()) if (D/'overrides.json').exists() else {}
for group,items in [('malts',malts),('hops',hops),('yeasts',yeasts)]:
 for item in items:item.update(overrides.get(group,{}).get(item['id'],{}))
for name,value in [('malts',malts),('hops',hops),('yeasts',yeasts),('descriptors',des),('vocabulary',vocab),('styles',styles)]:
 (D/(name+'.json')).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n');print(name,len(value))
