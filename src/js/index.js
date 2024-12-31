class JoinConversationForm extends window.HTMLElement {
  connectedCallback() {
    const form = this.querySelector("form");
    const email = form.querySelector("input[type='email']");
    const error = form.querySelector("engca-form-error[for='email']");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailIsBlank = email.value.length === 0;
      const emailIsValid = email.checkValidity();

      if (emailIsBlank || !emailIsValid) {
        email.setAttribute("aria-describedby", "emailError emailHint");
        email.setAttribute("aria-invalid", "true");
        error.removeAttribute("hidden");
        email.focus();
        return;
      }

      form.submit();
    });
  }
}

customElements.define("engca-join-convo-form", JoinConversationForm);
