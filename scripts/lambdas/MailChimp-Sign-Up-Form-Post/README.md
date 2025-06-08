# MailChimp-Sign-Up-Form-Post

- This is the lambda function used to send data to Mailchimp. 
- This folder is for documentation and version control only
- Actual code lives in AWS


## Keep lambda code and github code in sync. 

1. Change lambda code
2. Deploy lambda code
3. [Create new version in AWS](https://us-west-1.console.aws.amazon.com/lambda/home?region=us-west-1#/functions/MailChimp-Sign-Up-Form-Post?tab=versions) with Version description "MailChimp-Sign-Up-Form-Post-[id] - [description]"
4. Change line 1 of ./index.js to "MailChimp-Sign-Up-Form-Post-[id]"
5. Tag commit "MailChimp-Sign-Up-Form-Post-[id]"
6. Don't for get to `git push tag`