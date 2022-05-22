import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

document.getElementById('btn-create').onclick = async function createFunction() {
    // Extract values from form
    const name = (document.getElementById('fn-name') as HTMLInputElement).value;
    const about = (document.getElementById('fn-about') as HTMLTextAreaElement).value;
    const allowForeignWorkers = !(document.getElementById('fn-pol-fws') as HTMLInputElement).value;
    const preventReuse = !!(document.getElementById('fn-pol-reuse') as HTMLInputElement).value;
    const optSpec = (document.getElementById('fn-pol-spec') as HTMLSelectElement).value;

    // Send data to server
    const resp = await util.post(
        API_SERVER_URL + '/portal/function',
        { name, about, allowForeignWorkers, preventReuse, optSpec },
    );

    // On success redirect user to the management page
    if (resp.status === 401)
        return window.location.href = 'login.html';
    if (resp.status !== 200) {
        document.getElementById('failed-text').innerHTML = `Failed: ${resp.status}: ${resp.text}`;
        return;
    }
    window.location.href = 'manage_function.html?id=' + resp.text;
}