# Phase 3 delight

JourneyDeck's delight layer is intentionally sparse and data-led.

- Statistics rhythm bars reveal once for each new local statistics snapshot. They remain still when Reduce Motion is enabled or the app is inactive.
- Journey replay uses a small Skia route trace derived only from the journey's existing local coordinates. Projection is bounded and sampled before rendering.
- Liquid Glass is limited to compact map controls and the replay control surface. Unsupported devices fall back to blur, while Reduce Transparency uses an opaque themed surface.
- Existing photographs remain the visual source of depth; motion never substitutes synthetic trip content.

All behavior uses the shared Phase 1 lifecycle and accessibility state. No delight effect starts a network request or synthesizes journey, music, location, or statistics data.
