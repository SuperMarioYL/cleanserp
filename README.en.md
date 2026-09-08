[简体中文](./README.md) · [Website](https://cleanserp.lei6393.com) · [GitHub](https://github.com/SuperMarioYL/cleanserp)

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/hero-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/hero-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/hero-dark.svg">
  <img src="./assets/presentation/hero-light.svg" width="960" alt="Hero diagram">
</picture>

# cleanserp

**Filter search results before opening every link.**

CleanSERP applies local heuristics to rendered Baidu search results and hides matching cards while showing a filtered-result count.

## Why use it

Search snippets already contain signals such as promotion labels, login prompts and redirect links. CleanSERP uses those visible signals to reduce repeated checking, with rules that developers can inspect and adjust.

- **Local classification** — Visible result fields are classified without an API call.
- **Explainable reasons** — Matching results carry a specific rule category.
- **Keep your search page** — A content script works in the existing Baidu result view.

## Architecture

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/architecture-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/architecture-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/architecture-dark.svg">
  <img src="./assets/presentation/architecture-light.svg" width="960" alt="Architecture diagram">
</picture>

The content script extracts result fields and calls the pure classify function. Matching cards are hidden and the count is published to the extension UI. The manifest currently injects scripts into Baidu pages; the type definition alone does not enable another engine.

| Component | Responsibility |
| --- | --- |
| `Baidu DOM` | src/lib/serp-dom.ts |
| `Rule classifier` | src/content/rules.ts |
| `Content script` | src/content/serp-filter.ts |
| `Popup state` | service worker + popup |

## Install and quickstart

Build with the version declared in the repository manifest. Run the example from the repository root.

```bash
git clone https://github.com/SuperMarioYL/cleanserp.git
cd cleanserp
npm ci
npm run build
```

The standalone example includes three complete synthetic result objects and runs the production classify function.

```bash
node examples/presentation-demo.mjs
```

## Recorded demo

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/process-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/process-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/process-dark.svg">
  <img src="./assets/presentation/process-light.svg" width="960" alt="Process diagram">
</picture>

The documentation result is usable; the listicle and login-wall examples match explicit rules.

```text
{"title":"JavaScript reference","verdict":"usable"}
{"title":"一文读懂 5 个技巧","verdict":"dead-end","reason":"baijiahao-ai-slop"}
{"title":"Members article","verdict":"dead-end","reason":"paywall"}
```

The complete command and output are recorded in [docs/demo-results.json](./docs/demo-results.json). Inputs and reproduction code are included in the repository.

![Existing terminal recording](./assets/demo.gif)

The existing recording is retained for context; the text example above documents the reproducible scenario.

## Usage

The CLI exposes the following operations. Commands after the example use your own paths or identifiers.

```bash
npm run build
# Load dist/ in chrome://extensions (Developer mode).
npm run typecheck
npm test
```

## Configuration

Edit src/content/rules.ts to change local matching rules, rebuild, then reload the unpacked extension. No account is required. The extension requests storage permission and Baidu host permissions.

## Integrations and responsibilities

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/integrations-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/integrations-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/integrations-dark.svg">
  <img src="./assets/presentation/integrations-light.svg" width="960" alt="Integrations diagram">
</picture>

The following routes are implemented in the source. Choose the input that matches your task and keep the resulting artifact with your project.

| Route | Implemented role |
| --- | --- |
| Baidu pages | Manifest content-script matches |
| Result fields | URL, title, snippet and source |
| Chrome storage | Per-tab filtering state |
| MV3 bundle | Load unpacked from dist/ |

## Limits and next steps

- Rules are heuristics. Labels such as baijiahao-ai-slop name a rule category; they do not prove that an author used AI or that a page is inaccessible.
- The shipped manifest targets Baidu. Sogou and store publication are not established by this demo.
- The offline example tests the production classifier on synthetic inputs, not live DOM compatibility or search quality.

Useful next steps are exposing hidden cards for inspection and adding separately tested search-engine adapters. Custom shared rules are future work.

## License and contributions

See [LICENSE](./LICENSE). When reporting an issue, include a minimal input, the command, and the observed output.
