import { getCookie } from "./util";

const link = document.getElementById('nav-link-portal') as HTMLAnchorElement;
if (link) {
    if ( getCookie('authToken') ) {
        link.innerHTML = 'Portal';
        link.href = '/portal';
    } else {
        link.innerHTML = 'Log In';
        link.href = '/portal/login.html';
    }
}

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle)
    themeToggle.onclick = function() {
        // Dark to light
        if (themeToggle.classList.contains('fa-sun')) {
            document.getElementsByTagName('html')[0].setAttribute('data-theme', 'light');
            themeToggle.classList.remove('fa-sun');
            themeToggle.classList.add('fa-moon');
            return;
        }

        // Light to dark
        document.getElementsByTagName('html')[0].setAttribute('data-theme', 'dark');
        themeToggle.classList.remove('fa-moon');
        themeToggle.classList.add('fa-sun');
    };

