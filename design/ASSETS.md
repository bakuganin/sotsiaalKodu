# Визуальные материалы — ботанический редизайн, 14.09.2026

Текущий просторный концепт использует стеклянный дом и ветку на прозрачном фоне: подробности, исходники и промпты — в [CALM-ASSETS.md](CALM-ASSETS.md). Панорамная сфера ниже сохранена как материал предыдущего варианта и больше не отображается на сайте.

В заголовках четырёх разделов повторяющийся логотип заменён тематическими зелёными стеклянными иконками: кольца поддержки, четыре лепестка направлений помощи, сердце заботы и диалог. Рабочие файлы, оригиналы и промпты — в [section-icons/README.md](section-icons/README.md).

Три изображения услуг сочетают стекло с натуральными материалами: контуры диалога с веточкой, поддерживающие руки с льняными манжетами и стеклянной дугой, бумажная книга со стеклянной обложкой и ростком. Домик сохранён. Серия используется в карточках, меню и описаниях услуг: [service-themes/natural/README.md](service-themes/natural/README.md).

- `botanical-hero-original.png` — оригинальный панорамный фон, созданный встроенным imagegen. `../public/images/botanical-hero.webp` — оптимизированная версия (около 193 КБ, Sharp, качество 88).
- `botanical-services-original.png` — сохранённый оригинальный лист из четырёх объёмных композиций. По просьбе заказчика фон четырёх объектов удалён встроенным imagegen. Прозрачные рабочие файлы: `service-conversation.webp`, `service-people.webp`, `service-flower.webp`, `service-home.webp` в `../public/images/`, 512 × 560 px, около 175 КБ суммарно. PNG-исходники, финальные промпты и описание обработки — в [SERVICE-CUTOUTS.md](SERVICE-CUTOUTS.md).
- Ботанический фон, объекты, иллюстративное фото и фотографии команды хранятся локально. Материалы референсов не копировались в сайт.
- Актуальный логотип Kodu — новый векторный знак из двух соединённых открытых форм и словесная часть в кривых. Он заменил прежний знак из двух листьев в шапке, подвале, секционных метках и favicon. Брендбук, отдельные SVG/PDF и исходники — в [brandbook/README.md](brandbook/README.md). Все круговые Lottie-композиции и проигрыватель `lottie-web` удалены по просьбе заказчика. Ботанические изображения статичны; переходы используются только при взаимодействии.
- `first-screen.png`, `desktop.png`, `mobile.png`, `mobile-first-screen.png` — актуальные превью редизайна. `v1/` хранит предыдущие превью.

## Домик в hero

В hero восстановлена исходная статичная иллюстрация `public/images/calm-home.webp`. По просьбе заказчика раскрытие и реакция на курсор отключены; 3D-компонент не подключён к странице. Для продолжения позже сохранены код `src/hero3d/`, [исходник Blender](blender/calm-home.blend), [рендер Cycles](blender/calm-home-final.png), модель `public/models/calm-home.glb` с анимацией `Reveal` и освещение `calm-home-studio.hdr`. Описание сохранённой версии и её исторических проверок — в [hero3d/README.md](hero3d/README.md).

## Фотографии команды

Фотографии предоставлены заказчиком и скопированы без изменения содержимого или формата:

- `../public/images/team-natalia.png` — Наталья Умарова, 1080 × 1080 px, 1 249 036 байт. Исходный файл: `codex-clipboard-93d6e4a6-879e-4766-8e83-489addf4c915.png`.
- `../public/images/team-eduard.png` — Эдуард Ист, 1000 × 660 px, 797 705 байт. Исходный файл: `codex-clipboard-b52f00e6-d8f8-416e-81b1-d404ffd0d71e.png`.

Эти фотографии используются в разделе команды и не являются изображениями, созданными с помощью ИИ.

В раскрывающейся галерее неактивные фотографии показаны чёрно-белыми через CSS; оригинальные файлы остаются цветными. Кадрирование выполняется только при отображении. Актуальные состояния: `team-desktop.png`, `team-eduard-desktop.png`, `team-mobile.png`.

## Промпт панорамного фона

Use case: photorealistic-natural / premium 3D editorial environment. Asset: full-bleed panoramic website hero background for a refined social support organization named Kodu. Generate an ultra high-end photorealistic CGI botanical landscape, landscape 16:9, 2048x1152. Muted warm gray and olive mist background, soft directional daylight from top left. Bottom third: lush tiny moss hills and delicate wild chamomile daisies, little fern fronds and fresh grass growing up at left and right edges, much lower at center, no trees. A single beautiful large perfectly spherical transparent glass orb hovers over the moss in the lower middle of the image at approximately x50% y65%, diameter about 27% of image height. Inside the orb: one vibrant natural green young seedling with five realistic leaves and two smooth pebbles at base. True thin-wall glass realistic reflections, bright exquisite rim reflections, soft caustics, faint transparent shadow below. Upper 45% of the entire image must be completely open soft neutral grayish olive atmosphere with no objects, ready for large white website typography added later. Keep mid-left and mid-right empty for text. Calm optimistic growth, protective glass as a metaphor of care. Medium-wide camera, botanical macro detail foreground, realistic restrained textures, sophisticated Nordic luxury wellness art direction. No typography, no text, no logos, no people, no tablets, no pills, no UI, no borders. Image should fill entire rectangle.

## Промпт объёмных объектов

Use case: product-mockup. Asset: four original 3D botanical metaphor artworks for four website service cards. Make ONE horizontal 8:3 studio contact sheet with FOUR equal-width columns, each object centered in its own quarter with generous blank margin, no visible dividers or text. Canvas 2048x768. Background exactly uniform light warm gray #f0f1eb. Identical soft left studio daylight, subtle shadows, restrained premium product photography meets modern green glass sculpture. First quarter: two smooth clear olive glass interlocking rings, gentle diagonal pose, beautiful rounded substantial glass like tiny sculpture, symbolizes dialogue. Second quarter: two pale sage-green smoothly rounded pebble forms resting together, one taller vertical form and one short, with a single small fresh leaf between them, symbolizes personal support. Third quarter: a vivid lime-green elegantly folded semi-translucent botanical leaf with clear delicate natural veins, sculptural aerial twist with tiny dew drops, symbolizes learning and growth. Fourth quarter: a small simple smooth thick frosted translucent pale olive glass house sculpture, gabled roof, a little green seedling visible inside, symbolizes care at home. Objects occupy middle 65% height and middle 70% of each separate quarter, keep all objects far from quarter boundaries so contact sheet can be cleanly sliced into four separate website assets. All four objects same apparent scale, each entirely visible, no cropping. Elegant glass material depth and gentle high-end studio illumination. No labels, letters, numbers, logos, packaging, humans, line art, icons, cartoon style, borders.

## Иллюстративное фото из первой версии

- `care-hero-original.png` — оригинал изображения, созданного встроенным imagegen 14.09.2026.
- `../public/images/care-hero.webp` — оптимизированная копия для сайта; преобразование формата через Sharp, качество 85. Содержимое изображения не редактировалось.
- `first-screen.png`, `desktop.png`, `mobile.png`, `booking.png` — снимки сайта для обсуждения дизайна.
- Иллюстративное фото теперь используется в разделе о подходе к помощи.

На изображении вымышленные люди; оно не изображает Наталью Умарову, Эдуарда Иста или клиентов компании. На сайте есть соответствующая подпись. Путь встроенного генератора не используется как зависимость сайта: оригинал и рабочая копия находятся в проекте.

## Финальный промпт

Use case: photorealistic-natural. Asset type: editorial hero photograph for a welcoming Estonian social support organization website. Create a high-end natural lifestyle photograph, horizontal 3:2 ratio. A silver-haired woman around 68 in an oatmeal knit sweater and a kind woman around 40 in a light sage-green linen blouse sit together at a light oak kitchen table in a sunlit home. They share a quiet warm genuine smile and relaxed eye contact, listening attentively, ceramic tea cups on table, hands naturally resting separately on table. Medium shot, heads and torsos visible, subjects centered in frame with generous space around their heads for flexible website cropping. Soft daylight from left, warm creamy highlights, muted natural sage foliage softly out of focus in background, film-like fine grain, realistic unretouched skin texture and lived-in character. Compassion and dignity, calm optimism, authentic candid moment, refined Scandinavian editorial art direction. Not a medical setting, no uniform, no stethoscope, no text, no logo, no watermark, no collage, no borders. Fictional unnamed people for illustrative use, not portraits of company staff.
