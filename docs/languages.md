# Website languages

The selector lists Eesti (ET), Русский (RU), then English (EN). Estonian is the default regardless of browser language. An explicit selection is stored in `sotsiaal-language`; invalid or unavailable storage falls back to Estonian. A choice made while storage is blocked still works until reload. Changes also synchronise between open tabs.

Routes are shared by all languages. Switching updates React content and document metadata without reloading or changing the current route. Existing component state is preserved. The menu supports keyboard arrows, Home/End, Escape, Tab and outside clicks. Its transition and the brief content fade respect OS and site reduced-motion preferences.

`src/i18n/messages.json` maps Russian source phrases to `[Estonian, English]`. Render copy with `tr(sourcePhrase)`. Existing structured dictionaries use `localize` / `getContent` inside the render, so identifiers, links and company facts remain unchanged. Do not evaluate translated copy at module scope. Add both translations when adding or changing a source phrase. The main app subscribes with `useLocale`; independently rendered language selectors subscribe too.

Booking dates use `et-EE`, `ru-RU` or `en-GB`, with Europe/Tallinn as the service timezone. Static entry pages use Estonian metadata, then apply the saved language on startup. No translation service, tracking request or cookie is used.

Existing regression suites explicitly select Russian through the `siteLocale` fixture. `language-switcher.spec.ts` uses the real default and checks navigation, persistence, keyboard interaction, transition frames, all routes, forms, mobile layout, blocked storage and the first-visit notice.
