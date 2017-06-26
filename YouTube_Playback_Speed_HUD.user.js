// ==UserScript==
// @name         YouTube Playback Speed HUD
// @version      0.1
// @description  Show YouTube playback speed next to the Settings icon
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://www.youtube.com/watch*
// @match        https://www.youtube.com/embed*
// ==/UserScript==

/**** Note! Playback speed HUD does not appear until you've changed ****
 **** the speed at least once on the current page.                  ****
 **** Playback speed keyboard shortcuts are Shift+> and Shift+<.    ****/
 
(function() {
    'use strict';
    var right_control = document.getElementsByClassName("ytp-right-controls")[0];
    
    //Add custom div to show current system time (useful when fullscreen)
    (function() {
        var system_time = document.createElement("div");
        system_time.className = "ytp-button";
        right_control.insertBefore(system_time, right_control.firstChild);
        var updateTime = function() {
            var d = (new Date()).toLocaleTimeString(); //Returns "HH:mm:ss AMPM"
            system_time.innerText = d.substring(0, d.lastIndexOf(":"));
        };
        updateTime();
        //Update every minute
        setInterval(updateTime, 60000);
    })();
    
    //Add custom div to show current playback speed
    var speed_HUD = document.createElement("div");
    speed_HUD.className = "ytp-button";
    right_control.insertBefore(speed_HUD, right_control.firstChild);
    
    /* Notes as of 24/06/2017:
    - ytp-bezel element does not have aria-label attribute until 
      playback speed is adjusted by keyboard shortcuts.
    - ytp-bezel's aria-label attribute does not update when
      playback speed is adjusted through the Settings menu.
    - <div class="ytp-menuitem-label">Speed</div> does not exist 
      until the Settings menu is accessed for the first time.
    - If Speed menuitem exists, its value is always correct.
    */
    
    var speed_source_overlay;
    var speed_source_menuitem;
    var getPlaybackSpeed = function() {
		//Check menuitem first, because overlay doesn't update if Settings menu is used
		if (!speed_source_menuitem) {
			var settings = document.getElementsByClassName("ytp-menuitem-label");
			for (var i = 0; i < settings.length; i++) {
				if (settings[i].innerText == "Speed") break;
			}
			if (i < settings.length) {
				speed_source_menuitem = settings[i].nextSibling;
			}
		}
		if (speed_source_menuitem) {
			var spd = speed_source_menuitem.innerText;
			return (spd == "Normal") ? "1x" : spd + "x";
		}
		//Check overlay if user hasn't opened the Settings menu yet
		if (!speed_source_overlay) {
			speed_source_overlay = document.getElementsByClassName("ytp-bezel")[0];
		}
		if (speed_source_overlay) {
			//speed_source_overlay has a label attribute of the form "Speed is 1.25"
			var spd = speed_source_overlay.getAttribute('aria-label');
			var match = /Speed is (.*)/.exec(spd);
			if (match) return match[1] + 'x';
		}
		//If neither element is initialized yet, return nothing
		return "";
    };
    
    //Update speed_HUD every time there's a keypress or mouse click
    document.onclick = document.onkeydown = function(e) {
        var new_speed = getPlaybackSpeed();
        if (new_speed) speed_HUD.innerText = new_speed;
    };
})();
