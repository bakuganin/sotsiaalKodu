# Статичные изображения для просторного концепта Kodu

Создано 14 сентября 2026 года встроенным инструментом `image_gen` (без CLI/API). Это оригинальные иллюстративные изображения: они не показывают реальный офис, сотрудников или результат услуги.

Оба оригинала проверены визуально. Изображения имеют настоящую прозрачность: alpha min 0 / max 255. WebP получены из PNG с помощью Sharp (quality 90, alphaQuality 100), без изменения композиции или удаления фона.

| Изображение | Для сайта | Оригинал | Размер |
|---|---|---|---|
| Дом из оливкового стекла с ростком | `public/images/calm-home.webp` | `design/calm-home-original.png` | 1254 × 1254 |
| Естественная ветка с листьями | `public/images/calm-branch.webp` | `design/calm-branch-original.png` | 2172 × 724 |

PNG для сайта также сохранены как `public/images/calm-home.png` и `public/images/calm-branch.png`.

## Промпт: дом

```text
Use case: stylized-concept.
Asset type: isolated transparent hero sculpture for a calm premium social support website.
Primary request: Create one beautiful high-end studio CGI sculpture of a simple small house or protective shelter, made of thick dark olive-green translucent glass. Rounded gabled roof, solid thick walls, one large softly rounded arched opening. Inside the shelter sits a small vibrant natural seedling growing among two or three tiny smooth pebbles, a gentle metaphor of care, safety, and growth.
Composition: single object, front three-quarter view with only slight perspective, centered, entire object completely visible with generous clear margins, object occupies about 75 percent of a square 1536 by 1536 canvas. Shelter should be iconic and sculptural, substantial but friendly, around half as wide as its height is not required: use harmonious almost-square proportions.
Materials and lighting: luxury industrial product rendering, exceptionally realistic smooth polished translucent deep olive glass with subtle thickness, beautiful soft top-left studio light, refined bright reflections and dark rich green edges, natural detailed leaves. Softest grounded contact shadow only, on actual transparency.
Background: genuinely transparent alpha, no solid white or gray background, no checkered pattern painted in.
Avoid: bottles, pills, capsules, medicine, text, brand, lettering, logo, watermark, labels, UI, rings, orbits, floating circle decorations, fantasy glow, visual clutter, giant roots, extra buildings.
```

## Промпт: ветка

```text
Use case: photorealistic-natural.
Asset type: isolated botanical branch on actual transparent alpha for a spacious premium social-support website.
Primary request: a single elegant naturally weathered warm-brown wooden branch with a restrained number of fresh realistic green leaves, stretching gently across a wide panoramic composition. The main branch flows from lower left to upper right in a relaxed organic curve, slightly crooked natural twigs, beautiful tactile pale warm wood and small bark creases, leaves in several loose clusters with airy gaps between them. Healthy natural green leaves, moderately large leaves with fine veins, soft studio daylight, botanical still life of exceptional photographic realism.
Composition/framing: panoramic 3:1 aspect ratio, 2304 x 768 canvas preferred, whole branch is completely in frame including both ends and all leaf tips with ample margin on every side. It should span about 88 percent of image width, elegant asymmetrical natural form, horizontal branch with a slight ascending curve, not a straight stick, not a dense bush. Leaf clusters are taller near the center. Comfortable open space around the branch.
Background: genuinely transparent alpha, fully isolated cutout. No white background, no ground, no vase, no backdrop, no painted checkerboard.
Lighting/mood: realistic soft daylight from above left, clean high-end editorial plant photography, restrained natural greens with gently luminous leaf tips.
Avoid: text, lettering, logos, watermark, UI cards, containers, glass, circles, rings, orbits, human hands, potted plants, roots, trunk, flowers, fruit, extra branches disconnected from the main stem, dense foliage, edge-cropping, black silhouette leaves.
```

## Сохранённые источники

- `E:/Codex/Profiles/codex-gui-test/generated_images/01a09e57-a214-7693-93e9-e5867f23340a/exec-c7375537-ba58-41cf-ad4e-5ad21db7a508.png`
- `E:/Codex/Profiles/codex-gui-test/generated_images/01a09e57-a214-7693-93e9-e5867f23340a/exec-b0d2f4a1-4a9c-43b5-82c7-35655816ad0d.png`

Исходные изображения оставлены на месте; рабочие копии находятся в проекте.
