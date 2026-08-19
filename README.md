# yann.dev

Personal portfolio site for Yann Gilbert — resume front page plus three interactive,
in-browser ports of graduate-school ML/CV projects, and a live GitHub feed.

## Stack

React + TypeScript + Vite, React Router, Tailwind CSS v4.

## Pages

- **/** — Resume (rendered + PDF download)
- **/face-anonymization** — CSC515: face detection + eye blurring, ported from OpenCV
  Haar cascades to `face-api.js` (on-device, ~270KB of model weights bundled in
  `public/models`). Nothing is uploaded — detection and blurring happen entirely in
  the browser.
- **/mealprep-chatbot** — CSC525: retrieval-based diet chatbot, ported from
  spaCy + sentence-transformers to a client-side TF-IDF + cosine-similarity engine
  over the original 514-pair corpus (`src/data/mealprep_corpus.json`). The session
  preference tracker (calorie goals, dietary restrictions, food avoidances) is a
  line-for-line port of the original regex logic.
- **/bakery-assistant** — CSC510 (BakeryMind): a demand forecaster that trains live in
  the browser on `public/assets/sales_history.csv` (1,830 rows), an expert rule engine,
  a greedy hill-climbing search optimizer, and a STRIPS-style baking scheduler.
- **/github** — live feed of public repos via the GitHub REST API.

See inline comments at the top of `src/lib/mealprepBot.ts`, `src/lib/bakery.ts`, and
`src/lib/faceAnonymization.ts` for exactly what was changed vs. the original Python.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Deploying

`dist/` is a static site — drag-and-drop onto Netlify, or:

```bash
npm i -g vercel
vercel deploy --prod
```

To point yann.dev at it, add the host's DNS records (usually a CNAME or A record from
your registrar) once you've picked a host.

## Updating content

- **Resume**: replace `public/resume/Yann_Gilbert_Resume.pdf` and edit
  `src/data/resume.ts` to match.
- **GitHub tab**: change `USERNAME` in `src/pages/GitHubProjects.tsx`.
- **MealPrep corpus**: edit `src/data/mealprep_corpus.json` (array of `{ q, a }`).
- **Bakery config** (prices, oven capacity, bake times): edit `src/data/bakery_config.json`.
