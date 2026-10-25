# Usage

## Panorama

Pick a place by searching, clicking the map, or using your location. Drag the panorama to turn, scroll to change the field of view, and click a label to see the peak's distance, bearing and elevation. On a phone, the compass button in the header turns the view with the phone. Touch the view to stop. iOS asks for motion access the first time.

Controls in the side panel:

| Control    | Meaning                                                                |
| ---------- | ---------------------------------------------------------------------- |
| Range      | How far the panorama reaches, 5 to 400 km.                             |
| Eye height | Height above the ground, 0 to 3000 m. Raise it on a tower or a summit. |
| Refraction | Coefficient k for atmospheric bending, 0 to 0.25. The default is 0.13. |
| Time       | The moment used for the sun, so shading and haze match a real hour.    |
| Hidden     | Show peaks that are behind terrain as faint ghost labels.              |

The list of visible peaks in the side panel has a search box above it. Type part of a name, in any language the data has, and it searches every visible peak instead of only the 40 that matter most. Click a result to turn toward it and open its card.

## Line of sight

Switch to line of sight, click a second point on the map, and read the chart. The profile includes earth curvature and refraction. The result says whether the two points see each other and, if not, where the ridge that blocks them is.

## Photo mode

1. Switch to photo mode and choose a picture. If it carries GPS and a lens in its EXIF data, the app uses them. Otherwise it asks for the place you stood and assumes a 26 mm equivalent lens.
2. The app traces the skyline in the photo and searches heading, pitch, roll and zoom until it overlaps the skyline of the terrain model.
3. A mean gap of 0.6 degrees or less is reported as Matched. A larger gap is reported as Weak match, and you can still nudge the sliders by hand.
4. Save writes a JPEG with the labels drawn on it.

Alignment works best on photos with a clear skyline and a known place. It can fail in fog, when a foreground object cuts the skyline, or when the place is far from where the photo was taken.

## Share a view

The address holds the view. Copy it to share the same place, direction and moment. See [config.md](config.md) for the keys.
