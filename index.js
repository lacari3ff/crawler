/*
-- Google Like Web-Crawler
    -- Made By: Skywalker04885
-- Visit https://fannst.nl for example
*/

/*
    -- The requires
*/

// The HTTP Packages

const reqp = require('request-promise');
const urlParser = require('url');
const MongoClient = require('mongodb').MongoClient;
const f = require('util').format;

// The Cheerio packages

const cheerio = require('cheerio');

// The FS Packages

const fs = require('fs');

// Gets config

const config = JSON.parse(fs.readFileSync('./config/crawler.json'));

// Configures the database

if(config.MongoAuthentication) {
    var username = encodeURIComponent(config.MongoAuthCredentials.username);
    var password = encodeURIComponent(config.MongoAuthCredentials.password);
    var AuthMech = 'DEFAULT';
    var DataBase = f('mongodb://%s:%s@%s:27017/admin?authMechanism=%s?authSource=admin&w=1', username, password, config.MongoAuthenticationIp, AuthMech);
} else {
    var DataBase = 'mongodb://127.0.0.1:27017/?gssapiServiceName=mongodb';
}

/*
    --Connects mongodv
*/

MongoClient.connect(DataBase, {useNewUrlParser: true}, function(err, db) {
    if(err) {
        throw err;
    } else {
        
        // Defines the databases

        var mainDBO = db.db(config.DBname);
        var queDBO = db.db(config.QueDBname);

        /*
            --The functions
        */

        // CrawlPage function (Handles a crawling from a single main-page)

        function crawlPage(url) {
            return new Promise(function(cb) {
                var errorTimer = setTimeout(function() {
                    console.log('Crawlpage error timer off')
                    cb(false);
                }, 50000)
                if(url) {
                    correctUrl(url, function(res) {
                        if(res) {
                            getPageData(res, function(siteObject, urls, images) {
                                if(siteObject) {
                                    clearTimeout(errorTimer);
                                    cb({
                                        siteObject: siteObject,
                                        urls: urls,
                                        images: images
                                    })
                                } else {
                                    clearTimeout(errorTimer);
                                    console.log('An error occured');
                                    cb(false);
                                }
                            })
                        } else {
                            clearTimeout(errorTimer);
                            cb(false);
                        }
                    })
                } else {
                    clearTimeout(errorTimer);
                    cb(false);
                }
            })
        }

        /*
            --The page data crawling
        */

        // Crawl sub page function (Handles the crawling of layer 2, sub page)

        function crawlSubPage(url) {
            return new Promise(function(cb) {
                var errorTimer = setTimeout(function() {
                    console.log('CrawlSubpage error timer off')
                    cb(false);
                }, 7000)
                if(url) {
                    correctUrl(url, function(res) {
                        if(res) {
                            getSubPageData(res, function(siteObject) {
                                if(siteObject) {
                                    clearTimeout(errorTimer);
                                    cb({
                                        siteObject: siteObject
                                    })
                                } else {
                                    clearTimeout(errorTimer);
                                    cb(false);
                                }
                            })
                        } else {
                            clearTimeout(errorTimer);
                            cb(false);
                        }
                    })
                } else {
                    clearTimeout(errorTimer);
                    cb(false);
                }
            })
        }
        
        // Get page data function (Gets the page data, and returns it)

        function getPageData(url, cb) {
            var errorTimer = setTimeout(function() {
                cb(false);
            }, 18000)

            reqp(url, {
                timeout: 18000
            }).then(function(html) {
                var $ = cheerio.load(html);
                // Defines the site object
                var siteObject = {};
                // Gets the domain
                var urld = urlParser.parse(url, true);
                // Sets site data
                var title = $('title').text();
                var icon = $('link[rel="icon"]').attr('href');
                siteObject.ste_title = title;
                siteObject.ste_desc = $('meta[name="description"]').attr('content');
                siteObject.ste_author = $('meta[name="author"]').attr('content');
                siteObject.ste_copyright = $('meta[name="copyright"]').attr('content');
                siteObject.ste_url = url;
                siteObject.ste_host = urld.host;
                siteObject.ste_srank = 1;
                if(urld.pathname != '/') {
                    siteObject.ste_master = 0;
                    siteObject.ste_path_raw = urld.pathname;
                    siteObject.ste_path_view = urld.host + urld.pathname.split('/').join(' > ');
                } else {
                    siteObject.ste_master = 1;
                    siteObject.ste_path_raw = undefined;
                    siteObject.ste_path_view = undefined;
                }
                if(icon && url.substring(0, 8) === 'https://') {
                    if(icon.substring(0, 8) === 'https://') {
                        siteObject.ste_icon = icon;
                    } else {
                        siteObject.ste_icon = 'https://' + urld.host + icon;
                    }
                } else {
                    siteObject.ste_icon = '/images/fannst/main/search/site-icon.png';
                }
                var keywords = $('meta[name="keywords"]').attr('content');
                if(keywords) {
                    siteObject.ste_keywords = keywords.split(',');
                } else {
                    siteObject.ste_keywords = undefined;
                }
                // Processes the viewport
                var viewPortTag = $('meta[name="viewport"]').attr('content');
                if(viewPortTag != null) {
                    var viewPortTag_array = viewPortTag.split(',');
                
                    var viewPortTag_ObjectArray = [];
                    var viewPortTag_ObjectArray2 = [];

                    viewPortTag_array.forEach(function(viten) {
                        viewPortTag_ObjectArray.push(viten.split('=').join(':'));
                    })
                
                    viewPortTag_ObjectArray.forEach(function(a) {
                        var b = a.split(':');
                    
                        viewPortTag_ObjectArray2.push('"' + b[0].split('-').join('_') + '":"' + b[1] + '"')
                    })
                
                    viewPortTag_ObjectArray2 = '{' + viewPortTag_ObjectArray2 + '}';
                    viewPortTag_ObjectArray2 = viewPortTag_ObjectArray2.split(' ').join('');
                    viewport = JSON.parse(viewPortTag_ObjectArray2);
                
                    siteObject.site_viewport = viewport;
                } else {
                    siteObject.site_viewport = undefined;
                }
            
                // Gets the sub urls
                var imagesToParse = $('img');
                var urlsToParse = $('a');
                console.log('as')
                fetchUrls(urlsToParse, url, function(result) {
                    fetchImages(imagesToParse, url, function(images) {
                        // Sets the callback
                        clearTimeout(errorTimer);
                        cb(siteObject, result, images);
                    })
                })
            }).catch(function(err) {
                clearTimeout(errorTimer);
                cb(false);
            })
        }

        // getSubPageData function (Gets the data from a sub-page and returns it)

        function getSubPageData(url, cb) {
            var errorTimer = setTimeout(function() {
                cb(false);
            }, 18000)

            reqp(url, {
                timeout: 8000
            }).then(function(html) {
                var $ = cheerio.load(html);
                // Defines the site object
                var siteObject = {};
                // Gets the domain
                var urld = urlParser.parse(url, true);
                // Sets site data
                var title = $('title').text();
                siteObject.ste_title = title;
                siteObject.ste_desc = $('meta[name="description"]').attr('content');
                siteObject.ste_author = $('meta[name="author"]').attr('content');
                siteObject.ste_copyright = $('meta[name="copyright"]').attr('content');
                siteObject.ste_url = url;
                siteObject.ste_host = urld.host;
                siteObject.ste_srank = 1;
                var icon = $('link[rel="icon"]').attr('href');
                if(urld.pathname != '/') {
                    siteObject.ste_master = 0;
                    siteObject.ste_path_raw = urld.pathname;
                    siteObject.ste_path_view = urld.host + urld.pathname.split('/').join(' > ');
                } else {
                    siteObject.ste_master = 1;
                    siteObject.ste_path_raw = undefined;
                    siteObject.ste_path_view = undefined;
                }
                if(icon && url.substring(0, 8) === 'https://') {
                    if(icon.substring(0, 8) === 'https://') {
                        siteObject.ste_icon = icon;
                    } else {
                        siteObject.ste_icon = 'https://' + urld.host + icon;
                    }
                } else {
                    siteObject.ste_icon = '/images/fannst/main/search/site-icon.png';
                }
                var keywords = $('meta[name="keywords"]').attr('content');
                if(keywords) {
                    siteObject.ste_keywords = keywords.split(',');
                } else {
                    siteObject.ste_keywords = undefined;
                }
                // Processes the viewport
                var viewPortTag = $('meta[name="viewport"]').attr('content');
                if(viewPortTag != null) {
                    var viewPortTag_array = viewPortTag.split(',');
                
                    var viewPortTag_ObjectArray = [];
                    var viewPortTag_ObjectArray2 = [];

                    viewPortTag_array.forEach(function(viten) {
                        viewPortTag_ObjectArray.push(viten.split('=').join(':'));
                    })
                
                    viewPortTag_ObjectArray.forEach(function(a) {
                        var b = a.split(':');
                    
                        viewPortTag_ObjectArray2.push('"' + b[0].split('-').join('_') + '":"' + b[1] + '"')
                    })
                
                    viewPortTag_ObjectArray2 = '{' + viewPortTag_ObjectArray2 + '}';
                    viewPortTag_ObjectArray2 = viewPortTag_ObjectArray2.split(' ').join('');
                    viewport = JSON.parse(viewPortTag_ObjectArray2);
                
                    siteObject.site_viewport = viewport;
                } else {
                    siteObject.site_viewport = undefined;
                }
                
                var imagesToParse = $('img');

                fetchImages(imagesToParse, url, function(images) {
                    // Sets the callback
                    clearTimeout(errorTimer);
                    cb(siteObject, images);
                })
            }).catch(function(err) {
                clearTimeout(errorTimer);
                cb(false);
            })
        }
        
        /*
            --The data image/url collection functions
        */

        // Fetch images function (Gets the images and returns the: type, name and url)

        function fetchImages(imagesToParse, originalUrl, cb) {
            var processed = 0;
            var images = [];
            var imageObjects = []

            for(var i = 0; i < imagesToParse.length; i++) {
                // Sets the current image
                var image = imagesToParse[i].attribs.src;
                // Checks if the image is already in the list
                if(images.indexOf(image) === -1 && images.indexOf('/' + image) === -1) {
                    // Checks the image type
                    if(image.substring(0, 8) === 'https://') {
                        image = image;
                    } else if(image.substring(0, 7) === 'http://') {
                        image = image;
                    } else {
                        if(image.substring(0, 1) === '/') {
                            if(image.substring(0, 2) == '//') {
                                image = image.substring(1, image.length);
                            } else {
                                image = originalUrl + image;
                            }
                        }
                    }
                }
                // Gets the raw url
                if(image.includes('&')) {
                    var img_index = image.indexOf('&');
                    var img = image.substring(0, img_index);
                } else {
                    img = image;
                }
                // Gets the image type
                var img_type_index = img.lastIndexOf('.');
                var img_type = img.substring(img_type_index,  img.length);
                // Gets the image data
                var img_name_index = image.lastIndexOf('/') + 1;
                var img_name = image.substring(img_name_index, img_type_index);
                // Inserts it into the arrays
                images.push(image);
                imageObjects.push({
                    img_name: img_name,
                    img_url: img,
                    img_type: img_type
                })
                // Says one more is processed
                processed++;
                // Checks if process is done
                if(processed >= imagesToParse.length) {
                    cb(imageObjects);
                }
            }
        }

        // FetchUrls function (Gets the urls)
        
        function fetchUrls(urlsToParse, originalUrl, cb) {
            var processed = 0;
            var urls = [];
        
            for(var i = 0; i < urlsToParse.length; i++) {
                // Sets the url
                var url = urlsToParse[i].attribs.href;
                // Checks if the url is already in the list
                if(urls.indexOf(url) === -1 && urls.indexOf('/' + url) === -1) {
                    // Checks the url type
                    if(url.substring(0, 8) === 'https://') {
                        urls.push(url);
                    } else if(url.substring(0, 7) === 'http://') {
                        urls.push(url);
                    } else {
                        if(url.substring(0, 1) === '/') {
                            if(url.substring(0, 2) == '//') {
                                urls.push(url.substring(1, url.length));
                            } else {
                                urls.push(originalUrl + url);
                            }
                        } else {
                            urls.push(originalUrl + '/' + url);
                        }
                    }   
                }
                // Says one more is processed
                processed++;
                // Checks if process is done
                if(processed >= urlsToParse.length) {
                    cb(urls);
                }
            }
        }

        /* 
            --Corrects the url before crawl

            The URL Format (Without dir): (https://)(http://)example.com

            The URL Format (With dir): (https://)(http://)example.com/test

        */

        function correctUrl(url, cb) {
            // Gets the url
            var url = url;
            // Slices the url
            var urlSliced = url.substring(url.length-1, url.length);
            if(urlSliced === '/') {
                url = url.substring(0, url.length-1);
            }
            // Checks if its https or not
            if(url.substring(0, 8) === 'https://') {
                cb(url);
            } else if(url.substring(0, 7) === 'http://') {
                cb(url);
            } else {
                // If request takes to long, it will switch to http
                var timeout = setTimeout(function() {
                    console.log('correctUrl error timer off')
                    reqp('http://' + url, {
                        timeout: 2000
                    }).then(function(html) {
                        cb('http://' + url);
                    }).catch(function(err) {
                        cb(false);
                    })
                }, 5000)
                // Checks for https
                reqp('https://' + url, {
                    timeout: 2000
                }).then(function(html) {
                    clearTimeout(timeout);
                    cb('https://' + url);
                }).catch(function(err) {
                    clearTimeout(timeout);
                    reqp('http://' + url, {
                        timeout: 2000
                    }).then(function(html) {
                        clearTimeout(timeout);
                        cb('http://' + url);
                    }).catch(function(err) {
                        clearTimeout(timeout);
                        cb(false);
                    })
                })
            }
        }

        /* 
            --Insert into database
        */

        // Inserts pages

        function insertPage(siteObject, cb) {
            if(siteObject) {
                mainDBO.collection('indexed').findOne({
                    ste_url: siteObject.ste_url
                }, function(err, res) {
                    if(err) {
                        cb(false);
                    } else if(res) {
                        mainDBO.collection('indexed').updateOne({
                            ste_url: siteObject.ste_url
                        }, {
                            $set: {
                                ste_title: siteObject.ste_title,
                                ste_desc: siteObject.ste_desc,
                                ste_author: siteObject.ste_author,
                                ste_copyright: siteObject.ste_copyright,
                                ste_keywords: siteObject.ste_keywords,
                                site_viewport: siteObject.site_viewport,
                                ste_icon: siteObject.ste_icon
                            }
                        }, function(err) {
                            if(err) {
                                cb(false);
                            } else {
                                cb(true);
                            }
                        })
                    } else {
                        mainDBO.collection('indexed').insertOne(siteObject, function(err) {
                            if(err) {
                                cb(false);
                            } else {
                                cb(true);
                            }
                        })
                    }
                })
            } else {
                cb(false);
            }
        }

        // Inserts images

        function insertImage(imageObject, cb) {
            dbo.collection('images').findOne({
                img_url: imageObject.image_url
            }, function(err, res) {
                if(err) {
                    cb(false);
                } else if(res) {
                    mainDBO.collection('images').updateOne({
                        img_url: imageObject.image_url
                    }, {$set: {
                        img_name: imageObject.img_name,
                        img_type: imageObject.img_type,
                        img_url: imageObject.img_url
                    }}, function(err) {
                        if(err) {
                            cb(false);
                        } else {
                            cb(true);
                        }
                    })
                } else {
                    mainDBO.collection('images').insertOne({
                        img_name: imageObject.img_name,
                        img_type: imageObject.img_type,
                        img_url: imageObject.img_url
                    }, function(err) {
                        if(err) {
                            cb(false);
                        } else {
                            cb(true);
                        }
                    })
                }
            })
        }

        /* 
            Crawl full site
        */

        function crawlSite(url, cb) {
            // Indexes the main page
            crawlPage(url).then(function(result) {
                if(result) {
                    var urls = result.urls;
                    var images = result.images;

                    console.log(images);
                    var processed = 0;

                    var errorTimer = setTimeout(function() {
                        cb(false);
                    }, 60000)

                    urls.forEach(function(url) {
                        crawlSubPage(url).then(function(res) {
                            if(res) {
                                insertPage(res.siteObject, function(result) {
                                    if(result) {
                                        console.log(`Inserted: ${url}`);
                                    }

                                    processed++;
                                    if(processed >= urls.length) {
                                        console.log(processed)
                                        clearTimeout(errorTimer);
                                        cb(true);
                                    }
                                })
                            } else {
                                console.log(`Error: ${url}`);

                                processed++;
                                if(processed >= urls.length) {
                                    console.log(processed)
                                    clearTimeout(errorTimer);
                                    cb(true);
                                }
                            }
                        }).catch(function(err) {
                            cb(false);

                            processed++;
                            if(processed >= urls.length) {
                                console.log(processed)
                                clearTimeout(errorTimer);
                                cb(true);
                            }
                        })
                    })

                } else {
                    cb(false);
                }
            })
        }
        
        /*
            The script
        */

        function crawlQue() {
            queDBO.collection('que').findOne(function(err, site) {
                if(err) {
                    console.log(err);
                } else {
                    if(site) {
                        queDBO.collection('que').deleteOne(function(err) {
                            if(err) {
                                console.log(err);
                            } else {
                                crawlSite(site.url, function(cb) {
                                    if(cb) {
                                        console.log('done');
                                    }

                                    crawlQue()
                                })
                            }
                        })
                    } else {
                        console.log('Waiting for job');
                        setTimeout(function() {
                            crawlQue()
                        }, 1500)
                    }
                }
            })
        }

        crawlQue();
    }
})