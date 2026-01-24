(() => {
  const form = document.querySelector('[data-purchase-form]');
  const status = document.querySelector('[data-purchase-status]');
  const modal = document.querySelector('[data-activation-modal]');
  const licenseDisplay = modal ? modal.querySelector('[data-license-display]') : null;
  const copyButton = modal ? modal.querySelector('[data-copy-license]') : null;
  const copyStatus = modal ? modal.querySelector('[data-copy-status]') : null;
  const emailNote = modal ? modal.querySelector('[data-email-note]') : null;
  const modalCloseTargets = modal ? modal.querySelectorAll('[data-modal-close]') : [];

  if (!form || !status) {
    return;
  }

  let activeLicense = '';
  let bodyOverflow = '';

  const setStatus = (message) => {
    status.textContent = message;
  };

  const showModal = (license, email, emailMessage) => {
    if (!modal || !licenseDisplay) {
      return;
    }

    activeLicense = license;
    licenseDisplay.textContent = license;
    if (copyStatus) {
      copyStatus.textContent = '';
    }
    if (emailNote) {
      if (email) {
        emailNote.textContent = `Another copy will be emailed to ${email}.`;
      } else {
        emailNote.textContent = 'Another copy will be emailed to you.';
      }
      if (emailMessage) {
        emailNote.textContent = `${emailNote.textContent} ${emailMessage}`;
      }
    }

    modal.hidden = false;
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (!modal) {
      return;
    }
    modal.hidden = true;
    document.body.style.overflow = bodyOverflow;
  };

  const copyLicense = async () => {
    if (!activeLicense) {
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeLicense);
      } else {
        const temp = document.createElement('textarea');
        temp.value = activeLicense;
        temp.style.position = 'fixed';
        temp.style.top = '-1000px';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      if (copyStatus) {
        copyStatus.textContent = 'Copied!';
      }
    } catch (error) {
      if (copyStatus) {
        copyStatus.textContent = 'Copy failed. Please select and copy manually.';
      }
    }
  };

  if (copyButton) {
    copyButton.addEventListener('click', copyLicense);
  }

  if (modalCloseTargets.length) {
    modalCloseTargets.forEach((button) => {
      button.addEventListener('click', closeModal);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });

  const base64Url = (input) => {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer ?? input);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const buildPayload = (data) => ({
    name: data.get('name'),
    email: data.get('email'),
    edition: data.get('edition'),
    issuedAt: Date.now(),
    expiresAt: null,
  });

  const generateLicenseWithPrivateKey = async (payload) => {
    const response = await fetch('license/license-keypair.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load license keypair.');
    }

    const keyFile = await response.json();
    const privateJwk = keyFile.privateJwk || keyFile;

    if (!privateJwk.d) {
      throw new Error('Private key material missing.');
    }

    const key = await crypto.subtle.importKey(
      'jwk',
      privateJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const payloadString = JSON.stringify(payload);
    const payloadBytes = new TextEncoder().encode(payloadString);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, payloadBytes);

    return `${base64Url(payloadBytes)}.${base64Url(signature)}`;
  };

  const sendEmailWithServer = async (payload, license) => {
    const action = form.getAttribute('action') || window.location.pathname || 'index.php';
    const response = await fetch(action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        edition: payload.edition,
        license,
      }),
    });

    let message = 'Failed to send activation email.';
    try {
      const data = await response.json();
      if (data && data.message) {
        message = data.message;
      }
    } catch (error) {
      // Ignore JSON parse errors for non-JSON responses.
    }

    if (!response.ok) {
      throw new Error(message);
    }

    return message;
  };


  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const edition = formData.get('edition');
    const name = formData.get('name');

    if (edition !== 'developer') {
      setStatus('Payment processing is not enabled yet. Use Developer Edition for testing.');
      return;
    }

    if (name !== 'Sorry NeedMuvid') {
      setStatus('Not Authorized for Development Copy. If you feel this is in error, please contact Muvid support at support@muvid.sorryneedboost.com');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus('Generating activation code...');

    const payload = buildPayload(formData);

    try {
      if (window.MuvidLicensing && typeof window.MuvidLicensing.generateAndEmail === 'function') {
        const result = await window.MuvidLicensing.generateAndEmail(payload);
        const message = 'Activation email sent.';
        setStatus(message);
        if (typeof result === 'string') {
          showModal(result, payload.email, message);
        }
      } else {
        const license = await generateLicenseWithPrivateKey(payload);
        const hiddenLicense = form.querySelector('input[name="license"]');
        if (hiddenLicense) {
          hiddenLicense.value = license;
        }
        setStatus('Sending activation email...');
        let emailMessage = '';
        try {
          emailMessage = await sendEmailWithServer(payload, license);
          setStatus(emailMessage || 'Activation email sent.');
        } catch (sendError) {
          emailMessage = sendError instanceof Error ? sendError.message : 'Failed to send activation email.';
          setStatus(emailMessage);
        }
        showModal(license, payload.email, emailMessage);
      }
    } catch (error) {
      setStatus('Failed to generate activation code.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
})();
