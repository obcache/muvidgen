# MuvidGen UI Assets (Source)

This folder holds the design source files for the application UI (e.g., Photoshop/Illustrator documents). These files are not shipped with the app and exist only as a source of truth for exported assets.

Recommended structure
- Keep editable sources here:
  - `design/ui/muvidgen-buttons.psd` (example)
  - Additional pages or artboards as needed
- Exported, ship‑ready assets go in:
  - `client/public/ui/` (Vite serves from `public/` in dev and copies to `dist/` in builds)

Naming and organization
- Use short, semantic names that match usage in code:
  - `add-audio.png`
  - `add-layer.png`
  - `add-video.png`
  - `render.png`
  - `play.png`, `pause.png`
  - `logo.png`
- Prefer lower‑case, hyphen‑separated names.
- Keep file types consistent (PNG or SVG). SVG is preferred for crisp scaling; use PNG if artwork includes raster effects.

Export guidance
- Sizes: export at the native pixel size you want them displayed (common button tile size is 64×64). If using PNG, also consider @2x versions when appropriate.
- Color: ensure good contrast across the dark themes; avoid hard‑coded background colors in the asset unless intentional.
- Transparency: keep transparent backgrounds where the theme background should show through.

Workflow tips
- Update the source here, then export to `client/public/ui/`. The app references assets at runtime using relative URLs like `new URL('ui/add-audio.png', document.baseURI)`.
- If you change filenames, update the references in `client/src/App.tsx` (and any other components) accordingly.

Version control
- Large binary sources can bloat the repo. Consider Git LFS for `.psd`/`.ai` if your remote supports it. Example `.gitattributes` entry:
  
  ```gitattributes
  # Optional: enable LFS for design sources
  design/ui/*.psd filter=lfs diff=lfs merge=lfs -text
  design/ui/*.ai  filter=lfs diff=lfs merge=lfs -text
  ```

Packaging
- This `design/` folder is not part of the shipped application. Vite/Electron builds consume assets from `client/public/ui/`, and the Windows installer (Inno Setup) should also only include built outputs. No additional configuration is required as long as assets are exported to `client/public/ui/`.

--
Last updated: keep this document aligned with the actual assets and usage in the codebase.
