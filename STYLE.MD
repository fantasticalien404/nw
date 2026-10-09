## Frontend style report

1. The page uses a restrained, document-first editorial layout: one centred reading column with no cards, shadows, gradients, or decorative imagery.  
2. The desktop content width is fixed at `672px` (`max-w-2xl`), centred in the viewport; mobile retains a `360px` minimum viewport and uses `16px` outer gutters plus `8px` inner content padding.  
3. Vertical rhythm is spacious but compact: the body starts `32px` from the top, navigation ends with `40px` separation, and article paragraphs use `20px` top/bottom margins.  
4. The application requests Geist Sans/Mono, but the current rendered body font resolves to the Tailwind system sans stack: `ui-sans-serif, system-ui, sans-serif`; reproduce the visible result with that stack unless intentionally correcting the font wiring.  
5. Base text is `16px`, weight `400`, with `24px` line height; article paragraphs are neutral-800 (`#262626`) in light mode and neutral-200 in dark mode.  
6. The page title is `24px`, semibold (`600`), with a tight `32px` line height and `-1.2px` tracking; it uses balanced wrapping to avoid an isolated final word.  
7. Article level-two and level-three headings are both `20px`, medium (`500`), `28px` line height, `-0.5px` tracking, with `24px` top and `8px` bottom margins; level-four headings reduce to `18px`.  
8. Navigation is a single left-aligned horizontal row of small lowercase text, with `8px`-like link padding/margins and slightly tight tracking; it is functional and intentionally visually quiet.  
9. The primary palette is monochrome: white background/black text in light mode and black background/white text in dark mode, with supporting grays such as `#525252` for metadata, `#d4d4d4` table borders, and `#a3a3a3` link decoration.  
10. Selected text uses a clear blue highlight, `#47a3f3`, with near-white selected text; reserve saturated color mostly for this state and syntax highlighting.  
11. Links retain the surrounding text color and use a `0.1em` gray underline with a `2px` offset; heading anchors remain hidden until the heading is hovered, then show a pale `#` in the left gutter.  
12. Lists use conventional disc/decimal markers with `24px` left padding, preserving the same body type scale rather than introducing a separate list style.  
13. Tables are full width, collapsed, and plain: `1px` neutral-gray borders, `8px 12px` cells, bold headers, no zebra striping, and normal wrapping; on narrow screens they should remain horizontally scrollable rather than be transformed.  
14. Mathematical content is rendered with KaTeX and placed as clean display blocks between prose paragraphs, supporting the academic-note character without additional panels or captions.  
15. The footer continues the minimal geometry: a subtle bordered newsletter form, neutral input/button styling, then a compact row of social icons; all elements preserve the same grayscale, low-chrome visual system.

## Dashboard conventions

16. Charts use a white background, black axes, and grey grid lines. Use distinct, accessible colors for separate line series; do not use color as the sole means of conveying meaning.
17. Tables use a white background, black entries, and minimal lean grey borders. Header rows use a light-grey background.
18. Do not add CSS animations. Graphs may use restrained hover effects for tooltips, line or point emphasis, and data inspection.

