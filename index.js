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
    var DataBase = f('mongodb://%s:%s@192.168.178.15:27017/admin?authMechanism=%s?authSource=admin&w=1', user, password, AuthMech);
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
        function crawlPage(url, cb) {
            if(url) {
                correctUrl(url, function(res) {
                    if(res) {
                        getPageData(res, function(siteObject, urls) {
                            if(siteObject) {
                                cb(siteObject, urls);
                            } else {
                                console.log('An error occured');
                                cb(false);
                            }
                        })
                    } else {
                        cb(false);
                    }
                })
            } else {
                cb(false);
            }
        }
        // Grabs the data from the site
        function getPageData(url, cb) {
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
                    // Sets the callback
                    cb(siteObject, result);
                })
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
                if(processed === urlsToParse.length) {
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
        
        }
        /* 
            Crawl full site
        */
        function crawlSite(url, cb) {
            // Configures the arrays
            var toCrawlArray = [];
            var crawledArray = [];
            // Indexes the main page
            crawlPage(url, function(res, urls) {
                if(res) {
                    crawledArray.push(url);
                
                } else {
                    cb(false);
                }
            })
        }
        /*
            The script
        */
        crawlPage('https://discord.com/jobs', function(res, urls) {
            console.log(res);
            console.log(urls);
        })
    }
})