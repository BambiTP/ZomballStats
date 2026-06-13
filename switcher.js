const Switcher = (() => {
    const callbacks = {};

    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(el => {
            el.style.display = el.id === viewName + '-view' ? 'block' : 'none';
        });
        document.querySelectorAll('#nav-bar [data-view]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        if (callbacks[viewName]) callbacks[viewName]();
    }

    function register(viewName, cb) {
        callbacks[viewName] = cb;
    }

    function init(defaultView = 'stats') {
        document.getElementById('nav-bar').addEventListener('click', e => {
            const view = e.target.closest('[data-view]')?.dataset.view;
            if (view) switchView(view);
        });
        switchView(defaultView);
    }

    return { init, register, switchView };
})();