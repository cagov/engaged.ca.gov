function handler(event) {
  const request = event.request; // use uri to see incoming url
  const uri_lc = request.uri.toLowerCase();
  let redirect_location = null;
  if (uri_lc.endsWith('/fires') || 
      uri_lc.endsWith('/fires/') || 
      uri_lc.endsWith('/fire') ||   
      uri_lc.endsWith('/fire/') ||        
      uri_lc.endsWith('/lafire') ||   
      uri_lc.endsWith('/lafire/') ||        
      uri_lc.endsWith('/lafires') ||   
      uri_lc.endsWith('/lafires/') ||        
      uri_lc.endsWith('/firenze')) {
    redirect_location = 'https://engaged.ca.gov/lafires-recovery/#sign-up';
  }
  if (redirect_location) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: {value: redirect_location}}
    };
  }
  return request;
}