# Image Zoom

Image zooming with no extra dependency. It supports zooming in with a higher resolution image if supplied.

[Demo](http://desmonding.me/zooming/)

## How to use

1. Include `zooming.js` and `zooming.css` in your page:

  ```html
  <link rel="stylesheet" href="src/zooming.css">
  <script src="src/zooming.js"></script>
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
