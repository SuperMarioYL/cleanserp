[简体中文](./README.md) · [Website](https://cleanserp.lei6393.com) · [GitHub](https://github.com/SuperMarioYL/cleanserp)

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/hero-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/hero-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/hero-dark.svg">
  <img src="./assets/presentation/hero-light.svg" width="960" alt="Hero diagram">
</picture>

# cleanserp

**Filter search results before opening every link.**

CleanSERP applies local heuristics to rendered Baidu/Sogou search results and hides matching cards while showing a filtered-result count.

## Why use it

Search snippets already contain signals such as promotion labels, login prompts and redirect links. CleanSERP uses those visible signals to reduce repeated checking, with rules that developers can inspect and adjust.

- **Local classification** — Visible result fields are classified without an API call.
- **Explainable reasons** — Matching results carry a specific rule category.
- **Keep your search page** — A content script works in the existing Baidu/Sogou result view.

## Architecture

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/presentation/architecture-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="./assets/presentation/architecture-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="./assets/presentation/architecture-dark.svg">
  <img src="./assets/presentation/architecture-light.svg" width="960" alt="Architecture diagram">
</picture>

The content script picks the parser per engine (Baidu/Sogou), extracts result fields and calls the pure classify function. Matching cards are hidden and the count plus engine are published to the extension UI. The popup on/off toggle takes effect on already-filtered pages without a reload; a bottom strip lists hidden results one by one with a per-item restore.

| Component | Responsibility |
| --- | --- |
| `Baidu/Sogou DOM` | src/lib/serp-dom.ts |
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

Edit src/content/rules.ts to change local matching rules, rebuild, then reload the unpacked extension. No account is required. The extension requests storage permission and Baidu/Sogou host permissions.

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
| Baidu/Sogou pages | Manifest content-script matches |
| Result fields | URL, title, snippet and source |
| Chrome storage | Per-tab filtering state |
| MV3 bundle | Load unpacked from dist/ |

## Limits and next steps

- Rules are heuristics. Labels such as baijiahao-ai-slop name a rule category; they do not prove that an author used AI or that a page is inaccessible.
- Desktop Baidu (www.baidu.com) and Sogou (www.sogou.com/web) organic results are supported: both parser adapters are regression-tested against in-repo fixtures, but both SERP DOMs churn through A/B changes and live-page compatibility is not guaranteed.
- Mobile SERP DOMs (m.baidu.com / m.sogou.com) differ from desktop; the current selectors are desktop-only. On mobile the injected script is a harmless no-op (0 parsed cards implies no filtering and no badge) until real-device verification is available.
- Sogou vertical searches (images/videos/WeChat tabs) are out of scope.
- The offline example tests the production classifier on synthetic inputs, not live DOM compatibility or search quality.

Exposing hidden cards for inspection and separately tested search-engine adapters shipped in v0.2.0 (a bottom strip with per-item restore; Baidu/Sogou adapters both have fixture regression tests). Mobile adapters and shared custom rules remain future work.

## License and contributions

See [LICENSE](./LICENSE). When reporting an issue, include a minimal input, the command, and the observed output.
