// This script gets run by webworker threads

import { API_SERVER_URL, ROUTER_SERVER_URL } from './globals';

function fetchJobScript(id: string) {
    import(`${}`)
}