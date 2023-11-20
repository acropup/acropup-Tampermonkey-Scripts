// ==UserScript==
// @name         Imgur click video anywhere to toggle mute
// @namespace    https://github.com/acropup
// @version      0.1
// @description  When watching videos on imgur, click anywhere on the video to toggle mute.
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://imgur.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function click_video (event) {
        let v = event.target;
        if (v.nodeName == "VIDEO") {
            if (v.closest('.MediaPreview-wrapper')) {
                // Don't toggle audio on video previews within comments
                return;
            }
            let audio_btn = v.parentElement.parentElement.querySelector('.PostVideoControls-audio');
            if (audio_btn) {
                // Regularly posted video has a special audio control on imgur
                audio_btn.click();
            }
            else {
                // A video viewed from comments has regular controls (not the audio_btn), and needs
                // to preventDefault(), otherwise clicking to Mute/Unmute would Play/Pause as well.
                v.muted = !v.muted;
                event.preventDefault();
            }
        }
    }
    document.addEventListener('click',click_video);
})();