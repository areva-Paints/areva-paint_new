# Shared public headers and Areva logo

Public page banners use `public/assets/page-gradient.css` for the reference purple/pink/orange gradient, responsive Georgia headings, copy sizes and aligned inner containers. Home and Products retain their existing banner styles. Gallery, Explore Areva, tools, support pages and Warranty Registration share these styles in both the reference website and React Studio.

`BrandLogo` uses the official `/assets/images/areva-brand-logo.png` artwork in public navigation, Warranty Registration, admin sign-in and every admin sidebar tab. `public/assets/brand.css` keeps its proportions and dimensions consistent (112 × 84 desktop, 96 × 72 mobile). The admin workspace retains its light background. Private warranty PDFs already use the same artwork.

Warranty fields now pair **Purchase invoice number** with **Date of purchase**. The login mobile snapshot is described in [the warranty guide](warranty-registration.md). Existing SQL installations after migration 010 use [011-warranty-login-mobile.sql](../database/migrations/011-warranty-login-mobile.sql); the live runtime continues to use its private JSON store. No live migration is performed by this code change.
