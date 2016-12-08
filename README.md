# Zooming

Pure JavaScript image zoom that can be customized and invoked programmatically.

- Click to zoom in
- Press on the image for extra zoom-in and try moving around!
- Zoom into a higher resolution image if supplied

[Demo](http://desmonding.me/zooming/)

## Install

Install with your package manager:

`yarn add zooming`

`npm install zooming --save`

`bower install zooming --save`

Then load this module, e.g., via Browserify:

```javascript
var Zooming = require('zooming')
```

Alternatively, download and include a script tag in your page.

## Usage

Any image with attribute `data-action="zoom"` is zoomable by default, for example:

```html
<img src="img/sample.jpg" data-action="zoom" />
```

You can also define zoomable images in JavaScript:

```javascript
Zooming.listen('.selector') // or
Zooming.listen(element)
```

Add `data-original` attribute to supply a hi-res image when zooming in:

```html
<img src="img/thumbnail.jpg" data-action="zoom" data-original="img/original.jpg" />
```

## Development

Install [yarn](https://yarnpkg.com/en/docs/install) if haven't already.

Fork and clone it.

Under project folder:

`yarn`

`yarn watch`

Now open up `index.html` and play around with it!

## Methods

#### `.listen(selector | element)`

Attach click listeners to all matched images.

#### `.open(selector | element [, callback])`

Open (zoom in) the matched image. Fires optional callback when the transition is done.

#### `.close([callback])`

Close (zoom out) if currently zoomed-in.

#### `.grab(x, y [, start] [, callback])`

Grab the current image given a mouse/touch position and apply extra zoom in.

- `x`, `y`: Number. The point where the press happened.
- `start`: Boolean. Indicate whether this is the initial grab (press mouse/finger down) or not.

#### `.release([callback])`

Release the current image.

#### `.config(options)`

Takes an options object. Available options:

| Option                   | Type             | Default                   | Description |
| ---                      | ---              | ----                      | ---         |
| defaultZoomable          | String or Object | 'img[data-action="zoom"]' | Zoomable elements by default. It can be a css selector or an element. |
| enableGrab               | Boolean          | true                      | To be able to grab and drag the image for extra zoom-in. |
| transitionDuration       | String           | '.4s'                     | Transition duration. [More](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-duration) |
| transitionTimingFunction | String           | 'cubic-bezier(.4,0,0,1)'  | Transition timing function. [More](https://developer.mozilla.org/en-US/docs/Web/CSS/single-transition-timing-function) |
| bgColor                  | String           | '#fff'                    | Overlay background color. |
| bgOpacity                | Number           | 1                         | Overlay background capacity. |
| scaleBase                | Number           | 1.0                       | The base scale factor for zooming. By default scale to fit the window. |
| scaleExtra               | Number           | 0.5                       | The extra scale factor when grabbing the image. |
| scrollThreshold          | Number           | 40                        | How much scrolling it takes before closing out. |
| onOpen                   | Function         | null                      | A callback function that will be called when a target is opened and transition has ended. It will get the target element as the argument. |
| onClose                  | Function         | null                      | Same as above, except fired when closed. |
| onGrab                   | Function         | null                      | Same as above, except fired when grabbed. |
| onRelease                | Function         | null                      | Same as above, except fired when released. |
| onBeforeOpen             | Function         | null                      | A callback function that will be called before open. |
| onBeforeClose            | Function         | null                      | A callback function that will be called before close. |
| onBeforeGrab             | Function         | null                      | A callback function that will be called before grab. |
| onBeforeRelease          | Function         | null                      | A callback function that will be called before release. |

## Credit

Inspired by [zoom.js](https://github.com/fat/zoom.js) and [zoomerang](https://github.com/yyx990803/zoomerang).
