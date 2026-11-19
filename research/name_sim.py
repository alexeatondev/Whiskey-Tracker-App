# Synthetic naming test: persona-weighted preference simulation (multinomial logit) with respondent-level noise.
# Attribute scores (1-10) are analyst judgments; the simulation structures that judgment by segment, it is not real survey data.
import numpy as np, json
rng = np.random.default_rng(42)
A = ["memorable","category_cue","clarity","distinct","say_spell","tone"]
names = {
 "Whiskey Tracker": [4,9,10,2,10,4],
 "Second Pour":     [8,7,6,8,10,8],
 "Long Finish":     [7,7,4,8,10,9],
 "Proofmark":       [7,7,5,8,8,7],
 "Pourtrait":       [8,6,6,9,4,7],
 "Mash Note":       [6,7,5,6,8,7],
 "Tasteprint":      [7,4,7,7,9,7],
 "Sipmark":         [6,5,5,7,8,6],
 "Angel's Share":   [8,9,3,3,6,9],
 "Snapdram":        [7,8,8,4,7,6],
 "Rickhouse":       [7,9,4,6,9,8],
 "Encore":          [6,2,3,3,9,6],
}
# Business screens (not consumer-facing): extensibility to other spirits/premium tier, and availability risk (TM + app-store collisions)
ext = {"Whiskey Tracker":3,"Second Pour":8,"Long Finish":7,"Proofmark":7,"Pourtrait":8,"Mash Note":5,"Tasteprint":9,"Sipmark":8,"Angel's Share":6,"Snapdram":3,"Rickhouse":4,"Encore":6}
avail = {"Whiskey Tracker":2,"Second Pour":9,"Long Finish":7,"Proofmark":7,"Pourtrait":8,"Mash Note":5,"Tasteprint":2,"Sipmark":6,"Angel's Share":2,"Snapdram":5,"Rickhouse":1,"Encore":2}
segments = {  # weight order matches A; share = sample mix
 "Collector (Marcus)":     (0.35,[.15,.25,.25,.10,.10,.15]),
 "Explorer (Priya)":       (0.30,[.20,.05,.20,.10,.20,.25]),
 "Palate builder (Dana)":  (0.15,[.15,.25,.05,.20,.10,.25]),
 "Traveler (Tom)":         (0.12,[.25,.20,.25,.00,.20,.10]),
 "Gift buyer (Jess)":      (0.08,[.20,.00,.30,.00,.30,.20]),
}
N=1000; beta=0.9
X = np.array(list(names.values()),float); keys=list(names)
first = {k:0 for k in keys}; seg_first={s:{k:0 for k in keys} for s in segments}; top3={k:0 for k in keys}
for s,(share,w) in segments.items():
  n=int(N*share)
  for _ in range(n):
    wi = rng.dirichlet(np.array(w)*40+0.5)               # individual taste around the segment
    perceived = X + rng.normal(0,1.2,X.shape)          # people read names differently
    u = perceived@wi*beta*3
    p = np.exp(u-u.max()); p/=p.sum()
    pick = rng.choice(len(keys),p=p); first[keys[pick]]+=1; seg_first[s][keys[pick]]+=1
    for j in np.argsort(-u)[:3]: top3[keys[j]]+=1
tot=sum(first.values())
rows=[]
for k in keys:
  pref=first[k]/tot*100; t3=top3[k]/tot*100
  composite = 0.6*(t3/ max(top3.values())*tot/tot*100) + 0.2*ext[k]*10 + 0.2*avail[k]*10
  rows.append((k,pref,t3,ext[k],avail[k],composite))
rows.sort(key=lambda r:-r[5])
print(f"{'Name':16} {'1st%':>5} {'Top3%':>6} {'Ext':>4} {'Avail':>5} {'Score':>6}")
for r in rows: print(f"{r[0]:16} {r[1]:5.1f} {r[2]:6.1f} {r[3]:4d} {r[4]:5d} {r[5]:6.1f}")
print()
for s in segments:
  n=sum(seg_first[s].values()); best=sorted(seg_first[s].items(),key=lambda x:-x[1])[:3]
  print(s, ", ".join(f"{k} {v/n*100:.0f}%" for k,v in best))
json.dump({"rows":rows,"seg":seg_first},open("name_results.json","w"))
