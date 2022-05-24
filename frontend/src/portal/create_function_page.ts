import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

const projectFiles = [];

document.getElementsByTagName('form')[0].onsubmit
= async function createFunction() {
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
    if (resp.status === 401)
        return window.location.href = 'login.html';
    if (resp.status !== 200) {
        document.getElementById('failed-text').innerHTML = `Failed: ${resp.status}: ${resp.text}`;
        return false;
    }
    console.log('created function', resp.text);

    // Upload projectFiles
    const fd = new FormData();
    projectFiles.forEach((f, i) => fd.append(`file_${i}`, f, f.name));
    try {
        await fetch(`${API_SERVER_URL}/portal/function/${resp.text}/asset/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${util.getCookie('authToken')}`,
            },
            body: fd,
        });
    } catch (e) {
        console.error(e);
    }
    console.log('uploaded', projectFiles.length, 'projectFiles');

    // Redirect user to manage page
    window.location.href = 'manage_function.html?id=' + resp.text;
}

// File drop area
const filesArea = document.getElementById('fn-files');
filesArea.ondragover = function(ev) {
    ev.preventDefault();
    // ev.stopPropagation();
    filesArea.style.border = '1px solid blue';
    filesArea.style.backgroundColor = 'darkgrey';
};
filesArea.ondragleave = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();
    filesArea.style.border = '1px solid skyblue';
    filesArea.style.backgroundColor = 'grey';
};
filesArea.ondrop = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();

    if (ev.dataTransfer.items)
        for (const item of ev.dataTransfer.items)
            if (item.kind === 'file') {
                const f = item.getAsFile();
                if (f.size > 1000 * 1000 * 20) {
                    filesArea.innerHTML += `<br/><span class="small-fname invalid">${f.name} is over 20 MB cap</span>`;
                    continue;
                }

                filesArea.innerHTML += `<br/><span class="small-fname">${f.name} - ${f.size / 1000} kB</span>`;
                projectFiles.push(f);
            }
    else if (ev.dataTransfer.files)
        projectFiles.push(...ev.dataTransfer.files);
};