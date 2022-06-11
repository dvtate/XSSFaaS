import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

// This code is so ugly i wanna kms

// Get function ID
const functionId = util.getGetParams().id;
if (!functionId)
    window.location.href = 'index.html';

// Elements
const fnNameTitle = document.getElementById('function-name') as HTMLTitleElement;
const fnIdSpan = document.getElementById('function-id') as HTMLSpanElement;
const fnCallUrl = document.getElementById('url-fxn-call') as HTMLSpanElement; // <kbd>

// Populate with user provided id
fnIdSpan.innerHTML = functionId;

// Form elements
const fnNameInp = document.getElementById('fn-name') as HTMLInputElement;
const fnNameBtn = document.getElementById('btn-fn-name') as HTMLButtonElement;
const fnAboutInp = document.getElementById('fn-about') as HTMLTextAreaElement;
const fnAboutBtn = document.getElementById('btn-fn-about') as HTMLButtonElement;
const fnPolFwsInp = document.getElementById('fn-pol-fws') as HTMLInputElement;
const fnPolFwsBtn = document.getElementById('btn-fn-pol-fws') as HTMLButtonElement;
const fnPolReuseInp = document.getElementById('fn-pol-reuse') as HTMLInputElement;
const fnPolReuseBtn = document.getElementById('btn-fn-pol-reuse') as HTMLButtonElement;
const fnPolSpecInp = document.getElementById('fn-pol-spec') as HTMLInputElement;
const fnPolSpecBtn = document.getElementById('btn-fn-pol-spec') as HTMLButtonElement;

// Enable buttons on content change
fnNameInp.onkeyup = () => fnNameBtn.disabled = false;
fnAboutInp.onkeyup = () => fnAboutBtn.disabled = false;
fnPolFwsInp.onchange = () => fnPolFwsBtn.disabled = false;
fnPolReuseInp.onchange = () => fnPolReuseBtn.disabled = false;
fnPolSpecInp.onchange = () => fnPolSpecBtn.disabled = false;

// Update function data
fnNameBtn.onclick = async () => {
    await updateFunction('name', fnNameInp.value);
    fnNameBtn.disabled = true;
    fetchData(); // Update UI
};
fnAboutBtn.onclick = () => {
    updateFunction('about', fnAboutInp.value);
    fnAboutBtn.disabled = true;
};
fnPolFwsBtn.onclick = () => {
    updateFunction('preventReuse', fnPolFwsInp.value);
    fnPolFwsBtn.disabled = true;
};
fnPolReuseBtn.onclick = () => {
    updateFunction('optSpec', fnPolReuseInp.value);
    fnPolReuseBtn.disabled = true;
};
fnPolSpecBtn.onclick = () => {
    updateFunction('allowForeignWorkers', fnPolSpecInp.value);
    fnPolSpecBtn.disabled = true;
};

// Alter function in the database
async function updateFunction(field: string, value: string) {
    const res = await util.post(
        API_SERVER_URL + '/portal/function/' + functionId + '/alter',
        { field, value }
    );
    console.log('update', field, res);
}

interface AssetDbEntry {
    assetId: number;
    fileName: string;
    sizeBytes: number;
    creationTs: number;
    modifiedTs?: number;
};

function fileCard(file: AssetDbEntry, functionId: string) {
    return `<div class="ms-card ms-border ms-inline">
        <div class="ms-card-title">
            <h3>${file.fileName}</h3>
            <span>${file.sizeBytes/1000} kB - Uploaded ${new Date(file.creationTs).toISOString()}</span>
        </div>
        <div class="ms-card-content">
            <a class="ms-btn" href="${API_SERVER_URL}/portal/assets/${functionId}/${file.fileName}">Download</a>
            <button type="button" onclick="deleteFnAsset(${file.assetId})">Delete</button>
        </div>
    </div>`;
}

globalThis.deleteFnAsset = async (assetId: number) => {
    await fetch(API_SERVER_URL + '/portal/asset/' + assetId, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${util.getCookie('authToken')}`,
        },
    });
    return fetchData();
};

const logsBtn = document.getElementById('btn-logs') as HTMLButtonElement;

async function fetchData() {
    const info = await util.get(API_SERVER_URL + '/portal/function/' + functionId);

    // Not logged in
    if (info.status === 401)
        window.location.href = 'login.html';

    // Invalid id
    if (info.status === 404)
        window.location.href = 'index.html';

    // Other
    if (info.status !== 200) {
        console.error('request failed with status', info.status, ":", info.text);
        window.location.href = 'index.html';
    }

    const fnData = JSON.parse(info.text);

    fnNameTitle.innerHTML = fnNameInp.value = fnData.name;
    fnAboutInp.value = fnData.about;
    fnPolFwsInp.checked = !fnData.allowForeignWorkers
    fnPolReuseInp.checked = !!fnData.preventReuse;
    fnPolSpecInp.value = fnData.optSpec;
    fnCallUrl.innerHTML = `${API_SERVER_URL}/work/task/${functionId}?key=${encodeURIComponent(fnData.invokeToken)}`;
    document.getElementById('proj-files-list').innerHTML
        = fnData.assets.map(a => fileCard(a, fnData.functionId)).join('');
    if (logsBtn.innerHTML === 'Show Logs')
        logsBtn.innerHTML = `Show ${Math.min(fnData.logCount, 1000)} logs`;
}
fetchData();

// File drop area
let projectFiles = [];
const filesArea = document.getElementById('fn-files');
const filesBtn = document.getElementById('btn-fn-files') as HTMLButtonElement;
filesArea.ondragover = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();
    filesArea.style.border = '1px solid blue';
    filesArea.style.backgroundColor = 'grey';
};
filesArea.ondragleave = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();
    filesArea.style.border = '1px solid skyblue';
    filesArea.style.backgroundColor = 'darkgrey';
};
filesArea.ondrop = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();

    // Get files from drop event
    let files: File[] = [];
    if (ev.dataTransfer.items)
        files = [...ev.dataTransfer.items].filter(i => i.kind === 'file').map(f => f.getAsFile());
    else if (ev.dataTransfer.files)
        files = [...ev.dataTransfer.files];
    else
        console.error("wtf no files?", ev.dataTransfer);

    // Process files
    files.forEach(f => {
        if (f.size > 1000 * 1000 * 20) {
            filesArea.innerHTML += `<br/><span class="small-fname invalid">${f.name} is over 20 MB cap</span>`;
            return;
        }

        filesArea.innerHTML += `<br/><span class="small-fname">${f.name} - ${f.size / 1000} kB</span>`;
        projectFiles.push(f);
    });

    // Enable submit button
    if (projectFiles.length)
        filesBtn.disabled = false;
};
filesBtn.onclick = async () => {
    const fd = new FormData();
    projectFiles.forEach((f, i) => fd.append(`file_${i}`, f, f.name));
    try {
        await fetch(`${API_SERVER_URL}/portal/function/${functionId}/asset/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${util.getCookie('authToken')}` },
            body: fd,
        });
    } catch (e) {
        console.error(e);
    }
    console.log('uploaded', projectFiles.length, 'project files');
    projectFiles = [];
    filesArea.innerHTML = 'Drop project files here';
    filesBtn.disabled = true;

    fetchData();
};

interface LogDBEntry {
    taskId: number;
    logType: 'LOG' | 'CRASH';
    ts: number;
    message: string;
}

let logs: LogDBEntry[] = [];

function showLogs() {
    // TODO use a search box to filter
    document.getElementById('log-view').innerHTML = logs
        .map(l => `<div class="log-entry log-${l.logType === 'LOG' ? 'user' : 'fatal'}">${
            new Date(l.ts).toISOString()}: ${l.message}</div>`)
        .join('\n');
}

logsBtn.onclick = async () => {
    const logr = await util.get(`${API_SERVER_URL}/portal/function/${functionId}/logs`);
    if (logr.status !== 200)
        console.error(logr);

    // Display Logs
    logs = JSON.parse(logr.text)
    showLogs();
};

// Delete button
document.getElementById('fn-delete').onclick = async () => {
    const r = await fetch(API_SERVER_URL + '/portal/function/' + functionId, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${util.getCookie('authToken')}`,
        },
    });
    console.log(r);
    window.location.href = 'index.html';
};
