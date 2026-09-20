# JourneyDeck opening animation concepts

Three 2.5-second full-screen portrait previews for selecting the first-launch motion direction. These files are design prototypes only and are not wired into the mobile app.

Option 2 is the approved direction. Its exact selected render is preserved in `selected-option-2-final.webp`; see `SELECTED.md` for the implementation invariants and integrity hashes.

- `option-1-road-awakens.webp`: a route-light reveal that leads into the brand.
- `option-2-miles-become-memories.webp`: glassy road-trip moments gathering around the brand.
- `option-3-road-meets-soundtrack.webp`: a vinyl pulse transforming into a coastal road.

Each animated WebP contains 50 frames at 50 ms per frame, for an exact 2.5-second loop. Run `build_previews.py` with the bundled workspace Python/Pillow environment to reproduce them from the generated foundations in `assets/`.

The generated visual foundations use the JourneyDeck welcome and Statistics artwork as style references. Their production prompts are recorded in `PROMPTS.md`.
