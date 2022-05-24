

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
            headers: {
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
            headers: {
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

/**
 * Get the value of a cookie
 * @param cname name of cookie to get value of
 * @returns value stored in cookie or empty string
 */
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

/**
 * @returns Object representing get params
 */
export function getGetParams(): { [param: string] : string } | null {
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

/**
 * Set cookie
 * @param name name for the cookie
 * @param value value to store in the cookie
 * @param expMs expiration date for the cookie in miliseconds in the future
 */
export function setCookie(name: string, value: string, expMs: number) {
    const d = new Date(Date.now() + expMs);
    const expires = 'expires=' + d.toUTCString();
    document.cookie = `${name}=${value};${expires};path=/`;
}