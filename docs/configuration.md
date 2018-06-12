# Configuration

There are two types of configuration: [options](configuration?id=options) and [event hooks](configuration?id=event-hooks).

Zooming instance takes an configuration object in the constructor function:

```js
const zooming = new Zooming({
  // ...
})
```

We also provide an API to change options:

```js
const zooming = new Zooming()

zooming.config({
  // ...
})
```

## Options

An option modifies the appearence or the behavior of an instance.

### bgColor

- Type: `String`
- Default: `'rgb(255, 255, 255)'`

Background color of overlay.

### bgOpacity

- Type: `Number`
- Default: `1`

Background opacity of overlay.

### closeOnWindowResize

- Type: `Boolean`
- Default: `true`

Close the zoomed image when browser window is resized.

### customSize

- Type: `Object|String`
- Default: `null`

It defines the absolute image size after we zoom in the image. 
Note this option will ignore [scaleBase](configuration?id=scaleBase) if set.

We could provide an object with `width` and `height` to specify size in pixel:

```js
new Zooming({
  customSize: { width: 800, height: 400 }
})
```

Alternatively, provide a percentage value relative to the original image size:

```js
// Zoom at most to the original image size
new Zooming({
  customSize: '100%'
})

// Zoom at most to the half of the orignal image size
new Zooming({
  customSize: '50%'
})
```

The **original image size** refers to `naturalWidth` and `naturalHeight` obtained from the image `src` attribute (not image source from `data-original`). However, we could override the **original image size** by specifying `data-zooming-width` and `data-zooming-height` on the image.

### enableGrab

- Type: `Boolean`
- Default: `true`

Enable grabbing and dragging the image. Extra zoom-in will be applied.

### preloadImage

- Type: `Boolean`
- Default: `false`

Preload zoomable images. Enabling this option might cause performance issue on a page with lots of images or large image size.

### scaleBase

- Type: `Number`
- Default: `1.0`

The base scale factor for zooming. By default it scales to fit the browser window.

### scaleExtra

- Type: `Number`
- Default: `0.5`

The additional scale factor while grabbing the image.

### scrollThreshold

- Type: `Number`
- Default: `40`

How much scrolling it takes before closing out the instance.

### transitionDuration

- Type: `Number`
- Default: `0.4`

Transition duration in seconds.

### transitionTimingFunction

- Type: `String`
- Default: `cubic-bezier(0.4, 0, 0, 1)`

Transition timing function.

### zIndex

- Type: `Number`
- Default: `998`

The z-index that the overlay will be added with.

## Event Hooks

An event hook takes a callback function, which will be called upon a specific event occurs.

Every callback function will get the target element as the argument, for example:

```js
new Zooming({
  onOpen: function (target) {
    // Now you have the target!
  }
})
```

Events are associated with following actions: `open`, `grab`, `move`, `release` and `close`. 

### onBeforeOpen

- Type: `Function`
- Default: `function () {}`

Occurs before opening the target.

### onOpen

- Type: `Function`
- Default: `function () {}`

Occurs after the target is fully opened.

### onBeforeGrab

- Type: `Function`
- Default: `function () {}`

Occurs before grabbing the target.

### onGrab

- Type: `Function`
- Default: `function () {}`

Occurs after the target is fully grabbed.

### onMove

- Type: `Function`
- Default: `function () {}`

Occurs after the target is fully moved.

### onBeforeRelease

- Type: `Function`
- Default: `function () {}`

Occurs before releasing the target.

### onRelease

- Type: `Function`
- Default: `function () {}`

Occurs after the target is fully released.

### onBeforeClose

- Type: `Function`
- Default: `function () {}`

Occurs before closing the target.

### onClose

- Type: `Function`
- Default: `function () {}`

Occurs after the target is fully closed.

### onImageLoading

- Type: `Function`
- Default: `function () {}`

Occurs when the target hi-res image starts loading. This step happens right after `onBeforeOpen`.

!> Triggers only if hi-res image source is supplied and option `preloadImage` is set to `false`.

### onImageLoaded

- Type: `Function`
- Default: `function () {}`

Occurs when the target hi-res image has been loaded.

!> Triggers only if hi-res image source is supplied and option `preloadImage` is set to `false`.