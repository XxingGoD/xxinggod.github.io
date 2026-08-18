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

function initSiteSearch() {
    var panel = document.querySelector('[data-search-panel]');
    if (!panel) return;

    var openButtons = Array.prototype.slice.call(document.querySelectorAll('[data-search-open]'));
    var closeButtons = Array.prototype.slice.call(panel.querySelectorAll('[data-search-close]'));
    var input = panel.querySelector('[data-search-input]');
    var results = panel.querySelector('[data-search-results]');
    var status = panel.querySelector('[data-search-status]');
    var indexNode = panel.querySelector('[data-search-index]');
    var posts = [];
    var isOpen = false;
    var lastFocused = null;
    var searchTimer = null;

    try {
        posts = JSON.parse(indexNode.textContent || '[]');
    } catch (error) {
        posts = [];
    }

    function normalise(value) {
        var text = String(value || '');
        if (text.normalize) text = text.normalize('NFKC');
        return text.toLocaleLowerCase();
    }

    posts.forEach(function (post) {
        post._title = normalise(post.title);
        post._excerpt = normalise(post.excerpt);
        post._tags = normalise((post.tags || []).join(' '));
        post._categories = normalise((post.categories || []).join(' '));
        post._search = normalise([
            post.title,
            post.excerpt,
            (post.tags || []).join(' '),
            (post.categories || []).join(' '),
            post.date
        ].join(' '));
    });

    function appendText(parent, tagName, className, value) {
        var element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = value;
        parent.appendChild(element);
        return element;
    }

    function scorePost(post, query, terms) {
        var score = 0;
        var matched = terms.every(function (term) {
            if (post._search.indexOf(term) === -1) return false;
            if (post._title === term) score += 120;
            else if (post._title.indexOf(term) === 0) score += 70;
            else if (post._title.indexOf(term) !== -1) score += 45;
            if (post._tags.indexOf(term) !== -1) score += 25;
            if (post._categories.indexOf(term) !== -1) score += 20;
            if (post._excerpt.indexOf(term) !== -1) score += 8;
            return true;
        });
        if (!matched) return -1;
        if (post._title.indexOf(query) !== -1) score += 35;
        return score;
    }

    function render() {
        var query = normalise(input.value).replace(/\s+/g, ' ').trim().slice(0, 200);
        var terms;
        var matches;
        results.textContent = '';

        if (!query) {
            status.textContent = 'TYPE_TO_SCAN_THE_ARCHIVE';
            return;
        }

        terms = query.split(' ');
        matches = posts.map(function (post, order) {
            return {post: post, score: scorePost(post, query, terms), order: order};
        }).filter(function (match) {
            return match.score >= 0;
        }).sort(function (left, right) {
            return right.score - left.score || left.order - right.order;
        }).slice(0, 20);

        if (!matches.length) {
            status.textContent = '0 SIGNALS_FOUND // TRY_ANOTHER_QUERY';
            return;
        }

        results.setAttribute('role', 'list');
        matches.forEach(function (match) {
            var post = match.post;
            var link = document.createElement('a');
            link.className = 'search-result';
            link.setAttribute('role', 'listitem');
            link.href = post.path;
            appendText(link, 'span', 'search-result__meta', (post.date || 'NO_DATE') + ' // TRANSMISSION');
            appendText(link, 'strong', 'search-result__title', post.title || 'UNTITLED_TRANSMISSION');
            appendText(link, 'span', 'search-result__excerpt', post.excerpt || 'NO_EXCERPT_AVAILABLE');
            var taxonomy = (post.categories || []).map(function (name) {
                return '[' + String(name).toLocaleUpperCase() + ']';
            }).concat((post.tags || []).map(function (name) { return '#' + name; })).join(' ');
            if (taxonomy) appendText(link, 'span', 'search-result__taxonomies', taxonomy);
            results.appendChild(link);
        });
        status.textContent = matches.length + ' SIGNAL' + (matches.length === 1 ? '' : 'S') + '_FOUND';
    }

    function openSearch(trigger) {
        if (isOpen) {
            input.focus();
            return;
        }
        lastFocused = trigger || document.activeElement;
        isOpen = true;
        panel.removeAttribute('hidden');
        panel.setAttribute('aria-hidden', 'false');
        panel.classList.add('is-open');
        document.body.classList.add('search-open');
        openButtons.forEach(function (button) { button.setAttribute('aria-expanded', 'true'); });
        status.textContent = 'INDEX_READY // ' + posts.length + ' LOGS';
        window.setTimeout(function () {
            input.focus();
            input.select();
        }, 0);
    }

    function closeSearch(restoreFocus) {
        if (!isOpen) return;
        isOpen = false;
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('hidden', 'hidden');
        document.body.classList.remove('search-open');
        openButtons.forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
        if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    openButtons.forEach(function (button) {
        button.setAttribute('aria-controls', 'search-panel');
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', function () { openSearch(button); });
    });
    closeButtons.forEach(function (button) {
        button.addEventListener('click', function () { closeSearch(true); });
    });
    input.addEventListener('input', function () {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(render, 90);
    });
    document.addEventListener('keydown', function (event) {
        var target = event.target;
        var isEditing = target && (target.matches('input, textarea, select') || target.isContentEditable);
        var focusable;
        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeSearch(true);
        } else if (event.key === 'Tab' && isOpen) {
            focusable = Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'))
                .filter(function (element) { return element.tabIndex !== -1; });
            if (!focusable.length) return;
            if (event.shiftKey && document.activeElement === focusable[0]) {
                event.preventDefault();
                focusable[focusable.length - 1].focus();
            } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
                event.preventDefault();
                focusable[0].focus();
            }
        } else if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
            event.preventDefault();
            openSearch(document.activeElement);
        } else if (event.key === '/' && !isEditing && !isOpen && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            event.preventDefault();
            openSearch(document.activeElement);
        }
    });
}


$(document).ready(function () {
    alphaDust.initPostHeader();
    alphaDust.initMenu();
    alphaDust.displayArchives();
    initArticleUi();
    initSiteSearch();
});
