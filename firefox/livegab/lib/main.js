/*
  author: gabtub@gmail.com

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
    const  buttons = require('sdk/ui/button/action');
    const tabs = require("sdk/tabs");
    const environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    const system = require("sdk/system");

    /*
		  Notificaiton ids
	  */
    const PROCESS_CLOSED = 'process-notification';
    const LIVESTREAMER_PATH_NOT_FOUND = 'path-notification';
    const CLOSING_LIVESTREAMER = 'close-livestreamer';
    const OPENING_LIVESTREAMER = 'open-livestreamer';
    const NO_STREAMS_FOUND = 'no-streams-livestreamer';
    const DETERMINING_QUALITY_OPTIONS = 'determine-quality-options-livestreamer';
    const NOTIFICATION_FADE_DELAY = 3000;

    /*
		  GLOBALS 
	  */
    
    var DEBUG = 1;
    
    var outputBuffer = "";
    var livestreamerPath = "";
    var livestreamerSearchString = "";
    var livestreamerPathEnvironment = [];
    var pathDirectories = [];

    function init() {
        if(system.platform.toLowerCase() === "winnt"){
            livestreamerSearchString = "livestreamer.exe";
            livestreamerPathEnvironment = ["PATH=" + environment.get("PATH")];
            pathDirectories = environment.get("PATH").split(";");
        } else {
            livestreamerSearchString = "livestreamer";
            livestreamerPathEnvironment = ["PATH=" + environment.get("PATH"), "DISPLAY=" + environment.get("DISPLAY")];
            pathDirectories = environment.get("PATH").split(":");
        }

        findLivestreamerPath();
    }

    var launchLSButton = buttons.ActionButton({
        id: "open-livestreamer",
        label: "Open livestreamer for this page",
        accessKey: '8',
        icon: {
            "16": "./icon-16.png",
            "32": "./icon-32.png",
            "64": "./icon-64.png"
        },
        onClick: function() {
            determineStreamQualityOptions(displayQualityMenu);
        }
    });

    function displayNotification(id, message, prio) {
        let nb = windowUtils.getMostRecentBrowserWindow().getBrowser().getNotificationBox();
        let priority = prio || nb.PRIORITY_INFO_MEDIUM;
        let n = nb.getNotificationWithValue(id);
        if (n) {
            n.label = message;
        } else {
            var not = nb.appendNotification(message, id,
                                            'chrome://browser/skin/Info.png',
                                            priority, null);
            windowUtils.getMostRecentBrowserWindow().getBrowser().selectedBrowser.contentWindow.setTimeout(function() {
                nb.removeNotification(not);
            }, NOTIFICATION_FADE_DELAY);
        }
    }

    function displayQualityMenu(streams, url) {

        if(streams && streams.length < 1) {
            displayNotification(NO_STREAMS_FOUND, 'No streams found for this page');
        } else {
            let menuid = "select-quality-menu";
            let message = "select video quality";
            let nbButtons = [];
            let nb = windowUtils.getMostRecentBrowserWindow().getBrowser().getNotificationBox();
            let priority = nb.PRIORITY_INFO_MEDIUM;
            
            let i = 1;
            for (var qOption in streams) {
                nbButtons.push({
                    "accessKey": i++,
                    "callback": function(not, desc) {
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
    }

    function determineStreamQualityOptions(callback) {
        if (livestreamerPath === "") {
            displayNotification(LIVESTREAMER_PATH_NOT_FOUND, "Livestreamer path not found (yet?)!");
        } else {
            displayNotification(DETERMINING_QUALITY_OPTIONS, "Determining quality options...");
            let curUrl = windowUtils.getMostRecentBrowserWindow().getBrowser().selectedBrowser.contentWindow.location.href;
            outputBuffer = "";
            var p = subprocess.call({
                command: livestreamerPath,
                arguments: [curUrl, "-j"],
                environment: livestreamerPathEnvironment,
                stdin: function(stdin) {
                },
                stdout: function(data) {
                    outputBuffer = outputBuffer + data;
                },
                stderr: function(data) {
                    if(DEBUG === 1)
                        dump("got data on stderr:" + data + "\n");
                },
                done: function(result) {
                    if(DEBUG === 1)
                        dump("process terminated with " + result.exitCode + "\n");
                    var streams = JSON.parse(outputBuffer).streams;
                    if(DEBUG === 1){                    
                        for (var prop in streams) {
                            console.log("prop found: " + prop);
                        }
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
        for (let i = 0, max = pathDirectories.length; i < max; i++) {
            let iterator = new OS.File.DirectoryIterator(pathDirectories[i]);
            let entries = [];
            iterator.forEach(
                function onEntry(entry) {
                    if (entry.name === livestreamerSearchString) {
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
                console.log(i + "/" + pathDirectories.length + "fin");
            }
        }
    }

    function openStream(url, quality) {
        displayNotification(OPENING_LIVESTREAMER, "Opening URL in Livestreamer...");
        if(require('sdk/simple-prefs').prefs['DisableFlash']) {
            tabs.activeTab.attach({
                contentScript: 'var flashObjs = document.getElementsByTagName("object");while(flashObjs.length > 0){var e = flashObjs[0];var e2 = e.parentNode;e2.removeChild(e);}'
            });
        }
        var p = subprocess.call({
            command: livestreamerPath,
            arguments: [url, quality],
            environment: livestreamerPathEnvironment,
            stdin: function(stdin) {
            },
            stdout: function(data) {
                if(DEBUG===1)
                    dump("got data on stdout:" + data + "\n");
            },
            stderr: function(data) {
                if(DEBUG===1)
                    dump("got data on stderr:" + data + "\n");
            },
            done: function(result) {
                if(DEBUG===1)
                    dump("process terminated with " + result.exitCode + "\n");
                displayNotification(PROCESS_CLOSED, 'Stream closed');
            },
            mergeStderr: false
        });
    }
    init();
})();

