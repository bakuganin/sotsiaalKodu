# Иллюстрации услуг без фона — 14.09.2026

Первые три изображения услуг заменены более конкретными тематическими сюжетами: [актуальный набор и промпты](service-themes/README.md). Из описанного ниже набора домик продолжает использоваться для помощи на дому, а отдельный лист — в декоративной композиции между портретами. Остальные файлы сохранены как предыдущий вариант.

Обработка выполнена встроенным imagegen, режим редактирования / background-extraction. Исходный непрозрачный лист сохранён в `botanical-services-original.png`. В сайт включены только варианты с настоящим альфа-каналом; промежуточные варианты с нарисованной сеткой не используются.

PNG-оригиналы находятся в этой папке. Рабочие WebP — 512 × 560 px, качество 90, качество альфа-канала 100. Sharp использован только для уменьшения и преобразования формата с сохранением прозрачности.

| Объект | Прозрачный PNG | Файл на сайте |
| --- | --- | --- |
| Кольца — консультирование | [service-conversation-transparent.png](service-conversation-transparent.png) | [service-conversation.webp](../public/images/service-conversation.webp) |
| Камни с листом — личная поддержка | [service-people-transparent.png](service-people-transparent.png) | [service-people.webp](../public/images/service-people.webp) |
| Лист — встречи и курсы | [service-flower-transparent.png](service-flower-transparent.png) | [service-flower.webp](../public/images/service-flower.webp) |
| Домик — помощь дома | [service-home-transparent.png](service-home-transparent.png) | [service-home.webp](../public/images/service-home.webp) |

Общие файлы используются в карточках услуг, миниатюрах первого экрана, декоративном блоке и окнах описания услуг. Убраны CSS Multiply, градиентная маска и отдельная подложка картинки в описании услуги. Геометрия макета сохранена.

## Финальные промпты

### Кольца — консультирование

Редактируемый файл: `public/images/service-conversation.webp` (исходная версия с фоном).
Результат встроенного инструмента: `E:/Codex/Profiles/codex-gui-test/generated_images/01a09dc5-7755-7e83-beea-fa29e69dd91e/exec-35c7249e-ce91-4fb0-9664-87bde3c639f4.png`.

Make the background transparent. Cut out the two rings from the attached image. Keep the rings and delete everything else. Transparent background PNG asset for a website, no surrounding pixels. Keep the same framing and proportions.

### Камни с листом — личная поддержка

Редактируемый файл: `public/images/service-people.webp` (исходная версия с фоном).
Результат встроенного инструмента: `E:/Codex/Profiles/codex-gui-test/generated_images/01a09dc5-7755-7e83-beea-fa29e69dd91e/exec-fca5c1cb-e76c-44a9-97bc-380f7c29b898.png`.

Use case: background-extraction. Asset type: existing website service illustration and small navigation thumbnail. The input is the EDIT TARGET, not an inspiration reference. Remove only the opaque gray-green studio background and floor from this exact supplied image. Keep the same two pale sage translucent glass pebble forms with one natural green leaf between them unchanged: same silhouette, proportions, position, orientation, colors, material highlights, refractions and details. Preserve the original portrait 512:560 aspect ratio and the existing subject framing/margins. Output a clean cutout on a genuinely transparent RGBA alpha background, with clean antialiased edges. Remove the backdrop in all negative spaces as well (especially open ring holes), retain the glass objects and leaf, and keep only a very faint natural contact shadow with semitransparent alpha directly below the subject, no opaque ground plane. No visible rectangular background or white fringe on a white, gray or dark website card. Do not add or redraw objects. Do not paint a checkerboard; actual transparent pixels are required. No text, no UI, no border, no new lighting.

### Лист — встречи и курсы

Редактируемый файл: `public/images/service-flower.webp` (исходная версия с фоном).
Дополнительный образец прозрачности: финальный PNG камней с листом; его объекты не включались в результат.
Результат встроенного инструмента: `E:/Codex/Profiles/codex-gui-test/generated_images/01a09dc5-7755-7e83-beea-fa29e69dd91e/exec-94a7cd26-30f5-4b2d-bcb7-65265a460017.png`.

Background extraction for a transparent website PNG. Image 1 is the edit target: curled green leaf with dew drops. Image 2 is only an example of the required transparent-background file format; do not include its objects. Cut out the subject from image 1 and remove its background completely, just like the transparency in image 2. Use a real transparent alpha background, not a drawing of a checkerboard, not a gray grid, not a solid backdrop. Preserve the object from image 1 exactly, including its original framing and margins; change only the background. Fully transparent empty surroundings and any open holes, smooth clean edges. The object is the only visible content. No checkerboard pixels anywhere. Deliver transparent PNG.

### Домик — помощь дома

Редактируемый файл: `public/images/service-home.webp` (исходная версия с фоном).
Результат встроенного инструмента: `E:/Codex/Profiles/codex-gui-test/generated_images/01a09dc5-7755-7e83-beea-fa29e69dd91e/exec-9cc25569-6107-4bbc-aff3-da1cc5fdb6c3.png`.

Удали фон у этой картинки. Нужен PNG с прозрачным фоном: только домик с растением, вырезанный по контуру. Сохрани исходный вид и размер домика. Пустое пространство вокруг домика должно быть прозрачным.

## Проверка

- Все четыре WebP содержат настоящий альфа-канал и полностью прозрачные фоновые пиксели.
- Проверены миниатюры, карточки, описание услуги и мобильный экран; отдельно проверен тёмный контраст.
- Сборка TypeScript/Vite проходит.
- Снимки: `cutouts-after-services.png`, `cutouts-after-shortcuts.png`, `cutouts-after-dark.png`, `cutouts-after-detail.png`, `cutouts-after-mobile.png`.
