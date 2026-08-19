import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

test("publishes three isolated department datasets", async () => {
  const departments = await readJson("public/data/departments.json");
  assert.equal(departments.departmentCount, 3);
  assert.equal(departments.totalRecordCount, 2464);
  assert.equal(departments.totalClassifiedRecordCount, 2430);
  assert.equal(departments.totalClassificationExceptionCount, 34);
  assert.deepEqual(
    departments.departments.map((item) => [item.departmentId, item.fullRecordCount]),
    [["life", 932], ["medical", 806], ["information", 726]],
  );
});

test("keeps code prefixes isolated and preserves classification exceptions", async () => {
  const specs = [
    ["life", "C", 932, 0],
    ["medical", "H", 806, 26],
    ["information", "F", 726, 8],
  ];
  const allIds = new Set();
  let exceptionTotal = 0;

  for (const [id, prefix, expectedCount, expectedExceptions] of specs) {
    const data = await readJson(`public/data/${id}.json`);
    assert.equal(data.manifest.departmentId, id);
    assert.equal(data.manifest.fullRecordCount, expectedCount);
    assert.equal(data.records.length, expectedCount);
    assert.equal(data.manifest.classificationExceptionCount, expectedExceptions);

    for (const record of data.records) {
      assert.equal(record.departmentId, id);
      assert.ok(!allIds.has(record.id), `duplicate id: ${record.id}`);
      allIds.add(record.id);
      if (record.classificationState === "classified") {
        assert.match(record.currentCode, new RegExp(`^${prefix}\\d{2}$`));
      } else {
        assert.equal(record.currentCode, "");
        exceptionTotal += 1;
      }
      for (const url of [...record.sourceUrls, ...record.evidenceUrls]) {
        assert.doesNotThrow(() => new URL(url), `invalid URL in ${record.id}: ${url}`);
      }
    }
  }
  assert.equal(allIds.size, 2464);
  assert.equal(exceptionTotal, 34);
});

test("retains documented same-name cases without collapsing identities", async () => {
  const life = await readJson("public/data/life.json");
  const information = await readJson("public/data/information.json");
  const zhangYong = life.records.filter((item) => item.name === "张勇" && item.awardYear === 2023);
  const wangGuoping = information.records.filter((item) => item.name === "汪国平" && item.awardYear === 2009);

  assert.equal(zhangYong.length, 2);
  assert.equal(life.manifest.qualityWarningCount, 1);
  assert.equal(wangGuoping.length, 2);
  assert.equal(new Set(wangGuoping.map((item) => item.institution)).size, 2);
  assert.equal(new Set(wangGuoping.map((item) => item.currentCode)).size, 2);
});

test("site source starts with department cards and contains no fixed C08 shortcut", async () => {
  const [page, html, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("static-site/index.html", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /选择一个学部/);
  assert.match(page, /className=\{`departmentCard/);
  assert.match(page, /selectedSummary\.dataFile/);
  assert.match(page, /searchParams\.get\("department"\)/);
  assert.match(page, /待归属 \/ 归属异常/);
  assert.doesNotMatch(page, /C08 免疫学/);
  assert.match(html, /国家自然科学基金杰青档案与申请代码数据库/);
  assert.match(html, /static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(layout, /国家自然科学基金杰青档案与申请代码数据库/);
});
