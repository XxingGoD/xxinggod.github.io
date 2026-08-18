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
    var modal = document.querySelector('[data-search-modal]');
    if (!modal) return;

    var openButtons = Array.prototype.slice.call(document.querySelectorAll('[data-search-open]'));
    var closeButton = modal.querySelector('[data-search-close]');
    var input = modal.querySelector('[data-search-input]');
    var results = modal.querySelector('[data-search-results]');
    var count = modal.querySelector('[data-search-count]');
    var empty = modal.querySelector('[data-search-empty]');
    var indexNode = modal.querySelector('[data-search-index]');
    var resultLabel = count.getAttribute('data-label') || 'MATCHES';
    var posts = [];

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
        post._search = normalise([
            post.title,
            post.subtitle,
            post.content,
            (post.tags || []).join(' '),
            (post.categories || []).join(' ')
        ].join(' '));
    });

    function appendText(parent, tagName, className, value) {
        var element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = value;
        parent.appendChild(element);
        return element;
    }

    function render() {
        var query = input.value.trim();
        var terms = normalise(query).split(/\s+/).filter(Boolean);
        var matches;

        if (!terms.length) {
            matches = posts.slice(0, 8);
        } else {
            matches = posts.filter(function (post) {
                return terms.every(function (term) { return post._search.indexOf(term) !== -1; });
            }).map(function (post) {
                var exactTitle = post._title === normalise(query) ? 4 : 0;
                var titleStart = post._title.indexOf(normalise(query)) === 0 ? 2 : 0;
                var titleTerms = terms.reduce(function (score, term) {
                    return score + (post._title.indexOf(term) !== -1 ? 1 : 0);
                }, 0);
                return {post: post, score: exactTitle + titleStart + titleTerms};
            }).sort(function (left, right) {
                return right.score - left.score;
            }).map(function (match) { return match.post; }).slice(0, 12);
        }

        results.textContent = '';
        count.textContent = matches.length + ' ' + resultLabel;
        empty.hidden = matches.length !== 0;

        matches.forEach(function (post) {
            var link = document.createElement('a');
            link.className = 'search-result';
            link.href = post.url;

            var meta = document.createElement('div');
            meta.className = 'search-result__meta';
            appendText(meta, 'time', '', post.date || 'UNDATED');
            appendText(meta, 'span', '', (post.categories || [])[0] || 'TRANSMISSION');
            link.appendChild(meta);

            appendText(link, 'h3', '', post.title || 'Untitled');
            var summary = String(post.subtitle || post.content || '').trim();
            if (summary) appendText(link, 'p', '', summary.slice(0, 180));
            if (post.tags && post.tags.length) {
                appendText(link, 'span', 'search-result__tags', post.tags.map(function (tag) { return '#' + tag; }).join('  '));
            }
            results.appendChild(link);
        });
    }

    function openSearch() {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        document.body.classList.add('search-is-open');
        render();
        window.setTimeout(function () { input.focus(); }, 0);
    }

    function closeSearch() {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
        document.body.classList.remove('search-is-open');
    }

    openButtons.forEach(function (button) { button.addEventListener('click', openSearch); });
    closeButton.addEventListener('click', closeSearch);
    input.addEventListener('input', render);
    modal.addEventListener('click', function (event) {
        if (event.target === modal) closeSearch();
    });
    modal.addEventListener('close', function () {
        document.body.classList.remove('search-is-open');
    });
    document.addEventListener('keydown', function (event) {
        var target = event.target;
        var isEditing = target && (target.matches('input, textarea, select') || target.isContentEditable);
        if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
            event.preventDefault();
            openSearch();
        } else if (event.key === '/' && !isEditing && !modal.open) {
            event.preventDefault();
            openSearch();
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
