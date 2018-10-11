var gulp = require('gulp'),
	filter = require('gulp-filter'),
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
var path = require('path');

var target = process.env.TARGET || 'prod'

function getFiles(dir) {
	return fs.readdirSync(dir)
		.filter(function(file) {
			return fs.statSync(path.join(dir, file)).isFile() && path.extname(file) === '.html';
		});
}

function getDir(dir) {
	return fs.readdirSync(dir)
		.filter(function(file) {
			return fs.statSync(path.join(dir, file)).isDirectory();
		}).map(function(file) {
			return path.join(dir, file);
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
	var modules =  getDir(scriptsPath)
	var tasks = modules.reduce(function(result, n) {
		var moduleName = n.split(path.sep).pop()
		var files = getFiles(n);
		var distModule = 'dist/' + moduleName
		var subtasks = files.map(function(file) {
			const targetFilePath = path.join(n, file)
			const basename = path.basename(targetFilePath, '.html')

			const inlineCssPromise = new Promise(function(resolve, reject) {
				let resultFile = ''
				return gulp.src(targetFilePath)
					.pipe(processInline().extract('style'))
					.on('error', reject)
					.pipe(concat(basename + '.css'))
					.on('error', reject)
					.pipe(cssmin())
					.on('error', reject)
					.pipe(rename(function (path) {
						var moduleFileName = path.basename
						path.dirname = moduleFileName;
						path.basename = "style";
						path.extname = ".css";
					}))
					.pipe(md5(8))
					.pipe(tap(function(file) {
						resultFile = path.basename(file.path)
					}))
					.on('error', reject)
					.pipe(gulp.dest(distModule))
					.on('end', function() {
						resolve(resultFile)
					})
			})

			const inlineJsPromise = new Promise(function(resolve, reject) {
				let resultFile = ''
				return gulp.src(targetFilePath)
					.pipe(processInline().extract('script'))
					.on('error', reject)
					.pipe(concat(basename + '.js'))
					.on('error', reject)
					.pipe(uglify())
					.on('error', reject)
					.pipe(rename(function (path) {
						var moduleFileName = path.basename
						path.dirname = moduleFileName;
						path.basename = "app";
						path.extname = ".js";
					}))
					.pipe(md5(8))
					.pipe(tap(function(file) {
						resultFile = path.basename(file.path)
					}))
					.on('error', reject)
					.pipe(gulp.dest(distModule))
					.on('end', function() {
						resolve(resultFile)
					});
			})
			return Promise.all([inlineJsPromise, inlineCssPromise]).then(function(values) {
				const [jsFile, cssFile] = values
				return gulp.src(targetFilePath)
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
					.pipe(gulp.dest(distModule))
					.on('end', function() {
						gutil.log('Finish ' + targetFilePath)
					});
			})
		});
		return result.concat(subtasks)
	}, [])

	Promise.all(tasks).then(function() {
		done()
	})
})

gulp.task('build:module', function(done) {
	var scriptsPath = 'src/module'
	var modules = getDir(scriptsPath)
	var tasks = modules.reduce(function(result, n) {
		var moduleName = n.split(path.sep).pop()
		var files = getFiles(n);
		var distModule = 'dist/' + moduleName
		var subtasks = files.map(function(file) {
			const targetFilePath = path.join(n, file);
			const basename = path.basename(targetFilePath, '.html');
			return new Promise(function(resolve, reject) {
				const jsPromise = new Promise(function(resolve, reject) {
					let jsFileName = ''
					gulp.src(targetFilePath)
						.pipe(preprocess())
						.pipe(resources({
							skipNotExistingFiles: true,
							css: false
						}))
						.pipe(filter(['**/*.js']))
						.pipe(concat('app.js'))
						.pipe(uglify())
						.pipe(md5(8))
						.pipe(rename(function (path) {
							console.log('rename js')
							console.log(path)
							path.dirname = '';
							jsFileName = path.basename + path.extname
						}))
						.pipe(gulp.dest(distModule))
						.on('end', function() {
							resolve(jsFileName)
						})
				})
				const cssPromise = new Promise(function(resolve, reject) {
					let cssFileName = ''
					gulp.src(targetFilePath)
						.pipe(preprocess())
						.pipe(resources({
							skipNotExistingFiles: true,
							js: false
						}))
						.pipe(filter(['**/*.css']))
						.pipe(concat('style.css'))
						.pipe(cssmin())
						.pipe(md5(8))
						.pipe(rename(function (path) {
							console.log('rename css')
							console.log(path)
							path.dirname = '';
							cssFileName = path.basename + path.extname
						}))
						.pipe(gulp.dest(distModule))
						.on('end', function() {
							resolve(cssFileName)
						})
				})
				return Promise.all([jsPromise, cssPromise]).then(function (values) {
					console.log(values)
					const [jsFile, cssFile] = values
					gulp.src(targetFilePath)
						.pipe(preprocess())
						.pipe(gif('**/*.html', replace(
							/<!--startjs-->[^]+<!--endjs-->/,
							'<script src="../public/' + target + '.js"></script>\n' +
							'\t<script src="' + jsFile + '"></script>\n')))
						.pipe(gif('**/*.html', replace(/<!--startcss-->[^]+<!--endcss-->/, '<link rel="stylesheet" href="'+ cssFile +'">\n')))
						.pipe(gif('**/*.html', rename(function (path) {
							path.dirname = '';
							path.basename = "index";
						})))
						.pipe(gulp.dest(distModule))
						.on('end', function() {
							resolve()
							gutil.log('Finish ' + targetFilePath)
						})
				})
			})

		})
		return result.concat(subtasks)
	}, [])

	Promise.all(tasks).then(function() {
		done()
	})
})

gulp.task('build', gulp.series('clean', 'env:copy', 'build:extract'))




