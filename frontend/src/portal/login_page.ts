import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

// Elements
const emailInp = document.getElementById('Email') as HTMLInputElement;
const passwordInp = document.getElementById('Password') as HTMLInputElement;
const submitBtn = document.getElementById('btn-submit') as HTMLButtonElement;
const invalidSpan = document.getElementById('invalid-reason') as HTMLSpanElement;
const stayLoggedInInp = document.getElementById('chk-stay-logged-in') as HTMLInputElement;


(document.getElementsByTagName('form')[0] as HTMLFormElement).onsubmit = async function () {
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
    util.setCookie('authToken', login.text, stayLoggedIn ? 6 * 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000);

    // Redirect
    document.location.href = util.getGetParams().rdr || 'index.html';
}