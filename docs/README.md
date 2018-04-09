# Getting Started

## Quick start

To experient with Zooming right away, try the following code on [codepen](https://codepen.io/kingdido999/pen/rpYrKV) or save it to local and open with a browser:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      .grid {
        column-count: 2;
        column-gap: 1rem;
      }

      figure {
        display: inline-block;
        margin: 0 0 0 0;
        width: 100%;
      }

      img {
        width: 100%;
        height: auto;
      }
    </style>
  </head>

  <body>
    <div class='grid'>
      <figure><img src='http://via.placeholder.com/600x400' class='img-zoomable' /></figure>
      <figure><img src='http://via.placeholder.com/400x600' class='img-zoomable' /></figure>
      <figure><img src='http://via.placeholder.com/400x600' class='img-zoomable' /></figure>
      <figure><img src='http://via.placeholder.com/600x400' class='img-zoomable' /></figure>
    </div>

    <!-- Load Zooming library -->
    <script src="https://unpkg.com/zooming/build/zooming.min.js"></script>

    <script>
      // Listen to images after DOM content is fully loaded
      document.addEventListener('DOMContentLoaded', function () {
        new Zooming({
          // options...
        }).listen('.img-zoomable')
      })
    </script>
  </body>
</html>
```

## Installation

```
yarn add zooming
```

Or:

```
npm install zooming --save
```

## Usage

The first thing is to import the library:

### Option 1: Script tag

```html
<script src="node_modules/zooming/build/zooming.min.js"></script>
```

### Option 2: Module loader

```javascript
import Zooming from 'zooming'
```

Next, initialize Zooming instance after DOM content is fully loaded:

```js
document.addEventListener('DOMContentLoaded', function () {
  const zooming = new Zooming({
    // options...
  })

  zooming.listen('.img-zoomable')
})
```

Now the target images are zoomable!

!> Starting from Zooming **2.0**, we no longer listen to images with data attribute `data-action="zoom"` by default. Please make sure to call `.listen()` on target images after Zooming instance is created.

## What's Next?

Check out [Guide](/guide) and [Configuration](/configuration).