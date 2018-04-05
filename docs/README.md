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

## Usage

Assuming we have the following images on our page:

```html
<img src='foo-image.jpg' class='.img-zoomable' />
<img src='bar-image.jpg' class='.img-zoomable' />
```

There are two ways to make them zoomable:

### Option 1: script tag

```html
<script src="build/zooming.min.js"></script>
<script>
  new Zooming({
    defaultZoomable: '.img-zoomable'
  })
</script>
```

### Option 2: module loader

```javascript
import Zooming from 'zooming'

new Zooming({
  defaultZoomable: '.img-zoomable'
})
```

## What's Next?

Check out [Guide](/guide) and [Configuration](/configuration).