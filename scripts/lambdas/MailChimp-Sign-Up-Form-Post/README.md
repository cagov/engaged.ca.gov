# MailChimp-Sign-Up-Form-Post

- This is the lambda function used to send data to Mailchimp. 
- This folder is for documentation and version control only
- Actual code lives in AWS


```html
<engca-join-convo-form>
  
  <form action="https://innovation.us2.list-manage.com/subscribe/post?u=c515d1563732573cbc10cd6e9&amp;id=61200a6dda&amp;f_id=0003e1e3f0" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" target="_self" novalidate="">

    <engca-form-field>
      <label class="form-control-label" for="mce-EMAIL">
        <span class="required-label" aria-hidden="true">*</span>
        <span class="sr-only">Required field:</span>
        Email
      </label>
      <input type="email" class="form-control" id="mce-EMAIL" name="EMAIL" aria-required="true">
      <engca-form-error id="emailError" hidden="">
        <strong>Please enter a valid email address.</strong>
        Email addresses should contain a "@" and a "."
      </engca-form-error>
      <engca-form-error id="apiError" hidden="">
        <strong>We're sorry, there's a problem with our form.</strong>
        Please try again later.
      </engca-form-error>
    </engca-form-field>

    <engca-form-field>
    <h3 class="form-title">Tell us what you’re interested in</h3>

    <ul class="form-checkbox-list">
        <li>
        <input type="checkbox" class="form-check-input" id="mce-group[91023]-91023-1" name="group[91023][8]" value="Los Angeles fires recovery: Eaton">
        <label class="form-control-label form-checkbox-label" for="mce-group[91023]-91023-1">
          Los Angeles fires recovery: Eaton
        </label>
      </li>
      <li>
        <input type="checkbox" class="form-check-input" id="mce-group[91023]-91023-0" name="group[91023][4]" value="Los Angeles fires recovery: Palisades">
        <label class="form-control-label form-checkbox-label" for="mce-group[91023]-91023-0">
          Los Angeles fires recovery: Palisades
        </label>
      </li>
      <li>
        <input type="checkbox" class="form-check-input" id="mce-group[91023]-91023-2" name="group[91023][2]" value="Future topics" checked="">
        <label class="form-control-label form-checkbox-label" for="mce-group[91023]-91023-2">
          Future topics
        </label>
      </li>
      </ul>
      <engca-form-error id="emailError" hidden="">
        <strong>Please enter a valid email address.</strong>
        Email addresses should contain a "@" and a "."
      </engca-form-error>
      <engca-form-error id="apiError" hidden="">
        <strong>We're sorry, there's a problem with our form.</strong>
        Please try again later.
      </engca-form-error>
    </engca-form-field>

    <input type="submit" id="mc-embedded-subscribe" name="subscribe" data-theme="orange" value="Sign up now">
  </form>

  <engca-form-success aria-live="polite"></engca-form-success>
  <template id="form-success-msg">
    <p>
      <strong>Your subscription is confirmed.</strong>
    </p>
    <img width="75" height="75" src="/public/images/check-circle.svg" aria-hidden="true" alt="">
    <p>Thank you for signing up! Look out for news and updates.</p>
  </template>
</engca-join-convo-form>```