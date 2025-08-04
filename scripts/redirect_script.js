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
   redirect_location = 'https://engaged.ca.gov/stateemployees';
  } 
  // case correction
  else if (
     (uri_lc.endsWith('/stateemployees')   || uri_lc.endsWith('/stateemployees/')) && 
     !(request.uri.endsWith('/stateemployees')   || request.uri.endsWith('/stateemployees/')))
  {
    redirect_location = 'https://engaged.ca.gov/stateemployees';
  } 
  if (redirect_location) {
  //   // Append query string if present and not already included (e.g. # anchors)
  //   const qs = Object.keys(querystring).length > 0
  //   ? '?' + Object.entries(querystring).map(([k, v]) => `${k}=${v.value}`).join('&')
  //   : '';

  //   // Avoid breaking # fragments (e.g. #sign-up) when appending query strings
  //   const [base, fragment] = redirect_location.split('#');
  //   const final_location = base + qs + (fragment ? '#' + fragment : '');

    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: redirect_location } }
    };
  }   
  return request;
}