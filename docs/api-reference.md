# API Reference

## listen

Make element(s) zoomable. The argument can either be a css selector or an Element.

```js
const zooming = new Zooming()

// By a css selector
zooming.listen('.img-zoomable')

// By an Element
const img = document.getElementById('avatar')
zooming.listen(img)
```

## config

Update options or return current options if no argument is provided. See [Configuration](/configuration) for more details.

```js
const zooming = new Zooming()

zooming.config({
  // ...
})
```

## open

Open (zoom in) the Element.

```js
const zooming = new Zooming()
const img = document.getElementById('avatar')

zooming.open(img, function onOpen(target) {
  // When the target is fully opened...
})
```

## grab

Grab the Element currently opened given a position and apply extra zoom-in.

```js
const zooming = new Zooming()
const [x, y] = [400, 600]
const scaleExtra = 0.5

zooming.grab(x, y, scaleExtra, function onGrab(target) {
  // When the target is fully grabbed...
})
```

## move

Move the Element currently grabbed given a position and apply extra zoom-in.

```js
const zooming = new Zooming()
const [x, y] = [400, 600]
const scaleExtra = 0.5

zooming.move(x, y, scaleExtra, function onMove(target) {
  // When the target is fully moved...
})
```

## release

Release the Element currently grabbed.

```js
const zooming = new Zooming()

zooming.release(function onRlease(target) {
  // When the target is fully released...
})
```

## close

Close (zoomout) the Element currently opened.

```js
const zooming = new Zooming()

zooming.close(function onClose(target) {
  // When the target is fully closed...
})
```