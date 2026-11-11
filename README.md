# 職安健常識問答 Safety Quiz (standalone)

An offline practice tool for the OSHC Safety Quiz handbook, 2026 edition: 20 chapters, 1638 multiple choice questions (A/B/C).

It is plain HTML, CSS and JavaScript. There is no build step, no install, no server and no network access. Everything it needs is inside this folder.

## How to open it

Double click `index.html` in Finder. It opens in your default browser and works offline.

To use it on a phone, copy the whole folder across (keep the `data` folder next to `index.html`) and open `index.html` there.

## Passcode

if you know, u know

The passcode is a simple front-end gate, not security. It is asked once per browser and then remembered.

## Features

- Passcode gate before the quiz loads.
- Chapter selection across all 20 chapters (select all, clear, or pick any mix).
- Question count: 10, 20, 50, 100 or all.
- Two modes: practice (the answer is shown at once) and exam (answers are shown at the end, and you can go back and change them).
- Countdown: off, per question (5 to 120 seconds) or whole paper (5 to 180 minutes).
- Shuffle questions, shuffle the A/B/C options, auto next after a correct answer, and practise only the wrong-answer book.
- Running score in practice mode, per question timeout, and an end button that scores only the questions reached.
- Result screen with score, percentage (70% and above green, 50% and above amber, below 50% red), time taken, a per chapter breakdown and a review list of wrong answers (or all answers).
- Redo wrong questions, run again with the same settings, or return to settings.
- Wrong-answer book and a history of the last 50 results, kept in the browser.
- Keyboard shortcuts during a quiz: A/B/C or 1/2/3 to answer, Enter or right arrow for next, left arrow to go back (exam mode).

## Saved data

Progress is stored in the browser's localStorage under these keys:

- `safety_quiz_access_ok`: passcode already entered
- `safety_quiz_settings`: last used settings
- `safety_quiz_wrong`: wrong-answer book
- `safety_quiz_history`: result history

The data belongs to the browser and the location the page was opened from. A different browser, or a moved copy of the folder, starts fresh. Use 清除紀錄 on the setup screen to clear the history and the wrong-answer book.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page. Open this. |
| `style.css` | All styles. |
| `app.js` | The quiz logic. |
| `data/bank.js` | The question bank, generated. Do not edit by hand. |
| `build-bank.js` | Regenerates `data/bank.js` from the source JSON. |

## Regenerating the question bank

Browsers block `fetch()` of local files when a page is opened from `file://`, so the bank is shipped as a script that sets `window.SAFETY_BANK`. To refresh it from an updated source JSON, run this one command inside this folder (needs Node.js, no packages):

```sh
node build-bank.js path/to/safety-quiz-2026.json
```

It prints the chapter and question counts when it finishes. The source JSON is copied as is: same ids, options and answer indexes.

Expected JSON shape:

```json
{
  "edition": "2026",
  "source": "...",
  "checked": "...",
  "chapters": [{ "n": 1, "name": "...", "count": 49 }],
  "questions": [{ "id": "1.1", "ch": 1, "q": "...", "o": ["...", "...", "..."], "a": 0, "p": 12 }]
}
```

`a` is the index of the correct option, `p` is the handbook page, and an optional `"k": 1` keeps the options in printed order when they refer to each other.
