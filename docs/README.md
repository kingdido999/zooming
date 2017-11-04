# Getting Started

## Installation

```
npm install zooming --save
```

Alternatively:

- [cdnjs](https://cdnjs.com/libraries/zooming)
- [unpkg](https://unpkg.com/zooming)
- [Download source](https://github.com/kingdido999/zooming/releases)

## Usage

### Option 1: Simply include a script

```html
<script src="build/zooming.min.js"></script>
```

### Option 2: Module loader

```javascript
// via Browserify
const Zooming = require('zooming')

// via import statement
import Zooming from 'zooming'
```

At this point, any image with attribute `data-action="zoom"` is zoomable by default, for example:

```html
<img src="img/journey.jpg" data-action="zoom" />
```

## Examples

The source code of [demo](http://desmonding.me/zooming/) page is a  simple demonstration on how to integrate Zooming and personalize it on your web page. Take a look at [index.html](https://github.com/kingdido999/zooming/blob/master/index.html) and [demo/js/custom.js](https://github.com/kingdido999/zooming/blob/master/demo/js/custom.js).

Websites using Zooming:

- [atogatari](https://atogatari.com)

Want to add your demo/website to the list? Simply make a pull request!

## What's Next?

Check out [Advanced Usage](/advanced-usage) and [Configuration](/configuration).