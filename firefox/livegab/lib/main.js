const {Cc,Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Promise.jsm");
const {TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});

var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var livestreamerPath = "";

function myExt() {}
myExt.prototype = {
  observe: function(aSubject, aTopic, aData) {
  	console.log("observed");
  	console.log(aSubject);
  	console.log(aTopic);
  	console.log(aData);
  	/*
    switch (aTopic) {
      case "quit-application":
        stopServer();
        obs.removeObserver(this, "quit-application");
        break;
      case "profile-after-change":
        startServer();
        obs.addObserver(this, "quit-application", false);
        break;
    }
    */
  }
};
var button = buttons.ActionButton({
  id: "mozilla-link",
  label: "Visit Mozilla",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

var button2 = buttons.ActionButton({
  id: "gab-link",
  label: "HORSE",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

function handleClick(state) {
	let environment = Cc["@mozilla.org/process/environment;1"]
                            .getService(Ci.nsIEnvironment);
	let path = environment.get("PATH");
	let paths = path.split(":");
	let promises = [];

	for(let i = 0; i < paths.length; i++) {
		let iterator = new OS.File.DirectoryIterator(paths[i]);
		let entries = [];
		promises[i] = iterator.forEach(
			function onEntry(entry) {
				if(livestreamerPath !== ""){
					Promise.reject(Error("Already found!"));				
				}
				if(entry.name==="livestreamer"){
					console.log("Found livestreamer!:\n");
					console.log(entry);
					livestreamerPath = entry.path;	
					Promise.resolve("Found Path!");
				}
					
				/*
				if ("winLastWriteDate" in entry) {
				  // Under Windows, additional information allows us to sort files immediately
				  // without having to perform additional I/O.
				  entries.push({entry: entry, creationDate: entry.winCreationDate});
				} else {
				  // Under other OSes, we need to call OS.File.stat
				  return OS.File.stat(entry.path).then(
				    function onSuccess(info) {
				      entries.push({entry:entry, creationDate: info.creationDate});
				    }
				  );
				}*/
			}
		);
		if(livestreamerPath !== "")
			break;
		console.log(i+"/"+paths.length+"fin");
	}	
	Promise.all(promises).then(function(arrayOfResults) {
		console.log(arrayOfResults);
		
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
		file.initWithPath(livestreamerPath);				
		var params = ["http://www.twitch.tv/dota2ti_ru"];
		var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

		console.log("Starting: "+livestreamerPath+ "with "+params[0]);
		process.init(file);
		//process.run(false, params, params.length);
		process.runAsync(params, params.length, new myExt());
		/*promise.then(
			function onSuccess() {
				console.log("Success!");
				// Close the iterator, sort the array, return it
				iterator.close();

				var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
				file.initWithPath(livestreamerPath);				
				var params = ["http://www.twitch.tv/dota2ti_ru"];
				var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

				console.log("Starting: "+livestreamerPath+ "with "+params[0]);
				process.init(file);
				//process.run(false, params, params.length);
				process.runAsync(params, params.length, new myExt());
				/*
				return entries.sort(function compare(a, b) {
				  	return a.creationDate - b.creationDate;
				});/
			},
			function onFailure(reason) {
				console.log("Failure!");
				 // Close the iterator, propagate any error
				iterator.close();
				throw reason;
			}
		);
		*/
	});
}