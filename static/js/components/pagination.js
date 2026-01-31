// Pagination component

export function renderPagination(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';

    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }

    // Previous button
    pages.push(`
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">&laquo;</a>
        </li>
    `);

    // First page
    if (start > 1) {
        pages.push(`
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
        `);
        if (start > 2) {
            pages.push(`<li class="page-item disabled"><span class="page-link">...</span></li>`);
        }
    }

    // Page numbers
    for (let i = start; i <= end; i++) {
        pages.push(`
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `);
    }

    // Last page
    if (end < totalPages) {
        if (end < totalPages - 1) {
            pages.push(`<li class="page-item disabled"><span class="page-link">...</span></li>`);
        }
        pages.push(`
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `);
    }

    // Next button
    pages.push(`
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">&raquo;</a>
        </li>
    `);

    const html = `
        <nav aria-label="Page navigation">
            <ul class="pagination justify-content-center">
                ${pages.join('')}
            </ul>
        </nav>
    `;

    return { html, attach };

    function attach(container) {
        container.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page >= 1 && page <= totalPages && page !== currentPage) {
                    onPageChange(page);
                }
            });
        });
    }
}
