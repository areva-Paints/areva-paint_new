# About Areva: Explore Areva resources

The **About Areva** navigation opens a resource hub at `#about`. It uses the reference's gradient hero, **Explore Areva** heading, centered **How can we help you?** introduction and six white icon cards. Cards use the whole surface as a link, with keyboard focus, responsive two-column/one-column layouts and reduced-motion support.

| Card | Destination |
| --- | --- |
| Our Story | `#our-story`: the preserved company history, timeline, vision and mission |
| Dealer Network | `#portals`: the existing authorised-dealer directory and partner resources |
| Resource Centre | `#certs`: admin-managed certifications/documents and product PDF downloads |
| Customer Care | `#contact`: the existing contact/enquiry form |
| Warranty & Support | `/warranty`: the Areva mobile-entry warranty registration page |
| Partner Login | `/admin`: the existing secured administration portal/sign-in |

The resource hub, company story and documents are separate reference-site views. Navigating to a card hides the hub and unrelated page sections; deep links, browser history and the About navigation highlight remain supported. Existing `#about` bookmarks now open the hub; the story remains available through its card and new `#our-story` URL. The story's existing text, timeline and gradient value cards are retained.

The same component is used in React Studio. Its internal destinations resolve to the content backend's `/attached-page#…` routes, and warranty/admin URLs resolve to that backend as well. This keeps separate Static Site/backend deployments working. Warranty/admin links leave the iframe using top-level navigation. React's navigation/footer include About Areva; desktop spacing accommodates the added link.

Partner Login reuses the existing admin portal. No new dealer role, credentials, account creation flow or authentication bypass is introduced. Warranty entry retains its fresh mobile/OTP step and current demo mode. Customer Care navigation does not send an enquiry, and no SMS, WhatsApp or email is sent by a resource-card click. Existing dealer/document content remains managed through its existing admin sections. This layout change does not need a database migration.

`tests/explore-areva.test.mjs` checks six real/unique destinations, preserved story content, top-level warranty/admin links and backend-resolved React URLs. Browser checks cover every card, independent/deep-linked page visibility, history and keyboard use, actual warranty/admin entry, responsive layouts, header fit and CSP. The resource page is tested with isolated temporary content; no live deployment or records are changed.
