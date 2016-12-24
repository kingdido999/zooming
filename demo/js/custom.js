var config = Zooming.config(),
    TRANSITION_DURATION_DEFAULT = config.transitionDuration,
    TRANSITION_DURATION_SLOW    = 1.0,
    TRANSITION_DURATION_FAST    = 0.2,
    BG_COLOR_DEFAULT            = config.bgColor,
    BG_COLOR_DARK               = '#000',
    ENABLE_GRAB_DEFAULT         = config.enableGrab,
    ACTIVE_CLASS                = 'button-primary',

    btnFast = document.getElementById('btn-fast'),
    btnSlow = document.getElementById('btn-slow'),
    btnDark = document.getElementById('btn-dark'),
    btnNoGrab = document.getElementById('btn-no-grab')

function isActive (el) {
  return el.classList.contains(ACTIVE_CLASS)
}

function activate (el) {
  el.classList.add(ACTIVE_CLASS)
}

function deactivate (el) {
  el.classList.remove(ACTIVE_CLASS)
}

function fast () {
  var t
  if (isActive(btnFast)) {
    t = TRANSITION_DURATION_DEFAULT
    deactivate(btnFast)
  } else {
    t = TRANSITION_DURATION_FAST
    activate(btnFast)
    deactivate(btnSlow)
  }

  Zooming.config({ transitionDuration: t })
}

function slow () {
  var t
  if (isActive(btnSlow)) {
    t = TRANSITION_DURATION_DEFAULT
    deactivate(btnSlow)
  } else {
    t = TRANSITION_DURATION_SLOW
    activate(btnSlow)
    deactivate(btnFast)
  }

  Zooming.config({ transitionDuration: t })
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

  Zooming.config({ bgColor: c })
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

  Zooming.config({ enableGrab: enable })
}
