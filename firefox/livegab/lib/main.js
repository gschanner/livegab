/*
<object style="visibility: visible;" id="ember949-flash-player" data="http://www-cdn.jtvnw.net/swflibs/TwitchPlayer.swf" type="application/x-shockwave-flash" height="100%" width="100%"><param value="always" name="allowScriptAccess"><param value="true" name="allowFullScreen"><param value="opaque" name="wmode"><param value="000000" name="bgcolor"><param value="channel=dota2ti&amp;hide_chat=true&amp;auto_play=true&amp;embed=0&amp;eventsCallback=Twitch.player.FlashPlayer2.callbacks.callback0" name="flashvars"></object>
*/
/*
  uses 
  https://github.com/ochameau/jetpack-subprocess
  https://github.com/chrippa/livestreamer
*/
"use strict";
(function() {
    /*
		GLOBAL CONSTS/IMPORTS
	*/
    const {
        Cc, Ci, Cu
    } = require("chrome");
    Cu.import("resource://gre/modules/Promise.jsm");
    const {
        TextEncoder, OS
    } = Cu.import("resource://gre/modules/osfile.jsm", {});
    const windowUtils = require("sdk/window/utils");
    const subprocess = require("subprocess");
    var buttons = require('sdk/ui/button/action');
    var tabs = require("sdk/tabs");
    var environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var outputBuffer = "";

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

    function init() {
        console.log("env: ");
        console.log(environment);
        console.log(environment.get(""));
        findLivestreamerPath();
        //findLivestreamerPath(determineStreamQualityOptions);
    }

    function myExt(path) {
        this.path = path;
    }
    myExt.prototype = {
        observe: function(aSubject, aTopic, aData) {
            if (DEBUG === 1) {
                console.log("observed " + this.path);
                console.log(aSubject);
                console.log(aTopic);
                console.log(aData);
            }
            let message = "";
            if (aSubject == {})
                message = "livestreamer (" + this.path + ") closed successfully!";
            else
                message = "livestreamer (" + this.path + ") failed to start!";
            removeRunningProcess(this.path);
            displayNotification(PROCESS_CLOSED, message);
        }
    };

    var launchLSButton = buttons.ActionButton({
        id: "open-livestreamer",
        label: "Open livestreamer for this page",
        accessKey: '8',
        icon: {
            "16": "./icon-16.png",
            "32": "./icon-32.png",
            "64": "./icon-64.png"
        },
        //onClick: handleClick
        onClick: function() {
            determineStreamQualityOptions(displayQualityMenu);
        }
    });

    function displayNotification(id, message) {
        gBrowser = windowUtils.getMostRecentBrowserWindow().getBrowser();
        nb = gBrowser.getNotificationBox();
        priority = nb.PRIORITY_INFO_MEDIUM;
        let n = nb.getNotificationWithValue(id);
        if (n) {
            n.label = message;
        } else {
            var not = nb.appendNotification(message, id,
                'chrome://browser/skin/Info.png',
                priority, null);
            gBrowser.selectedBrowser.contentWindow.setTimeout(function() {
                nb.removeNotification(not);
            }, NOTIFICATION_FADE_DELAY);

        }
    }

    function displayQualityMenu(streams, url) {
        let menuid = "select-quality-menu";
        let message = "select video quality";
        let nbButtons = [];
        gBrowser = windowUtils.getMostRecentBrowserWindow().getBrowser();
        nb = gBrowser.getNotificationBox();
        priority = nb.PRIORITY_INFO_MEDIUM;

        /*
          accessKey - the accesskey to appear on the button
          callback - function to be called when the button is activated. This function is passed two arguments:
          the <notification> the button is associated with
          the button description as passed to appendNotification.
          label - the label to appear on the button
          popup - the id of a popup for the button. If null, the button is a button popup.
         */

        let i = 1;
        for (var qOption in streams) {
            nbButtons.push({
                "accessKey": i++,
                "callback": function(not, desc) {
                    //console.log("success");console.log(desc);console.log(not);
                    openStream(url, desc.label);
                },
                "label": qOption,
                "popup": null
            });
        }
        let n = nb.getNotificationWithValue(menuid);
        if (n) {
            n.label = message;
        } else {
            var not = nb.appendNotification(message, menuid,
                'chrome://browser/skin/Info.png',
                priority, nbButtons);
        }
    }

    function determineStreamQualityOptions(callback) {
        if (livestreamerPath === "") {
            displayNotification(LIVESTREAMER_PATH_NOT_FOUND, "Livestreamer path not found (yet?)!");
        } else {
            let curUrl = windowUtils.getMostRecentBrowserWindow().getBrowser().selectedBrowser.contentWindow.location.href;
            var env = ["PATH=" + environment.get("PATH"), "DISPLAY=" + environment.get("DISPLAY")];
            outputBuffer = "";
            var p = subprocess.call({
                command: livestreamerPath,

                // Print stdin and our env variable
                arguments: [curUrl, "-j"],
                environment: env,

                stdin: function(stdin) {
                    stdin.write("some value to write to stdin\nfoobar");
                    stdin.close();
                },
                stdout: function(data) {
                    //dump("got data on stdout:" + data + "\n");
                    //console.log(data);
                    outputBuffer = outputBuffer + data;
                    /*
                      var streams = data;
                      for(var prop in streams){
                      console.log("prop found: "+prop);
                      }
                    */
                },
                stderr: function(data) {
                    dump("got data on stderr:" + data + "\n");
                },
                done: function(result) {
                    console.log(result);
                    dump("process terminated with " + result.exitCode + "\n");
                    var streams = JSON.parse(outputBuffer).streams;
                    for (var prop in streams) {
                        console.log("prop found: " + prop);
                    }
                    if (callback) {
                        callback(streams, curUrl);
                    }
                },
                mergeStderr: false
            });
        }
    }

    function findLivestreamerPath(callback) {

        let path = environment.get("PATH");
        let paths = path.split(":");

        for (let i = 0; i < paths.length; i++) {
            let iterator = new OS.File.DirectoryIterator(paths[i]);
            let entries = [];
            iterator.forEach(
                function onEntry(entry) {
                    if (entry.name === "livestreamer") {
                        if (DEBUG === 1) {
                            console.log("Found livestreamer!:\n");
                            console.log(entry);
                        }
                        livestreamerPath = entry.path;
                        if (callback) {
                            callback();
                        }
                    }
                }
            );
            if (livestreamerPath !== "")
                break;
            if (DEBUG === 1) {
                console.log(i + "/" + paths.length + "fin");
            }
        }
    }

    function removeRunningProcess(processURL) {
        if (DEBUG === 1) {
            console.log("removing url " + processURL);
        }
        try {
            running[processURL].kill();
        } catch (e) {

        }
        delete running[processURL];
        displayNotification(CLOSING_LIVESTREAMER, "Livestreamer closed!");
    }

    // http://www.twitch.tv/dota2ti
    function openStream(url, quality) {
        displayNotification(OPENING_LIVESTREAMER, "Opening URL in Livestreamer...");
        tabs.activeTab.attach({
            //contentScript: 'var flashObjs = document.getElementsByTagName("object");alert("test"+flashObjs.length);for (var i=0, max=flashObjs.length; i < max; i++){alert(flashObjs.length);var e = flashObjs[i];var e2 = e.parentNode;e2.removeChild(e);}'
            contentScript: 'var flashObjs = document.getElementsByTagName("object");while(flashObjs.length > 0){var e = flashObjs[0];var e2 = e.parentNode;e2.removeChild(e);}'
        });
        /*
        var document = windowUtils.getMostRecentBrowserWindow().getBrowser().contentDocument;
        var flashObjs = document.getElementsByTagName("object");
        for (var i=0, max=flashObjs.length; i < max; i++){
            windowUtils.getMostRecentBrowserWindow().getBrowser().selectedBrowser.contentWindow.swfobject.removeSWF(flashObjs[i].id);
        }*/
        console.log(livestreamerPath);
        console.log(url);
        console.log(quality);
        console.log(environment.get("DISPLAY"));
        var p = subprocess.call({
            command: livestreamerPath,

            // Print stdin and our env variable
            arguments: [url, quality],
            environment: ["PATH=" + environment.get("PATH"), "DISPLAY=" + environment.get("DISPLAY")],

            stdin: function(stdin) {
                //stdin.write("some value to write to stdin\nfoobar");
                //stdin.close();
            },
            stdout: function(data) {
                dump("got data on stdout:" + data + "\n");
            },
            stderr: function(data) {
                dump("got data on stderr:" + data + "\n");
            },
            done: function(result) {
                dump("process terminated with " + result.exitCode + "\n");
            },
            mergeStderr: false
        });
    }
    /*
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
				/*
				let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

				process.init(file);
				process.runAsync(params, params.length, new myExt(params[0]));	
				running[curUrl] = process;*
				var p = subprocess.call({
						command:     livestreamerPath,
						
						// Print stdin and our env variable
						arguments:   params,
						environment: null,
						
						stdin: function(stdin) {
							stdin.write("some value to write to stdin\nfoobar");
							stdin.close();
						},
						stdout: function(data) {
							dump("got data on stdout:" + data + "\n");
						},
						stderr: function(data) {
							dump("got data on stderr:" + data + "\n");
						},
						done: function(result) {
							dump("process terminated with " + result.exitCode + "\n");
						  						},
						mergeStderr: false
						});
				if(DEBUG === 1){
					console.log("Starting: "+livestreamerPath+ "with "+curUrl);
					console.log("running info:");
					console.log(running);
					console.log(running[curUrl]);
				}
			}
			
		}
	}
*/
    init();
})();

