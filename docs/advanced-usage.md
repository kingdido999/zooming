# Advanced Usage

## Zoom into a high resolution image

### Option 1

Add `data-original` attribute to the image:

```html
<img src="img/journey_thumbnail.jpg" data-action="zoom" data-original="img/journey.jpg" />
```

### Option 2

Provide an original image link that wraps around the image:

```html
<a href="demo/img/journey.jpg">
  <img src="demo/img/journey_thumbnail.jpg" data-action="zoom" />
</a>
```

!> Notice that if both are provided, it takes the `data-original` value as hi-res image source. 

For the best result, the hi-res image should have the exact same aspect ratio as your regular image.

## Define zoomable images

We can make images zoomable programmatically:

```js
const zooming = new Zooming()

// By a css selector
zooming.listen('.img-zoomable')

// By an Element
const img = document.getElementById('img-zoomable')
zooming.listen(img)
```

## Multiple instances

To create multiple Zooming instances, each with its own configuration:

```js
const zoomingLight = new Zooming({
  bgColor: '#fff'
})

const zoomingDark = new Zooming({
  bgColor: '#000'
})

// We can always change options later
zoomingLight.config({
  // ...
})
```