var gulp = require('gulp'),
	gutil = require('gulp-util'),
	gif = require('gulp-if'),
	md5 = require('gulp-md5'),
	concat = require('gulp-concat'),
	uglify = require('gulp-uglify'),
	replace = require('gulp-replace'),
	cheerio = require('gulp-cheerio'),
	rename = require('gulp-rename'),
	cssmin = require('gulp-cssmin'),
	processInline = require('gulp-process-inline'),
	preprocess = require('gulp-preprocess'),
	tap = require('gulp-tap'),
	rm = require('gulp-rm'),
	resources = require('gulp-resources');

var fs = require('fs');
var path = require('path')

var target = process.env.TARGET || 'prod'

function getFiles(dir) {
	return fs.readdirSync(dir)
		.filter(function(file) {
			return fs.statSync(path.join(dir, file)).isFile() && path.extname(file) === '.html';
		});
}

gulp.task('clean', function(done) {
	gulp.src( 'dist/**/*', { read: false })
		.pipe(rm({ async: false }))
	done()
})

gulp.task('env:copy', function(done) {
	gulp.src('src/env/**/*.js')
		.pipe(uglify())
		.pipe(rename(function (path) {
			path.dirname = 'env';
		}))
		.pipe(gulp.dest('./dist'))
		.on('end', function() {
			done()
		});
})
gulp.task('build:extract', function(done) {
	var scriptsPath = 'src/module'
	var files = getFiles(scriptsPath);
	var tasks = files.map(function(file) {
		const targeFilePath = path.join(scriptsPath, file)
		const basename = path.basename(targeFilePath, '.html')

		const cssPromise = new Promise(function(resolve, reject) {
			let resultFile = ''
			return gulp.src(targeFilePath)
				.pipe(processInline().extract('style'))
				.on('error', reject)
				.pipe(concat(basename + '.css'))
				.on('error', reject)
				.pipe(cssmin())
				.on('error', reject)
				.pipe(rename(function (path) {
					var moduleName = path.basename
					path.dirname = moduleName;
					path.basename = "style";
					path.extname = ".css";
				}))
				.pipe(md5(8))
				.pipe(tap(function(file) {
					resultFile = path.basename(file.path,)
				}))
				.on('error', reject)
				.pipe(gulp.dest('dist/'))
				.on('end', function() {
					resolve(resultFile)
				})
		})

		const jsPromise = new Promise(function(resolve, reject) {
			let resultFile = ''
			return gulp.src(targeFilePath)
				.pipe(processInline().extract('script'))
				.on('error', reject)
				.pipe(concat(basename + '.js'))
				.on('error', reject)
				.pipe(uglify())
				.on('error', reject)
				.pipe(rename(function (path) {
					var moduleName = path.basename
					path.dirname = moduleName;
					path.basename = "app";
					path.extname = ".js";
				}))
				.pipe(md5(8))
				.pipe(tap(function(file) {
					resultFile = path.basename(file.path,)
				}))
				.on('error', reject)
				.pipe(gulp.dest('dist/'))
				.on('end', function() {
					resolve(resultFile)
				});
		})
		return Promise.all([jsPromise, cssPromise]).then(function(values) {
			const [jsFile, cssFile] = values
			return gulp.src(targeFilePath)
				.pipe(preprocess())
				.pipe(cheerio(function ($) {
					$('script').remove();
					$('style').remove();
					$('body').append('\t<script src="../public/' + target + '.js"></script>\n');
					$('body').append('\t<script src="' + jsFile + '"></script>\n');
					$('head').append('\t<link rel="stylesheet" href="'+ cssFile +'">\n');
				}))
				.pipe(rename(function (path) {
					var moduleName = path.basename
					path.dirname = moduleName;
					path.basename = "index";
					path.extname = ".html";
				}))
				.pipe(gulp.dest('dist/'))
				.on('end', function() {
					gutil.log('Finish ' + targeFilePath)
				});
		})
	});
	Promise.all(tasks).then(function() {
		done()
	})
})

gulp.task('build', gulp.series('clean', 'env:copy', 'build:extract'))




