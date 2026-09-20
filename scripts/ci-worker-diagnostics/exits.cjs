const fs = require('node:fs');
const childProcess = require('node:child_process');
const emit = childProcess.ChildProcess.prototype.emit;
childProcess.ChildProcess.prototype.emit = function (event, ...args) {
  if (event === 'exit') {
    fs.writeSync(2, `[child-exit] parent=${process.pid} pid=${this.pid} code=${args[0]} signal=${args[1]} executable=${this.spawnfile}\n`);
  }
  return Reflect.apply(emit, this, [event, ...args]);
};
const exit = process.exit;
process.exit = function (code) {
  fs.writeSync(2, `[process-exit] pid=${process.pid} code=${code}\n${new Error('process.exit caller').stack}\n`);
  return Reflect.apply(exit, process, [code]);
};
process.on('exit', code => fs.writeSync(2, `[process-exit-event] pid=${process.pid} code=${code}\n`));
