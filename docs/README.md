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

Assuming we have the following images on our page and we want to make them zoomable:

```html
<img src='foo-image.jpg' class='.img-zoomable' />
<img src='bar-image.jpg' class='.img-zoomable' />
```

We can load the library via script tag:

```html
<script src="build/zooming.min.js"></script>
```

Or module loader:

```javascript
import Zooming from 'zooming'
```

Then, initialize Zooming instance after DOM content is fully loaded:

```js
document.addEventListener('DOMContentLoaded', function () {
  new Zooming().listen('.img-zoomable')
})
```

## What's Next?

Check out [Guide](/guide) and [Configuration](/configuration).