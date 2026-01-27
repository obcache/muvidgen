<?php
$purchaseStatus = null;
$purchaseErrors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
  $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
  $rawBody = file_get_contents('php://input');
  $data = null;

  if (stripos($contentType, 'application/json') !== false) {
    $data = json_decode($rawBody, true);
  }

  if (!is_array($data)) {
    $data = $_POST;
  }

  $name = trim($data['name'] ?? '');
  $email = trim($data['email'] ?? '');
  $edition = trim($data['edition'] ?? '');
  $license = trim($data['license'] ?? '');

  if ($name === '' || $email === '' || $edition === '' || $license === '') {
    $purchaseErrors[] = 'Missing required fields.';
  }

  if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $purchaseErrors[] = 'Invalid email address.';
  }

  if ($edition !== '' && !in_array($edition, ['developer', 'perpetual'], true)) {
    $purchaseErrors[] = 'Invalid license edition.';
  }

  if (!$purchaseErrors) {
    $subject = 'muvid Activation Code';
    $message = "Hi {$name},\n\nYour activation code:\n\n{$license}\n\nPaste this into muvid to activate.\n\nThanks,\nmuvid";
    $headers = [
      'From: activation@sorryneedboost.com',
      'Reply-To: support@muvid.sorryneedboost.com',
      'Content-Type: text/plain; charset=UTF-8',
    ];

    $sent = mail($email, $subject, $message, [string]::Join("\r\n", $headers));
    if ($sent) {
      $purchaseStatus = 'Activation email sent.';
    } else {
      $purchaseErrors[] = 'Failed to send activation email.';
    }
  }

  $wantsJson = stripos($accept, 'application/json') !== false || stripos($contentType, 'application/json') !== false;
  if ($wantsJson) {
    http_response_code($purchaseErrors ? 400 : 200);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
      'ok' => !$purchaseErrors,
      'message' => $purchaseErrors ? $purchaseErrors[0] : ($purchaseStatus ?? 'Activation email sent.'),
    ]);
    exit;
  }
}
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>muvid License Portal</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="container topbar__inner">
        <a class="brand" href="https://muvid.sorryneedboost.com" aria-label="muvid homepage">
          <img src="assets/muvid_noText_logo.png" alt="" />
          <span>muvid</span>
        </a>
        <nav class="nav">
          <a href="#home">Home</a>
          <a href="#overview">Overview</a>
          <a href="#usage">Usage</a>
          <a href="#gallery">Gallery</a>
          <a href="#support">Support</a>
          <a class="btn-success btn-icon" href="dist/muvid_setup.exe" download aria-label="Download">
            <span class="material-symbols-rounded" aria-hidden="true">download</span>
          </a>
          <a class="btn-primary btn-icon" href="#purchase" aria-label="Purchase">
            <span class="material-symbols-rounded" aria-hidden="true">shopping_cart</span>
          </a>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero" id="home">
        <div class="container hero__grid">
          <div class="hero__logo-panel">
            <img src="assets/muvid_slogan.png" alt="muvid slogan logo" />
          </div>

          <div class="hero__copy">
            <div class="pill">
              <span class="pill__dot"></span>
              Secure Offline Verification
            </div>
            <h1>Build cinematic music visualizers in minutes.</h1>
            <p>
              Muvid is a music visualizer generator that lets you assemble video clips, audio, and overlay layers into
              a polished, ready-to-render timeline.
            </p>
            <div class="hero__actions">
              <div class="action-stack">
                <a class="action-card action-card--download" href="dist/muvid_setup.exe" download>
                  <span class="action-card__icon material-symbols-rounded" aria-hidden="true">download</span>
                  <span class="action-card__text">
                    <span class="action-card__label">muvid v1.0.0 for Windows</span>
                    <span class="action-card__title">Free Trial Download</span>
                  </span>
                </a>
                <a class="action-card action-card--purchase" href="#purchase">
                  <span class="action-card__icon material-symbols-rounded" aria-hidden="true">shopping_cart</span>
                  <span class="action-card__text">
                    <span class="action-card__label">muvid 1pc perpetual license</span>
                    <span class="action-card__title">Buy License $99</span>
                  </span>
                </a>
              </div>
            </div>
            <p class="fineprint fineprint--callout">
              <a href="dist/muvid_setup.exe" download>Download</a> a FREE trial version of muvid.<br />
              Unlock all features by purchasing an activation code.
            </p>
          </div>

          <div class="hero__aside">
            <div class="card hero-card">
              <h2>At a Glance</h2>
              <p class="muted">Project-driven workflow with audio-first timelines and visualizer overlays.</p>
              <ul class="info-list">
                <li>Audio + video timeline assembly</li>
                <li>Spectrograph and text layers</li>
                <li>Landscape or portrait renders</li>
                <li>ffmpeg-backed rendering pipeline</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="info" id="overview">
        <div class="container">
          <div class="info__head">
            <h2>Product Overview</h2>
            <p class="subhead">A streamlined toolset for building visualizer videos from start to finish.</p>
          </div>
          <div class="info__grid">
            <div class="card info-card">
              <h3>What muvid does</h3>
              <p class="muted">
                Assemble audio, video clips, spectrograph visualizers, and text layers into a final export using a project-based workflow.
              </p>
              <ul class="info-list">
                <li>Project save/load with JSON-based renders</li>
                <li>Audio + video timeline assembly</li>
                <li>Visualizer (spectrograph) and text overlays</li>
                <li>Render pipeline powered by ffmpeg</li>
              </ul>
            </div>
            <div class="card info-card">
              <h3>Project Basics</h3>
              <p class="muted">Save often. Rendering uses the saved project JSON.</p>
              <ul class="info-list">
                <li>Unsaved projects show: <span class="code-inline">muvid - Unsaved Project *</span></li>
                <li>Save: File &gt; Save</li>
                <li>Save As: File &gt; Save As...</li>
                <li>Open: File &gt; Open Project...</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="info app-preview" id="app-preview">
        <div class="container">
          <div class="info__head">
            <h2>App Preview</h2>
            <p class="subhead">A look at muvid in action.</p>
          </div>
          <div class="app-preview__grid">
            <div class="app-preview__shot">
              <img src="assets/app-screenshot-1.png" alt="muvid interface showing timeline, layers, and preview" loading="lazy" />
          </div>
          <div class="app-preview__shot">
              <img src="assets/app-screenshot-2.png" alt="muvid interface with media timeline and layer controls" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <section class="info" id="usage">
        <div class="container">
          <div class="info__head">
            <h2>Usage</h2>
            <p class="subhead">From your first project to a polished render.</p>
          </div>
          <div class="usage__grid">
            <div>
              <h3 class="usage__title">Quick Start</h3>
              <div class="steps steps--tight">
                <div class="step">
                  <div class="step__num">1</div>
                  <div>
                    <h3>Create a new project</h3>
                    <p>File &gt; New Project to begin with a clean timeline.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">2</div>
                  <div>
                    <h3>Load your audio</h3>
                    <p>Media &gt; Load Audio... to add the base waveform.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">3</div>
                  <div>
                    <h3>Add video clips</h3>
                    <p>Media &gt; Add Videos... or add from the Media Library.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">4</div>
                  <div>
                    <h3>Layer visualizers + text</h3>
                    <p>Layers &gt; Add Visualizer / Add Text, then tune colors and placement.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">5</div>
                  <div>
                    <h3>Save and render</h3>
                    <p>Save the project, then use File &gt; Render to export.</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 class="usage__title">Workflow Details</h3>
              <div class="info__grid">
                <div class="card info-card">
                  <h3>Storyboard timeline</h3>
                  <p class="muted">Reorder clips, trim for pacing, and loop short segments.</p>
                  <ul class="info-list">
                    <li>Drag clips to reorder</li>
                    <li>Trim start/end with handles</li>
                    <li>Loop clips by extending duration</li>
                    <li>Context menu: rename, duplicate, remove</li>
                  </ul>
                </div>
                <div class="card info-card">
                  <h3>Layer controls</h3>
                  <p class="muted">Keep text and visualizers editable throughout the edit.</p>
                  <ul class="info-list">
                    <li>Shared properties: color, outline, glow</li>
                    <li>Position: X/Y %, rotate, transparency</li>
                    <li>Spectrograph modes: bar, line, dots</li>
                    <li>Text settings: content, font, size</li>
                  </ul>
                </div>
                <div class="card info-card">
                  <h3>Preview + orientation</h3>
                  <p class="muted">Lock output sizes to your target format.</p>
                  <ul class="info-list">
                    <li>Landscape: 1920x1080</li>
                    <li>Portrait: 1080x1920</li>
                    <li>Clips stay centered to preserve aspect</li>
                    <li>Zoom tools for long timelines</li>
                  </ul>
                </div>
                <div class="card info-card">
                  <h3>Render</h3>
                  <p class="muted">Exports are driven by the saved project file.</p>
                  <ul class="info-list">
                    <li>Project &gt; Render or File &gt; Render</li>
                    <li>Cancel anytime from Project or File menus</li>
                    <li>Temporary render.json stored in .muvid</li>
                    <li>Output file chosen at render start</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="info" id="gallery">
        <div class="container">
          <div class="info__head">
            <h2>Gallery</h2>
            <p class="subhead">Finished visualizers built with muvid.</p>
          </div>
          <div class="gallery__grid">
            <article class="gallery__item">
              <div class="gallery__thumb">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              </div>
              <h3>Neon Skyline</h3>
              <p class="muted">High-contrast bars with fast-paced cuts.</p>
            </article>
            <article class="gallery__item">
              <div class="gallery__thumb">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              </div>
              <h3>Moonlight Drift</h3>
              <p class="muted">Minimalist line spectrograph with soft glow.</p>
            </article>
            <article class="gallery__item">
              <div class="gallery__thumb">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              </div>
              <h3>Pulse Circuit</h3>
              <p class="muted">Layered bars and typography-driven captions.</p>
            </article>
            <article class="gallery__item">
              <div class="gallery__thumb">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              </div>
              <h3>Studio Echo</h3>
              <p class="muted">Portrait format visualizer for social reels.</p>
            </article>
            <article class="gallery__item">
              <div class="gallery__thumb">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              </div>
              <h3>Night Drive</h3>
              <p class="muted">Looped footage with slow-wave spectrum.</p>
            </article>
            <article class="gallery__item">
              <div class="gallery__thumb">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5l11 7-11 7V5z" />
                </svg>
              </div>
              <h3>Skywave</h3>
              <p class="muted">Full-screen spectrum with bold type overlays.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="benefits" id="support">
        <div class="container benefits__grid">
          <div class="benefit">
            <div class="benefit__icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l7 3v6c0 5-3.5 9.4-7 11-3.5-1.6-7-6-7-11V5l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div class="benefit__title">Secure &amp; Encrypted</div>
            <div class="benefit__text">Industry-standard security protocols</div>
          </div>
          <div class="benefit">
            <div class="benefit__icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            <div class="benefit__title">Instant Delivery</div>
            <div class="benefit__text">License keys delivered immediately</div>
          </div>
          <div class="benefit">
            <div class="benefit__icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12a8 8 0 1116 0 8 8 0 01-16 0z" />
                <path d="M7 12h4l2-2 4 0" />
              </svg>
            </div>
            <div class="benefit__title">Offline Verification</div>
            <div class="benefit__text">Works without internet connection</div>
          </div>
        </div>
      </section>

      <section class="info" id="troubleshooting">
        <div class="container">
          <div class="info__head">
            <h2>Troubleshooting</h2>
            <p class="subhead">Fast fixes for the most common setup questions.</p>
          </div>
          <div class="info__grid">
            <div class="card info-card">
              <h3>Render fails with font errors</h3>
              <p class="muted">
                Ensure the font is in <span class="code-inline">client/public/fonts</span> and the font name matches the UI dropdown.
              </p>
            </div>
            <div class="card info-card">
              <h3>Spectrograph not visible</h3>
              <p class="muted">Verify audio is loaded and a spectrograph layer exists. Press Play once to initialize audio.</p>
            </div>
            <div class="card info-card">
              <h3>Missing media</h3>
              <p class="muted">If a file path is missing, the clip will highlight. Re-add the file or update the path.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="purchase" id="purchase">
        <div class="container">
          <div class="purchase__grid">
            <div class="card purchase-card">
              <h2>Purchase License</h2>
              <p class="muted">Complete the form below to receive your license key</p>
              <form class="purchase-form" data-purchase-form method="post" action="">
                <label>
                  <span>Full Name</span>
                  <input type="text" name="name" placeholder="John Doe" required />
                </label>
                <label>
                  <span>Email Address</span>
                  <input type="email" name="email" placeholder="john@company.com" required />
                </label>
                <label>
                  <span>License Edition</span>
                  <select name="edition" required>
                    <option value="">Select an edition</option>
                    <option value="developer">Developer Edition - $0</option>
                    <option value="perpetual">Perpetual License - $99</option>
                  </select>
                </label>
                <input type="hidden" name="license" value="" />
                <button class="btn-primary btn-wide" type="submit">
                  <span class="btn-lock">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 11V8a5 5 0 0110 0v3" />
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                    </svg>
                  </span>
                  Purchase
                </button>
                <p class="fineprint">Secure checkout | Instant delivery | 30-day money-back guarantee</p>
                <p class="purchase__status muted" data-purchase-status>
                  <?php echo htmlspecialchars($purchaseStatus ?? 'Developer Edition emails an activation key for testing.', ENT_QUOTES, 'UTF-8'); ?>
                </p>
                <p class="purchase__hint muted">Scroll down for activation steps.</p>
              </form>
            </div>
            <div class="how how--embedded" id="how">
              <h2>How to Activate Your License <span class="anchor-cue">↓</span></h2>
              <p class="subhead">Follow these simple steps to activate your license after purchase</p>

              <div class="steps">
                <div class="step">
                  <div class="step__num">1</div>
                  <div>
                    <h3>Receive Your License Key</h3>
                    <p>After purchase, you will receive an email containing your unique license key. It will look like this:</p>
                    <div class="code-block">
                      eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJlbWFpbCI6ImpvaG5AY29tY...signature
                    </div>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">2</div>
                  <div>
                    <h3>Open the Application</h3>
                    <p>Launch your trial version of the application. You will see a license activation prompt.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">3</div>
                  <div>
                    <h3>Paste Your License Key</h3>
                    <p>Copy the license key from your email and paste it into the activation modal. The application will verify it offline using the embedded public key.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step__num">4</div>
                  <div>
                    <h3>Start Using Full Version</h3>
                    <p>Once verified, all features will be unlocked immediately. No internet connection required for future use.</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="purchase__aside">
              <img src="assets/muvid_setupWizard_logo.png" alt="muvid slogan logo" />
            </div>
          </div>
        </div>
      </section>
    </main>

    <div class="modal" data-activation-modal hidden>
      <div class="modal__backdrop" data-modal-close></div>
      <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="activation-modal-title">
        <button class="modal__close" type="button" data-modal-close aria-label="Close">✕</button>
        <div class="modal__badge">Success</div>
        <h3 id="activation-modal-title">Congratulations on your purchase!</h3>
        <p class="muted">
          Your license key is below. Keep it safe, and paste it into muvid to activate.
        </p>
        <div class="code-block modal__code" data-license-display></div>
        <div class="modal__actions">
          <button class="btn-primary" type="button" data-copy-license>Copy to Clipboard</button>
          <span class="modal__copy-status muted" data-copy-status></span>
        </div>
        <p class="muted modal__note" data-email-note>Another copy will be emailed to you.</p>
      </div>
    </div>

    <footer class="footer">
      <div class="container footer__grid">
        <div class="footer__brand">
          <img src="assets/muvid_noText_logo.png" alt="" />
          <p>Secure offline license verification for proprietary applications.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#overview">Overview</a>
          <a href="#usage">Usage</a>
          <a href="#gallery">Gallery</a>
        </div>
        <div>
          <h4>Support</h4>
          <a href="#support">Support</a>
          <a href="#troubleshooting">Troubleshooting</a>
          <a href="#purchase">Contact Us</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="#support">Privacy Policy</a>
          <a href="#support">Terms of Service</a>
          <a href="#support">Refund Policy</a>
        </div>
      </div>
      <div class="container footer__bottom">
        <span>Ac 2026 License Portal. All rights reserved.</span>
        <span class="footer__secure">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2l7 3v6c0 5-3.5 9.4-7 11-3.5-1.6-7-6-7-11V5l7-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Secured with industry-standard encryption
        </span>
      </div>
    </footer>

    <script src="js/activation.1d758320.js"></script>
  </body>
</html>
