# ChapterCheck

A small, browser-only readability checker for authors. Paste an English chapter to get a Flesch Reading Ease estimate, an estimated grade level, and five sentences ranked by a transparent sentence-complexity heuristic.

## Try it
The `index.html` page is self-contained. Open it in a browser, use the sample chapter, then paste your own text and choose **Analyze chapter**.

## Features
- Flesch Reading Ease estimate and approximate Flesch–Kincaid grade level
- Word and sentence counts plus estimated reading time
- Highlights the five highest-ranked sentences in context
- Sentence ranking based on length and syllable density, with scores displayed
- Responsive layout, no external libraries, no server or AI API calls

## Privacy
Pasted text is processed locally in the page. This app does not upload text to a server.

## Limitations
The syllable counter and sentence splitter use simple heuristics. Results are intended for English prose; dialogue, poetry, abbreviations, fragments, unusual names, and intentional stylistic complexity can affect the score. The hardest-sentence ranking is a prompt for revision, not a quality judgement.
