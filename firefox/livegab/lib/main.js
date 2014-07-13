"use strict";
(function(){
	/*
		GLOBAL CONSTS/IMPORTS
	*/
	const {Cc,Ci, Cu} = require("chrome");
	Cu.import("resource://gre/modules/Promise.jsm");
	const {TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
	const windowUtils = require("sdk/window/utils");
	var buttons = require('sdk/ui/button/action');
	var tabs = require("sdk/tabs");

	var DEBUG = 1;

	/*
		Notificaiton ids
	*/
	const PROCESS_CLOSED = 'process-notification';
	const LIVESTREAMER_PATH_NOT_FOUND = 'path-notification';
	const CLOSING_LIVESTREAMER = 'close-livestreamer';
	const OPENING_LIVESTREAMER = 'open-livestreamer';
	const NOTIFICATION_FADE_DELAY = 3000;

	/*
		GLOBALS 
	*/
	var nb;
	var priority;
	var gBrowser;
	var livestreamerPath = "";
	var running = {};

	function init(){
		findLivestreamerPath();
	}

	function myExt(path) {this.path = path;}
	myExt.prototype = {
	  observe: function(aSubject, aTopic, aData) {
	  	if(DEBUG===1){
	  		console.log("observed "+this.path);
		  	console.log(aSubject);
		  	console.log(aTopic);
		  	console.log(aData);	
	  	}
	  	let message = "";
	  	if(aSubject == {})
	  		message = "livestreamer ("+this.path+") closed successfully!";
	  	else
	  		message = "livestreamer ("+this.path+") failed to start!";
	  	removeRunningProcess(this.path);
	  	displayNotification(PROCESS_CLOSED, message);
	  }
	};

	var launchLSButton = buttons.ActionButton({
	  id: "open-livestreamer",
	  label: "Open livestreamer for this page",
	  icon: {
	    "16": "./icon-16.png",
	    "32": "./icon-32.png",
	    "64": "./icon-64.png"
	  },
	  onClick: handleClick
	});

	function displayNotification(id, message){
		gBrowser = windowUtils.getMostRecentBrowserWindow().getBrowser();
		nb = gBrowser.getNotificationBox();
		priority = nb.PRIORITY_INFO_MEDIUM;
	  	let n = nb.getNotificationWithValue(id);
		if(n) {
		    n.label = message;
		} else {
			var not = nb.appendNotification(message, id,
	                         'chrome://browser/skin/Info.png',
	                          priority, null);
			gBrowser.selectedBrowser.contentWindow.setTimeout(function(){
				nb.removeNotification(not);
			}, NOTIFICATION_FADE_DELAY);

		}
	}

	function findLivestreamerPath(){
		let environment = Cc["@mozilla.org/process/environment;1"]
	                            .getService(Ci.nsIEnvironment);
		let path = environment.get("PATH");
		let paths = path.split(":");

		for(let i = 0; i < paths.length; i++) {
			let iterator = new OS.File.DirectoryIterator(paths[i]);
			let entries = [];
			iterator.forEach(
				function onEntry(entry) {
					if(entry.name==="livestreamer"){
						if(DEBUG === 1){
							console.log("Found livestreamer!:\n");
							console.log(entry);
						}
						livestreamerPath = entry.path;	
					}
				}
			);
			if(livestreamerPath !== "")
				break;
			if(DEBUG === 1){
				console.log(i+"/"+paths.length+"fin");
			}
		}
	}

	function removeRunningProcess(processURL){
		if(DEBUG === 1){
			console.log("removing url "+processURL);
		}
		try {
			running[processURL].kill();
		} catch(e){

		}
		delete running[processURL];
		displayNotification(CLOSING_LIVESTREAMER, "Livestreamer closed!");
	}

	function handleClick(state) {
		if(livestreamerPath === ""){
			displayNotification(LIVESTREAMER_PATH_NOT_FOUND, "Livestreamer path not found (yet?)!");
		} else {
			let curUrl = windowUtils.getMostRecentBrowserWindow().getBrowser().selectedBrowser.contentWindow.location.href;
			if(typeof running[curUrl] != "undefined"){
				if(DEBUG === 1){
					console.log("killing already open url "+curUrl);
				}
				removeRunningProcess(curUrl);
			} else {
				displayNotification(OPENING_LIVESTREAMER, "Opening URL in Livestreamer...");
				let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
				file.initWithPath(livestreamerPath);				
				
				if(DEBUG === 1){
					console.log("url"+curUrl);
				}
				let params = [curUrl, "best"];
				let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

				process.init(file);
				process.runAsync(params, params.length, new myExt(params[0]));	
				running[curUrl] = process;
				if(DEBUG === 1){
					console.log("Starting: "+livestreamerPath+ "with "+curUrl);
					console.log("running info:");
					console.log(running);
					console.log(running[curUrl]);
				}
			}
			
		}
	}
	init();
})();