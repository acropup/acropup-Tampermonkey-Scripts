// ==UserScript==
// @name         Google Search Disorder
// @namespace    https://github.com/acropup
// @version      0.1
// @description  Google thinks it's a good idea to randomize the order of search categories (Web, Images, Maps, etc) at the top of search results. I don't think it's a good idea. This fixes it.
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://www.google.com/search*
// @run-at       document-end
// @grant        none
// ==/UserScript==


'use strict';
//TODO: This script fails on Google Images, because the page structure is slightly different
//      from all the other search results pages. There is no #top_nav, among other things.
let proper_order = [ "All", "Images", "Maps", "News", "Finance", "Flights", "Books", "Shopping", "Videos" ];

keep_trying(fix_search_disorder);

function fix_search_disorder() {
    let top_nav,
        search_modes,
        more_modes_menu,
        more_modes;

    try { //Some of these might be null if the page isn't finished loading
        top_nav = document.querySelector("#top_nav #hdtb-msb-vis");
        search_modes = Array.from(top_nav.querySelectorAll(".hdtb-mitem"));
        // The More... menu exists in one of two places, whether it's open or not.
        more_modes_menu = document.querySelector("#hdtb-msb > div:nth-child(1) g-menu") //when menu closed
                          || document.querySelector("#lb > .EwsJzb.sAKBe > g-menu");    //when menu active
        more_modes = Array.from(more_modes_menu.querySelectorAll("g-menu-item"));
        //Only ready to proceed with script if we found elements for all of these
        if (!top_nav || !search_modes[0] || !more_modes_menu || !more_modes[0]) {
            return false;
        }
    } catch (err) {
        //Page is probably not finished loading
        return false;
    }

    let convert_elem = function() {
        let reference_elem = top_nav.querySelector(".hdtb-mitem:not(.hdtb-msel)");
        return function(data_elem) {
            let result = reference_elem.cloneNode(true);
            // Transfer the link URL
            result.getElementsByTagName('a')[0].href = data_elem.getElementsByTagName('a')[0].href;
            // Transfer the text label
            result.getElementsByTagName('a')[0].lastChild.textContent = data_elem.textContent;
            // Transfer the SVG icon
            result.getElementsByTagName('path')[0].setAttribute("d", data_elem.getElementsByTagName('path')[0].getAttribute("d"));
            return result;
        };
    }();

    search_modes = search_modes.concat(more_modes.map(convert_elem));
    let search_modes_ordered = search_modes.map(m => [ m, proper_order.indexOf(m.innerText) ])
                                           .sort((m1, m2) => m1[1]-m2[1])
                                           .map(m => m[0]);
    let next_child = top_nav.firstChild;
    let next_menu_item = more_modes_menu.firstChild;
    search_modes_ordered.forEach((m,i) => {
        top_nav.insertBefore(m, next_child);
        next_child = next_child?.nextSibling || null;
    });

    // Hide the More... menu button
    top_nav.nextSibling.style.display = "none";
    return true;
}


function keep_trying(callback, retries = 4) {
    //Execute callback until it succeeds (returns true)
    //"retries" parameter gives the page's javascript time to finish up after document.readyState says it's complete.

    if (!callback()) {
        if (document.readyState != "complete") {
        console.log("try");
            setTimeout(()=>keep_trying(callback), 50);
        }
        else if (retries > 0) {
        console.log("retry");
            //Document is apparently complete, but not all elements are ready.
            //Give the page's javascript a little more time to finish up.
            setTimeout(()=>keep_trying(callback, retries-1), 250);
        }
    }
}