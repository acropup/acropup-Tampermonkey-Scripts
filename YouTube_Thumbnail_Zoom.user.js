// ==UserScript==
// @name         YouTube Thumbnail Zoom
// @version      0.5
// @description  Show large image previews for video thumbnails and channel images on YouTube. Ctrl+Right Click, or Left+Right Click to activate.
// @homepage     https://github.com/acropup/acropup-Tampermonkey-Scripts/
// @author       Shane Burgess
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

'use strict';

/* --- Various image URLs for thumbnails on YouTube ---

Video thumbnails in JPG and WEBP format
`https://i.ytimg.com/vi/${video_id}/${quality}${thumb_id}.jpg`
`https://i.ytimg.com/vi_webp/${video_id}/${quality}${thumb_id}.webp`
where quality can be any one of [ 'maxres', 'sd', 'hq', 'mq', '' ].
and thumb_id can be any one of [ 'default', '1', '2', or '3' ] to get different thumbnails.
'0.jpg' returns the same as 'hqdefault.jpg'. 'hq720.jpg' also exists for some reason.
Thoroughly described on https://stackoverflow.com/questions/2068344/how-do-i-get-a-youtube-video-thumbnail-from-the-youtube-api/#2068371

Thumbnails for (potentially) external links
https://i.ytimg.com/an/Q76dMggUH1M/18269099204233283421${quality}.jpg?v=62a185b9
where quality can be any one of [ '_hq', '_mq', '' ]. There might be more options; I haven't found any documentation on this.
The three different values are also unknown to me. The v parameter might even be unnecessary.

Channel avatar images
https://yt3.ggpht.com/ytc/AOPolaSgwLYXTPf0qvWzwZnysg1P8SVS6EfCfaA9PJjt=s400-c-k-c0x00ffffff-no-rj
Parameters like =s400-c-k-c0x00ffffff-no-rj, for ggpht.com-hosted images (uses Google App Engine),
are described on https://stackoverflow.com/a/25438197/1392830

TODO: - Make a long-press right-click trigger this; that might feel more natural.
      - Consider serving webp images rather than jpg, wherever possible.
      - Consider parallelizing the queries in query_for_best_image to find the largest available image asap.

This script currently doesn't work on:
Chapter thumbnails - img tag with id #img
                   - src="https://i.ytimg.com/vi/-et5eMyLlUs/hqdefault_132933.jpg?sqp=-oaymwEcCNACELwBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDycHn0XmezCkcfq65eJy9vzbobxA"
                   - seems to require the sqp an rs parameters
Playlist/mix thumbnails - It shows the thumbnail of the first video to play, which isn't necessarily the playlist image.
*/
(function() {
    'use strict';
    let overlay_image = (()=>{
        let outer_div = null;
        let big_img = null;

        let init_outer_div = function () {
            outer_div = document.createElement('div');
            let yt_app = document.querySelector("ytd-app #content");
            yt_app.append(outer_div);
            let s = outer_div.style;
            s.position = "fixed";
            s.width = "100%";
            s.height = "100%";
            s.top = 0;
            s.left = 0;
            s.backgroundColor = "#00000033";
            s.display = "flex";
            s.justifyContent = "center";
            s.zIndex = 99999;

            // Clicking anywhere should hide the overlay image
            outer_div.addEventListener("click", () => {
                outer_div.style.visibility = "hidden";
                document.removeEventListener("keydown", handle_esc_key);
            });
        };

        let init_big_img = function () {
            big_img = document.createElement('img');
            outer_div.append(big_img);
            let s = big_img.style;
            s.maxWidth = "100%";
            s.maxHeight = "100%";
            s.objectFit = "scale-down";
        };

        // Pressing Escape should hide the overlay image
        let handle_esc_key = function (e) {
            if (e.key === "Escape") {
                outer_div.style.visibility = "hidden";
                document.removeEventListener("keydown", handle_esc_key);
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };

        return function (img_src) {
            if (!outer_div) {
                init_outer_div();
            }
            outer_div.style.visibility = "visible";
            document.addEventListener("keydown", handle_esc_key);

            if (!big_img) {
                init_big_img();
            }
            big_img.src = img_src;
        };
    })();

/* No longer used:
    let video_id_from_url = function (url) {
        let video_id = url.match(/youtube\.com\/watch.*[?&]v=([a-zA-Z0-9_-]+)/)?.[1];
        video_id ??= url.match(/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]+)\//)?.[1];
        return video_id;
    };
*/
    // Remove outer url("...") from elem's BackgroundImage CSS style, and return just the URL
    let get_background_image_url = function (elem) {
        let img_url = elem.style.backgroundImage.match(/^url\(['"](http.*)['"]\)$/)?.[1];
        return img_url;
    }

    // Return URL for a big image, based on reference_url, which might be a link to a thumbnail of some sort, or a video link.
    let get_big_img_url = function (reference_url) {
        // Attempt to match video URLs:
        // https://www.youtube.com/watch?v=${video_id}
        // https://www.youtube.com/shorts/${video_id}
        let video_id = reference_url.match(/^https:\/\/www\.youtube\.com\/(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]+)/)?.[1];
        // Attempt to match video thumbnails:
        // https://i.ytimg.com/vi/${video_id}/${quality}default.jpg
        // https://i.ytimg.com/vi/${video_id}/hq720.jpg
        // https://i.ytimg.com/vi_webp/${video_id}/${quality}default.webp
        // https://i.ytimg.com/an_webp/${video_id}/${quality}default_6s.webp?du=3000&sqp=CL_hmagG&rs=AOn4CLC2oBC9qd6PSbagGYYEqBgbvqdfMw
        video_id ??= reference_url.match(/^https:\/\/i\.ytimg\.com\/(?:vi|an)(?:_webp)?\/([a-zA-Z0-9_-]+)\/(?:(?:maxres|sd|hq|mq)?default|hq720)(?:_[0-9]+s)?\.(?:jpg|webp)/)?.[1];
        if (video_id) {
            return query_for_best_image(video_id);
        }
        // Attempt to match channel avatar thumbnails:
        // https://yt3.ggpht.com/ytc/AOPolaSgwLYXTPf0qvWzwZnysg1P8SVS6EfCfaA9PJjt=s400-c-k-c0x00ffffff-no-rj
        // https://yt3.googleusercontent.com/O0FjIKFUiJd0sboAyZPd7IuaIFnkzC0Wt6JIt4P7tafJmRugCWYAeUHJAvTx5QwV9aGUZsR51O8=s176-c-k-c0x00ffffff-no-rj
        let ggpht_url = reference_url.match(/^https:\/\/yt3\.(?:googleusercontent|ggpht)\.com\/(?:yt[ci]\/)?[a-zA-Z0-9_-]+/)?.[0];
        if (ggpht_url) {
            // Thumbnails can be requested at any size, but 800px seems reasonable
            return ggpht_url + "=s800";
        }
        // Attempt to match thumbnails for (potentially) external links:
        // https://i.ytimg.com/an/Q76dMggUH1M/18269099204233283421_mq.jpg?v=62a185b9
        let ytimg_alt_url = reference_url.match(/^(https:\/\/i\.ytimg\.com\/an(?:_webp)?\/[a-zA-Z0-9]+\/[0-9a-f-]+)_[mh]q\.(?:jpg|webp)/)?.[1];
        if (ytimg_alt_url) {
            // Aside from _mq and _hq for medium and high quality, I don't know how to get larger images of this kind
            return ytimg_alt_url + "_hq.jpg";
        }
        return undefined;
    };

    // Not all videos have all sizes of thumbnail, so we have to test for what's available and then choose the best of those.
    // This requires a query (HEAD is sufficient) to see if the server returns 200 (present) or 404 (unavailable).
    let query_for_best_image = function (video_id) {
        let qualities = [ 'maxres', 'sd', 'hq', 'mq', '' ];
        let xhr = new XMLHttpRequest();
        for (let quality of qualities) {
            let url = `https://i.ytimg.com/vi/${video_id}/${quality}default.jpg`;
            // webp urls are like `https://i.ytimg.com/vi_webp/${video_id}/${quality}default.webp`;
            xhr.open('HEAD', url, false);
            xhr.send();
            if (xhr.status == 200) return url; // status is 404 for qualities that youtube doesn't have
        }
    };

    // Only handle events that are either Ctrl+Right click or Left+Right click
    let should_handle_event = function (e) {
        let ctrl_right_click = (e.ctrlKey && e.button == 2);
        let left_right_click = (e.button == 2 && e.buttons == 1);
        return ctrl_right_click || left_right_click;
    };

    /*let log_ancestors = function (elem) {
        if (!(elem instanceof HTMLElement)) return;
        while (elem && elem !== document.body) {
            let elem_queryselector = [
                elem.tagName,
                (elem.id ? "#" + elem.id : ""),
                (elem.className ? "." + elem.className.replaceAll(' ', '.') : ""),
                (elem.href ? "[href='" + elem.href + "']" : ""),
                (elem.src ? "[src='" + elem.src + "']" : "")
            ].join('');
            console.log(elem_queryselector);
            elem = elem.parentElement;
        }
    };*/

    document.addEventListener('contextmenu', function (e) {
        let elem = e.target;
        //log_ancestors(elem);
        //console.log("---------------------");
        if (!should_handle_event(e)) return;
        //console.log("button", e.button, e.type," buttons", e.buttons);
        console.log(elem);

        let reference_url = undefined;
        do { // A do{}while(false) loop lets us break to the end of the loop after setting reference_url
            if ((elem.nodeName == "DIV" && elem.id == "inline-preview-player") ||
                (elem.nodeName == "VIDEO" && elem.classList.contains("html5-main-video"))) {
                // This handles the larger thumbnail previews (where it'll play the entire video if you let it)
                // DIV#inline-preview-player for quick clicks on static thumbnail, VIDEO.video-stream.html5-main-video for clicks while playing the video
                let video_thumb_container = elem.closest('a#media-container-link.ytd-video-preview[href^="/watch"]');
                reference_url = video_thumb_container.href;
                break;
            }
            if (elem.nodeName == "DIV") {
                if (elem.classList.contains("iv-card-image") ||          // for thumbnails in the video player's cards drawer
                         elem.classList.contains("ytp-ce-expanding-image") || // for an end-scene channel overlay or external link overlay
                         elem.classList.contains("ytp-autonav-endscreen-upnext-thumbnail")) { // for the annoying up-next countdown autoplay video
                    reference_url = get_background_image_url(elem);
                    break;
                }
            }
            else if (elem.nodeName == "IMG" && !elem.src.startsWith("data:image/gif;base64")) {
                reference_url = elem.src;
                break;
            }
            // Some thumbnails are obscured by a number of (sometimes invisible) elements, so for these ones, we don't care so much about which
            // element is clicked, but we do care about whether its ancestor is one of interest.

            // Video thumbnails within the video player, including videowall (end-of-video suggestions) and video overlays (ytp-ce-covering).
            let videowall_thumb_anchor = elem.closest('a.ytp-videowall-still[href*="/watch?v="], a.ytp-ce-covering-overlay[href*="/watch?v="]');
            if (videowall_thumb_anchor) {
                reference_url = videowall_thumb_anchor.href;
                break;
            }
            // Video thumbnails that are on the page but not within the video player. This kind of thumbnail often has a 6 second preview.
            let video_thumb_anchor = elem.closest('a#thumbnail[href^="/watch"]');
            if (video_thumb_anchor) {
                reference_url = video_thumb_anchor.href;
                break;
            }
            // Channel avatars on homepage, subscriptions page, and channel pages exist in a convoluted yt-avatar-shape where img isn't the topmost element.
            let channel_avatar = elem.closest('yt-avatar-shape')?.querySelector('img');
            if (channel_avatar) {
                reference_url = channel_avatar.src;
                break;
            }
        } while (false);

        if (reference_url) {
            let big_img_url = get_big_img_url(reference_url);
            overlay_image(big_img_url);

            // We've handled this event, so stop it from bubbling up to the next handler
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, {capture: true});

})();