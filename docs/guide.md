# Guide

## Zoom into a high resolution image

### Option 1: data attribute

Add `data-original` attribute to the image:

```html
<img src="img/journey_thumbnail.jpg" data-original="img/journey.jpg" />
```

### Option 2: anchor link

Provide an original image link that wraps around the image:

```html
<a href="demo/img/journey.jpg">
  <img src="demo/img/journey_thumbnail.jpg" />
</a>
```

!> Notice that if both are provided, it takes the `data-original` value as hi-res image source. 

For the best result, the hi-res image should have the exact same aspect ratio as your regular image.

## Multiple instances

To create multiple Zooming instances, each with its own [configuration](/configuration):

```js
const zoomingLight = new Zooming({
  bgColor: '#fff'
})

const zoomingDark = new Zooming({
  bgColor: '#000'
})
```

## Specify image width and height

To customize size for all images after zoom-in: see [customSize](/configuration?id=customSize) option.

To set size for a specific image, we can leverage data attributes `data-zooming-width` and `data-zooming-height`. For example:

```html
<img 
  src="image.jpg"
  data-zooming-width="1920" 
  data-zooming-height="1080" 
/>
```

## Open the image in a new tab

Click while holding your meta key (`⌘` or `Ctrl`).

## Working with React

Please see this [example](https://github.com/kingdido999/atogatari/blob/master/client/src/components/ZoomableImage.js).

Notice that it's best to pass in an initialized `zooming` instance as a prop to your component and use that instance to listen to your images within `componentDidMount` method. In this way, we don't create new `zooming` instances everytime the component rerendered.
