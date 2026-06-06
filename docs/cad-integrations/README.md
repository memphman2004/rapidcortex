# CAD integrations — documentation

PDF-ready Markdown guides for agency IT administrators and CAD vendor teams connecting a **record CAD system** to **Rapid Cortex** (supplemental AI and workflow layer; CAD remains system of record).

**Canonical PDF (v1.0, customer / IT bundle):** [`../admin-user-management/RapidCortex-CAD-Integration-Guide-1.0.pdf`](../admin-user-management/RapidCortex-CAD-Integration-Guide-1.0.pdf) — same file is listed under **Documents for agency IT** on **`/{slug}/admin/pilot`** and in `demo/customer-program-documentation-bundle.json`.

| Guide | Audience | Typical setup time |
| --- | --- | --- |
| [Motorola PremierOne](motorola-premierone-integration-guide.md) | Motorola-based agencies | 2–4 hours |
| [Tyler New World](tyler-new-world-integration-guide.md) | Tyler-based agencies | 4–8 hours (often includes vendor PS) |
| [CentralSquare](centralsquare-integration-guide.md) | CentralSquare / legacy Tritech paths | 2–4 hours |
| [Hexagon I/CAD](hexagon-icad-integration-guide.md) | Hexagon / Intergraph environments | 2–6 hours |
| [Generic webhook](generic-webhook-integration-guide.md) | Any HTTPS-capable CAD or middleware | 1–3 hours + mapping |
| [Master checklist (all vendors)](cad-integration-checklist-master.md) | PM / IT / compliance sign-off | One page |

**Support:** [support@rapidcortex.us](mailto:support@rapidcortex.us)

**API base (production):** `https://api.rapidcortex.us`  
**Webhook path pattern:** `POST /api/cad/webhook/{agencyId}/{integrationId}`

---

When converting to PDF, use a Markdown-to-PDF tool that preserves tables, code blocks, and blockquotes (e.g. Pandoc with a print stylesheet).
