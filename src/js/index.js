/*
Note: audienceId is referred to as list_id in the mailchimp API docs

1. Get the Audience Id from the MailChimip UI

    Audience Ids
        Engaged Califonia:  61200a6dda
        Government Efficiencies: 417d16b2c0
        [SANDBOX] EngCA testing: 23461fc80f

2. Get the categories.list_id
    curl -i -H POST --url 'https://us2.api.mailchimp.com/3.0/lists/[listid]/interest-categories/' --header "Authorization: Bearer [TOKEN]"

    Interest category Ids
        Engaged Califonia: 2a44a8fff7
        Government Efficiencies: 9cd68bb129
        [SANDBOX] EngCA testing: Participant choice: 29534fdf65

3. Get the interest ids
    curl -i -H POST --url 'https://us2.api.mailchimp.com/3.0/lists/[audienceId]/interest-categories/[listid]/interests' --header "Authorization: Bearer [TOKEN]"

    API docs for interests https://mailchimp.com/developer/marketing/api/interests/
 */

/* @todo create noJS version with embed code from mc */

class UnifiedForm extends window.HTMLElement {
  constructor() {
    super();

    // Config.
    this.form = this.querySelector("form");
    this.env = this.form.getAttribute("data-env");
    this.config = this.mailchimpConfig();

    // Submission.
    this.sectionEmployee = this.querySelector('[data-form-section="employee"]');
    this.sectionFires = this.querySelector('[data-form-section="fires"]');
    this.email = this.querySelector("input[type='email']");
    this.discussionCheckboxes = this.querySelectorAll(
      '[data-form-section="discussion"] input',
    );
    this.discussionEmployeeCheckbox = this.querySelector(
      'input[value="employee"]',
    );
    this.radioEmployeeYes = this.querySelector('input[value="employeeYes"]');
    this.radioEmployeeNo = this.querySelector('input[value="employeeNo"]');

    // Messages.
    this.apiError = this.querySelector("#apiError");
    this.errorEmail = this.querySelector("#emailError");
    this.errorEmployee = this.querySelector("#errorEmployee");
    this.successTemplate = this.querySelector("template#form-success-msg");
    this.successLiveArea = this.querySelector("engca-form-success");
  }
  connectedCallback() {
    this.hide(this.sectionEmployee);
    this.hide(this.sectionFires);

    // Email event listener.
    this.email.addEventListener("focusout", (e) => {
      this.validateEmail(e);
    });

    // Discussion checkbox event listeners.
    for (const checkbox of this.discussionCheckboxes) {
      checkbox.addEventListener("change", (e) => {
        this.handleCheckboxChange(e);
      });
    }

    // Submit event listener.
    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (this.validationQueue() === 0) {
        this.handleFormSubmit(e);
      }
    });
  }

  // Configuration settings.
  isTest = () => {
    return this.env === "test";
  };

  defaultConfig = {
    engca: {
      audience_name: "Engaged California",
      audience_id: "61200a6dda",
    },
    employee: {
      audience_name: "EngCA - State Employees",
      audience_id: "417d16b2c0",
    },
    interests: {
      eaton: "1552878c1b",
      palisades: "40c0f946cd",
      employeeNo: "",
      employeeYes: "0f531f3ce0",
    },
  };
  testConfig = {
    engca: {
      audience_name: "Engaged California(sandbox)",
      audience_id: "23461fc80f",
    },
    employee: {
      audience_name: "EngCA - State Employees(sandbox)",
      audience_id: "23461fc80f",
    },
    categories: {
      employee: "29534fdf65",
      fires: "02b58955d5",
    },
    interests: {
      eaton: "22329966e2",
      palisades: "f6c04a4be0",
      nope: "36bcda8f6f",
      employeeYes: "3f58175db3",
      employeeNo: "eb7da3ee1e",
    },
  };

  // Use defaultcConfig for production and testConfig for early development.
  mailchimpConfig = () =>
    this.isTest() ? this.testConfig : this.defaultConfig;

  getAudienceID = (data) => {
    const audienceID = Object.values(data).some(
      (value) => value === "employee",
    );
    return audienceID
      ? this.config.employee.audience_id
      : this.config.engca.audience_id;
  };

  getInterests = (data) => {
    const interests = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.includes("interest-")) {
        const interestId = this.config.interests[value];
        interests[interestId] = true;
      }
    }
    return interests;
  };

  hide = (element) => {
    element.setAttribute("hidden", "hidden");
  };

  show = (element) => {
    element.removeAttribute("hidden");
  };

  validationQueue = () => {
    let count = 0;
    if (this.validateEmployeeRequired() !== "ok") {
      count++;
    }
    return count;
  };
  validateEmployeeRequired = () => {
    let ok = "ok";
    if (
      this.discussionEmployeeCheckbox.checked &&
      this.radioEmployeeYes.checked === false &&
      this.radioEmployeeNo.checked === false
    ) {
      ok = "not okay";
      this.show(this.errorEmployee);
    } else {
      this.hide(this.errorEmployee);
    }
    return ok;
  };

  handleCheckboxChange = (e) => {
    const { checked, value } = e.target;

    switch (value) {
      case "employee":
        checked
          ? this.show(this.sectionEmployee)
          : this.hide(this.sectionEmployee);
        break;
      case "fires":
        checked ? this.show(this.sectionFires) : this.hide(this.sectionFires);
        break;
    }
  };

  validateEmail = (e) => {
    const email = e.target;

    const emailIsValid = email.checkValidity();
    if (emailIsValid) {
      this.hide(this.errorEmail);
      email.removeAttribute("aria-describedby");
      email.removeAttribute("aria-invalid");
    } else {
      email.setAttribute("aria-describedby", "emailError");
      email.setAttribute("aria-invalid", "true");
      this.show(this.errorEmail);
      email.focus();
    }
    return emailIsValid;
  };

  handleFormSubmit = async (e) => {
    // Convert submission to mailchimp friendly format.
    const formData = new FormData(e.target);
    const calculatedData = Object.fromEntries(formData);
    const dataToSend = {};
    dataToSend.audienceID = this.getAudienceID(calculatedData);
    dataToSend.email = this.email.value;
    dataToSend.interests = this.getInterests(calculatedData);
    const submitString = JSON.stringify(dataToSend);

    // Check environment.
    console.log("istest", this.isTest());
    const postJsonUrl = this.isTest
      ? "http://127.0.0.1:3001/api/subscribe"
      : "https://engaged.ca.gov/api/subscribe";

    // Send data and receive response.
    const response = await fetch(postJsonUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: submitString,
      mode: "cors",
    });

    if (response.ok) {
      this.successLiveArea.appendChild(this.successTemplate.content);
      this.hide(this.form);
    } else {
      this.show(this.apiError);
      this.apiError.focus();
    }
  };
}

customElements.define("engca-form-unified", UnifiedForm);

/* Accessibility note.
 *
 * Currently, the success and error messages for this form take
 * two different approaches to accessibility.
 *
 * The success message uses an "aria-live" region, which announces
 * itself whenever contents are updated.
 *
 * The error messages use hide-and-show techniques with the "hidden"
 * attribute, autofocus, and other aria attributes.
 */
class JoinConversationForm extends window.HTMLElement {
  connectedCallback() {
    const form = this.querySelector("form");
    const env = form.getAttribute("data-env");
    const emailInput = form.querySelector("input[type='email']");
    const emailError = form.querySelector("engca-form-error#emailError");
    const requiredCheckboxInput = form.querySelector(
      "input[type='checkbox'][required]",
    );
    const requiredCheckboxError = form.querySelector(
      "engca-form-error#requiredCheckboxError",
    );
    const apiError = form.querySelector("engca-form-error#apiError");
    const successLiveArea = this.querySelector("engca-form-success");
    const successTemplate = this.querySelector("template#form-success-msg");

    const postJsonUrl =
      env === "test"
        ? "http://127.0.0.1:3001/api/subscribe"
        : "https://engaged.ca.gov/api/subscribe";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Validate email.
      const emailIsBlank = emailInput.value.length === 0;
      // Email must be valid and contain at least one period.
      const emailIsValid =
        emailInput.checkValidity() && emailInput.value.includes(".");
      if (emailIsBlank || !emailIsValid) {
        emailInput.setAttribute("aria-describedby", "emailError");
        emailInput.setAttribute("aria-invalid", "true");
        emailError.removeAttribute("hidden");
        emailInput.focus();
        return; // <== Exit when invalid.
      }

      // Validate required checkbox.
      if (requiredCheckboxInput !== null) {
        const requiredCheckboxIsBlank = requiredCheckboxInput.checkValidity();
        if (!requiredCheckboxIsBlank) {
          requiredCheckboxInput.setAttribute(
            "aria-describedby",
            "requiredError",
          );
          requiredCheckboxInput.setAttribute("aria-invalid", "true");
          requiredCheckboxError.removeAttribute("hidden");
          requiredCheckboxInput.focus();
          return; // <== Exit when invalid.
        }
      }
      // Remove the error message here: validation just passed.
      emailError.setAttribute("hidden", "");

      // Massage the form entries into JSON.
      const formData = new FormData(e.target);
      const formObject = Object.fromEntries(formData.entries());
      const formJson = JSON.stringify(formObject);

      // Submit.
      const response = await fetch(postJsonUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: formJson,
        mode: "cors",
      });

      if (response.ok) {
        const successMessage = successTemplate.content;
        successLiveArea.appendChild(successMessage);
        form.setAttribute("hidden", "");
      } else {
        apiError.removeAttribute("hidden");
        apiError.focus();
      }
    });
  }
}

customElements.define("engca-join-convo-form", JoinConversationForm);
