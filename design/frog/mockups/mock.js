// mockup chrome: theme toggle like the site's nav
(function () {
    const root = document.documentElement;
    let t; try { t = localStorage.getItem('theme'); } catch (e) {}
    root.setAttribute('data-theme', t || 'light');
    document.addEventListener('click', e => {
        const b = e.target.closest('.mock-theme'); if (!b) return;
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next); try { localStorage.setItem('theme', next); } catch (e) {}
        b.textContent = next === 'dark' ? 'Light' : 'Dark';
    });
    document.addEventListener('DOMContentLoaded', () => {
        const b = document.querySelector('.mock-theme'); if (b) b.textContent = root.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark';
    });
})();
