# Project: ai-visibility-report

A public lead magnet website where anyone can scan their website and get a plain English AI visibility report card, built on agent-readiness-auditor, with email capture for consulting leads.

## Status

- Started: 2026-07-11
- Current state: live at https://scan.asishsingh.in

## Goal

Bring in warm consulting leads for the AI SEO business. A prospect enters their website address, sees a teaser score, leaves an email, and gets the full plain English report. Leads land in a local file for follow up with the aiseo-clients engine.

## How to run it

- `npm install` once, then `npm start`
- Open http://localhost:3000
- Captured leads are saved to `data/leads.json` (git ignored)

## Notes for Claude

- Asish is non-technical: explain in plain language, choose sensible defaults, confirm before anything destructive.
- Commit working checkpoints as you go.
- Keep this file updated as the project evolves (goal, status, how to run).
- The scan logic wraps the published npm package `agent-readiness-auditor` (Asish's own tool). Keep the report language plain and jargon free, prospects are non-technical business owners.
- Public repo. No client names, no lead data committed.
