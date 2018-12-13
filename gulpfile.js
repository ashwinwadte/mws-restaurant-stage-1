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
const gzip = require('gulp-gzip');
const gzipStatic = require('connect-gzip-static');
const webp = require('gulp-webp');
const connect = require('gulp-connect');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-htmlmin');
const minifyInline = require('gulp-minify-inline');
const rename = require('gulp-rename');
const gulpSequence = require('gulp-sequence');

// js files which are required for main page and restaurant page
var listMainJsFiles = ['js/dbhelper.js', 'js/main.js'];
var listRestaurantJsFiles = ['js/dbhelper.js', 'js/restaurant_info.js'];


// default task
gulp.task('default', gulpSequence('lint', 'dist', 'launch-app'));
// task to generate the styles in .css from .scss
gulp.task('minify-copy-styles', minifyAndCopyStylesTask);
//task for linting js files
gulp.task('lint', lintTask);
gulp.task('minify-copy-scripts', minifyAndCopyScriptsTask);
gulp.task('minify-copy-html', minifyAndCopyHtmlTask);
gulp.task('copy-webp-images', copyWebpImagesTask);
gulp.task('copy-dependent-files', copyDependentFiles);
gulp.task('tests', testsTask);
gulp.task('clean', cleanTask);
gulp.task('gzip', ['gzip-html', 'gzip-css', 'gzip-js']);
gulp.task('gzip-html', gzipHtmlTask);
gulp.task('gzip-css', gzipCssTask);
gulp.task('gzip-js', gzipJsTask);
gulp.task('launch-app', launchAppTask);

// call this task to prepare distribution ready code
gulp.task('dist', gulpSequence('clean', 'minify-copy-html', 'copy-webp-images', 'minify-copy-styles', 'minify-copy-scripts', 'copy-dependent-files', 'gzip'));

function defaultTask() {
    // gulp.watch('sass/**/*.scss', ['minify-copy-styles']);
    // gulp.watch('js/**/*.js', ['lint', 'minify-copy-scripts']);
    // gulp.watch('./*.html', ['minify-copy-html']);
    // gulp.watch('dist/*.html').on('change', browserSync.reload);

    // browserSync.init({
    //     server: './dist',
    //     port: 8000
    // });
    // browserSync.stream();
}

// /*styles with sourcemaps*/
// function minifyAndCopyStylesTask() {
//     gulp.src('sass/**/*.scss')
//         .pipe(sourcemaps.init())
//         .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
//         .pipe(autoprefixer({
//             browsers: ['last 2 versions']
//         }))
//         .pipe(sourcemaps.write())
//         .pipe(gulp.dest('dist/css'))
//         .pipe(browserSync.stream());
// }

function cleanTask() {
    return gulp.src('./dist', {read: false})
        .pipe(clean());
}

function minifyAndCopyHtmlTask() {
    gulp.src('./*.html')
        .pipe(htmlmin({removeComments: true, collapseWhitespace: true}))
        .pipe(minifyInline())
        .pipe(gulp.dest('./dist'));
}

function copyWebpImagesTask() {
    // slowest compression method: 6
    gulp.src('img/*.jpg')
        .pipe(webp({method:6}))
        .pipe(gulp.dest('./dist/img/webp'));
}

function minifyAndCopyStylesTask() {
    gulp.src('sass/**/*.scss')
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(autoprefixer({
            browsers: ['last 2 versions']
        }))
        .pipe(rename('styles.min.css'))
        .pipe(gulp.dest('dist/css'));
}

function minifyAndCopyScriptsTask() {
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
            .pipe(gulp.dest('./dist/js'));
    });
}

function copyDependentFiles() {
    gulp.src(['./service_worker.js', './manifest.json', '**/*.{png,jpg}', '!node_modules/**'])
        .pipe(gulp.dest('./dist'));
}

function gzipHtmlTask() {
    gulp.src('./dist/**/*.html')
        .pipe(gzip())
        .pipe(gulp.dest('./dist'));
}

function gzipCssTask() {
    gulp.src('./dist/css/**/*.min.css')
        .pipe(gzip())
        .pipe(gulp.dest('./dist/css'));
}

function gzipJsTask() {
    gulp.src('./dist/js/**/*.min.js')
        .pipe(gzip())
        .pipe(gulp.dest('./dist/js'));
}

function launchAppTask() {
    connect.server({
        root: 'dist/index.html',
        port: 8080,
        middleware: function () { return [gzipStatic(__dirname, {maxAge: 31536000})]; }
    });
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

function testsTask() {
    // test file path to run
    gulp.src('').
        pipe(jasmine({
            integration: true,
            vendor: 'js/**/*.js'
        }));
}