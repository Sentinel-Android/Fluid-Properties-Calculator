# Fluid Properties Calculator

An independent, static thermodynamic and transport property calculator, ready for GitHub Pages.

**Website:** https://fluidpropertiescalculator.aditusan.dev/  
**Repository:** https://github.com/Sentinel-Android/Fluid-Properties-Calculator

The website uses the same layout, shared styles, and page-folder convention as [Psychrometric Tools](https://github.com/Sentinel-Android/Psychrometric-tools) and [ADI Solver](https://github.com/Sentinel-Android/ADI-Solver). It preserves the existing CoolProp 8.0.0 engine, fluid selection, units, phase handling, MATLAB calls, and calculation history.

## Features

- Select a pure or pseudo-pure fluid from the bundled CoolProp fluid list.
- Define the state using two independent properties: temperature, absolute pressure, vapour quality, enthalpy, entropy, density, or internal energy.
- Read temperature, pressure, density, enthalpy, entropy, internal energy, quality, viscosity, thermal conductivity, Cp, and Cv, where available.
- Use the original water, R134a, two-phase water, and air examples.
- Copy a result table or a MATLAB `getFluidProperty` call for a chosen output.
- Save up to 20 calculations, with Restore, Copy, and Clear history.
- Read the property/unit reference and privacy page.
- Responsive layouts, labelled form controls, keyboard focus styles, and a skip link.
- Calculations run locally in a browser worker using the bundled WebAssembly engine.

## Repository layout

| Path | Purpose |
| --- | --- |
| `docs/index.html` | Main fluid-state calculator |
| `docs/reference/index.html` | Property symbols, units, phases, MATLAB calls, and sources |
| `docs/privacy/index.html` | Browser storage and clipboard information |
| `docs/assets/site.css` | Shared design used by every page |
| `docs/assets/site.js` | Shared page behaviour |
| `docs/assets/calculator.js` | Ready-to-use interface bundle |
| `docs/assets/engine.js` | Browser worker and property calculations |
| `docs/assets/vendor/coolprop.js` | Unchanged CoolProp JavaScript wrapper |
| `docs/assets/vendor/coolprop.wasm` | Unchanged CoolProp WebAssembly binary |
| `docs/assets/vendor/LICENSE.txt` | CoolProp MIT licence |
| `docs/404.html` | Custom-domain error page |
| `docs/CNAME`, `docs/.nojekyll` | GitHub Pages configuration |
| `docs/robots.txt`, `docs/sitemap.xml` | Search-engine discovery |
| `src/` | Editable interface, history, worker, and property modules |
| `scripts/build.mjs` | Rebuilds the interface and worker bundles |
| `tests/` | Numerical regression checks using the real CoolProp engine |

The entire publishable site is in **`docs/`**. No backend, CDN, or runtime package installation is required on GitHub Pages. Each project is self-contained; it does not load code or styles from the other sites.

## Publish on GitHub Pages

1. Replace this repository’s existing **`docs` folder** with the new `docs` folder. Remove the old flat assets, old `docs/vendor`, and `local-preview.html` when replacing it so obsolete files are not left published. Copy the accompanying root files and folders into this same repository.
2. Commit and push to `main` using GitHub Desktop or GitHub.
3. Open **Settings → Pages** in this repository.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose **`main`** and **`/docs`**, then save. If the default branch has a different name, choose that branch instead.
6. Keep the custom domain **`fluidpropertiescalculator.aditusan.dev`**. The included `docs/CNAME` already contains it. Enable **Enforce HTTPS** when available.

The current custom-domain DNS configuration can remain in place when replacing the existing site. The sitemap is https://fluidpropertiescalculator.aditusan.dev/sitemap.xml.

**Keep both CoolProp files and the licence in `docs/assets/vendor/`.** The worker resolves these paths locally; omitting the `.wasm` file prevents the calculator from starting.

## Preview locally

Install Python 3, then double-click `Start-Local-Preview.bat` on Windows, or run `sh Start-Local-Preview.sh` on macOS/Linux. Open **http://localhost:8000/** while the preview process is running. Stop it with Ctrl+C.

Alternatively, run from this repository’s root:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory docs
```

On macOS/Linux, use `python3` if `python` is unavailable. If running both project previews at once, use port `8001` for the second one. Open the site over localhost rather than double-clicking `docs/index.html`: browser workers and WebAssembly require a served page. The standalone, duplicate `local-preview.html` has been replaced by this preview workflow.

## Editing and rebuilding

Edit page content in the corresponding `docs/.../index.html`. Edit `docs/assets/site.css` once to update the styling across every page. Every page loads `assets/site.js` as well.

For calculation, worker, or history changes, edit **`src/`**, then use Node.js 20.19+ or 22+:

```sh
npm ci
npm run build
npm test
```

Commit the updated source and generated `docs/assets/calculator.js` and `docs/assets/engine.js`. These commands are only needed when developing the calculator; the supplied `docs` files are already built.

## Calculation details

- Inputs are converted to SI before calling CoolProp `PropsSI`; output values retain the existing displayed units.
- Pressure is **absolute**. Q = 0 is saturated liquid; Q = 1 is saturated vapour.
- For 0 < Q < 1, thermodynamic mixture properties are displayed. Viscosity, thermal conductivity, Cp, and Cv remain unavailable; use Q = 0 or Q = 1 for an individual saturated phase.
- Unsupported input pairs or fluid states show an error; an unavailable individual output does not remove other valid properties.
- Copied MATLAB calls use SI inputs and require the user’s existing `lib` setup in MATLAB. The website does not run MATLAB.
- The property computation code and CoolProp binary are preserved from the existing repository. Worker-path changes only accommodate the new `assets` folder.

## Third-party software and privacy

CoolProp 8.0.0 is bundled under the [MIT licence](docs/assets/vendor/LICENSE.txt). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the on-site [reference](https://fluidpropertiescalculator.aditusan.dev/reference/).

History uses browser IndexedDB, with a temporary tab-only fallback when storage is unavailable. Copy actions use the clipboard. No analytics or advertising scripts are included in this version; the on-site privacy page describes this behaviour.
