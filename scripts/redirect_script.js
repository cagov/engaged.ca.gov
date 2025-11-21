// v1.0.3 jbum - fixing some redirect issues which were stripping parameters

function handler(event) {
  const request = event.request; // use uri to see incoming url
  const uri_lc = request.uri.toLowerCase();
  const querystring = request.querystring;
  let redirect_location = null;
  if (uri_lc.endsWith('/fires')   || uri_lc.endsWith('/fires/') || 
      uri_lc.endsWith('/fire')    ||  uri_lc.endsWith('/fire/') ||        
      uri_lc.endsWith('/lafire')  || uri_lc.endsWith('/lafire/') ||        
      uri_lc.endsWith('/lafires') || uri_lc.endsWith('/lafires/')) {
    redirect_location = 'https://engaged.ca.gov/lafires-recovery/#sign-up';
  }
  else if (
     uri_lc.endsWith('/statemployees')   || uri_lc.endsWith('/statemployees/') ||   
     uri_lc.endsWith('/stateemployee')   || uri_lc.endsWith('/stateemployee/') ||   
     uri_lc.endsWith('/statemployee')    || uri_lc.endsWith('/statemployee/') ||   
     uri_lc.endsWith('/state-employees') || uri_lc.endsWith('/state-employees/')) {
   redirect_location = 'https://engaged.ca.gov/stateemployees/';
  } 
  // case correction
  else if (
     (uri_lc.endsWith('/stateemployees')   || uri_lc.endsWith('/stateemployees/')) && 
     !(request.uri.endsWith('/stateemployees')   || request.uri.endsWith('/stateemployees/')))
  {
    redirect_location = 'https://engaged.ca.gov/stateemployees/';
  }
  // add slash
  else if (
     uri_lc.endsWith('/stateemployees')  )
  {
    redirect_location = 'https://engaged.ca.gov/stateemployees/';
  }
  if (redirect_location) {
    // Convert querystring object to proper query string format
    let queryString_str = '';
    if (querystring && Object.keys(querystring).length > 0) {
      const params = [];
      for (const key in querystring) {
        if (querystring.hasOwnProperty(key)) {
          const value = querystring[key].value;
          params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
      }
      queryString_str = '?' + params.join('&');
    }
    
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: redirect_location + queryString_str }}
    };
  }   
  return request;
}