# AI Visibility Report

A free scan that tells any website owner how visible their site is to AI assistants like ChatGPT, Claude and Perplexity, and what to fix. Visitors see a teaser score instantly, leave an email to unlock the full plain English report, and each email becomes a warm consulting lead.

Built on the open source [agent-readiness-auditor](https://github.com/asish-singh/agent-readiness-auditor).

## How it works

1. A visitor enters their website address, the server runs the auditor against it.
2. They see their grade and a count of passing and failing checks.
3. To see the full report with fixes, they leave an email.
4. Each lead is committed to the private aiseo-clients repo under `prospects/<domain>/` with the full audit, ready for the engagement engine.

## How to run

```
npm install
npm start
```

Then open http://localhost:3000 and scan any website.

## Where the leads go

Every captured email is committed to the private aiseo-clients repo as `prospects/<domain>/lead.json` together with `audit.json`. The server needs a `GITHUB_TOKEN` environment variable (a fine grained token scoped to that repo) supplied via a `.env` file that ships in the deploy archive but never in git.
