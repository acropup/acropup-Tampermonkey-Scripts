// ==UserScript==
// @name         YouTube Playback Speed HUD
// @version      0.4
// @description  Show YouTube playback speed and time of day next to the Settings icon
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

'use strict';
/**** Playback speed keyboard shortcuts are Shift+> and Shift+< ****/
/****          EDIT THESE VARS TO CUSTOMIZE THIS SCRIPT         ****/
var SHOW_TIME_OF_DAY    = true;
var SHOW_PLAYBACK_SPEED = true;
var HIDE_PLAY_ON_TV_BTN = true; //Play on TV button is for sending to Chromecast
var HIDE_MINIPLAYER_BTN = true;
var HIDE_VIEW_SIZE_BTN  = false; //Toggle for Theater mode or Default view (keyboard shortcut 't' still works)
// The options below are not HUD-related tweaks, but they improve YouTube in different ways
var CONTINUOUS_THUMBNAIL_PREVIEW = true;
var SHOW_HIDE_SUGGESTED_VIDEOS = true; //Adds a button to hide the right column of suggested videos

//Wait until video player is loaded before modifying HUD
on_player_ready(customize_HUD);

function customize_HUD() {
    console.log("------------Customizing HUD-------------");
    if (SHOW_TIME_OF_DAY)    { show_time_of_day(); }
    if (SHOW_PLAYBACK_SPEED) { show_playback_speed(); }
    if (HIDE_PLAY_ON_TV_BTN) { hide_HUD_item("ytp-remote-button"); }
    if (HIDE_MINIPLAYER_BTN) { hide_HUD_item("ytp-miniplayer-button"); }
    if (HIDE_VIEW_SIZE_BTN)  { hide_HUD_item("ytp-size-button"); }
    if (CONTINUOUS_THUMBNAIL_PREVIEW) {
        //Set preview thumbnail videos to loop indefinitely
        // yt is a variable in global scope of the running window
        yt.config_.EXPERIMENT_FLAGS.preview_play_duration = 0; //TODO: have error handling here
    }
    if (SHOW_HIDE_SUGGESTED_VIDEOS) { show_hide_suggested(); }
}

var right_control; //placeholder for "ytp-right-controls" HUD container
function get_right_control() {
    right_control = right_control || document.getElementsByClassName("ytp-right-controls")[0];
    return right_control;
}

function add_HUD_item(class_name) {
    if (get_right_control()) {
        var new_item = document.createElement("div");
        new_item.className = class_name;
        right_control.insertBefore(new_item, right_control.firstChild);
        return new_item;
    }
}

function hide_HUD_item(itemClassName) {
    if (get_right_control()) {
        var hud_item = right_control.getElementsByClassName(itemClassName)[0];
        if (hud_item) {
            hud_item.style.display = "none";
        }
    }
}

function show_time_of_day() {
    //Add custom div to show current system time (useful when fullscreen)
    var system_time = add_HUD_item("ytp-button");
    if (system_time) {
        function update_time() {
            var d = (new Date()).toLocaleTimeString(); //Returns "HH:mm:ss AMPM"
            var t = d.substring(0, d.lastIndexOf(":"));//Keep "HH:mm" part
            if (system_time.innerText != t) {
                system_time.innerText = t;
            }
            //Update 5ms after the next minute has started
            var s = d.substr(d.lastIndexOf(":") + 1, 2);
            var next_update = 1000*(60-s) + 5;
            setTimeout(update_time, next_update);
        }
        update_time();
    }
}

function show_playback_speed() {
    //Add custom div to show current playback speed
    var speed_HUD = add_HUD_item("ytp-button");
    var playdiv = document.getElementsByClassName("html5-video-player")[0];
    function update_playback_speed() {
        var rate = playdiv.getPlaybackRate();
        if (rate) speed_HUD.innerText = rate + "x";
    };
    update_playback_speed();
    //Update speed_HUD every time there's a keypress or mouse click
        //TODO: Could filter these events somewhat, to act only in
        //      cases that might have affected playback speed.
    document.onclick = document.onkeyup = update_playback_speed;
}

function show_hide_suggested() {
    GM_addStyle(`
      ytd-watch-flexy #hide-related {
        position: absolute;
        right: 1rem;
        margin: -19px 0 0 0;
        cursor: pointer;
      }
      ytd-watch-flexy[is-two-columns_] #primary #hide-related {
        display: none;
      }
      ytd-watch-flexy #hide-related::before {
        content: "Hide suggested videos";
      }
      ytd-watch-flexy[hide-related_] #hide-related::before {
        content: "Show suggested videos";
      }
      ytd-watch-flexy[hide-related_] #related.ytd-watch-flexy {
        display: none;
      }`);

    let hide_btn = document.createElement('div');
    hide_btn.id = "hide-related";
    hide_btn.className = "more-button ytd-video-secondary-info-renderer";

    // This is where we put the hide-related_ attribute that triggers the above CSS rules
    let flex_layout = document.querySelector("#content ytd-watch-flexy");
    let hide_related_video_column = function() {
        flex_layout.toggleAttribute("hide-related_");
    }

    let hide_btn2 = hide_btn.cloneNode(true);
    hide_btn.onclick = hide_related_video_column;
    hide_btn2.onclick = hide_related_video_column;

    // Normally, the #related videos are in the #secondary column on the right, but
    // an especially narrow browser window hides the #secondary column, and places
    // the #related videos under the #merch-shelf in the #primary column.
    // We need a button for each location that #related may appear.
    let merch = document.querySelector("#primary-inner #merch-shelf");
    let right_column = document.querySelector("#secondary-inner");
    right_column.insertBefore(hide_btn, right_column.firstChild);
    merch.parentElement.insertBefore(hide_btn2, merch.nextSibling);
}

function missing_essential_elements() {
    if (undefined === get_right_control()) return true;
    //There is only one div of class "html5-video-player" per page/iframe.
    //The ID of this div (normally #movie_player) is inconsistent for embedded videos.
    var movie_player = document.getElementsByClassName("html5-video-player")[0];
    if (undefined === movie_player) return true;
    if (undefined === movie_player.getPlaybackRate) return true;
    if (SHOW_HIDE_SUGGESTED_VIDEOS && (document.querySelector("#secondary-inner #related") == null)) return true;
    return false;
}

function on_player_ready(callback, retries = 4) {
    //Execute callback once player is ready
    //"retries" parameter gives the page's javascript time to finish up after document.readyState says it's complete.

    console.log("testing if video player ready");

    if (missing_essential_elements()) {
        if (document.readyState != "complete") {
            setTimeout(()=>on_player_ready(callback), 250);
        }
        else {
            //Document is apparently complete, but not all elements are ready.
            //Give the page's javascript a little more time to finish up.
            if (retries > 0) {
                setTimeout(()=>on_player_ready(callback, retries-1), 250);
            }
            else {
                //Abandon customization if not all elements exist once page is finished loading
                console.log("+++++++++abandon HUD mods++++++++++++");
            }
        }
    }
    else {
        //All elements are loaded and ready
        callback();
    }
}
