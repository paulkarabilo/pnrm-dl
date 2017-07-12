var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var path = require('path');
var request = require('request');
var cheerio = require('cheerio');
var mkdirp = require('mkdirp');
var url = require('url');

if (!argv.i || ! argv.o) {
    console.error("Should use with -i url -o folder parameters");
    process.exit();
}

var folder = argv.o;

if (fs.existsSync(folder)) {
    if (!fs.lstatSync(folder).isDirectory()) {
        console.error("Output path should be a directory!");
        process.exit(1);
    } else {
        console.warn("Specified folder exists, will write in /pnrm-dl subfolder");
        folder = path.join(folder, "pnrm-dl");
        mkdirp.sync(folder);
    }
} else {
    mkdirp.sync(folder);
}

var counter = 0;
var globalStart = (new Date()).getTime();

request(argv.i, function(error, response, body) {
    if (error !== null) {
        console.error("Error occured loading " + argv.i);
        console.error(error);
        process.exit(1);
    }
    var $ = cheerio.load(body);
    var $profile = $('#profile_name');
    if ($profile.length === 0) {
        $profile = $('#user_profile_info');
    }
    if ($profile.length === 0) {
        console.error("Seems like input url is not panoramio page,\
            should be either profile page or single image page");
        process.exit(1);
    }
    folder = path.join(folder, $profile.text().trim().replace(/\s+/g, '_'));
    mkdirp.sync(folder);
    loadImg(argv.i, folder);
});

function loadImg(pageUrl, folder) {
    var start = (new Date()).getTime();
    request(pageUrl, function(error, response, body) {
        if (error !== null) {
            console.error("Error occured loading " + pageUrl);
            console.error(error);
        }
        var $ = cheerio.load(body);
        if ($('.user-page_photo_thumb').length > 0) {
            //we're on the list page
            var imgUrl = $('.user-page_photo_thumb').first().find('a').attr('href');
            return loadImg(url.resolve(pageUrl, imgUrl), folder);
        } else if ($('#main-photo').length) {
            var bigImgUrl = $('#main-photo img').attr('src');
            var title = $('#main-photo img').attr('alt') || '';
            var bigImgName = title.replace(/[/., ]+/g, "_").trim();
            if (bigImgName.length > 127) {
                console.log(bigImgName + " too long, will have to trim");
                bigImgName = bigImgName.substr(0, 127);
            }

            var imgId = pageUrl.split('/').pop();
            var imgExt = bigImgUrl.split('.').pop();
            
            var fullImgName = bigImgName + '_' + imgId + '.' + imgExt;
            var fullImgPath = path.join(folder, fullImgName);

            request.head(bigImgUrl, function(err, res, body){
                var contentLength = res.headers['content-length'];
                try {
                    request(bigImgUrl).pipe(fs.createWriteStream(fullImgPath)).on('close', function () {
                        var time = (new Date()).getTime() - start;
                        counter++;
                        console.log("(" + counter + ") " + fullImgName + " in " + time + " ms");
                    });
                } catch (e) {
                    console.log(e);
                }
            });

            var nextImg = $('img[src="/img/next-uphoto.png"]').closest('a');
            if (nextImg.length > 0) {
                loadImg(url.resolve(pageUrl, nextImg.attr('href')), folder);
            } else {
                var globalTime = (new Date()).getTime() - globalStart;
                console.log("Loaded " + counter + " images in " + globalTime + " ms");
                process.exit(0);
            }
        }
    });
}