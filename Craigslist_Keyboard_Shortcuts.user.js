// ==UserScript==
// @name         Craigslist Keyboard Shortcuts
// @namespace    https://github.com/acropup
// @version      0.1
// @description  Adds alt-key keyboard shortcuts to Craigslist listings, and shows hints of them with a letter inside square brackets (like "reply[r]"). This means to press Alt+r to reply.
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://*.craigslist.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let keys = [["h", ".banish"],
                ["u", ".unbanish"],
                ["s", ".fave"],
                ["s", ".unfave"],
                ["p", ".prev"],
                ["n", ".next"],
                ["r", ".reply-button"]];
    keys.forEach(i => {
        let elem = document.querySelector(i[1])
        elem.accessKey = i[0];
        let label = elem.querySelector(".action-label");
        elem = label || elem;
        elem.innerText += "[" + i[0] + "]";
    });
})();