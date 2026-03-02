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
                        <li class="nav-item"><a class="nav-link" href="/pricing">Pricing</a></li>
                        <li class="nav-item"><a class="nav-link" href="/cli">CLI</a></li>
                    </ul>
                    <ul class="navbar-nav align-items-center">
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
                m.closest('.dropdown')?.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
            });

            // Toggle this dropdown
            if (!isOpen) {
                menu.classList.add('show');
                toggle.setAttribute('aria-expanded', 'true');
            } else {
                toggle.setAttribute('aria-expanded', 'false');
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
                menu.closest('.dropdown')?.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
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
    return `<li class="nav-item"><a class="nav-link" href="/login">Login</a></li>`;
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
