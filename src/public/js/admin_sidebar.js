document.addEventListener('DOMContentLoaded', () => {
    try {
        const asideNav = document.querySelector('aside nav');
        if (!asideNav) { return; }

        const anchors = Array.from(asideNav.querySelectorAll('a[href]'));
        if (!anchors.length) { return; }

        const activePathRaw = window.location.pathname || '/';
        const activePath = activePathRaw.replace(/\/+$|\/$/, '') || '/';

        // find best matching anchor (longest matching path)
        let bestMatch = null;
        let bestScore = -1;

        anchors.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) { return; }
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
            if (linkPath !== '/' && activePath.startsWith(linkPath + '/')) {
                const score = linkPath.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = a;
                }
            }
        });

        // Clear previous active classes on anchors
        anchors.forEach(a => {
            a.classList.remove('bg-secondary-content');
        });

        // Apply active classes to bestMatch anchor
        if (bestMatch) {
            bestMatch.classList.add('bg-secondary-content');
        }
    } catch (err) {
        // silent fail
        // console.error('admin_sidebar active script error', err);
    }
});
