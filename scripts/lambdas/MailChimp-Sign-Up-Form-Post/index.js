// https://github.com/cagov/engaged.ca.gov/releases/tag/MailChimp-Sign-Up-Form-Post-005
// MailchimpForm v2.2
// See 
// * engaged.ca.gov/site/_includes/macros/form-radio.njk for more documentation

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

  const response = await client.lists
    .setListMember(audienceId, subscriberHash, {
      email_address: email,
      status_if_new: "subscribed",
      interests: interests,
      merge_fields: {
        EVACZONE: evaczone,
      }
    })
    .then((results) => {
      return {
        statusCode: 200,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        body: JSON.stringify({ message: "OK: Form submission successful!" }),
      };
    })
    .catch((error) => {
      console.log(error);

      return {
        statusCode: 400,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        body: JSON.stringify({
          message: "ERROR: Form submission unsuccessful.",
        }),
      };
    });

  return response;
};
