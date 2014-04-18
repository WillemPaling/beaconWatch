#!/usr/bin/env node

/*
	TODO
	* Write tests for existence of particular beacons
	* Interface somewhere so you can automate this shit
	* Use Saucelabs instead of local Selenium
	* GTM test mode
*/

var http = require('http'),
		httpProxy = require('http-proxy'),
		fs = require('fs'),
		colors = require('colors'),
		proxyPort = Math.floor(Math.random()*(12000-8000+1)+8000),
		webdriver = require('selenium-webdriver'),
		proxy = require('selenium-webdriver/proxy'),
		beacons = {},
		interestingRequest = {},
		beaconTests = require('./libs/beaconTests'),
		argv = require('optimist')
			.usage('Test the analytics beacons in a web page.\nUsage: $0')
			.demand('u')
			.alias('u', 'url')
			.describe('u', 'URL to test')
			.alias('r', 'require')
			.describe('r', 'Required analytics tools. One or more of: "omniture", "googleanalytics", "nielsen" separated by commas.')
			.alias('d', 'debug')
			.describe('d','Enable debugging output to console.')
			.argv;

if (argv.debug) {
	console.log('Proxy: '.red.bold + 'localhost:' + proxyPort);
}

/*
	Proxy server that pushes any requests for s_code.js to run through the server defined above.
	Looks at all requests and logs any analytics beacon requests to the console.
*/
var proxyServer = httpProxy.createProxy();

var outboundServer = require('http').createServer(function(req, res) {
	if (argv.debug) {
		console.log('Request: '.blue.bold + req.url);
	}
	var beacon = isThisInteresting(req);
	if (beacon) {
		console.log("Not proxying: " + req.url);
		proxyServer.web(req, res, {
			// TODO Use something other than spamming the Big G
			target: 'http://www.google.com/'
		}, function(e) {
			console.log('Not proxying error: '.blue.bold + req.url);
			console.log(e);
		});
	} else {
		proxyServer.web(req, res, {
			target: req.url
		}, function(e) {
			console.log('Proxy error: '.red.bold + req.url);
			console.log(e);
		});
	}
}).listen(proxyPort);

var driver = new webdriver.Builder()
    .withCapabilities(webdriver.Capabilities.firefox())
		.setProxy(proxy.manual({
			http: 'localhost:' + proxyPort
		}))
    .build();

driver.manage().timeouts().pageLoadTimeout(120000);
driver.get(argv.url).then(function() {
	driver.getTitle().then(function(title) {
		console.log('Page title: '.blue.bold + title);
	});
}).then(function() {
	console.log(beacons);
}).then(function() {
	driver.quit();
}).then(function() {
	outboundServer.close();
});

var isThisInteresting = function (request) {
	var beacon = beaconTests(request);
	if (beacon) {
		beacons[beacon.type] = beacons[beacon.type] || [];
		beacons[beacon.type].push(request.url);
		if (beacon.isBeacon) {
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
};