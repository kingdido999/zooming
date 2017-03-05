# Zooming [![CDNJS](https://img.shields.io/cdnjs/v/zooming.svg?style=flat-square)](https://cdnjs.com/libraries/zooming) [![npm](https://img.shields.io/npm/v/zooming.svg?style=flat-square)](https://www.npmjs.com/package/zooming)

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

// via import statement
import Zooming from 'zooming'
```

At this point, any image with attribute `data-action="zoom"` is zoomable by default, for example:

```html
<img src="img/journey.jpg" data-action="zoom" />
```

## Example

The source code of [demo](http://desmonding.me/zooming/) page is a  simple demonstration on how to integrate Zooming and personalize it on your web page. Take a look at [index.html](https://github.com/kingdido999/zooming/blob/master/index.html) and [demo/js/custom.js](https://github.com/kingdido999/zooming/blob/master/demo/js/custom.js).

## Advanced

#### Zoom into a high resolution image

Option 1: Add `data-original` attribute to the image:

```html
<img src="img/journey_thumbnail.jpg" data-action="zoom" data-original="img/journey.jpg" />
```

Option 2: Provide an original image link that wraps around the image:

```html
<a href="demo/img/journey.jpg">
  <img src="demo/img/journey_thumbnail.jpg" data-action="zoom" />
</a>
```

Notice that if both are provided, it takes the `data-original` value as hi-res image source.

#### Multiple instances

You can create multiple Zooming instances, each with its own configuration:

```js
const zoomingLight = new Zooming({
  bgColor: '#fff'
})

const zoomingDark = new Zooming({
  bgColor: '#000'
})

// you can change options later
zoomingLight.config({
  // ...
})
```

#### Define zoomable image(s) programmatically

```js
// by a css selector
zooming.listen('.img-zoomable')

// by an Element
var img = document.getElementById('img-zoomable')
zooming.listen(img)
```

**For all supported APIs and options, see [Documentation](http://desmonding.me/zooming/docs/index.html).**

## Development

Install [yarn](https://yarnpkg.com/en/docs/install) if haven't already. Fork and clone it. Under project folder:

`yarn && yarn watch`

## Test

`yarn test`

## Credit

Inspired by [zoom.js](https://github.com/fat/zoom.js) and [zoomerang](https://github.com/yyx990803/zoomerang). First demo image from [Journey](http://thatgamecompany.com/games/journey/). Second demo image [journey](http://www.pixiv.net/member_illust.php?mode=medium&illust_id=36017129) by [飴村](http://www.pixiv.net/member.php?id=47488).
