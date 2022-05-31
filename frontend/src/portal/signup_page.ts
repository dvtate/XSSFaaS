import sha512 from 'crypto-js/sha512';
import Base64 from 'crypto-js/enc-base64';
import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

// Elements
const nameInp = document.getElementById('Name') as HTMLInputElement;
const emailInp = document.getElementById('Email') as HTMLInputElement;
const passwordInp1 = document.getElementById('Password') as HTMLInputElement;
const passwordInp2 = document.getElementById('Password2') as HTMLInputElement;
const submitBtn = document.getElementById('btn-submit') as HTMLButtonElement;
const invalidSpan = document.getElementById('invalid-reason') as HTMLSpanElement;

// Check input boxes and update ui
function checkInputs() {
    const defaultBorder = '2px solid rgba(var(--default-border-color), 1)';
    if (nameInp.value.length === 0) {
        nameInp.style.border = '1px solid red';
        return 'Name required';
    } else {
        nameInp.style.border = defaultBorder;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInp.value)) {
        emailInp.style.border = '1px solid red';
        return 'Invalid email';
    } else {
        emailInp.style.border = defaultBorder;
    }

    // Check if passwords match
    if (passwordInp1.value !== passwordInp2.value) {
        passwordInp2.style.border = '1px solid red';
        return 'Passwords do not match';
    } else {
        passwordInp2.style.border = defaultBorder;
    }

    return '';
}

// React to user input
nameInp.onkeyup
= emailInp.onkeyup
= passwordInp1.onkeyup
= passwordInp2.onkeyup
= function () {
    const invalid = checkInputs();
    invalidSpan.innerHTML = invalid;
    submitBtn.disabled = !!invalid;
}
submitBtn.onclick = async function submit() {
    // Check inputs
    const invalid = checkInputs();
    invalidSpan.innerHTML = invalid;
    submitBtn.disabled = !!invalid;
    if (invalid)
        return;

    // Create account
    const resp = await util.post(API_SERVER_URL + '/portal/user/signup', {
        name: nameInp.value,
        email: emailInp.value,
        password: Base64.stringify(sha512(passwordInp1.value)),
    });
    if (resp.status === 200)
        window.location.href = 'login.html';
    else {
        invalidSpan.innerHTML = resp.text;
        if (resp.text === 'email already in use')
            emailInp.style.border = '1px solid red';
    }

    window.location.href = 'login.html';
}