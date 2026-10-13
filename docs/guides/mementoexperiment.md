---
layout: default
title: Memento experiment
parent: Working with code
nav_order: 25
---

# Memento experiment

Memento is a built-in **Experiment** mode in spARcl, created for our [ISMAR2026 tutorial](https://openarcloud.org/oscp/ismar2026/). In AR, after localization, you pick a 3D model, preview it on a hit-test reticle, and **place** it at your feet. The client writes two Spatial Content Records (SCRs) to a Spatial Content Discovery (SCD) service so you and others can see the same mementos when querying the same map cell and topic again.

Implementation lives under `src/experiments/oarc/memento/`.

## Models
Models are served from `public/media/models/memento/` but note that all users must use the same spARcl deployment to access to models.

In our ISMAR2026 tutorial, we used models from [3d-emoji-assets-generator](https://github.com/wangyz1999/3d-emoji-assets-generator) (CC-BY-4.0), but we do not want to add these to git. Specific to these models, the code uses the `kMementoModelSizePercent`, `kMementoTextSizePercent`, `kMementoModelOriginToBottomModelUnits`, `kTextHeightOffsetM` variables to place these models on the ground. If you use other models, you will need to adjust or remove these numbers.

Serving models from other external URLs requires a little refactoring.

## What it does

1. **Localize** — Uses the normal spARcl viewer flow (GeoPose / world alignment). Placement is only allowed when alignment is active.
2. **Browse models** — Loads `catalog.json` and shows a list of model labels. The selected model is previewed on the hit-test reticle.
3. **Place here** — On confirm, posts to SCD:
   - A **`MODEL_3D`** SCR: GLB from the catalog, `SPIN_UP` animation
   - A **`TEXT`** SCR: display name from SCD Auth0 profile in `description` (and `title`), floating ~2 m above the model, `content.size` 20, billboard toward camera.
4. **Discover others’ mementos** — Enables periodic H3 content re-query on the configured SCD **topic** (default `history`) via the parent `Viewer.svelte`, same as other OSCP content.

## How to run it (developers and testers)

### Dashboard

1. Open the **Dashboard** (tap the top-right corner of the screen).
2. Set **AR mode** to **Experiment**.
3. Choose **Memento** in the experiment selector.
4. Configure **Memento settings** (see below).
5. In **Application state**, ensure a **content service** that points at your SCD (or the default demo SCD) is **selected**, so placed and existing mementos can be retrieved.
6. Start AR from the main UI.

### Rendering engine

Memento preview and placement use **GLB** loading. Use the **Three.js** engine (for example `?engine=three` in the URL). 
The OGL engine does not support complex indexed models.

### SCD Auth0 (required to place)

Placing a memento calls `postContent` and needs an access token with **`create:scrs`**. This is **separate** from logging into the spARcl app.

Add to your `.env` (see also the root [README](https://github.com/OpenArCloud/sparcl/blob/main/README.md)):

```text
VITE_SCD_AUTH_AUTH0_DOMAIN="your-scd-auth0-domain.auth0.com"
VITE_SCD_AUTH_AUTH0_CLIENTID="your-scd-client-id-from-auth0"
VITE_SCD_AUTH_AUTH0_AUDIENCE="https://your-scd.your-domain.com"
VITE_SCD_AUTH_AUTH0_SCOPE="openid profile email create:scrs"
VITE_AUTH_REDIRECT_URI="YOUR_APP_REDIRECTION_URI"
```

In the dashboard, under Memento settings, use **Sign in to SCD**. Default **SCD URL** is `https://scd.orbit-lab.org` if left empty.

**Topic** is fixed to **`history`** in code (`DEFAULT_MEMENTO_TOPIC` in `Settings.svelte`); the topic field in settings is disabled and always normalized to that value when placing or syncing the content query.

### Seeing TEXT labels (name tags)

Posted name tags use SCR type **`TEXT`**. The main viewer only renders `TEXT` when **Enable OGC PoI contents** is checked on the dashboard (`debug_enableOGCPoIContents`). Turn that on when testing Memento end-to-end, or name labels will not appear even though the MODEL_3D emoji loads.

### Device capabilities

The experiment requests WebXR features: `dom-overlay`, `camera-access`, `hit-test`, and `local-floor`. You need a browser and device that support hit testing for the reticle and preview.

## Filling in `catalog.json`

### Location

```text
public/media/models/memento/catalog.json
```

At runtime the client fetches:

```text
/media/models/memento/catalog.json
```

Each catalog **`file`** must be a **basename** of a GLB in the **same directory**:

```text
public/media/models/memento/<file>
```

### JSON shape

The file must be a **JSON array**. Each element is an object with two required string fields:

| Field   | Meaning |
|--------|---------|
| `file` | GLB filename only (e.g. `camera.glb`). No path, no URL. Must be non-empty after trim. |
| `label` | Short text shown in the model picker and stored in the MODEL_3D SCR `description` / keywords. |

Invalid entries (missing `file` or `label`, empty `file`) are dropped. If the array is empty, the file is missing, or HTTP fetch fails, the overlay shows **No models are available** and placement stays disabled.

### Example

After adding GLBs under `public/media/models/memento/`:

```json
[
  { "file": "camera.glb", "label": "Camera" },
  { "file": "gift.glb", "label": "Gift" },
  { "file": "flamingo.glb", "label": "Flamingo" }
]
```

The first entry becomes the default selection when the catalog loads.

### Developer checklist for new models

1. Copy or generate **binary GLB** files into `public/media/models/memento/`.
2. Add one `{ "file", "label" }` object per GLB to `catalog.json`.
3. Keep **`file`** exactly equal to the on-disk name (case-sensitive on Linux servers).
4. Prefer **glTF binary** (`.glb`) with `contentType` `model/gltf-binary` as used when posting SCRs (URLs are `/media/models/memento/<file>`).
5. Reload the app (or restart dev server) so the static catalog and new GLBs are served.

You do **not** register models in TypeScript: the catalog is the only picker configuration. Constants such as model scale (`kMementoModelSizePercent`) and ground offset (`kMementoModelOriginToBottomModelUnits`) are shared for all emoji-style assets in `Viewer.svelte`; custom GLB layouts may need code changes if they are not center-origin with a similar bounding box.

## In-session UI

After localization, the **Memento** overlay provides:

- **Relocalize** — Same as the main viewer relocalize control.
- **Place here** — Enabled when a model is selected, hit-test reticle is active, world alignment exists, and SCD sign-in is ready (when Auth0 is configured).
- Horizontal **model browser** driven entirely by `catalog.json`.

Errors such as missing SCD token or failed `postContent` are shown above the toolbar.

## Related code (for maintainers)

| Piece | Path |
|-------|------|
| Experiment viewer | `src/experiments/oarc/memento/Viewer.svelte` |
| Dashboard settings | `src/experiments/oarc/memento/Settings.svelte` |
| Session overlay | `src/experiments/oarc/memento/Overlay.svelte` |
| SCD Auth0 helper | `src/experiments/oarc/memento/scdAuth0Service.ts` |
| Experiment registration | `src/experiments/Selector.svelte` (`memento` key) |
| Parent content query / SCR dispatch | `src/components/Viewer.svelte` |

For general experiment wiring, see [Creating an experiment](../workingwithcode/createexperiment.html) and [Integrating experiments](../architecture/experiments.html).
