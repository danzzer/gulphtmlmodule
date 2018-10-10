// gulp.task('extract', function () {
// 	return gulp.src('./src/module/test.html')
// 		.pipe(resources())
// 		.pipe(gif('**/*.js', concat('all.js')))
// 		.pipe(gif('**/*.js', uglify()))
// 		// .pipe(gif('**/*.html', replace(/<!--startjs-->[^]+<!--endjs-->/, '<script src="js/all.js"></script>')))
// 		.pipe(gulp.dest('./dist'));
// });

gulp.task('indexHtml', function() {
	console.log(process.env)

	return gulp.src('./src/module/test.html')
		.pipe(preprocess())
		.pipe(cheerio(function ($) {
			$('script').remove();
			$('style').remove();
			$('body').append('\t<script src="../env/' + target + '.js"></script>\n');
			$('body').append('\t<script src="app.full.min.js"></script>\n');
			$('head').append('\t<link rel="stylesheet" href="app.full.min.css">\n');
		}))
		.pipe(rename(function (path) {
			var moduleName = path.basename
			path.dirname = moduleName;
			path.basename = "index";
			path.extname = ".html";
		}))
		.pipe(gulp.dest('dist/'));
});

gulp.task('js', function() {
	return gulp.src('./src/module/test.html')
		.pipe(processInline().extract('script'))
		// Pipe other gulp plugins here
		// eg: .pipe(uglify())
		// .pipe(processInline().restore())
		.pipe(concat())
		.pipe(uglify())
		.pipe(rename(function (path) {
			var moduleName = path.basename
			path.dirname = moduleName;
			path.basename = "all";
			path.extname = ".js";
		}))
		.pipe(gulp.dest('./dist'));
});

gulp.task('css', function() {
	return gulp.src('./src/module/test.html')
		.pipe(processInline().extract('style'))
		// Pipe other gulp plugins here
		// eg: .pipe(uglify())
		// .pipe(processInline().restore())
		.pipe(concat())
		.pipe(cssmin())
		.pipe(rename(function (path) {
			var moduleName = path.basename
			path.dirname = moduleName;
			path.basename = "all";
			path.extname = ".css";
		}))
		.pipe(gulp.dest('./dist'));
});
