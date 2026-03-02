// Login page
import { Auth, getAppConfig } from '../app.js';
import { router } from '../router.js';

export function LoginView() {
    // Already logged in — redirect to dashboard
    if (Auth.isLoggedIn()) {
        router.navigate('/dashboard');
        return;
    }

    const main = document.getElementById('main-content');
    const config = getAppConfig();
    const providers = config.auth_providers || [];

    const githubBtn = `
        <button class="btn btn-dark w-100 mb-2 d-flex align-items-center justify-content-center gap-2 login-provider-btn" data-provider="github" disabled>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            Login with GitHub
        </button>`;

    const googleBtn = `
        <button class="btn btn-outline-dark w-100 mb-2 d-flex align-items-center justify-content-center gap-2 login-provider-btn" data-provider="google" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Login with Google
        </button>`;

    const buttons = [];
    if (providers.includes('github')) buttons.push(githubBtn);
    if (providers.includes('google')) buttons.push(googleBtn);

    main.innerHTML = `
        <div class="row justify-content-center py-5">
            <div class="col-sm-8 col-md-6 col-lg-4">
                <div class="card">
                    <div class="card-body p-4">
                        <h1 class="h4 text-center mb-4">Log in to CFP.ninja</h1>

                        ${buttons.length === 0
                            ? '<p class="text-muted text-center">Login is currently unavailable. No authentication providers are configured.</p>'
                            : `
                                <div class="mb-4">
                                    ${buttons.join('')}
                                </div>

                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="terms-accept-checkbox">
                                    <label class="form-check-label small" for="terms-accept-checkbox">
                                        I accept the <a href="/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a>
                                    </label>
                                </div>
                            `
                        }
                    </div>
                </div>
            </div>
        </div>
    `;

    // Wire up checkbox to enable/disable provider buttons
    const checkbox = document.getElementById('terms-accept-checkbox');
    const providerBtns = document.querySelectorAll('.login-provider-btn');

    if (checkbox) {
        checkbox.addEventListener('change', () => {
            providerBtns.forEach(btn => {
                btn.disabled = !checkbox.checked;
            });
        });
    }

    // Wire up provider buttons
    providerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.dataset.provider;
            Auth.login(provider);
        });
    });
}
