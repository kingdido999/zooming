# Zooming [![npm](https://img.shields.io/npm/v/zooming.svg?style=flat-square)](https://www.npmjs.com/package/zooming)

Image zoom that makes sense.

- Pure JavaScript & built with mobile in mind.
- Smooth animations with intuitive gestures.
- Zoom into a hi-res image if supplied.
- Easy to integrate & customizable.

Zooming [2.0.0](https://github.com/kingdido999/zooming/releases/tag/2.0.0) has been released with **two breaking changes**, please read the [Release Notes](https://github.com/kingdido999/zooming/releases/tag/2.0.0) carefully before upgrade.

## Get Started

Try [Demo](https://desmonding.me/zooming/) or play with [codepen](https://codepen.io/kingdido999/pen/rpYrKV).

Please see [Documentation](http://desmonding.me/zooming/docs) for detailed guide.

## Showcase

These projects are using Zooming. Pull requests are welcome!

- [atogatari](https://atogatari.com): share and discover your favorite anime characters.
- [FlowChat](https://flow-chat.com): an open-source, self-hostable, live-updating discussion platform.
- [conference-one](https://github.com/dspachos/conference-one): an one page, Bootstrap 4 template, suitable for academic conferences and events.
- [OctoberCMS Zooming Images plugin](http://octobercms.com/plugin/alexlit-zoomingimages): open source plugin for October CMS.
- [Chalk](https://github.com/nielsenramon/chalk): a high quality, completely customizable, performant and 100% free Jekyll blog theme.

## Caveats / Limitations

- Avoid working with fixed position images [#34](https://github.com/kingdido999/zooming/issues/34).
- Image won't be visible after zoom-in if any parent element has style `overflow: hidden` [#22](https://github.com/kingdido999/zooming/issues/22).

## Contributing

Fork it. Under project folder:

```bash
yarn
yarn start
```

Open up `index.html` in browser.

Make your changes and submit a pull request!

## Test

`yarn test`

## Credit

Inspired by [zoom.js](https://github.com/fat/zoom.js) and [zoomerang](https://github.com/yyx990803/zoomerang). First demo image from [Journey](http://thatgamecompany.com/games/journey/). Second demo image [journey](http://www.pixiv.net/member_illust.php?mode=medium&illust_id=36017129) by [飴村](http://www.pixiv.net/member.php?id=47488).
