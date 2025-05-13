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

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Validate email.
      const emailIsBlank = emailInput.value.length === 0;
      const emailIsValid = emailInput.checkValidity();
      if (emailIsBlank || !emailIsValid) {
        emailInput.setAttribute("aria-describedby", "emailError");
        emailInput.setAttribute("aria-invalid", "true");
        emailError.removeAttribute("hidden");
        emailInput.focus();
        return; // <== Exit when invalid.
      }

      // Validate required checkbox.
      const requiredCheckboxIsBlank = requiredCheckboxInput.checkValidity();
      console.log(requiredCheckboxIsBlank);
      if (!requiredCheckboxIsBlank) {
        requiredCheckboxInput.setAttribute("aria-describedby", "requiredError");
        requiredCheckboxInput.setAttribute("aria-invalid", "true");
        requiredCheckboxError.removeAttribute("hidden");
        requiredCheckboxInput.focus();
        return; // <== Exit when invalid.
      }

      // Remove the error message here: validation just passed.
      emailError.setAttribute("hidden", "");

      // Massage the form entries into JSON.
      const formData = new FormData(e.target);
      const formObject = Object.fromEntries(formData.entries());
      const formJson = JSON.stringify(formObject);

      // Submit.
      const postJsonUrl = "https://engaged.ca.gov/api/subscribe";
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
