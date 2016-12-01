# Zooming

Image zoom with pure JavaScript. No extra dependency. Supports zooming with a higher resolution image if supplied. It can be customized and invoked programmatically.

[Demo](http://desmonding.me/zooming/)

## Install

Download and include a script tag in your page, or install with your package manager (Bower/npm):

`npm install zooming --save`

`bower install zooming --save`

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

Add `data-original` attribute to supply a higher resolution image when zooming in:

```html
<img src="img/thumbnail.jpg" data-action="zoom" data-original="img/original.jpg" />
```

## APIs

### Zooming.listen(selector | element)

Attach click listeners to all matched elements. You can also directly pass in a single node to this method.

### Zooming.open(selector | element, [callback])

Zoom in on the matched element. Fires optional callback when the transition is done.

### Zooming.close([callback])

Zoom out if currently zoomed-in. Fires optional callback when the transition is done.

### Zooming.config(options)

Takes an options object. Available options:

  - `transitionDuration` - default: `'.4s'`
  - `transitionTimingFunction` - default: `'cubic-bezier(.4,0,0,1)'`
  - `bgColor` - default: `'#fff'`
  - `bgOpacity` - default: `1`
  - `scaleBase` - the base scale factor for zooming. default: `1.0` (scale to fit the window)
  - `scrollThreshold` - how much scrolling it takes before closing out. default: `40`
  - `onOpen` - a callback function that will be called when a target is zoomed in and transition has ended. It will get the target element as the argument.
  - `onClose` - same as `onOpen`, except fired when zoomed out.
  - `onBeforeOpen` - a callback function, that will be called before zoom-in.
  - `onBeforeClose` - a callback function, that will be called before zoom-out.

## Credit

Inspired by [zoom.js](https://github.com/fat/zoom.js) and [zoomerang](https://github.com/yyx990803/zoomerang).
