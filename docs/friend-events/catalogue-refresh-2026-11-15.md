# Boston catalogue refresh — November 15, 2026

Catalogue-only refresh from production main `5d51efd`. No application policy, email, campaign, scheduler, database schema or send gate changes. Draft PR #18 is excluded.

## Editorial review

27 upcoming records: 6 arts, 9 community, 5 food, 6 music and 1 outdoors. Retained stable IDs and original source URLs for 25 rechecked records. Removed six ended November 13–14 listings and withheld TroyBoi: AXS returned HTTP 403 on both original and canonical event URLs; cached search evidence is insufficient for renewing its timestamp.

Organizer pages were fetched directly on November 15 at 13:55:44–13:56:50 UTC, then read for actual date/time, venue and public admission. Each record uses its own successful source-fetch timestamp. Source checks expire after 72 hours, or the listing expires sooner at event start. The last source-age expiry in this batch is November 18 at 13:55:48.616 UTC (8:55 a.m. EST); renew before the earliest remaining source-age expiry at 13:55:45.888 UTC. Today's events expire today at their respective start times; this refresh does not extend them beyond event start.

Sources checked:

- [Trident organizer events](https://tridentbookscafe.com/events), plus all eight retained event-specific pages linked in the catalogue. Dates, times and 338 Newbury Street confirmed. Sci-Fi Bookclub remains $5, with an event-time bookstore/cafe voucher. Trivia is first-come seating, maximum six-person teams; no admission amount stated. Other unspecified prices remain unknown.
- [Somerville Theatre calendar](https://www.somervilletheatre.com/calendar/): six remaining November performances/screenings, exact times and 55 Davis Square confirmed. Ticket links present; prices unknown.
- [Bow Market November organizer newsletter](https://www.bowmarketsomerville.com/email-newsletters/nov2026): Criolla November 15, 1–4 p.m.; Binge Thinking November 17, 7–9 p.m. (21+); Mingle Mayhem November 18, 7–9 p.m. Original newsletter URLs retained. [Criolla organizer ticket page](https://www.eventbrite.com/e/el-dia-de-cancion-criolla-celebration-tickets-2003657142450) separately confirms Upstairs at Bow. $10 is the individual admission including one empanada; a different family ticket exists. No endorsement of the mixer's promotional psychology claims.
- Four event-specific [Berklee Performance Center](https://www.berklee.edu/BPC) pages linked in the catalogue: Journey November 17, hip-hop November 19, Coltrane November 21 and Symphonic Winds November 23, each at 8 p.m. EST, 136 Massachusetts Avenue. Winds explicitly free; other prices unknown.
- [Boston Public Market calendar](https://bostonpublicmarket.org/events/) and individual organizer pages: [coffee tasting](https://bostonpublicmarket.org/bpm-events/coffee-triangulation-with-george-howell-coffee/) November 17 at noon explicitly free (corrected from unknown); [tour](https://bostonpublicmarket.org/bpm-events/boston-public-market-tour/2026-11-20/) November 20 at 11 a.m., free, Info Desk, no registration, capacity may be limited above 20; [maker market](https://bostonpublicmarket.org/bpm-events/holiday-maker-market-at-marzae-cellar-provisions/) November 22, 2–5 p.m., Marzae; price changed from free to unknown because current organizer page does not state admission. Original catalogue source URLs retained.
- [Community brunch organizer ticket page](https://www.eventbrite.com/e/community-thanksgiving-brunch-at-boston-public-market-tickets-2003683787145/) confirms November 22, 11 a.m.–1 p.m., Boston Public Market, $10 admission plus requested shelf-stable food donation. Not free; admission does not imply a ticket remains available.
- New [Fenway stamp-making](https://fenwaycommunitycenter.org/calendar/offline-hours-stamp-making-2/): November 19, 4–6 p.m. EST, materials provided, all ages. New [Fenway community walk](https://fenwaycommunitycenter.org/calendar/community-walk/2026-11-20/): November 20, noon–1 p.m. EST, 1–3 miles, weather cancellation checks required. Both meet at Fenway Community Center, 1282 Boylston St #123, entrance on Jersey St. Neither event page states a fee, so both prices are unknown rather than assumed free.

Only factual titles, time, public venue, source and bounded price data are published; no descriptions/images copied. Existing cards direct members to organizer details for admission, age rules, weather, availability and fees. External listings are not existing member plans, tickets or confirmed attendance.

## Release checks

Use the exact published JSON with the existing editorial CLI, full tests, typecheck, production build and bundle budget. Verify the persisted isolated invitation/RSVP/chat journey and exact Fenway deep link on mobile before release. No migration is required for a catalogue-only change. Hosted CI and the live deployment/revision must pass before reporting release completion. Local evidence is retained separately; no production credentials or member data belong in this document.
