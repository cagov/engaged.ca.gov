import client from "@mailchimp/mailchimp_marketing";

export const handler = async (event) => {
  const secret = process.env.MAILCHIMP_API_KEY;

  client.setConfig({
    apiKey: secret,
    server: "us2",
  });

  const data = JSON.parse(event.body);

  const email = data.EMAIL;

  // Get ids for interests - curl -i -H POST --url 'https://us2.api.mailchimp.com/3.0/lists/<audienceId>/interest-categories' --header "Authorization: Bearer <TOKEN>"
  // API for interests https://mailchimp.com/developer/marketing/api/interests/
  const subscriberHash = email;

  const audienceId = "61200a6dda";

  const interests = {
    "1552878c1b":
      data["group[91023][8]"] === "Los Angeles fires recovery: Eaton",
    "40c0f946cd":
      data["group[91023][4]"] === "Los Angeles fires recovery: Palisades",
    "4d15bd19e5": data["group[91023][2]"] === "Future topics",
  };

  const response = await client.lists
    .setListMember(audienceId, subscriberHash, {
      email_address: email,
      status_if_new: "subscribed",
      interests: interests,
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
