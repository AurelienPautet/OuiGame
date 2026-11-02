# Campaign browser

The selector uses the shared Oui Tank input, button, card, filter chips, and five-star rating. Level and campaign cards reuse the same ListCardPreview frame and ListCardStat badges. Campaign previews use the first public level's thumbnail in campaign order, with a stack fallback when it has no image. Browsing is search plus difficulty chips only: there is no status, rating, or sort control, and no result count line. Cards show the name, creator, length, description, observed difficulty, level-rating average, and finished-run statistics. Only started campaigns show a progress bar. Owner play/edit/delete actions remain available.

## Discovery rules

- Fetch the complete list for the active mode; search names, creators, and descriptions locally. A server name-only search would discard valid creator/description matches.
- Combine search and difficulty. Progress and rating never hide a campaign, so unrated campaigns stay visible.
- Always newest first, ordered by campaign ID descending. There is no user-selectable sort.
- Filters start fresh when the selector is reopened; changing controls resets list scrolling. No delayed scroll restoration or persisted search hides results.
- Show a retry action on load failure, and a reset action for an empty filtered result.

## Metadata

Difficulty uses the proportion of recorded finished campaign runs that cleared the campaign, with at least ten runs required. Easy: at least 70%; medium: at least 40%; hard: at least 20%; expert: below 20%. Smaller samples are explicitly unknown. The difficulty badge tooltip on each card exposes these rules. This is an observed completion measure, not an intrinsic map difficulty or a bot-weight estimate, and repeat runs count individually.

Ratings average existing individual ratings across the campaign's currently public levels. The count is the number of those level ratings, not unique campaign reviewers. The rating indicator explains this in its tooltip. No campaign-review data is invented. Difficulty changes as run data changes; level ratings can change when levels are unpublished.

## Verification

- PR CI: unit tests (web + shared), backend tests, typecheck, client build, and lint all passed.
- Chromium checks against the running web client and the live campaign API: search, the Expert difficulty chip, and the empty state with its reset action. The status/rating/sort controls and the result-count line are gone, and the dialog does not overflow at 390px.
- The selector unit tests assert that only the search field and difficulty chips remain, that campaigns list newest first, and that search and difficulty still combine and reset.

The PNGs in this directory were captured from that session. They are anonymous views of public campaigns; no responses were mocked or screenshots fabricated.
