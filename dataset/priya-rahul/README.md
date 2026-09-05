# Priya & Rahul — synthetic onboarding dataset

This folder is a **fictional test fixture** for the Inai onboarding flow. Every person, company, phone number, board URL, amount, and image is invented. The reference images are original AI-generated images; they are not scraped from Pinterest.

## Wedding brief

- Couple: Priya Iyer and Rahul Mehta
- City: Chennai
- Tentative wedding date: 24 January 2027
- Working estimate: 220 guests
- Style signals: jasmine, ivory, muted peach, brass, warm and uncluttered

## Contents

- `01-whatsapp-export/` — a hand-off style group-chat export in English, Tamil, Hindi and code-mixed messages.
- `02-pinterest-mood-boards/` — a mock board manifest and three local reference images.
- `03-vendor-quotes/` — three competing quote documents plus a machine-friendly comparison CSV.
- `04-ingest-expectations/` — expected extraction candidates. This is a test oracle, **not** a seed file.

## Ingestion contract

Treat this as externally supplied, untrusted source material. All extracted facts and derived tasks must be created as `reported`, with provenance from the source artifact, and must not trigger vendor contact, spending, booking, or reminders until a responsible human confirms them.

The board URLs are deliberately `example.test` placeholders. A production flow should ingest only user-provided exports, links they are authorized to share, or uploaded images; it must not scrape Pinterest or WhatsApp.
