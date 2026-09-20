import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gnosys-release-config-')));
const canary = 'fixture-only-config-key-7f94a31c';
const cli = path.resolve('dist/cli.js');
const env = { PATH: process.env.PATH, HOME: root, GNOSYS_HOME: path.join(root,'brain'), GNOSYS_CONFIG_DIR: path.join(root,'config'), GNOSYS_LOCAL_ONLY:'1',GNOSYS_SKIP_UPGRADE_NUDGE:'1',VITEST:'true',CI:'true' };
const run = args => spawnSync(process.execPath,[cli,...args],{cwd:root,env,encoding:'utf8'});
try {
 const initialized = run(['init']); assert.equal(initialized.status,0,initialized.stderr);
 const configFile = path.join(root,'.gnosys','gnosys.json');
 const config = JSON.parse(fs.readFileSync(configFile,'utf8'));
 fs.writeFileSync(configFile,JSON.stringify({...config,llm:{defaultProvider:'custom',custom:{model:'display-canary-model',baseUrl:'http://provider.invalid/v1',apiKey:canary}}}));
 const before = fs.readFileSync(configFile);
 const result = run(['config','show','--json']); assert.equal(result.status,0,result.stderr);
 const shown = JSON.parse(result.stdout);
 assert.equal(shown.llm.defaultProvider,'custom');assert.equal(shown.llm.custom.model,'display-canary-model');assert.equal(shown.llm.custom.baseUrl,'http://provider.invalid/v1');
 let failure;
 try { assert.equal((result.stdout+result.stderr).includes(canary),false,'JSON config display must not expose stored key bytes'); } catch(error) { failure = {name:error.name,message:error.message}; }
 assert.equal(failure?.name,'AssertionError');assert.deepEqual(fs.readFileSync(configFile),before);
 const report = {defectId:'ADV-CTX-001',ordinaryAssertionStatus:'failed',command:['config','show','--json'],exitCode:result.status,stdout:result.stdout,stderr:result.stderr,configBytesUnchanged:true,failure};
 const outputFlag = process.argv.indexOf('--output');
 if (outputFlag !== -1 && !process.argv[outputFlag + 1]) throw new Error('--output requires a new report path');
 const target = outputFlag === -1 ? path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gnosys-release-config-report-')), 'ordinary.json') : path.resolve(process.argv[outputFlag + 1]);
 fs.mkdirSync(path.dirname(target), { recursive: true });
 fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({ reportPath:target, defectId:'ADV-CTX-001', ordinaryAssertionStatus:'failed', configBytesUnchanged:true }));
} finally {fs.rmSync(root,{recursive:true,force:true});}
