// Toast notification component
import { escapeHtml } from '../utils.js';

let toastContainer = null;

function getContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

export function showToast(message, type = 'info', duration = 5000) {
    const container = getContainer();
    const id = `toast-${Date.now()}`;

    const bgClass = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-primary'
    }[type] || 'bg-primary';

    const textClass = type === 'warning' ? 'text-dark' : 'text-white';

    const toastHtml = `
        <div id="${id}" class="toast ${bgClass} ${textClass}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body d-flex justify-content-between align-items-center">
                <span>${escapeHtml(message)}</span>
                <button type="button" class="btn-close ${type !== 'warning' ? 'btn-close-white' : ''}" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(id);

    // Manual show/hide since we're not loading Bootstrap JS
    toastElement.classList.add('show');

    const closeBtn = toastElement.querySelector('.btn-close');
    closeBtn?.addEventListener('click', () => {
        hideToast(toastElement);
    });

    if (duration > 0) {
        setTimeout(() => {
            hideToast(toastElement);
        }, duration);
    }

    return toastElement;
}

function hideToast(element) {
    element.classList.remove('show');
    setTimeout(() => {
        element.remove();
    }, 300);
}

// Convenience methods
export const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    warning: (msg) => showToast(msg, 'warning'),
    info: (msg) => showToast(msg, 'info')
};
