import { getCookie, setCookie } from "./util";

// Change link text
const link = document.getElementById('nav-link-portal') as HTMLAnchorElement;
if (link) {
    if (getCookie('authToken')) {
        link.innerHTML = 'Portal';
        link.href = '/portal';
    } else {
        link.innerHTML = 'Log In';
        link.href = '/portal/login.html';
    }
}

/////////////////////////////////////////
// Light/dark mode themes
/////////////////////////////////////////

// Dark/light mode switch
const themeToggle = document.getElementById('theme-toggle');

// Change the theme used across the site
function setTheme(t: 'dark' | 'light') {
    // Set to 'dark'
    if (t === 'dark') {
        setCookie('theme', t, 1000 * 60 * 60 * 24 * 14);
        document.getElementsByTagName('html')[0].setAttribute('data-theme', t);
        themeToggle.classList.remove('fa-moon');
        themeToggle.classList.add('fa-sun');
        return;
    }

    // Set to 'light'
    setCookie('theme', t, 1000 * 60 * 60 * 24 * 14);
    document.getElementsByTagName('html')[0].setAttribute('data-theme', t);
    themeToggle.classList.remove('fa-sun');
    themeToggle.classList.add('fa-moon');
}

// Toggle theme on click
if (themeToggle)
    themeToggle.onclick = () =>
        setTheme(themeToggle.classList.contains('fa-sun') ? 'light' : 'dark');

// If they have a preferred theme already
const themeCookie = getCookie('theme') as 'dark' | 'light' | null;
if (themeCookie)
    setTheme(themeCookie);