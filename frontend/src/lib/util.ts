// This file handles communications with the API server

import { API_SERVER_URL } from './globals';

interface HttpResponse {
    status: number;
    text: string;
}

/**
 * Perform a post request
 * @param url API url to request
 * @param body Data to include in the body of the request
 * @returns status + text
 */
export async function post(url: string, body: any): Promise<HttpResponse> {
    try {
        const resp = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('authToken')}`,
            },
            body: JSON.stringify(body),
        });

        return {
            status: resp.status,
            text: await resp.text(),
        };
    } catch (e) {
        throw e;
    }
}

/**
 * Perform a get request
 * @param url API url to request
 * @returns status + text
 */
export async function get(url: string): Promise<HttpResponse> {
    try {
        const resp = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('authToken')}`,
            },
        });

        return {
            status: resp.status,
            text: await resp.text(),
        };
    } catch (e) {
        throw e;
    }
}

export function getCookie(cname: string) {
    const name = cname + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ')
            c = c.substring(1);
        if (c.indexOf(name) == 0)
            return c.substring(name.length, c.length);
    }
    return "";
}