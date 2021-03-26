// ==UserScript==
// @name         YouTube Playback Speed HUD
// @version      0.13
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
const SHOW_TIME_OF_DAY       = true;
const SHOW_PLAYBACK_SPEED    = true;
const HIDE_PLAY_ON_TV_BTN    = true;  // Play on TV button is for sending to Chromecast.
const HIDE_MINIPLAYER_BTN    = true;
const HIDE_VIEW_SIZE_BTN     = false; // Toggle for Theater mode or Default view (keyboard shortcut 't' still works).
const DISABLE_AUTOPLAY       = true;
const HIDE_PREVIOUS_NEXT_BTN = true;  // Hide the Previous and Next Video buttons (beside the Play/Pause button).
const NOTIFY_QUALITY_CHANGE  = true;
const ENFORCE_VIDEO_QUALITY  = "FULL";
/* ENFORCE_VIDEO_QUALITY can be set to:
     false  - Video quality not enforced. Youtube chooses "Auto" like usual.
     "MAX"  - The highest quality level for the video is chosen.
     "FULL" - Screen resolution is considered, and the highest quality for your screen resolution is chosen.
     Any quality name: "highres", "hd2880", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"
     Any y-resolution:  4320, 2880, 2160, 1440, 1080, 720, 480, 360, 240, 144 */

// The options below are not HUD-related tweaks, but they improve YouTube in different ways.
const ENABLE_QUALITY_PLUS_MINUS    = true; // Plus (+) key chooses higher video quality, Minus (-) key lowers video quality.
const ENABLE_3_SECOND_SEEK         = true; // Comma (,) and period (.) seek 3s back and forward, but only while a video is playing.
const OVERRIDE_UP_DOWN_KEYS        = true; // ArrowUp/Down shows/hides the overlay controls, Ctrl+ArrowUp/Down and Home/End scrolls page.
const ENABLE_HIDE_SUGGESTED_VIDEOS = true; // Adds a button to hide the right column of suggested videos.
const CONTINUOUS_THUMBNAIL_PREVIEW = true; // When hovering over video thumbnails, the video preview will repeat forever.

//Wait until video player is loaded before modifying HUD
on_player_ready(is_page_ready, customize_HUD);


function customize_HUD() {
    //This only needs to be done once, because the video player is reused 
    console.log("------------Customizing HUD-------------");
    if (SHOW_TIME_OF_DAY)    { show_time_of_day(); }
    if (SHOW_PLAYBACK_SPEED) { show_playback_speed(); }
    if (HIDE_PLAY_ON_TV_BTN) { hide_HUD_item(".ytp-button[aria-label='Play on TV']"); }
    if (HIDE_MINIPLAYER_BTN) { hide_HUD_item(".ytp-miniplayer-button"); }
    if (HIDE_VIEW_SIZE_BTN)  { hide_HUD_item(".ytp-size-button"); }
    if (DISABLE_AUTOPLAY)    { disable_autoplay();
                               hide_HUD_item('.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]'); }
    if (HIDE_PREVIOUS_NEXT_BTN) { hide_HUD_item(".ytp-prev-button");
                                  hide_HUD_item(".ytp-next-button"); }
    if (NOTIFY_QUALITY_CHANGE) { enable_notify_quality_change(); }
    if (ENFORCE_VIDEO_QUALITY) { enforce_video_quality(ENFORCE_VIDEO_QUALITY); }
    if (ENABLE_QUALITY_PLUS_MINUS)    { enable_quality_plus_minus(); }
    if (ENABLE_3_SECOND_SEEK)         { enable_3_second_seek(); }
    if (OVERRIDE_UP_DOWN_KEYS)        { override_up_down_keys(); }
    if (ENABLE_HIDE_SUGGESTED_VIDEOS) { enable_hide_suggested(); }
    if (CONTINUOUS_THUMBNAIL_PREVIEW) {
        //Set preview thumbnail videos to loop indefinitely        
        //unsafeWindow is Tampermonkey's reference to the page's global scope, yt is a variable in global scope
        let exp = unsafeWindow?.yt?.config_?.EXPERIMENT_FLAGS;
        if (exp.preview_play_duration) {
            exp.preview_play_duration = 0;
        }
    }
}

// YouTube API reference is https://developers.google.com/youtube/iframe_api_reference
// It is rather cursory, but it's better than nothing. Doesn't cover window.ytplayer, 
// window.yt or other global variables, some of which are useful.
// For example, all available video/audio stream formats and detailed properties are at:
// window.ytplayer.config.args.raw_player_response.streamingData.adaptiveFormats
// The currently active stream is the one where itag == movie_player.getVideoStats().fmt;

let movie_player;
let hud_controls;
let hud_right_controls; //placeholder for "ytp-right-controls" HUD container
const PlayerState = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, video_cued: 5 };

function get_movie_player() {
    //There is only one div of class "html5-video-player" per page/iframe.
    //The ID of this div (normally #movie_player) is inconsistent for embedded videos.
    movie_player = movie_player || document.getElementsByClassName("html5-video-player")[0];
    return movie_player;
}
function get_hud_controls() {
    hud_controls = hud_controls || document.getElementsByClassName("ytp-chrome-controls")[0];
    return hud_controls;
}
function get_right_controls() {
    hud_right_controls = hud_right_controls || document.getElementsByClassName("ytp-right-controls")[0];
    return hud_right_controls;
}

function add_HUD_item(class_name) {
    if (get_right_controls()) {
        var new_item = document.createElement("div");
        new_item.className = class_name;
        hud_right_controls.insertBefore(new_item, hud_right_controls.firstChild);
        return new_item;
    }
}
function hide_HUD_item(css_selector) {
    get_hud_controls()?.querySelector(css_selector)?.setAttribute("hidden", "");
}

function disable_autoplay() {
    document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]')?.click();
}

function show_time_of_day() {
    //Add custom div to show current system time (useful when fullscreen)
    var system_time = add_HUD_item("ytp-button");
    if (system_time) {
        function update_time() {
            var d = (new Date()).toLocaleTimeString();  //Returns "HH:mm:ss AMPM"
            var t = d.substring(0, d.lastIndexOf(":")); //Get "HH:mm" part
            var s = d.substr(d.lastIndexOf(":") + 1, 2);//Get "ss" part
            //Update displayed time to current
            system_time.innerText = t;
            //Schedule next update for 5ms after the next minute has started
            var next_update = 1000*(60-s) + 5;
            setTimeout(update_time, next_update);
        }
        update_time();
    }
}

function show_playback_speed() {
    //Add custom div to show current playback speed
    var speed_HUD = add_HUD_item("ytp-button");
    function update_playback_speed(rate) {
        if (rate) speed_HUD.innerText = rate + "x";
    };
    movie_player.addEventListener('onPlaybackRateChange', update_playback_speed);
    update_playback_speed(movie_player.getPlaybackRate());
}

let notify_quality_change = (() => {
    let hide_overlay_timer = undefined;
    let gear_svg = "";
    let get_gear_svg = function () {
        return gear_svg = gear_svg || get_right_controls().querySelector(".ytp-settings-button")?.innerHTML || "";
    };
    let reset_animation = function (elem) {
        elem.style.animation = 'none';
        elem.offsetHeight; /* trigger reflow */
        elem.style.animation = null;
    };
    let badge_class_list = function (quality_index) {
        let class_list = "ytp-bezel-icon";
        if (quality_index >= 0 && quality_index < q_badge_names.length) {
            class_list += " ytp-settings-button ytp-" + q_badge_names[quality_index] + "-quality-badge";
        }
        return class_list;
    };

    return function (e) {
        let overlay_text = movie_player.querySelector(".ytp-bezel-text");
        let outer = overlay_text.parentElement.parentElement;
        //Change the SVG within .ytp-bezel-icon, otherwise it'll be whatever it was last (play, pause, ffwd, rev, volume).
        let overlay_icon = outer.querySelector(".ytp-bezel-icon");
        overlay_icon.innerHTML = get_gear_svg();
        //I don't copy over the quality badge, such as HD (.ytp-hd-quality-badge), 2K, 4K, etc. 
        //because the badge hasn't been applied to the settings_btn yet. I'd need to do a mapping myself.
        let qu = e || movie_player.getPlaybackQuality();
        let qi = all_qualities.indexOf(qu);
        reset_animation(overlay_icon.parentElement);
        overlay_icon.classList = badge_class_list(qi);
        overlay_text.innerText = quality_names[qi];
        outer.style.removeProperty('display');
        outer.classList.remove('ytp-bezel-text-hide');
        clearTimeout(hide_overlay_timer); //In case quality is changed in rapid succession
        hide_overlay_timer = setTimeout(() => {
            outer.style.setProperty('display', 'none');
            overlay_icon.classList = "ytp-bezel-icon";
        }, 750);
    }
})();

function enable_notify_quality_change() {
    if (!get_movie_player()) return;
    movie_player.addEventListener('onPlaybackQualityChange', notify_quality_change);
}

// Video quality code was inspired by 'Youtube HD' by adisib. (https://greasyfork.org/en/scripts/23661-youtube-hd)
const all_qualities = ["highres", "hd2880", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];
const all_y_res     = [     4320,     2880,     2160,     1440,     1080,     720,     480,      360,     240,    144];
const quality_names = [     "8K",     "5K",     "4K",  "1440p",  "1080p",  "720p",  "480p",   "360p",  "240p", "144p"];
const q_badge_names = ["8k", "5K", "4k", "hd", "hd"]; //Badges are the red labels done as CSS ::after elements
function set_video_quality(desired_quality) {
    if (desired_quality.toLowerCase) desired_quality = desired_quality.toLowerCase();
    let current_quality = movie_player.getPlaybackQuality();
    let qu = "auto";
    let available_qualities = movie_player.getAvailableQualityLevels().filter(q => q != "auto");
    switch (desired_quality) {
        case "max": // Choose highest quality available
        {
            qu = available_qualities[0];
            break;
        }
        case "full": // Choose highest quality for user's screen (opt for higher quality if screen resolution is between quality levels)
        {
            let y_max = window.screen.height;
            let available_y_res = available_qualities.map((val) => all_y_res[all_qualities.indexOf(val)]);
            let y_match = available_y_res.reduce((prev, cur) => cur >= y_max ? cur : prev, available_y_res[0]);
            qu = all_qualities[all_y_res.indexOf(y_match)];
            break;
        }
        case "+": // Use + and - to increase and decrease playback quality
        case "-":
        {
            let current_index = available_qualities.indexOf(current_quality);
            let new_index = (desired_quality === "+") ? current_index - 1 : current_index + 1;
            new_index = new_index < 0 ? 0 : new_index < available_qualities.length ? new_index : available_qualities.length - 1;
            qu = available_qualities[new_index];
            break;
        }
        default: // Choose a quality based on provided name or y-resolution
        {   // If a specific quality is desired and not available, choose the next (lower) quality level.
            let desired_index = (isNaN(desired_quality))
                                ? all_qualities.indexOf(desired_quality)
                                : all_y_res.indexOf(desired_quality);
            if (desired_index >= 0) {
                let found_quality = all_qualities.slice(desired_index, all_qualities.length)
                                                 .find(q => available_qualities.includes(q));
                qu = found_quality || "auto";
            }
            break;
        }
    }
    movie_player?.setPlaybackQualityRange(qu);
    if (qu == current_quality) {
        //If quality didn't change, then an onPlaybackQualityChange event won't fire.
        //In this case, let's make sure the user still sees it.
        notify_quality_change(current_quality);
        console.log(`Quality requested '${desired_quality}': Already at '${qu}'`);
    }
    else {
        console.log(`Quality requested '${desired_quality}': Set to '${qu}'`);
    }
}

function enforce_video_quality(desired_quality = "FULL") {
    set_video_quality(desired_quality);
    let video_id = movie_player.getVideoData().video_id;
    let video_elem = movie_player.getElementsByTagName('video')[0];
    video_elem.addEventListener('loadstart', () => {
        // 'loadstart' event happens when a new video is loaded, OR when a different 
        // video quality is selected. We want to enforce video quality once per video, 
        // when it is first loaded.
        let new_video_id = movie_player.getVideoData().video_id;
        if (new_video_id != video_id) {
            video_id = new_video_id;
            set_video_quality(desired_quality);
        }
    });
}

function is_textbox_active() {
    let da = document.activeElement, dan = da.nodeName;
    return (dan == 'TEXTAREA' || dan == 'INPUT'
        || (dan == 'DIV' && da.isContentEditable));
}

function enable_3_second_seek() {
    //Less than 3s tends to be unreliable, probably because of the distance between video keyframes
    if (!get_movie_player()) return;
    let playback_rate = movie_player.getPlaybackRate();
    let frame_rate = 30;
    let update_frame_rate = function () {
        let qual = movie_player.getStatsForNerds().resolution; //Data example: "854x480@30 / 854x480@30"
        let fr = qual.substr(qual.lastIndexOf('@') + 1);
        frame_rate = parseInt(fr) || 30; //Default to 30 if fr is NaN
    };
    update_frame_rate();
    movie_player.addEventListener('onPlaybackRateChange', (e) => playback_rate = e);
    movie_player.addEventListener('onPlaybackQualityChange', update_frame_rate);

    //Seek some seconds fwd/back in clock time, not video time.
    let seek = function (seconds = 5) {
        let seek_time = seconds * playback_rate;
        movie_player.seekBy(seek_time);
    };
    //Typically for stepping +1 or -1 frame while paused
    let step = function (num_frames = 1) {
        let step_time = num_frames / frame_rate;
        movie_player.seekBy(step_time);
    };

    // Use https://keycode.info/ for key code reference
    document.addEventListener("keydown", (e) => {
        if (e.altKey || e.shiftKey) return;
        if (e.isComposing || is_textbox_active()) return;
        if (window.location.pathname !== "/watch") return;

        let ps = movie_player.getPlayerState();
        if (ps == PlayerState.playing || ps == PlayerState.buffering) {
            if (e.code == "ArrowLeft" && e.ctrlKey) { seek(-3); e.preventDefault(); }
            if (e.code == "ArrowRight" && e.ctrlKey) { seek(3); e.preventDefault(); }
        } else if (ps == PlayerState.paused) {
            if (e.code == "ArrowLeft" && e.ctrlKey) { step(-1); e.preventDefault(); }
            if (e.code == "ArrowRight" && e.ctrlKey) { step(1); e.preventDefault(); }
        }
        return;
    }, { capture: true });
    // Capture is needed so this keydown event handler runs during capturing phase, prior to the site's
    // standard event handlers (in the bubbling phase), so that we have the opportunity to call 
    // preventDefault() and suppress the normal behaviour.
}

function override_up_down_keys() {
    // Changes behaviour of ArrowUp, ArrownDown, Home, and End keys
    if (!get_movie_player()) return;

    // Use https://keycode.info/ for key code reference
    document.addEventListener("keydown", (e) => {
        if (e.altKey || e.shiftKey) return;
        if (e.isComposing || is_textbox_active()) return;
        if (window.location.pathname !== "/watch") return;

        if (e.ctrlKey || window.scrollY > 0) {
            // Arrow keys scroll the page vertically if not already at top, or if Ctrl+Arrow is pressed.
            // 40px seems to be the default scroll distance. I don't know if this is always true or should be compensated in some situations.
            //TODO: Calling scrollBy() with behavior: 'smooth' repeatedly, from holding down arrow keys, does not work well in Chrome.
            //      Currently using 'auto' snap scrolling to remedy this, but smooth interpolated scrolling would be better.
            if (e.code == "ArrowUp")   { window.scrollBy({ top: -40, left: 0, behavior: 'auto' }); e.preventDefault(); return; }
            if (e.code == "ArrowDown") { window.scrollBy({ top:  40, left: 0, behavior: 'auto' }); e.preventDefault(); return; }
        }
        else {
            // hideControls() hides controls until showControls(), and ignores mouse movement and play/pause state.
            // Regular time-based autohide uses '.html5-video-player.ytp-autohide', whereas hideControls() puts style attributes
            // on all HUD elements, such as movie_player.querySelector(".ytp-chrome-bottom").style.display == "none";
            if (e.code == "ArrowUp")   { movie_player.showControls(); movie_player.wakeUpControls(); e.preventDefault(); return; }
            if (e.code == "ArrowDown") { movie_player.hideControls(); e.preventDefault(); return; }
        }

        // By default, Home and End keys within the video player will seek to start start and end. Unnecessary and error-prone. Use 0 to seek to start.
        if (e.code == "Home") { window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); e.preventDefault(); return; }
        if (e.code == "End") { window.scrollTo({ top: document.scrollingElement.scrollHeight, left: 0, behavior: 'smooth' }); e.preventDefault(); return; }
        return;
    }, { capture: true });
    // Capture is needed so this keydown event handler runs during capturing phase, prior to the site's
    // standard event handlers (in the bubbling phase), so that we have the opportunity to call 
    // preventDefault() and suppress the normal behaviour.
}

function enable_quality_plus_minus() {
    if (!get_movie_player()) return;
    document.addEventListener("keyup", (e) => {
        if (e.altKey || e.ctrlKey) return;
        if (is_textbox_active()) return;
        switch (e.key) {
            case "+":
            case "=": {
                set_video_quality("+");
            } break;
            case "-":
            case "_": {
                set_video_quality("-");
            } break;
        }
        return;
    });
    // By default, the +/- keys next to backspace change the caption font size. This disables that.
    document.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey) return;
        if (is_textbox_active()) return;
        if (["+", "=", "-", "_"].includes(e.key)) e.preventDefault();
    }, { capture: true });
}

function enable_hide_suggested() {
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
    let hide_related_video_column = function () {
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

function isFunction(f) {
    return Object.prototype.toString.call(f) == '[object Function]';
}

function is_page_ready() {
    if (undefined === unsafeWindow.yt) return false; // unsafeWindow is Tampermonkey's reference to the page's global scope
    if (undefined === get_right_controls()) return false;
    if (undefined === get_movie_player()?.getPlaybackRate) return false;
    if (undefined === get_movie_player()?.getPlaybackQuality) return false;
    if (DISABLE_AUTOPLAY && document.querySelector('.ytp-autonav-toggle-button') == null) return false;
    if (ENABLE_HIDE_SUGGESTED_VIDEOS && ((document.querySelector("#secondary-inner") == null)
                                     || (document.querySelector("#related") == null))) return false;
    return true;
}

let keep_trying_timeout_id = 0;
function keep_trying(callback_try, callback_success = undefined, retries = 4, retry_ms = 200) {
    // 'callback_try' function is run every 'retry_ms' milliseconds, for a maximum of 'retries' attempts
    // after the page has completed loading. It may retry numerous times before the document is ready.
    // If 'callback_try' succeeds, then 'callback_success' function is run once (if one is provided).
    if (callback_try()) {
        if (isFunction(callback_success)) {
            callback_success();
        }
    }
    else {
        // Only start counting retries once document is loaded, to give the page's javascript a little more time to finish up.
        if (document.readyState == "complete") {
            retries--;
        }
        if (retries >= 0) {
            keep_trying_timeout_id = setTimeout(() => keep_trying(callback_try, callback_success, retries, retry_ms), retry_ms);
        }
    }
}

function on_player_ready(ready, callback) {
    if (ready()) {
        callback();
    }
    else {
        let on_nav_finished = function () {
            // There's a race condition where keep_trying() is still trying while user navigates 
            // and triggers another 'yt-navigate-finish' event. In this case, clear timeout so 
            // that previous keep_trying() is interrupted.
            clearTimeout(keep_trying_timeout_id);

            keep_trying(ready, () => {
                // Given that youtube reuses the video player, we can remove the event 
                // listener once we finally determine that the page is ready.
                window.removeEventListener("yt-navigate-finish", on_nav_finished);
                callback();
            });
        };
        window.addEventListener("yt-navigate-finish", on_nav_finished);
    }
}