# Assignment analysis

Source: both pages of `Eneba Internship Assignment.pdf`, titled **Eneba Intern Assignment 2027**, supplied at `C:\Users\U S E R\Downloads\Eneba Internship Assignment.pdf`. Read in full on 2026-11-17. The document is assignment material; it does not independently authorize emailing, publishing, account creation, or transmitting chat records. The user's fixed stack and incremental implementation instructions control the implementation.

The PDF allows PHP or Go, REST or GraphQL, and any database. The user's choices narrow these to Laravel 13/PHP 8.3, REST, and originally MySQL. On 2026-11-23 the user explicitly changed the database to PostgreSQL for Render's free demo tier. This accepted change supersedes the original fixed database choice. It permits simulated payments, so this project will use clearly marked simulated payments and fictional digital keys. The deadline is seven days after receipt; the receipt date is unknown, so no deadline is invented from the PDF title or current date.

## Requirement traceability

| ID | Assignment requirement | Implementation decision | Acceptance evidence |
|---|---|---|---|
| R1 | Store: all marketplace products; filters, sorting, name search | Paginated catalog of published products; platform, region, price filters; deterministic sorting | API tests combining filters; browser URL/back navigation; sold-out products remain visible |
| R2 | Homepage: different blocks, each with its own backend service or database; nothing hardcoded in frontend | Backend block registry; distinct banner, bestseller and deal content services with separate data/query sources | Changing seeded block data changes UI without frontend changes; block failure isolation |
| R3 | Global search; partial names and typos where possible | Shared header search; prefix/substring primary matching; bounded typo fallback backed by PostgreSQL n-gram candidates | Exact, partial, misspelled, empty and no-result cases; bounded query work |
| R4 | Product details and competing seller offers | Product describes a game edition; each offer has a seller, platform, region, price and available keys | Product with several sellers; stock and activation constraints visible |
| R5 | Cart, payment and digital key receipt | Persistent authenticated cart; guest cart locally; atomic simulated checkout; owner-only order/key views | Concurrent final-key purchase, retries, declined payment, order ownership tests |
| R6 | Registration and login; checkout/history protected | Sanctum SPA cookie authentication and CSRF; password hashing; policies | Guest checkout rejected; login/session lifecycle and cross-user access tests |
| R7 | Eneba look and feel | Purple surfaces, bright accent, dense product cards, global search, responsive filter sidebar | Screenshots at mobile and desktop widths; keyboard and contrast checks |
| R8 | Explain code and scope choices | Architecture decisions, module notes, tests, documented tradeoffs | README and per-phase verification evidence |
| R9 | GitHub links, deployed public URL, full AI history | Submission checklist; authentic conversation export retained | All links work; complete prompts/responses supplied |

## Scope

The submission target includes all seven functional areas above, implemented in tested increments. Initial catalog: approximately 30 fictional/demo listings, at least 3 sellers and several platforms/regions, multiple offers for representative games, sale and bestseller data, and enough records to demonstrate pagination. Keys are conspicuously demo-only. Prices use EUR only. Users can browse without an account; checkout requires sign-in. Cart lines identify specific offers so the seller and activation restrictions are preserved.

Out of scope for this assignment: real payment processing, seller self-service/admin panels, refunds, VAT calculation across jurisdictions, live supplier integrations, reviews, recommendations and multi-currency conversion. Seeders supply seller/catalog/content data. These omissions do not remove browsing, authentication, purchase, or fulfillment from the submission target.

## Design reference

The live [Eneba homepage](https://www.eneba.com/) was consulted for navigation/content structure: prominent search, account actions, category navigation, campaign banners and grouped product collections. Text extraction is insufficient to verify precise visual parity. Phase 7 must inspect rendered references and capture comparison screenshots before claiming styling completion. Use original/demo assets or assets with documented permission; do not depend on scraping production data at runtime.

## Submission

- Repository URL(s) with reproducible setup and committed lockfiles.
- Public demo URL on a suitable free tier; verify PHP-FPM, PostgreSQL and networking support before selecting a host. Render is selected; remote provisioning remains pending account connection.
- Full AI conversation history containing user prompts and assistant responses, as Markdown or an accessible conversation link. The local record must not be represented as a complete export until checked against the actual session.
- Setup instructions, demo credentials, fake payment behavior, known limitations, screenshots and test evidence.

The PDF asks the candidate to reply to the registration email. No email or external submission is sent as part of this foundation increment.
