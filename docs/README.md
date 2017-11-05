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

#### Option 1: Simply include a script

```html
<script src="build/zooming.min.js"></script>
```

#### Option 2: Module loader

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

## What's Next?

Check out [Guide](/guide) and [Configuration](/configuration).