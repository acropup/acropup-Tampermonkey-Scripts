// ==UserScript==
// @name         YouTube Playback Speed HUD
// @version      0.2
// @description  Show YouTube playback speed and time of day next to the Settings icon
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://www.youtube.com/*
// @run-at       document-start
// ==/UserScript==

/**** Playback speed keyboard shortcuts are Shift+> and Shift+<. ****/

/*** EDIT THESE VARS TO CUSTOMIZE THIS SCRIPT ***/
var SHOW_TIME_OF_DAY    = true;
var SHOW_PLAYBACK_SPEED = true;
var HIDE_PLAY_ON_TV_BTN = true; //Play on TV button is for sending to Chromecast
var HIDE_MINIPLAYER_BTN = true;
var HIDE_VIEW_SIZE_BTN  = false; //Toggle for Theater mode or Default view (keyboard shortcut 't' still works)


'use strict';
//Wait until video player is loaded before modifying HUD
on_player_ready(customize_HUD);

function customize_HUD() {
    if (SHOW_TIME_OF_DAY)    { show_time_of_day(); }
    if (SHOW_PLAYBACK_SPEED) { show_playback_speed(); }
    if (HIDE_PLAY_ON_TV_BTN) { hide_HUD_item("ytp-remote-button"); }
    if (HIDE_MINIPLAYER_BTN) { hide_HUD_item("ytp-miniplayer-button"); }
    if (HIDE_VIEW_SIZE_BTN)  { hide_HUD_item("ytp-size-button"); }
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

function missing_essential_elements() {
    if (undefined === get_right_control()) return true;
    //There is only one div of class "html5-video-player" per page/iframe.
    //The ID of this div (normally #movie_player) is inconsistent for embedded videos.
    var movie_player = document.getElementsByClassName("html5-video-player")[0];
    if (undefined === movie_player) return true;
    if (undefined === movie_player.getPlaybackRate) return true;
    return false;
}

function on_player_ready(callback, retries = 4) {
    //Execute callback once player is ready
    //"retries" parameter gives the page's javascript time to finish up after document.readyState says it's complete.
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
            }
        }
    }
    else {
        //All elements are loaded and ready
        callback();
    }
}

