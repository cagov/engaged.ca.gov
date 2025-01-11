class JoinConversationForm extends window.HTMLElement {
  connectedCallback() {
    const form = this.querySelector("form");
    const emailInput = form.querySelector("input[type='email']");
    const emailError = form.querySelector("engca-form-error#emailError");
    const apiError = form.querySelector("engca-form-error#apiError");
    const success = this.querySelector("engca-form-success");

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
        form.setAttribute("hidden", "");
        success.removeAttribute("hidden");
        success.focus();
      } else {
        apiError.removeAttribute("hidden");
        apiError.focus();
      }
    });
  }
}

customElements.define("engca-join-convo-form", JoinConversationForm);
