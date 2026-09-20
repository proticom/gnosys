import hashlib,json,pathlib,subprocess
root=pathlib.Path.cwd();out=root/'test-audit/release-review';file=root/'src/test/context-adversarial.test.ts'
before=file.read_bytes();source=before.decode();expected=[
'adversarial context and provider routing ADV-CTX-002 normal CLI bulk import persists the reported memories',
'adversarial context and provider routing ADV-CTX-002 normal MCP bulk import persists the reported memories']
assert source.count('it.fails("ADV-CTX-002')==2
(out/'release-context-before-test.ts.txt').write_bytes(before)
file.write_text(source.replace('it.fails("ADV-CTX-002','it("ADV-CTX-002'))
try:
 run=subprocess.run(['node','node_modules/vitest/vitest.mjs','run','src/test/context-adversarial.test.ts','-t','ADV-CTX-002','--reporter=json','--outputFile=test-audit/release-review/release-context-import-ordinary.json'],capture_output=True,text=True,timeout=180)
 report=json.loads((out/'release-context-import-ordinary.json').read_text());cases=[t for f in report['testResults'] for t in f['assertionResults'] if t['status'] not in ['pending','skipped']]
 assert run.returncode==0 and sorted(t['fullName'] for t in cases)==expected and all(t['status']=='passed' for t in cases),(run.stdout,run.stderr,cases)
except BaseException:
 file.write_bytes(before)
 raise
(out/'release-context-promotion.json').write_text(json.dumps({'checkoutRef':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'applicationRef':'e9d605f','file':'src/test/context-adversarial.test.ts','beforeSha256':hashlib.sha256(before).hexdigest(),'afterSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'markersPromoted':2,'ordinaryPasses':[t['fullName'] for t in cases]},indent=2)+'\n')
print('Both CLI/MCP persistence cases pass as ordinary tests; two expected-failure markers promoted.')
