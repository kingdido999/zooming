# Zooming [![npm](https://img.shields.io/npm/v/zooming.svg?style=flat-square)](https://www.npmjs.com/package/zooming) [![npm bundle size](https://img.shields.io/bundlephobia/minzip/zooming.svg?style=flat-square)](https://bundlephobia.com/result?p=zooming)

Image zoom that makes sense.

- Pure JavaScript & built with mobile in mind.
- Smooth animations with intuitive gestures.
- Zoom into a hi-res image if supplied.
- Easy to integrate & customizable.

## Get Started

Try [Demo](https://desmonding.me/zooming/) or play with [codepen](https://codepen.io/kingdido999/pen/rpYrKV).

Please see [Documentation](https://desmonding.me/zooming/docs) for detailed guide.

## Showcase

These projects are using Zooming. Pull requests are welcome!

- [Atogatari](https://atogatari.desmonding.me): Share and discover your favorite anime characters.
- [beta](https://github.com/sunya9/beta): pnut.io web client.
- [bluedoc](https://github.com/thebluedoc/bluedoc): an open-source document management tool for enterprise self host.
- [Chalk](https://github.com/nielsenramon/chalk): a high quality, completely customizable, performant and 100% free Jekyll blog theme.
- [Drupal Zooming](https://www.drupal.org/project/zooming): integrate Zooming to Drupal.
- [imagediff](https://github.com/Showmax/imagediff): tool for automated UI testing and catching visual regressions.
- [OctoberCMS Zooming Images plugin](https://github.com/alex-lit/OctoberCMS-Zooming-Images-Plugin): open source plugin for October CMS.
- [pubdomordie.club](https://github.com/jckfa/pubdomordie.club): curated public domain images.
- [vuepress-plugin-zooming](https://github.com/vuepress/vuepress-plugin-zooming): make images zoomable in VuePress. 

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
