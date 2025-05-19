// https://github.com/cagov/engaged.ca.gov/releases/tag/MailChimp-Sign-Up-Form-Post-003

import client from "@mailchimp/mailchimp_marketing";

export const handler = async (event) => {
  const secret = process.env.MAILCHIMP_API_KEY;

  client.setConfig({
    apiKey: secret,
    server: "us2",
  });

  const data = JSON.parse(event.body);

  const email = data.EMAIL;

  // Get ids for interests - curl -i -H POST --url 'https://us2.api.mailchimp.com/3.0/lists/<listId>/interest-categories' --header "Authorization: Bearer <TOKEN>"
  // API for interests https://mailchimp.com/developer/marketing/api/interests/
  const subscriberHash = email;

  const listId = "61200a6dda"; // Also called Audience ID in Mailchimp.

  const response = await client.lists
    .setListMember(listId, subscriberHash, {
      email_address: email,
      status_if_new: "subscribed",
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
