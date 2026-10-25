# Changelog

## 0.3.0

- A compass button for phones. Tap it and the panorama turns with the phone, so you can point at a ridge and read its name. It uses the absolute compass, with the tilt of the phone taken into account, and smooths the readings so the view does not shake. Touching the view or picking a peak hands control back. The button only shows on touch devices, and says so when the device has no compass or access was refused.
- The link in the address bar now updates while you keep turning the view, not only after you stop, so a copied link holds the heading you see.
- The header fits a 360 px wide phone with the new button, by letting the language picker shrink.

## 0.2.0

- The page works offline after one visit. A service worker keeps the page and the terrain tiles you already loaded, so a view you opened on the way up still draws on the summit with no signal. It can also be installed as an app, with proper icons.
- A search box above the list of visible peaks. It finds any visible peak by name, in any language the data has, and ignores case and accents. Before, the list stopped at 40 peaks and could not be searched.
- A summit that the bundled list had twice, such as Kranzberg near the Jungfrau, now shows one label.
- The notice under the place chip says so when the cause is that you are offline, instead of blaming OpenStreetMap.
- Dropped the French Overpass mirror, which now answers only to allow listed sites and made every lookup waste a slot.

## 0.1.2

- The page now opens on the Rigi Kulm looking at the Bernese Alps, the same view as the README, instead of a hazy Tokyo horizon where Mount Fuji was a few pixels tall.
- Peak labels no longer sit under the place chip, the status message or the zoom buttons. They are placed around them, so no name is half hidden at the top of the view.

## 0.1.1

- Fixed missing peak names outside Switzerland. One Overpass mirror only holds Swiss data and answered with an empty list for other places, which was accepted and kept. That mirror is no longer used, an answer with no peaks falls back to the bundled list and is not stored, and the stored answers from 0.1.0 are cleared. The default Tokyo view now labels Mount Fuji.

## 0.1.0

First release.

- A labeled 360 degree panorama from any point on Earth, drawn in the browser from open elevation tiles with earth curvature and refraction.
- Peak names from OpenStreetMap, with a bundled list of about 35,000 notable summits as a fallback when OpenStreetMap is busy.
- A line of sight check between two points, with a terrain profile that includes curvature.
- Photo mode: drop a picture of a skyline and it is matched to the terrain and labeled. EXIF position, heading and focal length are used when present.
- Overpass lookups start a second mirror after 4 seconds and never run more than two at once, to stay polite to the volunteer servers.
- Nine interface languages, light and dark themes, a layout for phones, and shareable links that carry the whole view.
