import base64,hashlib,json,pathlib,re,subprocess
root=pathlib.Path.cwd();out=root/'test-audit/release-review'
read=lambda name:json.loads((out/name).read_text())
def write(name,value):
 p=out/name;assert not p.exists(),name;p.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ref=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
assert ref=='5dac0725bde036e1eea5689ed1977d23b73a364f'
appref=subprocess.check_output(['git','rev-parse','e9d605f'],text=True).strip()
production=subprocess.check_output(['git','ls-files','src','prompts','extensions'],text=True).strip().splitlines();production=[f for f in production if not f.startswith('src/test/') and not f.endswith('.test.ts')]
digest=hashlib.sha256('\0'.join(f+'\0'+base64.b64encode((root/f).read_bytes()).decode() for f in production).encode()).hexdigest()
assert subprocess.check_output(['git','diff','HEAD','--',*production],text=True)==''
changed=subprocess.check_output(['git','diff','--name-only'],text=True).strip().splitlines();assert changed==['src/test/context-adversarial.test.ts'],changed
before=(out/'release-context-before-test.ts.txt').read_text();after=(root/'src/test/context-adversarial.test.ts').read_text();assert after==before.replace('it.fails("ADV-CTX-002','it("ADV-CTX-002')
report=read('release-context-unit.json');cases=[{'file':str(pathlib.Path(f['name']).relative_to(root)),'name':t['fullName'],'status':t['status']} for f in report['testResults'] for t in f['assertionResults']];assert len(cases)==26 and all(t['status']=='passed' for t in cases)
results=read('release-context-mutations.results.json');specs=read('release-context-mutations.json');assert results['applicationDigest']==digest and len(results['results'])==len(specs)==15
assert {r['id'] for r in results['results']}=={s['id'] for s in specs}
kill={}
for r in results['results']:
 assert r['outcome']=='killed' and r['applicationRestored'] and r['before']['exitCode']==r['restored']['exitCode']==0 and r['mutated']['exitCode']==1
 for phase in ['before','restored']:assert r[phase]['tests'] and all(t['status']=='passed' for t in r[phase]['tests'])
 for t in r['killedBy']:kill.setdefault((t['file'],t['name']),[]).append(r['id'])
assert len(kill)==19
known={(t['file'],t['name']) for t in cases};assert set(kill)<=known
actions=[]
for line,text in enumerate(before.splitlines(),1):
 m=re.search(r'it\.fails\("(ADV-CTX-002[^\"]+)"',text)
 if not m:continue
 name=next(t['name'] for t in cases if t['name'].endswith(m.group(1)));ids=kill[('src/test/context-adversarial.test.ts',name)]
 actions.append({'beforeId':f'src/test/context-adversarial.test.ts:{line}','name':name,'action':'expected_failure_to_ordinary','defectId':'ADV-CTX-002','ordinaryStatus':'passed','mutationIds':ids,'applicationRef':appref,'applicationDigest':digest})
assert len(actions)==2
write('release-context-actions.json',actions)
features=json.loads((root/'test-audit/adversarial/context-f4b9135-feature-coverage.json').read_text())
for row in features:
 for t in row['tests']:
  assert (t['file'],t['name']) in known;t['mutationIds']=kill.get((t['file'],t['name']),[])
 if (row['featureId'],row['obligationKind'])==('F19','success'):
  row['status']='PARTIAL';row['limitations']='Real normal CLI and MCP LLM imports through the local custom HTTP provider persist the two literal JSON-derived titles and bodies in the reopened central DB and report Imported:2/Failed:0/Total:2. Separate omission of each caller DB argument kills its ordinary case. CSV, JSONL, Markdown bootstrap, mapped tags/category and other records are not demonstrated by these two cases.'
 if (row['featureId'],row['obligationKind'])==('F19','boundary'):
  row['limitations']='CLI and MCP honor configured provider/concurrency2, and the original CLI override1 passes. The MCP dry-run case leaves the central DB empty while the normal MCP control persists two rows. CLI dry-run write protection, skip-existing, offset/limit and other concurrency values are outside this subset.'
write('release-context-feature-coverage.json',features)
config=read('release-context-config-ordinary.json');assert config['ordinaryAssertionStatus']=='failed' and config['configBytesUnchanged']
write('release-context-defects.json',{'applicationRef':appref,'applicationDigest':digest,'defects':[{'id':'ADV-CTX-002','status':'verified_fixed','tests':actions,'evidence':'test-audit/release-review/release-context-import-ordinary.json'},{'id':'ADV-CTX-001','status':'open','expectedFailureRetained':True,'actual':'JSON config show prints the fake stored custom-provider API key; the stored config bytes remain unchanged.','evidence':'test-audit/release-review/release-context-config-ordinary.json'}]})
patch=subprocess.check_output(['git','diff','--','src/test/context-adversarial.test.ts'],text=True);(out/'release-context-tests.patch').write_text(patch)
meta={'checkoutRef':ref,'applicationRef':appref,'applicationDigest':digest,'applicationNetDiff':'','changedTests':[{'path':'src/test/context-adversarial.test.ts','beforeSha256':hashlib.sha256(before.encode()).hexdigest(),'afterSha256':sha(root/'src/test/context-adversarial.test.ts')}],'counts':{'unitPassed':26,'unitFailed':0,'unitSkipped':0,'expectedFailures':1,'markersPromoted':2,'priorFaultsKilled':13,'newPersistenceFaultsKilled':2,'faultsKilled':15,'survivors':0,'uniqueKilledCases':19},'staticChecks':{'typecheckExitCode':0,'biomeExitCode':0},'testOutcomes':cases,'patch':'test-audit/release-review/release-context-tests.patch','actions':'test-audit/release-review/release-context-actions.json','features':'test-audit/release-review/release-context-feature-coverage.json','defects':'test-audit/release-review/release-context-defects.json','mutationSpecs':'test-audit/release-review/release-context-mutations.json','mutationResults':'test-audit/release-review/release-context-mutations.results.json','unitEvidence':'test-audit/release-review/release-context-unit.json'}
write('release-context-final.json',meta)
(out/'release-context-HANDOFF.md').write_text(f'''# Release context QA

Validated QA checkout `{ref}`, application `{appref}`, in `/private/tmp/gnosys-release-context` with Node22. Application digest is `{digest}`. No application changes or commits were retained.

Both normal CLI/MCP bulk imports pass their existing literal reopened-database assertions as ordinary tests. Only their two `it.fails` markers changed. The custom local HTTP provider and actual CLI/MCP boundaries remain intact.

The existing four-file context/provider/dedup/config unit has26 passed, zero failed and zero skipped, with one expected failure. Typecheck and edited-file Biome pass. All13 prior context faults plus two caller-specific persistence faults are killed, covering19 distinct ordinary cases. Every before/restored selection passes and every application mutation restores exactly.

ADV-CTX-001 remains open. Actual `config show --json` exposes the fake stored provider key; config bytes are unchanged. Its test and expected-failure annotation are untouched. Run `node test-audit/release-review/release-context-config-repro.mjs` for a fresh temporary report, or add `--output /tmp/config-release-new.json` for a chosen new path. It refuses to overwrite evidence.

The test patch is `release-context-tests.patch`. `release-context-final.json` lists all26 exact outcomes and file hashes. `release-context-actions.json` maps both promoted markers to their direct fault IDs. Specs/results, feature limits, defect status and artifact hashes are adjacent under the same prefix. These results cover this owned unit; the parent owns integrated full-suite validation.
''')
write('release-context-artifact-sha256.json',{'files':[{'path':str(p.relative_to(root)),'sha256':sha(p)} for p in sorted(out.glob('release-context-*')) if p.is_file()]})
print(json.dumps(meta['counts']|{'applicationDigest':digest},indent=2))
