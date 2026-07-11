# AI Visibility Report

A free scan that tells any website owner how visible their site is to AI assistants like ChatGPT, Claude and Perplexity, and what to fix. Visitors see a teaser score instantly, leave an email to unlock the full plain English report, and each email becomes a warm consulting lead.

Built on the open source [agent-readiness-auditor](https://github.com/asish-singh/agent-readiness-auditor).

## How it works

1. A visitor enters their website address, the server runs the auditor against it.
2. They see their grade and a count of passing and failing checks.
3. To see the full report with fixes, they leave an email.
4. Leads are saved locally to `data/leads.json` (never committed to git).

## How to run

```
npm install
npm start
```

Then open http://localhost:3000 and scan any website.

## Where the leads go

Every captured email is appended to `data/leads.json` with the website, score, grade and timestamp. Follow up using the aiseo-clients engagement engine.
