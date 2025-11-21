// 1.0.2 jbum - disabling authentication for all PR requests
// 1.0.1 jbum - disabling authentication for e3-report
// 1.0 Jon Jensen

function handler(event) {
    const request = event.request;
    // const uri_lc = request.uri.toLowerCase();
    const headers = request.headers;
    const authHeaders = headers.authorization;
    
    // const credentials = "odiandfriends:odiandfriends"; /* username:password */
    // const authHeaderStr = "Basic " + Buffer.from(credentials).toString('base64');
    
    // If credentials are good, perform PR redirect.
    // if ((authHeaders && authHeaders.value == authHeaderStr) || uri_lc.includes("e3-report")) { 
    if (true) { 
        const host = headers.host.value;
        const domain = "pr.engaged.ca.gov";
        const subdomain = host.substr(0, host.indexOf(`.${domain}`));
        
        // Rewrite request path to branch-based pr subfolder.
        if (subdomain && !request.uri.startsWith("/pr/")) {
            request.uri = `/pr/${subdomain}${request.uri}`;
        }
        
        return request;
    }

    
    // If credentials are bad, respond with 401 and request credentials.
    const response = {
        statusCode: 401,
        statusDescription: 'Unauthorized',
        headers: { 
            "www-authenticate": { value: 'Basic realm="Authentication"' } 
        }
    };

    return response;
}