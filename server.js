import express from "express";
import { fetchSite } from "agent-readiness-auditor/dist/fetch-site.js";
import { audit } from "agent-readiness-auditor/dist/audit.js";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env (kept out of git, shipped only inside the deploy archive).
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const PROSPECTS_REPO = process.env.PROSPECTS_REPO || "asish-singh/aiseo-clients";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Full reports are held in memory until the visitor leaves an email.
const reportCache = new Map(); // scanId -> { report, url, createdAt }
const CACHE_TTL_MS = 60 * 60 * 1000;

function pruneCache() {
  const now = Date.now();
  for (const [id, entry] of reportCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) reportCache.delete(id);
  }
}

function normalizeUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (!u.hostname.includes(".")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function runAudit(url) {
  const ctx = await fetchSite(url);
  return audit(ctx);
}

app.post("/api/scan", async (req, res) => {
  const url = normalizeUrl(req.body.url);
  if (!url) return res.status(400).json({ error: "Please enter a valid website address, like example.com" });
  try {
    const report = await runAudit(url);
    pruneCache();
    const scanId = randomUUID();
    reportCache.set(scanId, { report, url, createdAt: Date.now() });
    const counts = { pass: 0, warn: 0, fail: 0 };
    for (const f of report.findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
    res.json({
      scanId,
      url,
      score: report.score,
      maxScore: report.maxScore,
      grade: report.grade,
      counts,
      totalChecks: report.findings.length,
    });
  } catch (e) {
    console.error("scan failed:", e.message);
    res.status(502).json({ error: "We could not reach that website. Check the address and try again." });
  }
});

app.post("/api/report", (req, res) => {
  const { scanId, email, name } = req.body || {};
  const entry = reportCache.get(scanId);
  if (!entry) return res.status(410).json({ error: "This scan expired. Please run it again." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const lead = {
    email: String(email).trim().toLowerCase(),
    name: String(name || "").trim(),
    website: entry.url,
    score: entry.report.score,
    grade: entry.report.grade,
    capturedAt: new Date().toISOString(),
    source: "scan.asishsingh.in",
  };
  // Show the report immediately; save the lead to GitHub in the background.
  res.json({ report: entry.report });
  saveLeadToGitHub(lead, entry.report).catch(e => {
    console.error("LEAD SAVE FAILED, capture it manually:", JSON.stringify(lead), e.message);
  });
});

async function githubPut(filePath, content, message) {
  const url = `https://api.github.com/repos/${PROSPECTS_REPO}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-visibility-report",
  };
  // Include the current file sha if it already exists (required to update).
  let sha;
  const existing = await fetch(url, { headers });
  if (existing.ok) sha = (await existing.json()).sha;
  const r = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), sha }),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function saveLeadToGitHub(lead, report) {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
  const host = new URL(lead.website).hostname;
  const msg = `New lead from scan.asishsingh.in for ${host}`;
  await githubPut(`prospects/${host}/lead.json`, JSON.stringify(lead, null, 2) + "\n", msg);
  await githubPut(`prospects/${host}/audit.json`, JSON.stringify(report, null, 2) + "\n", msg);
  console.log("lead saved to GitHub:", host, lead.email);
}

app.listen(PORT, () => {
  console.log(`AI Visibility Report running at http://localhost:${PORT}`);
});
