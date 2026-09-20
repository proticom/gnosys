import { writeSync } from "node:fs";

export default class DiagnosticReporter {
  onTestCaseReady(test) {
    writeSync(2, `[test-start] ${test.module.moduleId} ${test.fullName}\n`);
  }

  onTestCaseResult(test) {
    writeSync(2, `[test-end] ${test.module.moduleId} ${test.fullName} ${test.result().state}\n`);
  }
}
