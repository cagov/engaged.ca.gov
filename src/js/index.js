const mailchimpConfig = {
  engca: {
    audience_name: "Engaged California",
    audience_id: "61200a6dda",
    options: 1,
  },
  state: {
    audience_name: "EngCA - State Employees",
    audience_id: "417d16b2c0",
    options: 2,
  },
  sandbox: {
    audience_name: "[SANDBOX] EngCA testing",
    audience_id: "23461fc80f",
    options: 2,
  },
};

class UnifiedForm extends window.HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector("form");
    this.sectionState = this.querySelector('[data-form-section="state"]');
    this.sectionFires = this.querySelector('[data-form-section="fires"]');
    this.discussionCheckboxes = this.querySelectorAll(
      '[data-form-section="discussion"] input',
    );
  }
  connectedCallback() {
    this.hide(this.sectionState);
    this.hide(this.sectionFires);

    if (this.form) {
      this.form.addEventListener("submit", async (e) => {
        e.preventDefault();
        this.handleFormSubmit(e);
      });
    }

    for (const checkbox of this.discussionCheckboxes) {
      checkbox.addEventListener("change", (e) => {
        this.handleCheckboxChange(e);
      });
    }
  }

  getAudienceID = (data) => {
    const audienceID = Object.keys(data).some(
      (key) => key === "interest-state",
    );

    return audienceID
      ? mailchimpConfig.state.audience_id
      : mailchimpConfig.engca.audience_id;
  };

  hide = (element) => {
    element.classList.add("hidden");
  };

  show = (element) => {
    element.classList.remove("hidden");
  };

  handleFormSubmit = async (e) => {
    // Handle form submission logic here
    const formData = new FormData(e.target);
    const calculatedData = Object.fromEntries(formData);
    calculatedData.audienceID = this.getAudienceID(calculatedData);

    console.log("Calculated data:", calculatedData);
  };
  handleCheckboxChange = (e) => {
    const { checked, value } = e.target;

    switch (value) {
      case "state":
        checked ? this.show(this.sectionState) : this.hide(this.sectionState);
        break;
      case "fires":
        checked ? this.show(this.sectionFires) : this.hide(this.sectionFires);
        break;
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
 * attribute, auto-focus, and other aria attributes.
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
