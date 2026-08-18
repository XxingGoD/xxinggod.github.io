var alphaDust = function () {

    var _menuOn = false;

    function initPostHeader() {
        $('.main .post').each(function () {
            var $post = $(this);
            var $header = $post.find('.post-header.index');
            var $title = $post.find('h1.title');
            var $readMoreLink = $post.find('a.read-more');

            var toggleHoverClass = function () {
                $header.toggleClass('hover');
            };

            $title.hover(toggleHoverClass, toggleHoverClass);
            $readMoreLink.hover(toggleHoverClass, toggleHoverClass);
        });
    }

    function _menuShow () {
        $('nav a').addClass('menu-active');
        $('.menu-bg').show();
        $('.menu-item').css({opacity: 0});
        TweenLite.to('.menu-container', 1, {padding: '0 40px'});
        TweenLite.to('.menu-bg', 1, {opacity: '0.92'});
        TweenMax.staggerTo('.menu-item', 0.5, {opacity: 1}, 0.3);
        _menuOn = true;

        $('.menu-bg').hover(function () {
            $('nav a').toggleClass('menu-close-hover');
        });
    }

    function _menuHide() {
        $('nav a').removeClass('menu-active');
        TweenLite.to('.menu-bg', 0.5, {opacity: '0', onComplete: function () {
            $('.menu-bg').hide();
        }});
        TweenLite.to('.menu-container', 0.5, {padding: '0 100px'});
        $('.menu-item').css({opacity: 0});
        _menuOn = false;
    }

    function initMenu() {

        if (!$('.menu-bg').length) return;

        $('nav a').click(function () {
            if(_menuOn) {
                _menuHide();
            } else {
                _menuShow();
            }
        });

        $('.menu-bg').click(function (e) {
            if(_menuOn && e.target === this) {
                _menuHide();
            }
        });
    }

    function displayArchives() {
        $('.archive-post').css({opacity: 0});
        TweenMax.staggerTo('.archive-post', 0.4, {opacity: 1}, 0.15);
    }

    return {
        initPostHeader: initPostHeader,
        initMenu: initMenu,
        displayArchives: displayArchives
    };
}();

function initArticleUi() {
    var article = document.querySelector('[data-article-content]');
    if (!article) return;

    var progress = document.querySelector('.reading-progress');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc-link[href^="#"]'));
    var tocEntries = tocLinks.map(function (link) {
        var id = link.getAttribute('href').slice(1);
        try {
            id = decodeURI(id);
        } catch (error) {
            return null;
        }
        var heading = document.getElementById(id);
        return heading ? {link: link, heading: heading} : null;
    }).filter(Boolean);
    var ticking = false;

    function updateArticleUi() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var scrollRange = document.documentElement.scrollHeight - window.innerHeight;

        if (progress) {
            var ratio = scrollRange > 0 ? Math.min(1, Math.max(0, scrollTop / scrollRange)) : 0;
            progress.style.setProperty('--reading-progress', ratio);
        }

        if (tocEntries.length) {
            var activationLine = scrollTop + (window.innerWidth <= 860 ? 150 : 200);
            var activeEntry = tocEntries[0];

            tocEntries.forEach(function (entry) {
                if (entry.heading.offsetTop <= activationLine) activeEntry = entry;
            });

            tocEntries.forEach(function (entry) {
                entry.link.classList.toggle('is-active', entry === activeEntry);
            });
        }

        ticking = false;
    }

    function requestUpdate() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(updateArticleUi);
    }

    updateArticleUi();
    window.addEventListener('scroll', requestUpdate, {passive: true});
    window.addEventListener('resize', requestUpdate);
}


$(document).ready(function () {
    alphaDust.initPostHeader();
    alphaDust.initMenu();
    alphaDust.displayArchives();
    initArticleUi();
});
