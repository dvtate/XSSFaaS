import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

// Elements
const emailInp = document.getElementById('Email') as HTMLInputElement;
const passwordInp = document.getElementById('Password') as HTMLInputElement;
const submitBtn = document.getElementById('btn-submit') as HTMLButtonElement;
const invalidSpan = document.getElementById('invalid-reason') as HTMLSpanElement;
const stayLoggedInInp = document.getElementById('stayLoggedIn') as HTMLInputElement;

/**
 * @returns Object representing get params
 */
function getQuerystring() {
    let output = {};
    if (window.location.search){
        const queryParams = window.location.search.substring(1);
        const listQueries = queryParams.split("&");
        for (let query in listQueries) {
            if (listQueries.hasOwnProperty(query)) {
                const queryPair = listQueries[query].split('=');
                output[queryPair[0]] = decodeURIComponent(queryPair[1] || "");
            }
        }
    }
    return output;
}
const getParams: { [p: string]: string } = getQuerystring() as any;

/**
 * Set cookie
 * @param name name for the cookie
 * @param value value to store in the cookie
 * @param expMs expiration date for the cookie in miliseconds in the future
 */
function setCookie(name: string, value: string, expMs: number) {
    const d = new Date(Date.now() + expMs);
    const expires = 'expires=' + d.toUTCString();
    document.cookie = `${name}=${value};${expires};path=/`;
}

submitBtn.onclick = async function () {
    // Get data from form
    const email = emailInp.value;
    const password = passwordInp.value;
    const stayLoggedIn = !!stayLoggedInInp.value;

    // Make request
    const login = await util.post(API_SERVER_URL + '/portal/user/login', { email, password, stayLoggedIn });
    if (login.status === 401) {
        invalidSpan.innerHTML = login.text;
        return;
    }
    if (login.status !== 200) {
        console.error(login);
        invalidSpan.innerHTML = `${login.status}: ${login.text}`;
        return;
    }

    // Store token
    setCookie('authToken', login.text, stayLoggedIn ? 6 * 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000);

    // Redirect
    document.location.href = getParams.rdr || '/portal';
}