import client from "@mailchimp/mailchimp_marketing";

client.setConfig({
  apiKey: "<TOKEN>>",
  server: "us2",
});

export const handler = async (event) => {

  const data = JSON.parse(event.body);

  const email = data.EMAIL;

  // Get ids for interests - curl -i -H POST --url 'https://us2.api.mailchimp.com/3.0/lists/<listId>/interest-categories' --header "Authorization: Bearer <TOKEN>"
  // API for interests https://mailchimp.com/developer/marketing/api/interests/
  const subscriberHash = email;

  const listId = "61200a6dda"; // Also called Audience ID in Mailchimp.

  const interests = { 
    "4d15bd19e5": data["group[91023][2]"] === "Future topics" ? true : false,
    "40c0f946cd": data["group[91023][4]"] === "LA Fires: Palisades" ? true : false,
    "1552878c1b": data["group[91023][8]"] === "LA Fires: Eaton" ? true : false
  };

    // https://mailchimp.com/developer/marketing/api/list-members/
    const response = await client.lists.setListMember(
      listId,
      subscriberHash,
      { email_address: email, status_if_new: "subscribed", interests: interests }
    ).then((results) => {
      return {
        statusCode: 200,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods" : "*",
        "Access-Control-Allow-Headers" : "*",
        body: JSON.stringify({ message: 'OK: Form submission successful!'}),
      }
    }).catch((error) => {
      console.log(error);

      return {
        statusCode: 400,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods" : "*",
        "Access-Control-Allow-Headers" : "*",
        body: JSON.stringify({ message: 'ERROR: Form submission unsuccessful.'}),
      }
    });

    return response;
};
