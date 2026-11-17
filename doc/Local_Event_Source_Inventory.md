# Local event sources checked November 17, 2026

The search area uses a 100-mile straight-line radius from central Idaho Falls, matching the app's distance calculation. Feeds can include remote or out-of-area events. Coordinates beyond the radius and explicitly distant venue cities are excluded. Missing coordinates require a verified venue match or manual review before publication.

## Connected sources

| Source | Public calendar | Adapter and observed result |
| --- | --- | --- |
| Idaho Falls city Parks & Recreation | https://www.idahofallsidaho.gov/calendar.aspx?CID=26 | Original iCalendar still empty or HTTP 403. Falls back explicitly to the library below. |
| Idaho Falls Public Library | https://www.ifpl.org/events/ | Structured Events Calendar API, paginated. Shown within the existing Idaho Falls feed card with an explanatory note. |
| City of Rexburg | https://www.rexburg.org/events | Public calendar JSON. Existing adapter retained. |
| Museum of Idaho | https://museumofidaho.org/events/ | Structured Events Calendar API. |
| Rexburg Chamber | https://rexburgchamber.org/events/ | Structured Events Calendar API. |
| Teton Valley Welcome Center | https://welcometetonvalley.org/events/ | Structured Events Calendar API, filtered by venue city. |
| Lava Hot Springs Chamber | https://lavahotsprings.org/events/ | Structured Events Calendar API. |
| Idaho State University | https://www.isu.edu/calendar/ | Trumba iCalendar containing individual occurrences. Out-of-area campus locations excluded when identified. |
| Madison Library District | https://www.madisonlib.org/main-calendar/ | Public HTML calendar microdata. Stable occurrence keys avoid duplicate month cells. |

Structured APIs fetch at most three pages, 150 records. The preview explains when this cap applies. Feed downloads have a size limit and timeout, fail independently, and are cached briefly. One-time events with compatible schedules are eligible. Multi-day blocks and unsupported recurring series require manual review. Prices remain unknown unless provided through the existing submission workflow. New feeds generally lack coordinates and will first need a venue match.

## Other calendars investigated

| Source | URL | Finding |
| --- | --- | --- |
| Idaho Falls Arts Council | https://www.idahofallsarts.org/calendar/ | Public HTML event cards, but listing dates omit required start/end times. Needs a detail-page adapter before automatic importing. |
| ARTitorium on Broadway | https://www.artitoriumonbroadway.org/calendar/ | Arts Council calendar ecosystem. Evaluate with the same detail adapter to avoid duplicate listings. |
| Art Museum of Eastern Idaho | https://www.theartmuseum.org/calendar | Public calendar. No compatible feed verified during this pass. |
| Downtown Idaho Falls | https://downtownidahofalls.com/events/ | Public event links and static listings. Needs a separate HTML adapter. |
| Mountain America Center | https://mountainamericacenter.com/ | Tested Events Calendar API returned 404. |
| BYU–Idaho | https://www.byui.edu/calendar | Public calendar page. Compatible feed not verified. |
| Historic Downtown Pocatello | https://www.historicdowntownpocatello.com/events/ | Tested structured endpoint returned 403. |
| Visit Pocatello | https://visitpocatello.com/events/ | Tested structured endpoint returned 404. |
| Pocatello city | https://pocatello.gov/calendar.aspx | Tested iCalendar endpoint returned an empty response. |
| Pocatello Chamber | https://business.pocatelloidaho.com/events/ | Tested iCalendar endpoint returned 403. |
| Blackfoot city | https://www.cityofblackfoot.org/calendar.aspx | Tested iCalendar endpoint returned an empty response. |
| Blackfoot Chamber | https://members.blackfootchamber.org/eventcalendar | Public calendar found. Main site access returned 403; no verified compatible endpoint. |
| Blackfoot Performing Arts Center | https://blackfootpac.com/ | Tested structured endpoint returned 503. |
| Bannock County | https://www.bannockcounty.gov/events/ | Public Events Calendar pages. Tested API returned 403. |
| Southeast Idaho tourism | https://southeastidaho.org/ | Tested structured endpoint returned 503. |
| Valley of the Tetons Library | https://valleyofthetetonslibrary.org/programs-events/ | Calendar exists. Tested Events Calendar endpoint returned 404. Some programs already appear through the Welcome Center feed. |
| Teton Valley Foundation | https://tetonvalleyfoundation.org/ | Tested structured endpoint returned 404. |
| Teton Arts | https://tetonarts.org/ | Tested structured endpoint returned 404. |
| Jackson Center for the Arts | https://www.jhcenterforthearts.org/ | Tested structured endpoint returned 403. |
| Island Park Chamber | https://islandparkchamber.org/events | Public calendar found. Compatible endpoint not verified. |
| Fremont County District Library | https://fremont.lili.org/ | Public community calendar found. Compatible endpoint not verified. |
| Eastern Idaho State Fair | https://funatthefair.com/ | Tested structured endpoint returned 406. |
| Shoshone-Bannock Tribes | https://www.shoshonebannocktribes.com/ | Tested structured endpoint returned 503. |
| Idaho Brewing | https://idahobrewing.com/ | Tested structured endpoint returned 503. |
| Henry's Fork Foundation | https://henrysfork.org/ | Tested structured endpoint returned 403. |
| Eagle Rock Art Guild | https://www.eaglerockartguild.com/ | Tested iCalendar-style URL returned HTML, not a feed. |
| ISU Music, Arts & Letters, SOPA, Stephens Performing Arts | https://www.isu.edu/calendar/ | All four Trumba feeds returned events. The connected ISU master calendar covers these; separate imports would overlap. |

HTTP results are observations, not permanent classifications. The importer reports each source's availability rather than silently substituting another organization's events without attribution.
