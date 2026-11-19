# Study Quest

A small study-guide hub for my college classes: **https://loganmacmanus.github.io/study-quest/**

The home page lists one card per class. Each card opens that class's study guide with notes, a glossary, flashcards, practice quizzes, a timed test, XP and levels, and a leaderboard.

## Guides

| Guide | Address |
|---|---|
| CS 379 Ethical Hacking & Pen Testing (Test 2) | [/study-quest/cs379-quest/](https://loganmacmanus.github.io/study-quest/cs379-quest/) |
| CR 370 Origins (Test 3) | [/study-quest/cr370-quest/](https://loganmacmanus.github.io/study-quest/cr370-quest/) |
| SC 141 Astronomy (Test 3) | [/study-quest/sc141-quest/](https://loganmacmanus.github.io/study-quest/sc141-quest/) |
| MA 224 Discrete Math (Test 3) | [/study-quest/ma224-quest/](https://loganmacmanus.github.io/study-quest/ma224-quest/) |

Each guide has its own look (cyan HUD, parchment, deep space, chalkboard), light and dark modes and colour themes. One sign-in unlocks every guide.

## Features

- Notes, glossary, flashcards, practice quizzes and a timed test with a choice of time limits.
- XP, levels, badges, a daily streak and a leaderboard per guide with separate callsigns.
- **Knowledge studied** on the hub and in each guide, with a per-chapter breakdown.
- Review of missed questions and weak spots, saved questions, search, and a printable cheat sheet.
- Extra study pages where a class has them (for example Verses and Planets) and a Proofs tab for MA 224.
- A suggestion box and a "Report a problem" button on questions.
- An updates page with a notification bell, quiet hub music, a mute switch, an animations setting, and back up and restore of your progress to a file.
- Works from small phones to desktops. Study progress is saved on your device.

## How it works

- Static site on GitHub Pages: plain HTML, CSS and JavaScript, with no frameworks, no trackers and self-hosted fonts.
- Sign-in uses a one-time email code through Supabase. New people are approved by the owner, and access lasts 30 days.
- The study questions and notes are **not** in this repository. They live in a private storage bucket that only approved, signed-in people can download.
- The leaderboard rules (one row per person per guide, scores only go up, XP gain is rate-limited) are enforced by the database, not by the browser.

The key in `config.js` is Supabase's public "anon" key. It is meant to be public, and the database rules decide what it can do.

## Copyright

© 2026 Logan MacManus. All rights reserved. See the Terms page for what you may do with the site.
