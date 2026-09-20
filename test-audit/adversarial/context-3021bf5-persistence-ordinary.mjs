import fs from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const files=['src/test/context-adversarial.test.ts'];
const originals=files.map(file=>[file,fs.readFileSync(file)]);
const production=execFileSync('git',['ls-files','src','prompts','extensions'],{encoding:'utf8'}).trim().split('\n').filter(file=>!file.startsWith('src/test/'));
const digest=()=>createHash('sha256').update(production.map(file=>`${file}\0${fs.readFileSync(file).toString('base64')}`).join('\0')).digest('hex');
const before=digest();
fs.writeFileSync('test-audit/adversarial/context-3021bf5-persistence-before-tests.json',JSON.stringify(originals.map(([file,bytes])=>({file,source:bytes.toString()})),null,2)+'\n');
let run;
try {
 for(const [file,bytes] of originals)fs.writeFileSync(file,bytes.toString().replaceAll('it.fails("ADV-CTX-002','it("ADV-CTX-002'));
 run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...files,'-t','ADV-CTX-002','--reporter=json','--outputFile=test-audit/adversarial/context-3021bf5-persistence-ordinary.json'],{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
} finally {
 for(const [file,bytes] of originals)fs.writeFileSync(file,bytes);
 if(digest()!==before)throw new Error('Application changed during repair replay');
}
const report=JSON.parse(fs.readFileSync('test-audit/adversarial/context-3021bf5-persistence-ordinary.json','utf8'));
const tests=report.testResults.flatMap(file=>file.assertionResults.filter(test=>!['pending','skipped'].includes(test.status)).map(test=>({file:file.name,name:test.fullName,status:test.status,failures:test.failureMessages})));
fs.writeFileSync('test-audit/adversarial/context-3021bf5-persistence-ordinary-summary.json',JSON.stringify({ref:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),applicationDigest:before,applicationRestored:true,exitCode:run.status,tests},null,2)+'\n');
process.stdout.write(JSON.stringify({exitCode:run.status,tests},null,2)+'\n');
if(run.status!==1||report.numFailedTests!==2)throw new Error('Expected both ordinary CLI/MCP persistence cases to fail');
