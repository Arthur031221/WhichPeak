# Changelog

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
