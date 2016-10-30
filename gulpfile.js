var gulp = require('gulp')
var uglify = require('gulp-uglify')
var cssnano = require('gulp-cssnano')
var rename = require('gulp-rename')
var gfi = require('gulp-file-insert')
var header = require('gulp-header')
var pkg = require('./package.json')

var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  '',
  ''].join('\n')

gulp.task('compress-js', function() {
  gulp.src('src/*.js')
      .pipe(header(banner, { pkg : pkg } ))
      .pipe(gulp.dest('dist'))
      .pipe(uglify())
      .pipe(header(banner, { pkg : pkg } ))
      .pipe(rename({
          extname: '.min.js'
      }))
      .pipe(gulp.dest('dist'))
})

gulp.task('compress-css', function() {
  gulp.src('src/*.css')
      .pipe(header(banner, { pkg : pkg } ))
      .pipe(gulp.dest('dist'))
      .pipe(cssnano())
      .pipe(header(banner, { pkg : pkg } ))
      .pipe(rename({
          extname: '.min.css'
      }))
      .pipe(gulp.dest('dist'))
})

gulp.task('default', [ 'compress-js', 'compress-css' ])
