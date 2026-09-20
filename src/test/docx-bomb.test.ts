/**
 * DOCX zip-bomb and billion-laughs resistance tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractDocxText } from "../lib/docxExtract.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "gnosys-docx-bomb-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function writeMinimalDocx(documentXml: string, fileName: string): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file("word/document.xml", documentXml);

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filePath = join(workDir, fileName);
  writeFileSync(filePath, buf);
  return filePath;
}

function billionLaughsDoctype(): string {
  const entities = ['<!ENTITY lol "lol">', '<!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">'];
  for (let i = 3; i <= 9; i++) {
    const prev = `lol${i - 1}`;
    entities.push(`<!ENTITY lol${i} "${(`&${prev};`).repeat(10)}">`);
  }
  return entities.join("\n  ");
}

describe("DOCX bomb resistance", () => {
  it("rejects a zip-bomb DOCX before decompression (no OOM)", async () => {
    const payload = "a".repeat(210 * 1024 * 1024);
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${payload}</w:t></w:r></w:p></w:body>
</w:document>`;

    const filePath = await writeMinimalDocx(documentXml, "zip-bomb.docx");

    await expect(extractDocxText(filePath)).rejects.toThrow(/possible zip bomb/i);
  }, 120_000);

  it("handles billion-laughs entity definitions without exponential expansion", async () => {
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!DOCTYPE w:document [
  ${billionLaughsDoctype()}
]>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>&lol9;</w:t></w:r></w:p></w:body>
</w:document>`;

    const filePath = await writeMinimalDocx(documentXml, "billion-laughs.docx");
    await expect(extractDocxText(filePath)).rejects.toThrow("entity not found:&lol9;");
    const benignPath = await writeMinimalDocx(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Safe document text.</w:t></w:r></w:p></w:body></w:document>',
      "benign.docx",
    );
    expect(await extractDocxText(benignPath)).toEqual([{ text: "Safe document text.", sectionHeading: undefined }]);
  }, 30_000);
});
