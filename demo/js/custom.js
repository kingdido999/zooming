var btnFast = document.getElementById('btn-fast')
var btnSlow = document.getElementById('btn-slow')
var btnDark = document.getElementById('btn-dark')
var btnNoGrab = document.getElementById('btn-no-grab')
var activeClass= 'button-primary'

function toggleClass (el) {
  if (el.classList.contains(activeClass)) {
    el.classList.remove(activeClass)
  } else {
    el.classList.add(activeClass)
  }
}

function fast () {
  var t
  if (btnFast.classList.contains(activeClass)) {
    t = 0.4
    btnFast.classList.remove(activeClass)
  } else {
    t = 0.2
    btnFast.classList.add(activeClass)
    btnSlow.classList.remove(activeClass)
  }

  Zooming.config({ transitionDuration: t })
}

function slow () {
  var t
  if (btnSlow.classList.contains(activeClass)) {
    t = 0.4
    btnSlow.classList.remove(activeClass)
  } else {
    t = 1.0
    btnSlow.classList.add(activeClass)
    btnFast.classList.remove(activeClass)
  }

  Zooming.config({ transitionDuration: t })
}

function dark() {
  var c
  if (btnDark.classList.contains(activeClass)) {
    c = '#fff'
    btnDark.classList.remove(activeClass)
  } else {
    c = '#000'
    btnDark.classList.add(activeClass)
  }

  Zooming.config({ bgColor: c })
}

function noGrab() {
  var enable
  if (btnNoGrab.classList.contains(activeClass)) {
    enable = true
    btnNoGrab.classList.remove(activeClass)
  } else {
    enable = false
    btnNoGrab.classList.add(activeClass)
  }

  Zooming.config({ enableGrab: enable })
}
