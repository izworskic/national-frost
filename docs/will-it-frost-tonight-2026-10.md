# Will it frost tonight? (cover-plants-tonight), October 25, 2026

**Page:** `/national-tools/frost/cover-plants-tonight/` (URL and canonical unchanged) · **Tests:** `tests/frost-tonight.test.js`

## Why

Step 3 of the national garden plan. Autocomplete for "frost tonight" and "will it frost tonight" (a demand proxy, not search volume) is almost entirely live and local: "in my area", "near me", "at my location", "hourly", "tomorrow". The page answered only "should I cover my plants", from the hourly temperature alone. It now answers the question people type first, then keeps the cover decision.

## What it does

- **Answer for tonight**, plus the next two nights: hard freeze, freeze, frost likely, frost possible, frost unlikely, frost only in low spots, or no frost, with the low and the hour it comes.
- **Official alerts first:** any active NWS Frost Advisory, Freeze Watch, Freeze Warning or Hard Freeze product for the point heads the answer, because criteria vary by NWS office and the office's call outranks this page's reading.
- **Hourly chart** for the next 42 hours: temperature, dew point, night shading, the 33 to 36°F frost band and the 32°F line.
- **Cover decision kept:** the existing `GardenFrostCover.decide()` and its tests, now fed the same NWS hours.

## Rules and sources

- NWS Charleston, WV: Frost Advisory for lows of 33 to 36°F with good radiational cooling (light winds and clear skies); Freeze Warning for 29 to 32°F; hard freeze at 28°F or below. NWS Tallahassee: frost can form while the measured air (5 ft) is slightly above freezing.
- This page's own reading of "clear" and "light wind" (stated on the page and in the engine): average sky cover 30% or less and wind 5 mph or less across the coldest hours (within 2°F of the low). Lows of 33 to 36°F with both are "frost likely", with one "possible", with neither "unlikely". Lows of 37 to 39°F on clear, calm nights are "low spots only".
- Data: `api.weather.gov` points, forecast grid (temperature, dew point, sky cover, wind speed) and active alerts, all read in the browser.

## Hosting

The page no longer calls `/api/national-frost` (a Vercel function); it reads NWS directly, so each visit uses one fewer function invocation. The function itself is unchanged and still serves the main frost page.

## Michigan

National copy (title, description, lede) does not mention Michigan (tested). Michigan places get a line pointing to `/michigan-frost-dates/`.

## Checked

Real NWS forecasts on October 25 for Bay City MI, Elko NV, Wichita KS and Ukiah CA parsed correctly (Elko: hard freeze tonight at 26°F with clear, calm conditions; Ukiah: an active Frost Advisory). Local Chromium at 390 and 1280 px with stubbed NWS responses: no script errors, no sideways scroll, no `/api/` calls.
