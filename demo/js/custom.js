var customZooming = new Zooming({
  defaultZoomable: '#img-custom'
})

var config = customZooming.config(),
  TRANSITION_DURATION_DEFAULT = config.transitionDuration,
  TRANSITION_DURATION_SLOW = 1.0,
  TRANSITION_DURATION_FAST = 0.2,
  BG_COLOR_DEFAULT = config.bgColor,
  BG_COLOR_DARK = '#000',
  ENABLE_GRAB_DEFAULT = config.enableGrab,
  SCALE_BASE_DEFAULT = config.scaleBase,
  SCALE_BASE_SMALL = 0.8,
  ACTIVE_CLASS = 'button-primary',
  btnFast = document.getElementById('btn-fast'),
  btnSlow = document.getElementById('btn-slow'),
  btnDark = document.getElementById('btn-dark'),
  btnNoGrab = document.getElementById('btn-no-grab'),
  btnScaleSmall = document.getElementById('btn-scale-small')

function isActive(el) {
  return el.classList.contains(ACTIVE_CLASS)
}

function activate(el) {
  el.classList.add(ACTIVE_CLASS)
}

function deactivate(el) {
  el.classList.remove(ACTIVE_CLASS)
}

function fast() {
  var t
  if (isActive(btnFast)) {
    t = TRANSITION_DURATION_DEFAULT
    deactivate(btnFast)
  } else {
    t = TRANSITION_DURATION_FAST
    activate(btnFast)
    deactivate(btnSlow)
  }

  customZooming.config({ transitionDuration: t })
}

function slow() {
  var t
  if (isActive(btnSlow)) {
    t = TRANSITION_DURATION_DEFAULT
    deactivate(btnSlow)
  } else {
    t = TRANSITION_DURATION_SLOW
    activate(btnSlow)
    deactivate(btnFast)
  }

  customZooming.config({ transitionDuration: t })
}

function dark() {
  var c
  if (isActive(btnDark)) {
    c = BG_COLOR_DEFAULT
    deactivate(btnDark)
  } else {
    c = BG_COLOR_DARK
    activate(btnDark)
  }

  customZooming.config({ bgColor: c })
}

function noGrab() {
  var enable
  if (isActive(btnNoGrab)) {
    enable = ENABLE_GRAB_DEFAULT
    deactivate(btnNoGrab)
  } else {
    enable = !ENABLE_GRAB_DEFAULT
    activate(btnNoGrab)
  }

  customZooming.config({ enableGrab: enable })
}

function scaleSmall() {
  var scaleBase
  if (isActive(btnScaleSmall)) {
    scaleBase = SCALE_BASE_DEFAULT
    deactivate(btnScaleSmall)
  } else {
    scaleBase = SCALE_BASE_SMALL
    activate(btnScaleSmall)
  }

  customZooming.config({ scaleBase: scaleBase })
}

function license() {
  return '<a href="https://opensource.org/licenses/MIT">The MIT License</a>'
}

function copyright() {
  return (
    'Copyright © ' +
    new Date().getFullYear() +
    ' <a href="https://github.com/kingdido999">Desmond Ding</a>' +
    ' and other <a href="https://github.com/kingdido999/zooming/graphs/contributors">contributors</a>'
  )
}

document.getElementById('license').innerHTML = license()
document.getElementById('copyright').innerHTML = copyright()
