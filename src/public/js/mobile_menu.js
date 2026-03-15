document.addEventListener('DOMContentLoaded', () => {
    try {
        const mobileNav = document.querySelector('#mobile_menu');
        if (!mobileNav) {
            return;
        }

        const anchors = Array.from(mobileNav.querySelectorAll('a[href]'));
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
            } catch (_err) {
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

            // prefix match (avoid matching root '/'
            if (linkPath !== '/' && activePath.startsWith(linkPath + '/')) {
                const score = linkPath.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = a;
                }
            }
        });

        // Clear previous active classes on anchors
        anchors.forEach((a) => {
            a.classList.remove('active_mm');
        });

        // Apply active classes to bestMatch anchor (background on the <a> element)
        if (bestMatch) {
            bestMatch.classList.add('active_mm');
        }
    } catch (_err) {
        // silent fail
        // console.error('left_menu active script error', err);
    }
});
