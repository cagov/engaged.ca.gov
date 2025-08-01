// Test file for running the Mailchimp Lambda function locally
import { handler } from './index.js';
import { localSettings } from './local_settings.js';

// Set up environment variables
process.env.MAILCHIMP_API_KEY = localSettings.MAILCHIMP_API_KEY;

// Sample event data that mimics what the Lambda would receive
const sampleEvent = {
  body: JSON.stringify({
    EMAIL: localSettings.EMAIL,
    audienceId: localSettings.audienceId, // SANDBOX
  })
};

// Test function
async function testMailchimpFunction() {
  try {
    console.log('Testing Mailchimp Lambda function...');
    console.log('Event data:', JSON.stringify(sampleEvent, null, 2));
    
    const result = await handler(sampleEvent);
    
    console.log('\n=== RESULT ===');
    console.log('Status Code:', result.statusCode);
    console.log('Headers:', result['Access-Control-Allow-Origin']);
    console.log('Body:', result.body);
    
  } catch (error) {
    console.error('Error testing function:', error);
  }
}

// Run the test
testMailchimpFunction(); 