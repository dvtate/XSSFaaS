import { getCookie } from "./util";

const link = document.getElementById('nav-link-portal') as HTMLAnchorElement;

if ( getCookie('authToken') ) {
    link.innerHTML = 'Portal';
    link.href = '/portal';
} else {
    link.innerHTML = 'Log In';
    link.href = '/portal/login.html';
}