"use client";

import { useEffect, useMemo, useState } from "react";

type DepartmentId = "life" | "medical" | "information";
type VerificationState = "verified" | "pending";
type ClassificationState = "classified" | "unassigned" | "mismatch";

type DepartmentSummary = {
  departmentId: DepartmentId;
  departmentName: string;
  shortName: string;
  accent: string;
  sourceFile: string;
  sourceLastModified: string;
  codeVersion: string;
  codePrefix: string;
  codeCount: number;
  codeMin: string;
  codeMax: string;
  fullRecordCount: number;
  classifiedRecordCount: number;
  classificationExceptionCount: number;
  verifiedRecordCount: number;
  pendingRecordCount: number;
  yearStart: number;
  yearEnd: number;
  qualityWarningCount: number;
  dataFile: string;
};

type DepartmentsManifest = {
  generatedAt: string;
  codeVersion: string;
  departmentCount: number;
  totalRecordCount: number;
  totalClassifiedRecordCount: number;
  totalClassificationExceptionCount: number;
  departments: DepartmentSummary[];
};

type RecordItem = {
  rowNumber: number;
  id: string;
  departmentId: DepartmentId;
  departmentName: string;
  scientificDepartmentNumber: string;
  historicalDiscipline: string;
  currentCode: string;
  rawCurrentCode: string;
  researchDirection: string;
  name: string;
  institution: string;
  currentCategory: string;
  awardYear: number;
  classificationReason: string;
  classificationState: ClassificationState;
  sourceUrls: string[];
  sourceLabel: string;
  verificationState: VerificationState;
  rawVerificationStatus: string;
  evidenceUrls: string[];
  verificationNote: string;
  confidence: string;
};

type QualityWarning = {
  type: string;
  name: string;
  awardYear: number;
  institution: string;
  rowNumbers: number[];
  message: string;
};

type DepartmentManifest = DepartmentSummary & {
  codeNames: Record<string, string>;
  unassignedRecordCount: number;
  mismatchRecordCount: number;
  missingDirectionCount: number;
  qualityWarnings: QualityWarning[];
};

type FellowsDatabase = {
  manifest: DepartmentManifest;
  records: RecordItem[];
};

type Filters = {
  search: string;
  code: string;
  year: string;
  status: string;
};

const ALL = "全部";
const UNASSIGNED = "__unassigned__";
const PAGE_SIZE = 30;
const EMPTY_RECORDS: RecordItem[] = [];
const EMPTY_CODE_NAMES: Record<string, string> = {};
const VALID_DEPARTMENTS = new Set<DepartmentId>(["life", "medical", "information"]);
const EMPTY_FILTERS: Filters = { search: "", code: ALL, year: ALL, status: ALL };

function formatCode(code: string, codeNames: Record<string, string>) {
  if (!code) return "待归属";
  return codeNames[code] ? `${code} ${codeNames[code]}` : code;
}

function confidenceClass(value: string) {
  if (value === "高") return "high";
  if (value.includes("高")) return "midHigh";
  if (value.includes("中")) return "mid";
  return "pending";
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

function verificationLabel(item: RecordItem) {
  return item.verificationState === "verified" ? "已核验" : "待核验";
}

function classificationLabel(state: ClassificationState) {
  if (state === "mismatch") return "归属异常";
  if (state === "unassigned") return "待归属";
  return "已分类";
}

export default function Home() {
  const [departmentsManifest, setDepartmentsManifest] = useState<DepartmentsManifest | null>(null);
  const [departmentId, setDepartmentId] = useState<DepartmentId | null>(null);
  const [database, setDatabase] = useState<FellowsDatabase | null>(null);
  const [manifestError, setManifestError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<"person" | "browse">("person");
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCode, setDraftCode] = useState(ALL);
  const [draftYear, setDraftYear] = useState(ALL);
  const [draftStatus, setDraftStatus] = useState(ALL);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [page, setPage] = useState(1);

  const selectedSummary = departmentsManifest?.departments.find(
    (item) => item.departmentId === departmentId,
  );
  const records = database?.records ?? EMPTY_RECORDS;
  const manifest = database?.manifest;
  const codeNames = manifest?.codeNames ?? EMPTY_CODE_NAMES;

  useEffect(() => {
    const controller = new AbortController();
    fetch("./data/departments.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`学部清单加载失败：${response.status}`);
        return response.json() as Promise<DepartmentsManifest>;
      })
      .then((payload) => {
        if (payload.departments.length !== payload.departmentCount) throw new Error("学部清单数量不一致");
        setDepartmentsManifest(payload);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setManifestError(error.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function syncDepartmentFromUrl() {
      const raw = new URL(window.location.href).searchParams.get("department") as DepartmentId | null;
      setDatabase(null);
      setLoadError("");
      setDraftSearch("");
      setDraftCode(ALL);
      setDraftYear(ALL);
      setDraftStatus(ALL);
      setFilters(EMPTY_FILTERS);
      setSelected(null);
      setPage(1);
      setMode("person");
      setDepartmentId(raw && VALID_DEPARTMENTS.has(raw) ? raw : null);
    }
    syncDepartmentFromUrl();
    window.addEventListener("popstate", syncDepartmentFromUrl);
    return () => window.removeEventListener("popstate", syncDepartmentFromUrl);
  }, []);

  useEffect(() => {
    if (!selectedSummary) return;
    const controller = new AbortController();
    fetch(`./data/${selectedSummary.dataFile}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`学部数据加载失败：${response.status}`);
        return response.json() as Promise<FellowsDatabase>;
      })
      .then((payload) => {
        if (payload.manifest.departmentId !== selectedSummary.departmentId) throw new Error("学部数据与所选卡片不一致");
        if (payload.records.length !== payload.manifest.fullRecordCount) throw new Error("数据记录数与清单不一致");
        setDatabase(payload);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      });
    return () => controller.abort();
  }, [selectedSummary]);

  const codes = useMemo(() => Object.keys(codeNames).sort((a, b) => a.localeCompare(b)), [codeNames]);
  const years = useMemo(
    () => [...new Set(records.map((item) => item.awardYear))].sort((a, b) => b - a),
    [records],
  );

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLocaleLowerCase("zh-CN");
    return records.filter((item) => {
      const haystack = [item.name, item.institution, item.scientificDepartmentNumber, item.historicalDiscipline, item.currentCategory, item.researchDirection, item.rawVerificationStatus]
        .join(" ")
        .toLocaleLowerCase("zh-CN");
      const codeMatches = filters.code === ALL || (filters.code === UNASSIGNED ? item.classificationState !== "classified" : item.currentCode === filters.code);
      const statusMatches =
        filters.status === ALL ||
        (filters.status === "已核验" && item.verificationState === "verified") ||
        (filters.status === "待核验" && item.verificationState === "pending") ||
        (filters.status === "待归属" && item.classificationState === "unassigned") ||
        (filters.status === "归属异常" && item.classificationState === "mismatch");
      return (!query || haystack.includes(query)) && codeMatches && (filters.year === ALL || String(item.awardYear) === filters.year) && statusMatches;
    });
  }, [filters, records]);

  function resetFilters() {
    setDraftSearch("");
    setDraftCode(ALL);
    setDraftYear(ALL);
    setDraftStatus(ALL);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function chooseDepartment(nextDepartment: DepartmentId) {
    const url = new URL(window.location.href);
    url.searchParams.set("department", nextDepartment);
    window.history.pushState({}, "", url);
    setDatabase(null);
    setLoadError("");
    resetFilters();
    setSelected(null);
    setMode("person");
    setDepartmentId(nextDepartment);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToDepartments() {
    const url = new URL(window.location.href);
    url.searchParams.delete("department");
    window.history.pushState({}, "", url);
    setDatabase(null);
    setLoadError("");
    resetFilters();
    setSelected(null);
    setMode("person");
    setDepartmentId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyFilters() {
    setFilters({ search: draftSearch, code: draftCode, year: draftYear, status: draftStatus });
    setPage(1);
  }

  function quickFilter(next: Partial<Filters>) {
    const merged = { ...EMPTY_FILTERS, ...next };
    setDraftSearch(merged.search);
    setDraftCode(merged.code);
    setDraftYear(merged.year);
    setDraftStatus(merged.status);
    setFilters(merged);
    setPage(1);
  }

  const verifiedVisible = filtered.filter((item) => item.verificationState === "verified").length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedRecords = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const selectedSources = selected ? uniqueSourceUrls(selected) : [];

  return (
    <main className="pageShell" data-department={departmentId ?? "home"}>
      <div className="wrap">
        <header className="hero">
          <div className="heroTopline">
            <span className="kicker">国家自然科学基金 · 杰青 / 青A</span>
            <button className="methodLink" onClick={() => setShowMethod(true)}>数据口径与方法</button>
          </div>
          <h1>杰青档案 · 申请代码数据库</h1>
          <p className="subtitle">分学部整理历年杰青项目，保留历史学科、现行代码判断、分类理由与可回溯证据。</p>
          <div className="heroStats" aria-label="数据库概览">
            <span><b>{departmentsManifest?.totalRecordCount ?? "—"}</b> 条源记录</span>
            <span><b>3</b> 个科学部</span>
            <span><b>{departmentsManifest?.totalClassifiedRecordCount ?? "—"}</b> 条已分类</span>
            <span><b>{departmentsManifest?.totalClassificationExceptionCount ?? "—"}</b> 条待归属 / 归属异常</span>
          </div>
        </header>

        <section className="departmentSection" aria-labelledby="department-heading">
          <div className="sectionHeading">
            <div><span className="eyebrow">按科学部独立查询</span><h2 id="department-heading">选择一个学部</h2></div>
            {departmentId && <button className="backToCards" onClick={returnToDepartments}>返回三学部入口</button>}
          </div>
          {manifestError ? (
            <div className="manifestError">{manifestError}</div>
          ) : !departmentsManifest ? (
            <div className="departmentLoading">正在载入学部清单…</div>
          ) : (
            <div className="departmentGrid">
              {departmentsManifest.departments.map((department) => {
                const isActive = department.departmentId === departmentId;
                return (
                  <button key={department.departmentId} className={`departmentCard ${department.accent} ${isActive ? "active" : ""}`} onClick={() => chooseDepartment(department.departmentId)} aria-pressed={isActive}>
                    <span className="departmentCode">{department.codePrefix}</span>
                    <span className="departmentName">{department.departmentName}</span>
                    <span className="departmentRange">{department.codeMin}—{department.codeMax} · {department.codeCount}个现行一级代码</span>
                    <span className="departmentMetrics"><b>{department.fullRecordCount}</b> 条记录<i /><b>{department.verifiedRecordCount}</b> 条已核验</span>
                    {department.classificationExceptionCount > 0 && <span className="exceptionMetric">{department.classificationExceptionCount}条待归属 / 归属异常</span>}
                    <span className="departmentAction">{isActive ? "当前学部" : "进入查询"} →</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {!departmentId && departmentsManifest && (
          <section className="entryNote" aria-label="使用说明">
            <span>01</span>
            <div><h2>代码按学部隔离</h2><p>请先选择学部。进入后只会看到该学部的申请代码、统计与人员档案，C、H、F代码不会混合。</p></div>
          </section>
        )}

        {departmentId && (
          <>
            <section className="selectedDepartmentHeader">
              <div><span className="eyebrow">当前数据库</span><h2>{selectedSummary?.departmentName ?? "正在载入"}</h2><p>按2026年现行申请代码重新整理；无有效本学部代码的源记录保留为“待归属”或“归属异常”。</p></div>
              <div className="selectedStats">
                <span><b>{manifest?.fullRecordCount ?? selectedSummary?.fullRecordCount ?? "—"}</b>条记录</span>
                <span><b>{manifest?.codeCount ?? selectedSummary?.codeCount ?? "—"}</b>个代码</span>
                <span><b>{manifest?.classificationExceptionCount ?? selectedSummary?.classificationExceptionCount ?? "—"}</b>条归属例外</span>
              </div>
            </section>

            <div className="tabs" role="tablist" aria-label="查询模式">
              <button className={`tab ${mode === "person" ? "active" : ""}`} onClick={() => setMode("person")} role="tab" aria-selected={mode === "person"}>按姓名查档案</button>
              <button className={`tab ${mode === "browse" ? "active" : ""}`} onClick={() => setMode("browse")} role="tab" aria-selected={mode === "browse"}>按代码 / 年度浏览</button>
            </div>

            <section className="searchPanel" aria-label="档案筛选">
              <div className="controls">
                <label className="field searchField"><span>① {mode === "person" ? "姓名、单位或科学部编号" : "关键词（可选）"}</span><input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} placeholder={mode === "person" ? "例如：姓名、大学或科学部编号" : "研究方向、原所属学科或单位"} /></label>
                <label className="field"><span>② 现行一级代码</span><select value={draftCode} onChange={(event) => setDraftCode(event.target.value)}><option>{ALL}</option>{codes.map((code) => <option key={code} value={code}>{formatCode(code, codeNames)}</option>)}{(manifest?.classificationExceptionCount ?? 0) > 0 && <option value={UNASSIGNED}>待归属 / 无有效代码</option>}</select></label>
                <label className="field"><span>③ 获批年度</span><select value={draftYear} onChange={(event) => setDraftYear(event.target.value)}><option>{ALL}</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
                <label className="field"><span>④ 核验 / 归属状态</span><select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}><option>{ALL}</option><option>已核验</option><option>待核验</option>{(manifest?.unassignedRecordCount ?? 0) > 0 && <option>待归属</option>}{(manifest?.mismatchRecordCount ?? 0) > 0 && <option>归属异常</option>}</select></label>
                <button className="primaryButton" onClick={applyFilters}>查询</button>
              </div>
              <div className="quickRow"><span>快捷查看</span><button onClick={() => quickFilter({})}>全部记录</button><button onClick={() => quickFilter({ year: "2025" })}>2025年</button><button onClick={() => quickFilter({ status: "已核验" })}>仅已核验</button>{(manifest?.classificationExceptionCount ?? 0) > 0 && <button className="exceptionQuick" onClick={() => quickFilter({ code: UNASSIGNED })}>待归属 / 归属异常</button>}</div>
            </section>

            <section className="resultSummary" aria-live="polite">
              <div>{database ? <>当前匹配 <b>{filtered.length}</b> 条记录，其中 <b>{verifiedVisible}</b> 条身份已核验</> : <>正在载入{selectedSummary?.departmentName ?? "学部"}数据…</>}</div>
              <div className="summaryChips">{filters.code !== ALL && <span>{filters.code === UNASSIGNED ? "待归属 / 归属异常" : formatCode(filters.code, codeNames)}</span>}{filters.year !== ALL && <span>{filters.year}年</span>}{filters.status !== ALL && <span>{filters.status}</span>}{filters.search && <span>“{filters.search}”</span>}{!filters.search && filters.code === ALL && filters.year === ALL && filters.status === ALL && <span>全部记录</span>}</div>
            </section>

            <section className="resultsCard">
              <div className="cardHeading"><div><span className="eyebrow">{selectedSummary?.departmentName}杰青档案</span><h2>检索结果</h2></div><span className="demoBadge">{manifest ? `全库 · ${manifest.fullRecordCount}条` : "数据载入中"}</span></div>
              {loadError ? (
                <div className="emptyState"><span>!</span><h3>当前学部数据暂时无法载入</h3><p>{loadError}</p><button onClick={() => chooseDepartment(departmentId)}>重新载入</button></div>
              ) : !database ? (
                <div className="loadingState" aria-live="polite"><span />正在载入当前学部全库数据…</div>
              ) : filtered.length ? (
                <div className="tableWrap"><table><thead><tr><th>申请人</th><th>获批年度</th><th>现行代码 / 归属</th><th>依托单位 / 原所属学科</th><th>研究方向</th><th>核验</th><th aria-label="查看档案" /></tr></thead><tbody>{pagedRecords.map((item) => (
                  <tr key={item.id} className={item.classificationState !== "classified" ? "exceptionRow" : ""}>
                    <td><button className="nameButton" onClick={() => setSelected(item)}>{item.name}</button><small>{item.scientificDepartmentNumber || `源表第${item.rowNumber}行`}</small></td>
                    <td><span className="yearBadge">{item.awardYear}</span></td>
                    <td>{item.classificationState === "classified" ? <span className="codeBadge">{formatCode(item.currentCode, codeNames)}</span> : <span className={`classificationBadge ${item.classificationState}`}>{classificationLabel(item.classificationState)}</span>}{item.classificationState !== "classified" && <small>{item.rawVerificationStatus || "现行代码待判断"}</small>}</td>
                    <td><b className="institution">{item.institution}</b><small>{item.historicalDiscipline || "原所属学科待补充"}</small></td>
                    <td className="direction">{item.researchDirection || <span className="muted">待补充</span>}</td>
                    <td><span className={`statusBadge ${item.verificationState}`}>{verificationLabel(item)}</span><span className={`confidence ${confidenceClass(item.confidence)}`}>{item.confidence || "未评级"}</span></td>
                    <td><button className="detailButton" onClick={() => setSelected(item)} aria-label={`查看${item.name}完整档案`}>查看档案 →</button></td>
                  </tr>
                ))}</tbody></table></div>
              ) : (
                <div className="emptyState"><span>⌕</span><h3>没有匹配的记录</h3><p>可以清空关键词，或使用“全部记录”恢复默认范围。</p><button onClick={resetFilters}>查看全部记录</button></div>
              )}
              {filtered.length > 0 && <nav className="pagination" aria-label="结果分页"><div>第 <b>{safePage}</b> / {totalPages} 页<span>本页 {pageStart + 1}—{Math.min(pageStart + PAGE_SIZE, filtered.length)} 条</span></div><div className="paginationButtons"><button onClick={() => setPage(1)} disabled={safePage === 1}>首页</button><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1}>上一页</button><button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages}>下一页</button><button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>末页</button></div></nav>}
            </section>

            <section className="methodStrip"><div><span className="eyebrow">分类方法</span><h2>保留原始字段，独立判断现行代码</h2></div><p>“科学部编号”“项目批准号”“申请代码”分别记录，不用研究内容关键词代替正式学部归属。待归属记录保留源表状态与判断理由。</p><button onClick={() => setShowMethod(true)}>查看完整口径</button></section>
            {manifest && manifest.qualityWarningCount > 0 && <section className="qualityWarning" aria-label="数据质量提示"><b>数据质量提示</b><span>当前学部有{manifest.qualityWarningCount}组同名、同年、同单位的重复候选记录，已按源表保留并等待进一步确认。</span></section>}
            <footer><span>数据源：{manifest?.sourceFile ?? selectedSummary?.sourceFile} · {manifest?.fullRecordCount ?? "—"}条源记录 · 更新于{manifest?.sourceLastModified.slice(0, 10) ?? "—"}</span><span>公开访问 · 数据持续核验与更新</span></footer>
          </>
        )}
      </div>

      {selected && <div className="modalBackdrop"><button type="button" className="modalDismissLayer" onClick={() => setSelected(null)} aria-label="关闭档案" /><article className="detailModal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="closeButton" onClick={() => setSelected(null)} aria-label="关闭档案">×</button><header className="detailHeader"><span className="kicker">{selected.classificationState === "classified" ? formatCode(selected.currentCode, codeNames) : classificationLabel(selected.classificationState)}</span><h2 id="detail-title">{selected.name}</h2><p>{selected.institution}</p><div className="detailBadges"><span className="yearBadge">{selected.awardYear}年获批</span><span className={`statusBadge ${selected.verificationState}`}>{verificationLabel(selected)}</span>{selected.classificationState !== "classified" && <span className={`classificationBadge ${selected.classificationState}`}>{classificationLabel(selected.classificationState)}</span>}<span className={`confidence ${confidenceClass(selected.confidence)}`}>可信度：{selected.confidence || "未评级"}</span></div></header><dl className="detailGrid"><div><dt>所属科学部数据库</dt><dd>{selected.departmentName}</dd></div><div><dt>科学部编号</dt><dd>{selected.scientificDepartmentNumber || "待补充"}</dd></div><div><dt>原所属学科</dt><dd>{selected.historicalDiscipline || "待补充"}</dd></div><div><dt>现行一级代码</dt><dd>{selected.currentCode ? formatCode(selected.currentCode, codeNames) : "待归属 / 无有效代码"}</dd></div><div><dt>研究方向</dt><dd>{selected.researchDirection || "待补充"}</dd></div><div><dt>源表核验状态</dt><dd>{selected.rawVerificationStatus || "源表未填写"}</dd></div></dl><section className="detailSection"><h3>分类判断说明</h3><p>{selected.classificationReason || "暂未填写分类判断说明。"}</p></section><section className="detailSection"><h3>核验说明</h3><p>{selected.verificationNote || "该记录尚未补充详细核验说明。"}</p></section><section className="detailSection sourceSection"><h3>来源与核验证据</h3><div className="sourceLinks">{selectedSources.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" title={url}>来源 {index + 1} · {sourceType(url)} ↗</a>)}{selectedSources.length === 0 && <span className="muted">来源待补充</span>}</div></section></article></div>}

      {showMethod && <div className="modalBackdrop"><button type="button" className="modalDismissLayer" onClick={() => setShowMethod(false)} aria-label="关闭方法说明" /><article className="detailModal methodModal" role="dialog" aria-modal="true" aria-labelledby="method-title"><button className="closeButton" onClick={() => setShowMethod(false)} aria-label="关闭方法说明">×</button><span className="kicker">数据方法</span><h2 id="method-title">三学部分类与核验口径</h2><ol className="methodList"><li><b>学部相互隔离：</b>生命、医学、信息分别使用C、H、F代码表；切换学部会清空全部筛选条件。</li><li><b>编号不混用：</b>科学部编号、项目批准号和申请代码含义不同，均不以彼此替代。</li><li><b>按2026代码重判：</b>历史学科映射到现行一级代码，同时保留原所属学科和分类理由。</li><li><b>身份与归属分开：</b>人员身份已核验，不代表学部归属已经确定；无有效代码的记录单列“待归属”或“归属异常”。</li><li><b>证据可回溯：</b>基金委、依托单位、科研机构和补充资料均保留为可点击链接。</li><li><b>不按姓名去重：</b>同名人员使用学部、年份和源表行号区分，疑似重复另作质量提示。</li></ol><div className="methodNote">2025年起“国家杰出青年科学基金项目”更名为“青年科学基金项目（A类）”；网站统一以“杰青 / 青A”表述。</div></article></div>}
    </main>
  );
}
