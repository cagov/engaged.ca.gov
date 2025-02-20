import client from "@mailchimp/mailchimp_marketing";
// import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// const getSecret = async () => {
//     const secret_name = "mailchimp-api-key";
  
//     const client = new SecretsManagerClient({
//       region: "us-west-1",
//     });
  
//     let response;
  
//     try {
//       response = await client.send(
//         new GetSecretValueCommand({
//           SecretId: secret_name,
//           VersionStage: "AWSCURRENT"
//         })
//       );
//     } catch (error) {
//       throw error;
//     }
  
//     const secret = response.SecretString;

//     let secretString = JSON.parse(secret);
//     if (secretString["MAILCHIMP_API_KEY"] !== undefined && secretString["MAILCHIMP_API_KEY"] !== null ) {
//       return secretString.MAILCHIMP_API_KEY;
//     }
    
//     return false;
//   };
  
// let secret;

export const handler = async (event) => {

  // // Get secret if not already cached by Lambda. Run in event handler loop because it is faster.
  // if (secret === undefined) {    
  //   secret = await getSecret();
  // }

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
