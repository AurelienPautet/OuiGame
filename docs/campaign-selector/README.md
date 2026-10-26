# Campaign browser

The selector uses the shared Oui Tank input, select, button, card, filter chips, and five-star rating. Level and campaign cards reuse the same ListCardPreview frame and ListCardStat badges. Campaign previews use the first public level's thumbnail in campaign order, with a stack fallback when it has no image. Difficulty chips stay visible; progress, minimum rating, and sort controls have explicit labels. Cards show the name, creator, length, description, observed difficulty, level-rating average, and finished-run statistics. Only started campaigns show a progress bar. Owner play/edit/delete actions remain available.

## Discovery rules

- Fetch the complete list for the active mode; search names, creators, and descriptions locally. A server name-only search would discard valid creator/description matches.
- Combine search, difficulty, progress, and minimum rating. Unrated campaigns do not pass a minimum-rating filter.
- Default to newest first. Highest rated breaks ties by rating count, then campaign ID. Unknown difficulty stays last for both easiest-first and hardest-first.
- Filters start fresh when the selector is reopened; changing controls resets list scrolling. No delayed scroll restoration or persisted search hides results.
- Show a retry action on load failure, and a reset action for an empty filtered result.

## Metadata

Difficulty uses the proportion of recorded finished campaign runs that cleared the campaign, with at least ten runs required. Easy: at least 70%; medium: at least 40%; hard: at least 20%; expert: below 20%. Smaller samples are explicitly unknown. The expandable explanation exposes these rules. This is an observed completion measure, not an intrinsic map difficulty or a bot-weight estimate, and repeat runs count individually.

Ratings average existing individual ratings across the campaign's currently public levels. The count is the number of those level ratings, not unique campaign reviewers. The rating indicator explains this in its tooltip. No campaign-review data is invented. Difficulty changes as run data changes; level ratings can change when levels are unpublished.

## Verification

- 109 unit-test files, 693 tests passed.
- 34 campaign API integration tests passed against the isolated test database, including sample-size boundaries, all difficulty thresholds, rating aggregation excluding unpublished levels, and ordered campaign previews excluding unpublished levels.
- Production web build and workspace type checking passed. Web and changed backend/shared files passed lint (existing web warnings remain).
- Automated Chromium checks against the running app and its real local API: creator search, combined expert and 4+ rating filters, empty state and reset, reopening with fresh filters, no horizontal overflow at 390px, no emoji text, and no page errors.

The PNGs in this directory were captured from that real local app/API session. They are anonymous views of existing local campaigns; no responses were mocked or screenshots fabricated.

The local campaigns in these captures have no stored opening-level thumbnail, so the fallback is visible. Preview selection and missing-image handling are covered by the API integration tests.
