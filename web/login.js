(() => {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("submitButton");
  const message = document.getElementById("message");
  const passkeyButton = document.getElementById("passkeyButton");
  const decode=value=>Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=")),c=>c.charCodeAt(0));
  const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");

  if(window.PublicKeyCredential&&navigator.credentials)passkeyButton.hidden=false;
  passkeyButton.addEventListener("click",async()=>{message.textContent="";passkeyButton.disabled=true;try{
    const optionResponse=await fetch("/api/auth/passkey/options",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"});const options=await optionResponse.json();
    if(!options.available){message.textContent="Sign in with your password, then enable Face ID in Data Health.";return;}
    const credential=await navigator.credentials.get({publicKey:{challenge:decode(options.challenge),rpId:options.rpId,allowCredentials:[{type:"public-key",id:decode(options.credentialId)}],userVerification:"required",timeout:60000}});
    const response=await fetch("/api/auth/passkey/verify",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:options.challengeId,credentialId:encode(credential.rawId),clientDataJSON:encode(credential.response.clientDataJSON),authenticatorData:encode(credential.response.authenticatorData),signature:encode(credential.response.signature)})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Passkey sign-in failed.");window.location.replace("/");
  }catch(error){if(error?.name!=="NotAllowedError")message.textContent=error.message||"Passkey sign-in failed.";}finally{passkeyButton.disabled=false;}});

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
      window.location.replace(data.role === "wife" ? "/wife" : "/");
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
