# Getting Started

## Installation

```
yarn add zooming

# or
npm install zooming --save
```

Alternatively:

- [cdnjs](https://cdnjs.com/libraries/zooming)
- [unpkg](https://unpkg.com/zooming)
- [Download source](https://github.com/kingdido999/zooming/releases)

## Example usage

To make the following images zoomable:

```html
<img src='foo-image.jpg' class='.img-zoomable' />
<img src='bar-image.jpg' class='.img-zoomable' />
```

First, we need to load the library:

### Option 1: Script tag

```html
<script src="build/zooming.min.js"></script>
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

!> Starting from Zooming **2.0**, we no longer listen to images with data attribute `data-action="zoom"` by default. Please make sure to call `.listen()` on target images after Zooming instance is created.

## What's Next?

Check out [Guide](/guide) and [Configuration](/configuration).