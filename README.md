# nsfc-life-science-fellows

国家自然科学基金生命科学部、医学科学部、信息科学部杰青及青年科学基金项目（A类）档案与申请代码数据库。

公开网站：<https://jqzhang971127-glitch.github.io/nsfc-life-science-fellows/>

## 数据范围

- 生命科学部：`生命科学学部_v3.xlsx`
- 医学科学部：`医学科学部_v2.xlsx`
- 信息科学部：`信息科学学部v1.xlsx`
- 历史项目按照2026年现行一级申请代码重新判断，并保留原所属学科、判断理由和核验来源。
- 无有效本学部代码的源记录不会删除，在网站中显示为“待归属”或“归属异常”。

## 更新数据

项目使用 `scripts/export_fellows_data.py` 从三份Excel完整生成：

- `public/data/departments.json`
- `public/data/life.json`
- `public/data/medical.json`
- `public/data/information.json`

数据文件应由脚本重新生成，不直接手工编辑JSON。

## 本地开发与检查

```bash
npm install
npm run build
npm test
npm run build:pages
```

## 发布

网站仅通过GitHub Pages公开发布，静态文件生成到 `docs/` 并随 `main` 分支提交。

Cloudflare仅用于Web Analytics流量统计。本项目不发布Cloudflare Worker副本，也不维护第三个公网地址。
