// SPA Router using History API

class Router {
    constructor() {
        this.routes = [];
        this.notFoundHandler = null;
        this.beforeEach = null;

        window.addEventListener('popstate', () => this.handleRoute());
        document.addEventListener('click', (e) => this.handleClick(e));
    }

    add(pattern, handler, options = {}) {
        const paramNames = [];
        const regexPattern = pattern.replace(/:([^/]+)/g, (_, name) => {
            paramNames.push(name);
            return '([^/]+)';
        });

        this.routes.push({
            pattern: new RegExp(`^${regexPattern}$`),
            paramNames,
            handler,
            options
        });
        return this;
    }

    notFound(handler) {
        this.notFoundHandler = handler;
        return this;
    }

    handleClick(e) {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');

        // Skip external links, downloads, and special protocols
        if (!href ||
            href.startsWith('http') ||
            href.startsWith('//') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            link.hasAttribute('download') ||
            link.hasAttribute('target') ||
            e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }

        e.preventDefault();
        this.navigate(href);
    }

    navigate(path, replace = false) {
        if (replace) {
            history.replaceState(null, '', path);
        } else {
            history.pushState(null, '', path);
        }
        this.handleRoute();
    }

    async handleRoute() {
        const path = window.location.pathname;
        const query = Object.fromEntries(new URLSearchParams(window.location.search));

        for (const route of this.routes) {
            const match = path.match(route.pattern);
            if (match) {
                const params = {};
                route.paramNames.forEach((name, index) => {
                    params[name] = decodeURIComponent(match[index + 1]);
                });

                // Check auth requirement
                if (this.beforeEach) {
                    const result = await this.beforeEach(route, params, query);
                    if (result === false) return;
                }

                try {
                    await route.handler(params, query);
                } catch (error) {
                    console.error('Route handler error:', error);
                }
                return;
            }
        }

        // No route matched
        if (this.notFoundHandler) {
            this.notFoundHandler(path);
        }
    }

    start() {
        this.handleRoute();
    }
}

export const router = new Router();
