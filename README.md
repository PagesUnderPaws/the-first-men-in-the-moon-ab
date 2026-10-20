# The First Men in the Moon — A/B Edition

Updated alternative ending: **v16**.

Upload the **contents of this folder** to the root of the GitHub Pages repository. Keep the folder structure exactly as it is:

- `index.html`
- `style.css`
- `script.js`
- `text/novel.html`
- `text/published-ending.html`
- `text/alternative-ending.html`
- `data/illustrations.json`

The online route presents the full shared novel (title page + Chapters I–XXIV) only on the first reading, then the randomly assigned first ending. After Survey 1, the second ending is shown by itself.

Printed books use neutral reader codes:

- **Z** = published ending first, alternative ending second
- **X** = alternative ending first, published ending second

Do not explain that mapping to readers before the reveal.

For testing only, append `?test=1` to the GitHub Pages URL to show a jump panel.

## Current limitations

Survey data is saved only in the reader's browser. Shared response collection, aggregate results, AI summaries and shared discussion still require a backend. The discussion pseudonym is generated and stored separately in the browser and is not linked to survey answers.

## Text and images

The Wells text is based on the cleaned 1901 George Newnes edition in the project files. Plain-text emphasis markers are rendered as italics, the known `(? battle)` transcription artefact is corrected to `battle`, and dash runs are normalised for browser display.

The original Claude Allin Shepperson illustrations are public-domain images served from Wikimedia Commons using `Special:FilePath` URLs. `data/illustrations.json` records the image filenames, captions and source information.

## Print copies
The Home page includes a **Buy a copy** section for Amazon and Lulu. The buttons are intentionally disabled until the actual product pages exist; replace them with the live product URLs at publication.

## Alternative ending length
The alternative final act has been tightened to bring its reading burden much closer to the published Wells ending while preserving the different story and the Grand Lunar conversation.


## Chapter navigation

Online readers have a compact chapter-jump bar at the top of the reading area. The existing Previous/Next controls remain at the bottom. During a final act, the jump bar shows only Chapters XXV and XXVI of the ending currently being read; it does not expose the other ending or any survey/reveal screen.
