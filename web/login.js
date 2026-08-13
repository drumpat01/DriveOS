(() => {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("submitButton");
  const message = document.getElementById("message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    button.disabled = true;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        message.textContent =
          data.error || "Sign in failed. Please try again.";
        return;
      }

      form.password.value = "";
      window.location.replace("/");
    }
    catch {
      message.textContent =
        "JourneyDeck could not be reached. Please try again.";
    }
    finally {
      button.disabled = false;
    }
  });
})();
