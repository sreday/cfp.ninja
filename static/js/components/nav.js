// Navigation component
import { Auth, getAppConfig } from '../app.js';
import { escapeHtml } from '../utils.js';
import { toggleTheme, getTheme } from '../theme.js';

// Track cleanup function for dropdown handlers
let dropdownCleanup = null;

export function renderNav() {
    // Clean up previous listeners
    if (dropdownCleanup) {
        dropdownCleanup();
        dropdownCleanup = null;
    }
    const container = document.getElementById('nav-container');
    const user = Auth.getUser();
    const isLoggedIn = Auth.isLoggedIn();

    container.innerHTML = `
        <nav class="navbar navbar-expand-lg">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center gap-2" href="/"><img src="/img/cfpninja-logo.png" alt="CFP.ninja" height="32" class="logo-spin">CFP.ninja</a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav me-auto">
                    </ul>
                    <ul class="navbar-nav">
                        ${renderThemeToggle()}
                        ${isLoggedIn ? renderUserMenu(user) : renderLoginButton()}
                    </ul>
                </div>
            </div>
        </nav>
    `;

    // Attach event listeners
    const themeToggle = container.querySelector('#theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            toggleTheme();
            renderNav(); // Re-render to update the icon
        });
    }

    // Setup dropdown handlers and store cleanup function
    dropdownCleanup = attachDropdownHandlers(container);

    if (isLoggedIn) {
        const logoutBtn = container.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }
    } else {
        const loginGitHubBtn = container.querySelector('#login-github-btn');
        if (loginGitHubBtn) {
            loginGitHubBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.login('github');
            });
        }
        const loginGoogleBtn = container.querySelector('#login-google-btn');
        if (loginGoogleBtn) {
            loginGoogleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.login('google');
            });
        }
    }
}

function attachDropdownHandlers(container) {
    const dropdownToggles = container.querySelectorAll('.dropdown-toggle');
    const toggleHandlers = [];

    dropdownToggles.forEach(toggle => {
        const toggleHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = toggle.closest('.dropdown');
            const menu = dropdown.querySelector('.dropdown-menu');
            const isOpen = menu.classList.contains('show');

            // Close all other dropdowns first
            document.querySelectorAll('.dropdown-menu.show').forEach(m => {
                m.classList.remove('show');
            });

            // Toggle this dropdown
            if (!isOpen) {
                menu.classList.add('show');
            }
        };
        toggle.addEventListener('click', toggleHandler);
        toggleHandlers.push({ element: toggle, handler: toggleHandler });
    });

    // Close dropdowns when clicking outside
    const outsideHandler = (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    };
    document.addEventListener('click', outsideHandler);

    // Return cleanup function
    return () => {
        toggleHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
        });
        document.removeEventListener('click', outsideHandler);
    };
}

function renderThemeToggle() {
    const isDark = getTheme() === 'dark';
    return `
        <li class="nav-item">
            <button class="btn btn-link nav-link font-size-1-25 text-decoration-none" id="theme-toggle" title="Toggle theme">
                ${isDark ? '☀️' : '🌙'}
            </button>
        </li>
    `;
}

function renderLoginButton() {
    const config = getAppConfig();
    const providers = config.auth_providers || [];

    const githubBtn = `<li><a class="dropdown-item" href="#" id="login-github-btn">
        <svg class="me-2" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        Login with GitHub
    </a></li>`;

    const googleBtn = `<li><a class="dropdown-item" href="#" id="login-google-btn">
        <svg class="me-2" width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Login with Google
    </a></li>`;

    const buttons = [];
    if (providers.includes('github')) {
        buttons.push(githubBtn);
    }
    if (providers.includes('google')) {
        buttons.push(googleBtn);
    }

    // No providers configured
    if (buttons.length === 0) {
        return `<li class="nav-item"><span class="nav-link text-muted">Login unavailable</span></li>`;
    }

    // Single provider - show direct button
    if (buttons.length === 1) {
        const btnId = providers.includes('github') ? 'login-github-btn' : 'login-google-btn';
        const btnText = providers.includes('github') ? 'Login with GitHub' : 'Login with Google';
        const svg = providers.includes('github')
            ? `<svg class="me-2" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`
            : `<svg class="me-2" width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;
        return `<li class="nav-item"><a class="nav-link" href="#" id="${btnId}">${svg}${btnText}</a></li>`;
    }

    // Multiple providers - show dropdown
    return `
        <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" role="button" aria-expanded="false">
                Login
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
                ${buttons.join('')}
            </ul>
        </li>
    `;
}

function renderUserMenu(user) {
    const name = user?.name || 'User';
    const email = user?.email || '';
    const initial = name.charAt(0).toUpperCase();

    return `
        <li class="nav-item dropdown user-dropdown">
            <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" role="button" aria-expanded="false">
                <span class="badge bg-primary rounded-circle avatar-badge">${escapeHtml(initial)}</span>
                <span class="d-none d-md-inline">${escapeHtml(name)}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
                <li>
                    <div class="user-info">
                        <div class="user-name">${escapeHtml(name)}</div>
                        <div class="user-email">${escapeHtml(email)}</div>
                    </div>
                </li>
                <li><a class="dropdown-item" href="/dashboard">Dashboard</a></li>
                <li><a class="dropdown-item" href="/dashboard/events/new">Create Event</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" id="logout-btn">Logout</a></li>
            </ul>
        </li>
    `;
}
