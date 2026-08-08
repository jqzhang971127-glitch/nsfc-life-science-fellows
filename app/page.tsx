"use client";

import { useEffect, useMemo, useState } from "react";

type RecordItem = {
  rowNumber: number;
  id: string;
  scientificDepartmentNumber: string;
  historicalDiscipline: string;
  currentCode: string;
  researchDirection: string;
  name: string;
  institution: string;
  currentCategory: string;
  awardYear: number;
  classificationReason: string;
  sourceUrls: string[];
  sourceLabel: string;
  verificationStatus: string;
  evidenceUrls: string[];
  verificationNote: string;
  confidence: string;
};

type FellowsDatabase = {
  manifest: {
    sourceLastModified: string;
    fullRecordCount: number;
    verifiedRecordCount: number;
    pendingRecordCount: number;
    missingDirectionCount: number;
    c08RecordCount: number;
    yearStart: number;
    yearEnd: number;
    codeCount: number;
  };
  records: RecordItem[];
};

const ALL = "全部";
const PAGE_SIZE = 30;
const EMPTY_RECORDS: RecordItem[] = [];
const CODE_NAMES: Record<string, string> = {
  C01: "微生物学",
  C02: "植物学",
  C03: "生态学",
  C04: "动物学",
  C05: "生物物理与生物化学",
  C06: "遗传学与生物信息学",
  C07: "细胞生物学",
  C08: "免疫学",
  C09: "神经科学与心理学",
  C10: "生物材料、成像与组织工程学",
  C11: "生理学与整合生物学",
  C12: "发育生物学与生殖生物学",
  C13: "农学基础与作物学",
  C14: "植物保护学",
  C15: "园艺学与植物营养学",
  C16: "林学",
  C17: "畜牧学",
  C18: "兽医学",
  C19: "水产学",
  C20: "食品科学",
  C21: "分子生物学与生物技术",
  C22: "草学",
};

function formatCode(code: string) {
  return CODE_NAMES[code] ? `${code} ${CODE_NAMES[code]}` : code;
}

function confidenceClass(value: string) {
  if (value === "高") return "high";
  if (value.includes("高")) return "midHigh";
  if (value.includes("中")) return "mid";
  return "pending";
}

function verificationClass(value: string) {
  return value === "已核验" ? "verified" : "unverified";
}

function uniqueSourceUrls(item: RecordItem) {
  const sources = new Map<string, string>();
  for (const rawUrl of [...item.sourceUrls, ...item.evidenceUrls]) {
    try {
      const parsed = new URL(rawUrl);
      parsed.hash = "";
      const key = parsed.href.replace(/\/$/, "");
      if (!sources.has(key)) sources.set(key, rawUrl);
    } catch {
      if (!sources.has(rawUrl)) sources.set(rawUrl, rawUrl);
    }
  }
  return [...sources.values()];
}

function sourceType(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "nsfc.gov.cn" || host.endsWith(".nsfc.gov.cn")) return `基金委官网 · ${host}`;
    if (host.endsWith(".edu.cn")) return `高校官网 · ${host}`;
    if (host.endsWith(".cas.cn") || host.endsWith(".ac.cn")) return `科研机构官网 · ${host}`;
    if (host.includes("baidu.com") || host.includes("baike.com")) return `百科资料 · ${host}`;
    if (host === "web.archive.org") return "网页存档 · web.archive.org";
    if (host.endsWith(".gov.cn")) return `政府机构官网 · ${host}`;
    return host;
  } catch {
    return "外部来源";
  }
}

export default function Home() {
  const [mode, setMode] = useState<"person" | "browse">("person");
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCode, setDraftCode] = useState(ALL);
  const [draftYear, setDraftYear] = useState(ALL);
  const [draftStatus, setDraftStatus] = useState(ALL);
  const [filters, setFilters] = useState({ search: "", code: ALL, year: ALL, status: ALL });
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [page, setPage] = useState(1);
  const [database, setDatabase] = useState<FellowsDatabase | null>(null);
  const [loadError, setLoadError] = useState("");
  const records = database?.records ?? EMPTY_RECORDS;
  const manifest = database?.manifest;

  useEffect(() => {
    const controller = new AbortController();
    fetch("./data/fellows.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`数据文件加载失败：${response.status}`);
        return response.json() as Promise<FellowsDatabase>;
      })
      .then((payload) => {
        if (payload.records.length !== payload.manifest.fullRecordCount) throw new Error("数据记录数与清单不一致");
        setDatabase(payload);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      });
    return () => controller.abort();
  }, []);

  const codes = useMemo(
    () => [...new Set(records.map((item) => item.currentCode))].sort((a, b) => a.localeCompare(b)),
    [records],
  );
  const years = useMemo(
    () => [...new Set(records.map((item) => item.awardYear))].sort((a, b) => b - a),
    [records],
  );

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLocaleLowerCase("zh-CN");
    return records.filter((item) => {
      const haystack = [
        item.name,
        item.institution,
        item.scientificDepartmentNumber,
        item.historicalDiscipline,
        item.currentCategory,
        item.researchDirection,
      ].join(" ").toLocaleLowerCase("zh-CN");
      return (
        (!query || haystack.includes(query)) &&
        (filters.code === ALL || item.currentCode === filters.code) &&
        (filters.year === ALL || String(item.awardYear) === filters.year) &&
        (filters.status === ALL || item.verificationStatus === filters.status)
      );
    });
  }, [filters, records]);

  function applyFilters() {
    setFilters({ search: draftSearch, code: draftCode, year: draftYear, status: draftStatus });
    setPage(1);
  }

  function quickFilter(next: Partial<typeof filters>) {
    const merged = { search: "", code: ALL, year: ALL, status: ALL, ...next };
    setDraftSearch(merged.search);
    setDraftCode(merged.code);
    setDraftYear(merged.year);
    setDraftStatus(merged.status);
    setFilters(merged);
    setPage(1);
  }

  const verifiedVisible = filtered.filter((item) => item.verificationStatus === "已核验").length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedRecords = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const selectedSources = selected ? uniqueSourceUrls(selected) : [];

  return (
    <main className="pageShell">
      <div className="wrap">
        <header className="hero">
          <div className="heroTopline">
            <span className="kicker">国家自然科学基金 · 生命科学部</span>
            <button className="methodLink" onClick={() => setShowMethod(true)}>数据口径与方法</button>
          </div>
          <h1>杰青档案 · 申请代码查询</h1>
          <p className="subtitle">
            按2026年申请代码重新整理生命科学部历年杰青项目，保留历史学科、分类依据与可回溯证据。
          </p>
          <div className="heroStats" aria-label="数据库概览">
            <span><b>{manifest?.fullRecordCount ?? "—"}</b> 条有效记录</span>
            <span><b>{manifest ? `${manifest.yearStart}—${manifest.yearEnd}` : "—"}</b> 年</span>
            <span><b>{manifest?.verifiedRecordCount ?? "—"}</b> 条已核验</span>
            <span><b>C01—C22</b> 现行一级代码</span>
          </div>

          <div className="tabs" role="tablist" aria-label="查询模式">
            <button
              className={`tab ${mode === "person" ? "active" : ""}`}
              onClick={() => setMode("person")}
              role="tab"
              aria-selected={mode === "person"}
            >
              按姓名查档案
            </button>
            <button
              className={`tab ${mode === "browse" ? "active" : ""}`}
              onClick={() => setMode("browse")}
              role="tab"
              aria-selected={mode === "browse"}
            >
              按代码 / 年度浏览
            </button>
          </div>
        </header>

        <section className="searchPanel" aria-label="档案筛选">
          <div className="controls">
            <label className="field searchField">
              <span>① {mode === "person" ? "姓名、单位或科学部编号" : "关键词（可选）"}</span>
              <input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                placeholder={mode === "person" ? "例如：李斌、浙江大学、3152500249" : "研究方向、原所属学科或单位"}
              />
            </label>
            <label className="field">
              <span>② 现行一级代码</span>
              <select value={draftCode} onChange={(event) => setDraftCode(event.target.value)}>
                <option>{ALL}</option>
                {codes.map((code) => <option key={code} value={code}>{formatCode(code)}</option>)}
              </select>
            </label>
            <label className="field">
              <span>③ 获批年度</span>
              <select value={draftYear} onChange={(event) => setDraftYear(event.target.value)}>
                <option>{ALL}</option>
                {years.map((year) => <option key={year}>{year}</option>)}
              </select>
            </label>
            <label className="field">
              <span>④ 核验状态</span>
              <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                <option>{ALL}</option>
                <option>已核验</option>
                <option>待核验</option>
              </select>
            </label>
            <button className="primaryButton" onClick={applyFilters}>查询</button>
          </div>
          <div className="quickRow">
            <span>快捷查看</span>
            <button onClick={() => quickFilter({})}>全部记录</button>
            <button className="c08Quick" onClick={() => quickFilter({ code: "C08" })}>C08 免疫学</button>
            <button onClick={() => quickFilter({ year: "2025" })}>2025年</button>
            <button onClick={() => quickFilter({ status: "已核验" })}>仅已核验</button>
          </div>
        </section>

        <section className="resultSummary" aria-live="polite">
          <div>{database ? <>当前匹配 <b>{filtered.length}</b> 条记录，其中 <b>{verifiedVisible}</b> 条已核验</> : <>正在载入全库数据…</>}</div>
          <div className="summaryChips">
            {filters.code !== ALL && <span>{formatCode(filters.code)}</span>}
            {filters.year !== ALL && <span>{filters.year}年</span>}
            {filters.status !== ALL && <span>{filters.status}</span>}
            {filters.search && <span>“{filters.search}”</span>}
            {!filters.search && filters.code === ALL && filters.year === ALL && filters.status === ALL && <span>全部记录</span>}
          </div>
        </section>

        <section className="resultsCard">
          <div className="cardHeading">
            <div>
              <span className="eyebrow">生命科学部杰青档案</span>
              <h2>检索结果</h2>
            </div>
            <span className="demoBadge">{manifest ? `全库 · ${manifest.fullRecordCount}条` : "数据载入中"}</span>
          </div>

          {loadError ? (
            <div className="emptyState">
              <span>!</span>
              <h3>全库数据暂时无法载入</h3>
              <p>{loadError}</p>
              <button onClick={() => window.location.reload()}>重新载入</button>
            </div>
          ) : !database ? (
            <div className="loadingState" aria-live="polite"><span />正在载入920条全库记录…</div>
          ) : filtered.length ? (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>申请人</th>
                    <th>获批年度</th>
                    <th>现行代码</th>
                    <th>依托单位 / 原所属学科</th>
                    <th>研究方向</th>
                    <th>核验</th>
                    <th aria-label="查看档案" />
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <button className="nameButton" onClick={() => setSelected(item)}>{item.name}</button>
                        <small>{item.scientificDepartmentNumber}</small>
                      </td>
                      <td><span className="yearBadge">{item.awardYear}</span></td>
                      <td>
                        <span className={`codeBadge ${item.currentCode === "C08" ? "isC08" : ""}`}>{formatCode(item.currentCode)}</span>
                      </td>
                      <td>
                        <b className="institution">{item.institution}</b>
                        <small>{item.historicalDiscipline || "原所属学科待补充"}</small>
                      </td>
                      <td className="direction">{item.researchDirection || <span className="muted">待补充</span>}</td>
                      <td>
                        <span className={`statusBadge ${verificationClass(item.verificationStatus)}`}>{item.verificationStatus}</span>
                        <span className={`confidence ${confidenceClass(item.confidence)}`}>{item.confidence}</span>
                      </td>
                      <td><button className="detailButton" onClick={() => setSelected(item)} aria-label={`查看${item.name}完整档案`}>查看档案 →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="emptyState">
              <span>⌕</span>
              <h3>没有匹配的记录</h3>
              <p>可以清空关键词，或使用“全部记录”恢复默认范围。</p>
              <button onClick={() => quickFilter({})}>查看全部记录</button>
            </div>
          )}
          {filtered.length > 0 && (
            <nav className="pagination" aria-label="结果分页">
              <div>
                第 <b>{safePage}</b> / {totalPages} 页
                <span>本页 {pageStart + 1}—{Math.min(pageStart + PAGE_SIZE, filtered.length)} 条</span>
              </div>
              <div className="paginationButtons">
                <button onClick={() => setPage(1)} disabled={safePage === 1}>首页</button>
                <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1}>上一页</button>
                <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages}>下一页</button>
                <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>末页</button>
              </div>
            </nav>
          )}
        </section>

        <section className="methodStrip">
          <div>
            <span className="eyebrow">编号口径</span>
            <h2>科学部编号 ≠ 项目批准号 ≠ 申请代码</h2>
          </div>
          <p>本Demo将“科学部编号”原样保存；“现行代码”按2026年生命科学部申请代码重新判断，并保留分类理由。</p>
          <button onClick={() => setShowMethod(true)}>查看整理方法</button>
        </section>

        <footer>
          <span>数据源：生命科学学部_v3.xlsx · {manifest?.fullRecordCount ?? "—"}条有效记录 · 更新于{manifest?.sourceLastModified.slice(0, 10) ?? "—"}</span>
          <span>Cloudflare Web Analytics 接入位已预留，本地预览不发送统计数据</span>
        </footer>
      </div>

      {selected && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <article className="detailModal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="closeButton" onClick={() => setSelected(null)} aria-label="关闭档案">×</button>
            <div className="detailHeader">
              <span className="kicker">{formatCode(selected.currentCode)}</span>
              <h2 id="detail-title">{selected.name}</h2>
              <p>{selected.institution}</p>
              <div className="detailBadges">
                <span className="yearBadge">{selected.awardYear}年获批</span>
                <span className={`statusBadge ${verificationClass(selected.verificationStatus)}`}>{selected.verificationStatus}</span>
                <span className={`confidence ${confidenceClass(selected.confidence)}`}>可信度：{selected.confidence}</span>
              </div>
            </div>

            <dl className="detailGrid">
              <div><dt>科学部编号</dt><dd>{selected.scientificDepartmentNumber || "待补充"}</dd></div>
              <div><dt>原所属学科</dt><dd>{selected.historicalDiscipline || "待补充"}</dd></div>
              <div><dt>现行一级代码</dt><dd>{formatCode(selected.currentCode)}</dd></div>
              <div><dt>研究方向</dt><dd>{selected.researchDirection || "待补充"}</dd></div>
            </dl>

            <section className="detailSection">
              <h3>分类判断说明</h3>
              <p>{selected.classificationReason || "暂未填写分类判断说明。"}</p>
            </section>
            <section className="detailSection">
              <h3>核验说明</h3>
              <p>{selected.verificationNote || "该记录尚未补充详细核验说明。"}</p>
            </section>
            <section className="detailSection sourceSection">
              <h3>可回溯来源</h3>
              <div className="sourceLinks">
                {selectedSources.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" title={url}>来源 {index + 1} · {sourceType(url)} ↗</a>
                ))}
                {selectedSources.length === 0 && <span className="muted">来源待补充</span>}
              </div>
            </section>
          </article>
        </div>
      )}

      {showMethod && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowMethod(false)}>
          <article className="detailModal methodModal" role="dialog" aria-modal="true" aria-labelledby="method-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="closeButton" onClick={() => setShowMethod(false)} aria-label="关闭说明">×</button>
            <span className="kicker">数据库方法</span>
            <h2 id="method-title">分类与核验口径</h2>
            <ol className="methodList">
              <li><b>保留原始字段：</b>姓名、年度、依托单位、科学部编号和历史所属学科均按公开名单记录。</li>
              <li><b>按最新代码归类：</b>历史项目依据研究方向和公开证据映射到2026年C01—C22一级代码。</li>
              <li><b>不混用编号：</b>科学部编号只作为档案标识，不自动视为项目批准号或申请代码。</li>
              <li><b>证据可回溯：</b>基金委、依托单位和论文等来源保留为可点击链接，并记录核验说明与可信度。</li>
              <li><b>透明展示空缺：</b>尚未核验或暂缺研究方向的记录保留“待核验/待补充”标记。</li>
            </ol>
            <div className="methodNote">2025年起“国家杰出青年科学基金项目”更名为“青年科学基金项目（A类）”，网站将在正式版中单独说明。</div>
          </article>
        </div>
      )}
    </main>
  );
}
