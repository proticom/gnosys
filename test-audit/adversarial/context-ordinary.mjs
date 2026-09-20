import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const files=['src/test/context-adversarial.test.ts','src/test/config-display-adversarial.test.ts'];
const originals=files.map(file=>[file,fs.readFileSync(file)]);
const app=execFileSync('git',['ls-files','src','prompts','extensions'],{encoding:'utf8'}).trim().split('\n').filter(file=>!file.startsWith('src/test/'));
const digest=()=>createHash('sha256').update(app.map(file=>`${file}\0${fs.readFileSync(file).toString('base64')}`).join('\0')).digest('hex');
const before=digest();
let run;
try {
 for(const [file,bytes] of originals)fs.writeFileSync(file,bytes.toString().replaceAll('it.fails(', 'it('));
 run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...files,'-t','D-CTX-001|G2-D003|D-CTX-002|ADV-CTX','--reporter=json','--outputFile=test-audit/adversarial/context-ordinary.json'],{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
} finally {
 for(const [file,bytes] of originals)fs.writeFileSync(file,bytes);
 if(digest()!==before)throw new Error('Application changed during ordinary reproduction');
}
const report=JSON.parse(fs.readFileSync('test-audit/adversarial/context-ordinary.json','utf8'));
const failures=report.testResults.flatMap(file=>file.assertionResults.filter(test=>test.status==='failed').map(test=>({file:path.relative(process.cwd(),file.name),name:test.fullName,failures:test.failureMessages})));
fs.writeFileSync('test-audit/adversarial/context-ordinary-summary.json',JSON.stringify({base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),exitCode:run.status,failedCases:failures.length,applicationDigest:before,applicationRestored:true,tests:failures},null,2)+'\n');
process.stdout.write(JSON.stringify({exitCode:run.status,failedCases:failures.length,names:failures.map(test=>test.name)},null,2)+'\n');
if(run.status!==1||failures.length!==6)throw new Error(`Expected six ordinary behavior failures, received ${failures.length}`);
