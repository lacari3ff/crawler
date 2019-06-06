/*
    The requires
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
// Connects to mongodb
MongoClient.connect(DataBase, {useNewUrlParser: true}, function(err, db) {
    if(err) {
        throw err;
    } else {
        var mainDBO = db.db(config.DBname);
        var queDBO = db.db(config.QueDBname);

        /*
            The functions
        */
        // The site crawl function
        function crawlPage(url) {
            return new Promise(function(cb) {
                var errorTimer = setTimeout(function() {
                    cb(false);
                }, 900)
                if(url) {
                    correctUrl(url, function(res) {
                        if(res) {
                            getPageData(res, function(siteObject, urls) {
                                if(siteObject) {
                                    clearTimeout(errorTimer);
                                    cb({
                                        siteObject: siteObject,
                                        urls: urls
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
        function crawlSubPage(url) {
            return new Promise(function(cb) {
                var errorTimer = setTimeout(function() {
                    cb(false);
                }, 900)
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
        // Grabs the data from the site
        function getPageData(url, cb) {
            var errorTimer = setTimeout(function() {
                cb(false);
            }, 1000)

            reqp(url).then(function(html) {
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
                if(urld.pathname != '/') {
                    siteObject.ste_master = 0;
                    siteObject.ste_path_raw = urld.pathname;
                    siteObject.ste_path_view = urld.host + urld.pathname.split('/').join(' > ');
                } else {
                    siteObject.ste_master = 1;
                    siteObject.ste_path_raw = undefined;
                    siteObject.ste_path_view = undefined;
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
                var urlsToParse = $('a');
                fetchUrls(urlsToParse, url, function(result) {
                    console.log('as')
                    // Sets the callback
                    clearTimeout(errorTimer);
                    cb(siteObject, result);
                })
            }).catch(function(err) {
                cb(false);
            })
        }
        // Grabs the data from the site
        function getSubPageData(url, cb) {
            var errorTimer = setTimeout(function() {
                cb(false);
            }, 1000)

            reqp(url).then(function(html) {
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
                if(urld.pathname != '/') {
                    siteObject.ste_master = 0;
                    siteObject.ste_path_raw = urld.pathname;
                    siteObject.ste_path_view = urld.host + urld.pathname.split('/').join(' > ');
                } else {
                    siteObject.ste_master = 1;
                    siteObject.ste_path_raw = undefined;
                    siteObject.ste_path_view = undefined;
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
                cb(siteObject);
            }).catch(function(err) {
                cb(false);
            })
        }
        // Fetches the urls
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
                                urls.push(url.substring(2, url.length));
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
        // The adjust url function to make url correct
        /* 

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
                    reqp('http://' + url).then(function(html) {
                        cb('http://' + url);
                    }).catch(function(err) {
                        cb(false);
                    })
                }, 5000)
                // Checks for https
                reqp('https://' + url).then(function(html) {
                    clearTimeout(timeout);
                    cb('https://' + url);
                }).catch(function(err) {
                    clearTimeout(timeout);
                    reqp('http://' + url).then(function(html) {
                        cb('http://' + url);
                    }).catch(function(err) {
                        cb(false);
                    })
                })
            }
        }
        /* 
            Insert into database
        */
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
                                site_viewport: siteObject.site_viewport
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
        /* 
            Crawl full site
        */
        function crawlSite(url, cb) {
            // Indexes the main page
            crawlPage(url).then(function(result) {
                if(result) {
                    var urls = result.urls;
                    var processed = 0;

                    var errorTimer = setTimeout(function() {
                        cb(false);
                    }, 3000)
                    urls.forEach(function(url) {
                        crawlSubPage(url).then(function(res) {
                            if(res) {
                                insertPage(res.siteObject, function(result) {
                                    if(result) {
                                        console.log(`Inserted: ${url}`);
                                    }
                                })
                            } else {
                                console.log(`Error: ${url}`);
                            }

                            processed++;
                            if(processed >= urls.length) {
                                clearTimeout(errorTimer);
                                cb(true);
                            }
                        }).catch(function(err) {
                            cb(false);
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
                                        crawlQue()
                                    } else {
                                        crawlQue()
                                    }
                                })
                            }
                        })
                    } else {
                        console.log('Waiting for job');
                        setTimeout(function() {
                            crawlQue()
                        }, 500)
                    }
                }
            })
        }

        crawlQue();
    }
})