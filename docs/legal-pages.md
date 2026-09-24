# Company and website legal pages

Prepared 24 September 2026 for the current demonstration website. This is a description of the website and initial contact, not an agreement governing care services or health-data processing.

## Company facts

Source: customer-provided business-register extract dated 04.09.2026; cross-checked against [e-Äriregister](https://ariregister.rik.ee/eng/company/17591732/Sotsiaalsete-Teenuste-Kodu-O%C3%9C) on 24.09.2026. Company name, code, registration date, capital, address, board and representation match. The public register also confirms the phone and principal EMTAK activity. Personal identification codes from the extract are intentionally not reproduced on the website. The registered address is not advertised as a reception location. No bank details, VAT number or service licences were inferred.

## Observed implementation

- Hosting: Vercel. Production browser audit on 24.09.2026 saw only same-origin requests and no cookies or Set-Cookie header.
- No analytics, advertising pixels, remote fonts, embedded video, payment or submission backend is configured.
- Booking fields stay in React state; close clears name/contact, reopening resets the other choices. No submission request or persistent record is created.
- Accessibility preferences are written to localStorage under `kodu-accessibility-v1`, including defaults. Legacy `kodu-large-text` is read/migrated/deleted.
- A language explicitly selected by the visitor is stored as `et`, `ru` or `en` in localStorage under `sotsiaal-language`. There is no automatic expiry; the default without a saved choice is Estonian. The privacy and browser-storage pages disclose this preference in all three languages.
- The development notice writes `sotsiaal-development-notice-dismissed` to sessionStorage after dismissal. Browser session restoration can preserve sessionStorage.
- The old preloader files are not loaded; its historical storage key is not an active feature.
- Gmail is the registered contact address. The website itself does not read that mailbox.

## Sources used for the policies

- [AKI: privacy information and transparency](https://www.aki.ee/10-peatukk-labipaistvus)
- [AKI: preparing a privacy notice](https://www.aki.ee/isikuandmed/andmetootlejale/andmekaitsetingimuste-koostamisest)
- [AKI: individual rights](https://www.aki.ee/isikuandmed/andmetootlejale/inimese-oiguste-tagamine)
- [AKI: cookies and web activity](https://www.aki.ee/isikuandmed/kkk/interneti-ja-veebitegevused)
- [AKI: international transfers](https://www.aki.ee/isikuandmed/andmetootlejale/isikuandmete-edastamine-valisriiki-uldmaaruse-alusel)
- [European Commission: GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [Vercel privacy notice](https://vercel.com/legal/privacy-notice) and [DPA](https://vercel.com/legal/dpa)
- [Google privacy policy](https://policies.google.com/privacy?hl=ru)

## Details still requiring the operator's input

The operator was asked which systems store client correspondence and for how long. No specific mailbox retention period, CRM, automatic deletion process or hosting-log retention period is claimed. Current copy uses purpose-based retention criteria. Confirm the real operational retention schedule, access holders and any additional processors before extending the notice to a live client intake workflow. Hosting-provider agreements and transfer arrangements must correspond to the actual operator/account setup.

Before enabling real bookings, payments, special-category data collection or optional tracking, update the notice and implement the corresponding data-handling and consent behavior. No decorative consent banner is included for services that do not exist.

## Routes

`/company/`, `/privacy/`, `/cookies/`, `/terms/` have generated static entry points and page metadata. The former `#/privacy` link is migrated to `/privacy/`. Footer links work on every page; the booking form opens privacy information in a new tab so entered demo data is not lost.
