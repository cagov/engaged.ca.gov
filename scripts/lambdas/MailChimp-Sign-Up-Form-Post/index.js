// https://github.com/cagov/engaged.ca.gov/releases/tag/MailChimp-Sign-Up-Form-Post-005
// MailchimpForm v2.3
// See engaged.ca.gov/site/_includes/macros/form-checkbox.njk for more documentation
//
// history
// v2.4 'Test user' tag only added for users who put engcatest in their email address
// v2.3 added support for 'Test user' tag for innovation.ca.gov emails - jbum
// v2.2 removed comments
// v2.1

import client from "@mailchimp/mailchimp_marketing";

export const handler = async (event) => {
  const secret = process.env.MAILCHIMP_API_KEY;

  client.setConfig({
    apiKey: secret,
    server: "us2",
  });


  const data = JSON.parse(event.body); // Production
  // const data = event.body; // Test case
  const email = data.EMAIL;
  const subscriberHash = email;
  const audienceId = data.audienceId;
  const evaczone = data.EVACZONE !== undefined ? data.EVACZONE : "";

  const interests = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.includes("interest-")) {
      const interestId = key.replace("interest-", "");
      interests[interestId] = true;
    }
    if (key.includes("lafires-radio-group")) {
      const interestId = key.replace("lafires-radio-group-", "");
      interests[interestId] = true;
    }
  }

  try {
    // First, add/update the list member
    const results = await client.lists.setListMember(audienceId, subscriberHash, {
      email_address: email,
      status_if_new: "subscribed",
      interests: interests,
      merge_fields: {
        EVACZONE: evaczone,
      }
    });

    // Then, update the test User tag accordingly if the user includes something like +engcatest001 in the meail
    const test_user_status = email.toLowerCase().includes('engcatest')
                              ? 'active' : 'inactive';
    try {
      const results2 = await client.lists.updateListMemberTags(audienceId, subscriberHash, {
        tags: [{ name: "Test user", status: test_user_status }],
      });
      console.log(results2);
    } catch (error2) {
      console.log("Tag update error:", error2);
      // Continue even if tag update fails
    }

    return {
      statusCode: 200,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
      body: JSON.stringify({ message: "OK: Form submission successful!" }),
    };

  } catch (error) {
    console.log("List member update error:", error);

    return {
      statusCode: 400,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
      body: JSON.stringify({
        message: "ERROR: Form submission unsuccessful.",
      }),
    };
  }
};



