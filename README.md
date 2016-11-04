# Zooming

Image zoom with pure JavaScript. No extra dependency. Supports zooming with a higher resolution image if supplied.

[Demo](http://desmonding.me/zooming/)

## Install

npm:

`npm install zooming --save`

bower:

`bower install zooming --save`

## Usage

1. Include `zooming.js` in your page:

  ```html
  <script src="dist/zooming.js"></script>
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
