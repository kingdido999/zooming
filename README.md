# Zooming

Image zoom that makes sense. [Demo](http://desmonding.me/zooming/)

- Pure JavaScript & built with mobile in mind.
- Smooth animations with intuitive gestures.
- Zoom into a hi-res image if supplied.
- Easy to integrate & customizable.

## Get started

This library is available through:

- [cdnjs](https://cdnjs.com/libraries/zooming)
- Package manager:
  - `yarn add zooming`
  - `npm install zooming --save`
  - `bower install zooming --save`
- [Download source](https://github.com/kingdido999/zooming/releases)

To integrate with your web app:

#### Option 1. Simply include a script

```html
<script src="build/zooming.min.js"></script>
```

#### Option 2. Module loader

```javascript
// via Browserify
var Zooming = require('zooming')

// via ES6 syntax
import Zooming from 'zooming'
```

At this point, any image with attribute `data-action="zoom"` is zoomable by default, for example:

```html
<img src="img/journey.jpg" data-action="zoom" />
```

You can also define zoomable images in JavaScript:

```javascript
// by a css selector
Zooming.listen('.img-zoomable')

// by an Element
var img = document.getElementByID('img-zoomable')
Zooming.listen(img)
```

Add `data-original` attribute to supply a hi-res image when zooming in:

```html
<img src="img/journey_thumbnail.jpg" data-action="zoom" data-original="img/journey.jpg" />
```

## [Documentation](http://desmonding.me/zooming/docs/index.html)

## Development

Install [yarn](https://yarnpkg.com/en/docs/install) if haven't already.

Fork and clone it. Under project folder:

`yarn`

`yarn watch`

Open up `index.html` and play around with it!

## Test

Open up `test.html` for browser testing (keep your cursor away from the browser window).

## Credit

Inspired by [zoom.js](https://github.com/fat/zoom.js) and [zoomerang](https://github.com/yyx990803/zoomerang). First demo image from [Journey](http://thatgamecompany.com/games/journey/). Second demo image [journey](http://www.pixiv.net/member_illust.php?mode=medium&illust_id=36017129) by [飴村](http://www.pixiv.net/member.php?id=47488).
