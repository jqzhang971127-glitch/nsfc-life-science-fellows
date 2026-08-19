# nsfc-life-science-fellows

An NSFC project archive and application-code database covering the Department
of Life Sciences, Department of Health Sciences, and Department of Information
Sciences.

Public website: <https://jqzhang971127-glitch.github.io/nsfc-life-science-fellows/>

## Data scope

- Life Sciences source: `生命科学学部_v3.xlsx`
- Health Sciences source: `医学科学部_v2.xlsx`
- Information Sciences source: `信息科学学部v1.xlsx`
- Historical records are mapped to the 2026 primary application-code system
  while retaining the original discipline, classification rationale, and
  verification sources.
- Records without a valid department code remain in the database and are
  displayed as unassigned or department-mismatch cases.

## Data updates

The complete web datasets are regenerated from the three Excel workbooks with
`scripts/export_fellows_data.py`:

- `public/data/departments.json`
- `public/data/life.json`
- `public/data/medical.json`
- `public/data/information.json`

Regenerate these files with the export script instead of editing the JSON by
hand.

## Local development and validation

```bash
npm install
npm run build
npm test
npm run build:pages
```

## Publishing

The website is published exclusively through GitHub Pages. Static output is
generated in `docs/` and committed to the `main` branch.

Cloudflare is used only for Web Analytics. No Cloudflare Worker copy or third
public endpoint is maintained.
