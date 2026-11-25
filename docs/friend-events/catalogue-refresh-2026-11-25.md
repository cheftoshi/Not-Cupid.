# Boston Friend catalogue refresh — November 25, 2026

Data-only refresh from verified production `d93e6a86a1208cc72f26ceb021d6142be6b647ee`. Preserves PR30 plan-link behavior, PR31 and earlier signup fixes. PR18 is untouched. No application, dependency, schema or campaign changes.

## Inventory and review

25 stored before refresh; 18 still eligible and seven ended. Rechecked all 18 originals, removed the seven ended November 23–24 records, and added 11: **29 listings**, November 25–December 8. Categories: arts 8, community 9, outdoors 5, music 3, sports 1 (yoga), food 3. Community meals are also represented under community. No minimum count was forced; no catalogue cap or service area changed.

Each included source was freshly retrieved and manually reviewed. The source evidence directory retains HTTP status, exact retrieval time and content hash. Draft/review/publish digests bind the exact facts; each expires at event start or 72 hours after its source check, whichever comes first. Original factual copy only; no imported images or bulk event feeds.

## Retained records and limitations

All 18 dates, venues and access descriptions remain supported by current organizer pages. Wompatuck remains scheduled November 27, 10 a.m.–noon, with 10:15 departure at the visitor-center lot, 204 Union Street, Hingham. Its title now explicitly asks people to check organizer weather updates. NWS forecast retrieved November 25 calls for Friday rain likely (70%), south winds 12–18 mph and gusts to 36 mph, following heavy overnight rain. This is a weather watch, not an organizer cancellation. Recheck on the next integrity pass; no route-accessibility or safe-weather guarantee.

Dialogue Dinner's exact organizer form still accepts registration details without a closed/waitlist notice; no submission or seat guarantee. Brighton lunch walk still publicly shows 11/12 spots, a changing snapshot, not guaranteed capacity. London Elektricity and Hong Kong Night ticket metadata show scheduled/in-stock offers; final checkout was not performed. Other Meetup capacity remains unknown. Craft Club's November 25 seasonal centerpiece is explicitly listed; recurring offer metadata is not a verified session-specific price. Trident's November 25 event still lists 6–8 p.m., doors 5:30, purchases separate; JavaScript registration capacity unverified. Malden's free public meal remains noon–2 p.m. November 26 with no reservation needed; closed delivery/volunteer programs are not promoted. Long Now ticket tier eligibility/final fees remain unknown. Retained source URLs appear below.

## Added event decisions

- Dewitt supper, December 3, 6–7:30 p.m., 122 Dewitt Drive: organizer and linked Eventbrite agree; live music and meal, doors 5:45. Organizer describes a $4 suggested contribution and access regardless of ability to pay; metadata shows a zero-price in-stock offer. Use unknown structured price plus the explicit suggested-contribution title, not a required charge or unconditional free claim. Reservation required; no checkout or reservation made. Omit disputed ZIP.
- Market tour, December 4 at 11 a.m.: exact dated organizer page; free, no registration, approximately 20–30 minutes, meet Info Desk. Capacity may be limited above 20 people; samples are not lunch or guaranteed entry.
- Market trivia, December 4, 6–8 p.m.: organizer ticket page confirms rounds at 6 and 7, optional RSVP and first-come seating. Free in-stock offer metadata; food/drinks separate. One record, not separate rounds.
- Cambridge knitting, December 8, 2:30–3:30 p.m.: exact library page, bring own project, drop-in at 449 Broadway.
- Boston Common lighting, December 3, 6–8 p.m.: City page confirms free public outdoor event at 139 Tremont. No performer, visibility, weather or reserved-space promise.
- Fenway slow-flow yoga, November 30, 12:30–1:30 p.m.: exact organizer occurrence, walk-ins welcome, mats included, floor exercises. Linked Eventbrite defaults to an older occurrence, so its price/availability is not assigned to this date; structured price remains unknown.
- Fenway book discussion, December 3, 5:30–7 p.m.: exact page confirms Hidden History of Boston by Dina Vargo. No claim that books or food are included.
- Fenway walk, December 4, noon–1 p.m.: exact page, 1–3 miles, organizer weather-cancellation guidance. No accessibility or weather guarantee.
- Fenway bingo, December 4, 12:30–2:30 p.m.: exact page, all ages. Unknown fee/capacity; no prizes promised in our copy. All four Fenway activities use 1282 Boylston #123, entrance on Jersey Street.
- Roslindale chess, December 5, 10–11:30 a.m.: canonical BPL page confirms all ages/adults, 4246 Washington Street, instruction and play. No registration shown; public library program, no reserved seat.
- Waltham Mill Talk, December 2, 7–8 p.m.: dated museum page and linked Eventbrite agree, 154 Moody Street; free/public, registration required, doors 6:30. Event-specific zero-price in-stock metadata checked; no registration submitted.

## Excluded or deferred

Aeronaut remains withheld: direct venue pages return 403 and date-specific holiday operation is unresolved. Rinse & Repeat's earlier date conflict remains unresolved; canceled Excavations and private/full potlucks are not recycled. Gamelan and telescope direct pages return 404 despite indexed web text; do not treat the indexed copy as a fresh clearance. Drone source returned 403 directly and a generic shell through web retrieval. Norwell exhibition details were verified but existing geographic eligibility was not established, so no service-area expansion. Parker badminton offers season membership and one-day-ahead drop-in access, with no cleared date-specific inventory; youth-only sports and BPL after-school games are not adult replacements. December 14/18/19 reserves are deferred. No reserve delays this release.

## Verification scope

Run full local ci:check and public mobile suite on the current production dependencies, isolated persisted synthetic API/privacy checks, and Chromium/WebKit via the actual /friends discovery entry, then exact PR/main hosted checks and production alias verification. Unknown production signed-in display and physical Safari remain explicit gaps unless separately observed. No provider sends, real-member interactions, RSVP, booking or outreach. Docker was initially stopped; only existing loopback staging is used and task-owned services will be stopped afterward.

## Exact selected sources

| Event | Boston start | Original source |
|---|---|---|
| Craft Club: Seasonal Centerpiece | 2026-11-25T18:00:00-05:00 | [Boston Public Market / Eventbrite](https://www.eventbrite.com/e/craft-club-at-boston-public-market-tickets-2003682568500) |
| FRIENDSgiving | 2026-11-25T18:00:00-05:00 | [Trident Booksellers & Cafe](https://tridentbookscafe.com/event/2026-11-25/friendsgiving) |
| Community Thanksgiving meal — all welcome | 2026-11-26T12:00:00-05:00 | [Bread of Life / Malden Mayor’s Office](https://www.breadoflifemalden.org/events/2023/10/25/h73ce3y5o4pdbfy3ekw1uiadpkssqa-xlx2f) |
| Black Friday Wompatuck Walk (alcohol-free; check organizer weather updates) | 2026-11-27T10:00:00-05:00 | [Sober & Curious Boston / Meetup](https://www.meetup.com/sober-curious-circle-boston-south-shore/events/316976197/) |
| Synapse Dance Night (18+, door tickets only) | 2026-11-27T22:00:00-05:00 | [The Middle East](https://www.mideastclub.com/tm-event/synapse-11/) |
| Manufacturing history tour (tour free; museum admission separate) | 2026-11-28T11:00:00-05:00 | [Charles River Museum](https://www.charlesrivermuseum.org/events-list/2025/2/8/manufacturingthemodernworld-tejdr-j5f44-fpnf8-5ttcg-xdb85-fyk3l-ys9n3-726nw) |
| Boston Women's Holiday Market at the Armory | 2026-11-29T11:00:00-05:00 | [Boston Women's Market](https://www.bostonwomensmarket.com/events-calendar/boston-womens-holiday-market-at-the-armory-nov29) |
| Co-Op Board Games at Roots & Roasts | 2026-11-29T12:00:00-05:00 | [Quincy Board Game Group / Meetup](https://www.meetup.com/quincy-board-game-group/events/316845808/) |
| We Are As Gods: film and discussion (registration required) | 2026-11-29T15:00:00-05:00 | [Long Now Boston](https://www.longnowboston.org/events/we-are-as-gods-2026) |
| Slow Flow Yoga (walk-ins welcome; mats provided) | 2026-11-30T12:30:00-05:00 | [Fenway Community Center](https://fenwaycommunitycenter.org/calendar/slow-flow-yoga-11/2026-11-30/) |
| Copley Square reopening and tree lighting | 2026-11-30T17:00:00-05:00 | [Boston Parks and Recreation](https://www.boston.gov/calendar/2026-copley-square-tree-lighting) |
| Dialogue Dinner (free; organizer registration required) | 2026-12-01T18:00:00-05:00 | [History Cambridge](https://historycambridge.org/events/dec-1-dinner-valente/) |
| Arlington 30s/40s lunch and optional walk (food separate) | 2026-12-02T12:30:00-05:00 | [Arlington 30- and 40-somethings / Meetup](https://www.meetup.com/arlington-30-somethings-meetup/events/317473121/) |
| Mill Talk: The Disposable Workforce (free; registration required) | 2026-12-02T19:00:00-05:00 | [Charles River Museum](https://www.charlesrivermuseum.org/events-list/2026/8/31/mill-talk-the-disposable-workforce-why-how-much-and-consequences-for-workers-and-for-employers) |
| Café and nature walk: lunch session (RSVP; purchases separate) | 2026-12-03T12:00:00-05:00 | [Allston-Brighton Food Tours / Partiful](https://partiful.com/e/TbtDCDRNEh8PVgwvCFUc?source=discover) |
| Adult Puzzle Party: shared jigsaw and conversation | 2026-12-03T14:30:00-05:00 | [Cambridge Public Library](https://www.cambridgema.gov/departments/housingdepartment/calendar/view?guid=c477ec5cedf44c41974c1064d1a3783d) |
| Boston Baked Books: Hidden History of Boston discussion | 2026-12-03T17:30:00-05:00 | [Fenway Community Center](https://fenwaycommunitycenter.org/calendar/boston-baked-books-hidden-history-of-boston/) |
| Boston Common Tree Lighting (free outdoor gathering) | 2026-12-03T18:00:00-05:00 | [City of Boston](https://www.boston.gov/calendar/boston-common-tree-lighting) |
| First Thursdays Supper Club (reserve; $4 suggested contribution) | 2026-12-03T18:00:00-05:00 | [Madison Park Development Corporation / Eventbrite](https://www.eventbrite.com/e/december-supper-club-at-dewitt-center-tickets-2004830256265) |
| London Elektricity + Agent 137: drum & bass night (19+) | 2026-12-03T22:00:00-05:00 | [elements / Eventbrite](https://www.eventbrite.com/e/london-elektricity-fast-soul-music-uk-agent-137-driven-am-nyc-tickets-2004940939321) |
| Boston Public Market tour (free; limited capacity) | 2026-12-04T11:00:00-05:00 | [Boston Public Market](https://bostonpublicmarket.org/bpm-events/boston-public-market-tour/2026-12-04/) |
| Fenway community walk (check organizer weather updates) | 2026-12-04T12:00:00-05:00 | [Fenway Community Center](https://fenwaycommunitycenter.org/calendar/community-walk/2026-12-04/) |
| Community Bingo (all ages) | 2026-12-04T12:30:00-05:00 | [Fenway Community Center](https://fenwaycommunitycenter.org/calendar/bingo-16/2026-12-04/) |
| Holiday Movie Trivia (first-come seating; purchases separate) | 2026-12-04T18:00:00-05:00 | [Boston Public Market / Eventbrite](https://www.eventbrite.com/e/holiday-movie-trivia-at-boston-public-market-tickets-2003739058463) |
| Siren x LaBoum: queer dance night (21+, $5 door) | 2026-12-04T21:00:00-05:00 | [Siren / Partiful](https://partiful.com/e/8Glun2PCKbYVblQuOdsO) |
| Chess Club: learn and play (all ages) | 2026-12-05T10:00:00-05:00 | [Boston Public Library](https://bpl.bibliocommons.com/v2/events/6a207db24407827f8aa26709) |
| Hong Kong Night: crafts, games and community market (register) | 2026-12-05T18:30:00-05:00 | [New England Hong Kong Festival / Eventbrite](https://www.eventbrite.com/e/hong-kong-night-tickets-2004692228420) |
| Making Connections at Novo (Meetup check-in; food separate) | 2026-12-05T19:00:00-05:00 | [Boston Random Acts of Connection / Meetup](https://www.meetup.com/boston-random-acts-of-connection/events/316641224/) |
| Sit 'n' Knit: bring your fiber project | 2026-12-08T14:30:00-05:00 | [Cambridge Public Library](https://www.cambridgema.gov/departments/cambridgepubliclibrary/calendar/2026/12/08/sitnknitmain) |

## Completed local validation

`npm run ci:check` passed: typecheck, **479 unit tests**, production build and bundle budgets. Public HTTPS mobile suite: **68 passed**. Persisted isolated API flow: **16 passed**, including source provenance, idempotency, RSVP, participant-only venue/chat and withdrawal revocation. Chromium and WebKit both passed `/friends` discovery, all 29 cards, exact source link, event deep link and opening invitation review; no page errors or 320px/200%-text overflow. Screenshot reviewed. Audit: zero high/critical and three existing moderate findings. No dependency changes.

Earliest event-start expiry: November 25 at 6 p.m. Boston. Earliest source-age deadline: **November 28 at 8:18:23.280 a.m. Boston**. Next full refresh should be November 27, with daily imminent-event/weather checks. Hosted PR/main CI and final production identity are tracked in the release artifact, not assumed from local results.
