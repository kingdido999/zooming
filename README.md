# Image Zoom

Image zooming with pure JavaScript. No dependencies needed. [Demo](http://desmonding.me/image-zoom/)

## How to use

1. Include `image-zoom.js` and `image-zoom.css` in your page:

  ```html
  <link rel="stylesheet" href="src/image-zoom.css">
  <script src="src/image-zoom.js"></script>
  ```

2. Add `data-action="zoom"` attribute to an image to make it zoomable:

  ```html
  <img src="img/sample.jpg" data-action="zoom" />
  ```

3. Add `data-original` attribute to supply a higher resolution image when zooming in:

  ```html
  <img src="img/thumbnail.jpg" data-action="zoom" data-original="img/original.jpg" />
  ```

## Credit

Inspired by [zoom.js](https://github.com/fat/zoom.js).
