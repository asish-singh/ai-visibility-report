import express from "express";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AUDIT_SCRIPT = path.join(__dirname, "node_modules", "agent-readiness-auditor", "dist", "index.js");
const DATA_DIR = path.join(__dirname, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

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

function runAudit(url) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [AUDIT_SCRIPT, url, "--json"], { timeout: 90_000 }, (err, stdout, stderr) => {
      if (stdout && stdout.trim().startsWith("{")) {
        try { return resolve(JSON.parse(stdout)); } catch {}
      }
      reject(err || new Error(stderr || "Audit produced no result"));
    });
  });
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
  // Save the lead.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let leads = [];
  try { leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8")); } catch {}
  leads.push({
    email: String(email).trim().toLowerCase(),
    name: String(name || "").trim(),
    website: entry.url,
    score: entry.report.score,
    grade: entry.report.grade,
    capturedAt: new Date().toISOString(),
  });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  res.json({ report: entry.report });
});

app.listen(PORT, () => {
  console.log(`AI Visibility Report running at http://localhost:${PORT}`);
});
