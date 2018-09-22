/*eslint-env node */
const gulp = require('gulp');
const gulpIf = require('gulp-if');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const browserSync = require('browser-sync').create();
const eslint = require('gulp-eslint');
const jasmine = require('gulp-jasmine-phantom');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
const pngquant = require('imagemin-pngquant');
const clean = require('gulp-clean');
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

// js files which are required for main page and restaurant page
var listMainJsFiles = ['js/dbhelper.js', 'js/main.js'];
var listRestaurantJsFiles = ['js/dbhelper.js', 'js/restaurant_info.js'];


// default task
gulp.task('default', ['copy-dependent-files', 'copy-html', 'copy-images', 'styles', 'lint', 'scripts'], defaultTask);
// task to generate the styles in .css from .scss
gulp.task('styles', stylesTask);
//task for linting js files
gulp.task('lint', lintTask);
gulp.task('scripts', scriptsTask);
gulp.task('copy-html', copyHtmlTask);
gulp.task('copy-images', copyImagesTask);
gulp.task('copy-dependent-files', copyDependentFiles);
gulp.task('tests', testsTask);
gulp.task('clean', cleanTask);

// call this task to prepare distribution ready code
gulp.task('dist', ['copy-html', 'copy-images', 'styles', 'lint', 'scripts']);

function defaultTask() {
    gulp.watch('sass/**/*.scss', ['styles']);
    gulp.watch('js/**/*.js', ['lint', 'scripts']);
    gulp.watch('./*.html', ['copy-html']);
    gulp.watch('dist/*.html').on('change', browserSync.reload);

    browserSync.init({
        server: './dist',
        port: 8000
    });
    browserSync.stream();
}

function stylesTask() {
    gulp.src('sass/**/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(autoprefixer({
            browsers: ['last 2 versions']
        }))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist/css'))
        .pipe(browserSync.stream());
}

function isFixed(file) {
    return file.eslint != null && file.eslint.fixed;
}

function lintTask() {
    return gulp.src(['js/**/*.js'])
        // eslint() attaches the lint output to the "eslint" property
        // of the file object so it can be used by other modules.
        // try to fix automatically
        .pipe(eslint({fix: true}))
        // eslint.format() outputs the lint results to the console.
        // Alternatively use eslint.formatEach() (see Docs).
        .pipe(eslint.format())
        // if fixed, save the files to same folder
        .pipe(gulpIf(isFixed, gulp.dest('./js')))
        // To have the process exit with an error code (1) on
        // lint error, return the stream and pipe to failAfterError last.
        .pipe(eslint.failAfterError());
}

function scriptsTask() {
    modifyScripts(listMainJsFiles, 'main');
    modifyScripts(listRestaurantJsFiles, 'restaurant');
}

function modifyScripts(files, mergedName) {
    files.map(function (file) {
        return browserify({entries: [file]})
            .transform(babelify.configure({presets: ['env']}))
            .bundle()
            .pipe(source(`${mergedName}.min.js`))
            .pipe(buffer())
            .pipe(sourcemaps.init())
            .pipe(uglify())
            .pipe(sourcemaps.write())
            .pipe(gulp.dest('dist/js'));
    });
}

function copyHtmlTask() {
    gulp.src('./*.html')
        .pipe(gulp.dest('./dist'));
}

function copyImagesTask() {
    gulp.src('img/**')
        .pipe(imagemin({
            progressive: true,
            use: [pngquant()]
        }))
        .pipe(gulp.dest('dist/img'));
}

function copyDependentFiles() {
    gulp.src(['./service_worker.js', './manifest.json'])
        .pipe(gulp.dest('./dist'));
}

function testsTask() {
    // test file path to run
    gulp.src('').
        pipe(jasmine({
            integration: true,
            vendor: 'js/**/*.js'
        }));
}

function cleanTask() {
    return gulp.src('./dist', {read: false})
        .pipe(clean());
}