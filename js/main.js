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
    var indexUrl = panel.getAttribute('data-search-index-url') || '/search.json';
    var posts = null;
    var indexLoading = false;
    var indexCallbacks = [];
    var isOpen = false;
    var lastFocused = null;
    var searchTimer = null;

    function normalise(value) {
        var text = String(value || '');
        if (text.normalize) text = text.normalize('NFKC');
        return text.toLocaleLowerCase();
    }

    function preparePosts(payload) {
        var entries = payload && Array.isArray(payload.posts) ? payload.posts : payload;
        if (!Array.isArray(entries)) throw new Error('Invalid search index');
        posts = entries.map(function (post) {
            post = post || {};
            post.title = String(post.title || 'UNTITLED_TRANSMISSION');
            post.excerpt = String(post.excerpt || '');
            post.tags = Array.isArray(post.tags) ? post.tags : [];
            post.categories = Array.isArray(post.categories) ? post.categories : [];
            post._title = normalise(post.title);
            post._excerpt = normalise(post.excerpt);
            post._tags = normalise(post.tags.join(' '));
            post._categories = normalise(post.categories.join(' '));
            post._search = normalise([
                post.title,
                post.excerpt,
                post._tags,
                post._categories,
                post.date
            ].join(' '));
            return post;
        });
    }

    function finishIndex(error, payload) {
        var callbacks = indexCallbacks.slice();
        indexCallbacks = [];
        indexLoading = false;
        if (!error) {
            try {
                preparePosts(payload);
            } catch (parseError) {
                error = parseError;
            }
        }
        callbacks.forEach(function (callback) { callback(error, posts || []); });
    }

    function loadWithXhr() {
        var request = new XMLHttpRequest();
        request.open('GET', indexUrl, true);
        request.setRequestHeader('Accept', 'application/json');
        request.onreadystatechange = function () {
            var payload;
            if (request.readyState !== 4) return;
            if (request.status < 200 || request.status >= 300) {
                finishIndex(new Error('Search index request failed'));
                return;
            }
            try {
                payload = JSON.parse(request.responseText);
                finishIndex(null, payload);
            } catch (error) {
                finishIndex(error);
            }
        };
        request.onerror = function () { finishIndex(new Error('Search index request failed')); };
        request.send(null);
    }

    function loadIndex(callback) {
        if (posts) {
            callback(null, posts);
            return;
        }
        indexCallbacks.push(callback);
        if (indexLoading) return;
        indexLoading = true;
        if (window.fetch) {
            window.fetch(indexUrl, {credentials: 'same-origin', headers: {Accept: 'application/json'}})
                .then(function (response) {
                    if (!response.ok) throw new Error('Search index request failed');
                    return response.json();
                })
                .then(function (payload) { finishIndex(null, payload); })
                .catch(function () { loadWithXhr(); });
        } else {
            loadWithXhr();
        }
    }

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

        if (!posts) {
            status.textContent = 'LOADING_LOCAL_INDEX…';
            loadIndex(function (error) {
                if (error) {
                    status.textContent = 'INDEX_OFFLINE // RETRY_LATER';
                    return;
                }
                render();
            });
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
        status.textContent = posts ? 'INDEX_READY // ' + posts.length + ' LOGS' : 'LOADING_LOCAL_INDEX…';
        if (!posts) {
            loadIndex(function (error, index) {
                if (error) status.textContent = 'INDEX_OFFLINE // RETRY_LATER';
                else if (!input.value) status.textContent = 'INDEX_READY // ' + index.length + ' LOGS';
                else render();
            });
        }
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

function initCodeCopy() {
    function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        var active = document.activeElement;
        var copied = false;

        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.setAttribute('aria-hidden', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            copied = document.execCommand('copy');
        } catch (error) {
            copied = false;
        }
        document.body.removeChild(textarea);
        if (active && typeof active.focus === 'function') active.focus();
        return copied;
    }

    function copyText(text, callback) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text).then(function () {
                callback(true);
            }).catch(function () {
                callback(fallbackCopy(text));
            });
        } else {
            callback(fallbackCopy(text));
        }
    }

    function sourceText(source) {
        var lines = source.querySelectorAll('.line');
        var value;

        if (lines.length) {
            value = Array.prototype.map.call(lines, function (line) {
                return line.textContent || '';
            }).join('\n');
        } else {
            value = source.textContent || source.innerText || '';
        }
        return value.replace(/\r\n/g, '\n').replace(/\n$/, '');
    }

    function createCopyButton(source) {
        var button = document.createElement('button');
        var resetTimer;

        button.type = 'button';
        button.className = 'code-copy-button';
        button.setAttribute('aria-label', '复制代码');
        button.textContent = '[COPY]';
        button.addEventListener('click', function () {
            copyText(sourceText(source), function (copied) {
                window.clearTimeout(resetTimer);
                button.textContent = copied ? '[COPIED]' : '[FAILED]';
                button.setAttribute('aria-label', copied ? '代码已复制' : '复制失败');
                button.classList.toggle('is-copied', copied);
                resetTimer = window.setTimeout(function () {
                    button.textContent = '[COPY]';
                    button.setAttribute('aria-label', '复制代码');
                    button.classList.remove('is-copied');
                }, 1800);
            });
        });
        return button;
    }

    function installCopyButtons() {
        document.querySelectorAll('figure.highlight').forEach(function (figure) {
            var source;
            if (figure.getAttribute('data-copy-ready') === 'true') return;
            source = figure.querySelector('td.code pre') || figure.querySelector('.code pre') || figure.querySelector('pre');
            if (!source) return;
            figure.setAttribute('data-copy-ready', 'true');
            figure.classList.add('has-code-copy');
            figure.appendChild(createCopyButton(source));
        });

        document.querySelectorAll('pre > code').forEach(function (code) {
            var pre = code.parentNode;
            var wrapper;
            if (pre.closest('figure.highlight') || pre.getAttribute('data-copy-ready') === 'true') return;
            wrapper = document.createElement('div');
            wrapper.className = 'code-block code-block--plain';
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            wrapper.appendChild(createCopyButton(code));
            pre.setAttribute('data-copy-ready', 'true');
            pre.classList.add('has-code-copy');
        });
    }

    installCopyButtons();
}


document.addEventListener('DOMContentLoaded', function () {
    initArticleUi();
    initSiteSearch();
    initCodeCopy();
});
