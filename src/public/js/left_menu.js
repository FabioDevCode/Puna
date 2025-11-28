document.addEventListener('DOMContentLoaded', () => {
    try {
        const asideNav = document.querySelector('aside nav');
        if (!asideNav) {
            return;
        }

        const anchors = Array.from(asideNav.querySelectorAll('a[href]'));
        if (!anchors.length) {
            return;
        }

        const activePathRaw = window.location.pathname || '/';
        const activePath = activePathRaw.replace(/\/+$|\/$/, '') || '/';

        // find best matching anchor (longest matching path)
        let bestMatch = null;
        let bestScore = -1;

        anchors.forEach((a) => {
            const href = a.getAttribute('href');
            if (!href) {
                return;
            }
            // resolve relative urls
            let url;
            try {
                url = new URL(href, window.location.origin);
            } catch (err) {
                return;
            }
            const linkPath = (url.pathname || '/').replace(/\/+$|\/$/, '') || '/';

            // exact match
            if (activePath === linkPath) {
                const score = linkPath.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = a;
                }
                return;
            }

            // prefix match (avoid matching root '/')
            // Match if the active path starts with the link path followed by '/'
            if (linkPath !== '/' && activePath.startsWith(linkPath + '/')) {
                const score = linkPath.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = a;
                }
                return;
            }

            // NEW: Match by first segment
            // e.g., /site/all matches /site/123/view, /inbox/456/view, etc.
            const linkSegments = linkPath.split('/').filter((s) => s);
            const activeSegments = activePath.split('/').filter((s) => s);

            if (linkSegments.length > 0 && activeSegments.length > 0) {
                // If first segment matches (e.g., both start with /site, /inbox, /admin)
                if (linkSegments[0] === activeSegments[0]) {
                    // Give it a score based on first segment match
                    const score = linkSegments[0].length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = a;
                    }
                }
            }
        });

        // Clear previous active classes on anchors
        anchors.forEach((a) => {
            a.classList.remove('bg-secondary-content');
        });

        // Apply active classes to bestMatch anchor
        if (bestMatch) {
            bestMatch.classList.add('bg-secondary-content');
        }
    } catch (err) {
        // silent fail
        // console.error('left_menu active script error', err);
    }
});
