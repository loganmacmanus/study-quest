# Study Quest

A small study-guide hub for my college classes: **https://loganmacmanus.github.io/study-quest/**

The home page lists one card per class. Each card opens that class's study guide with notes, a glossary, flashcards, practice quizzes, a timed test, XP and levels, and a leaderboard.

## Guides

| Guide | Address |
|---|---|
| CS 379 Ethical Hacking & Pen Testing (Test 2) | [/study-quest/cs379-quest/](https://loganmacmanus.github.io/study-quest/cs379-quest/) |

## How it works

- Static site on GitHub Pages: plain HTML, CSS and JavaScript, with no frameworks, no trackers and self-hosted fonts.
- Sign-in uses a one-time email code through Supabase. New people are approved by the owner, and access lasts 30 days.
- The study questions are **not** in this repository. They live in a private storage bucket that only approved, signed-in people can download.
- The leaderboard rules (one row per person per guide, scores only go up, XP gain is rate-limited) are enforced by the database, not by the browser.

The key in `config.js` is Supabase's public "anon" key. It is meant to be public, and the database rules decide what it can do.
