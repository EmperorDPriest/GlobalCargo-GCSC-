// ── GCSC Shared Navigation & Footer ──────────────────────────────────────────
(function () {
  const ROOT = './';
  const PUB = './';

  // Detect active page for nav highlight
  const path = window.location.pathname;

  function buildNav() {
    return `
<!-- TOP BAR -->
<div class="top-bar">
  <div class="tb-inner">
    <div class="tb-links">
      <a href="contact.html">Find US Office</a>
      <span>|</span>
      <a href="contact.html">Service Alerts</a>
      <span>|</span>
      <a href="history.html">Our History</a>
      <span>|</span>
      <a href="careers.html">Careers</a>
    </div>
    <div class="tb-right">
      <a class="tb-phone" href="tel:+18005424678">📞 1-800-GCSC-HUB</a>
      <div class="tb-flag">🇺🇸 United States</div>
    </div>
  </div>
</div>
<!-- HEADER -->
<header>
  <div class="h-inner">
    <a href="${PUB}index.html" class="logo">
      <img src="${ROOT}assets/images/logos/logo_transparent.webp" alt="Global Cargo Shipping Company" />
    </a>
    <nav>
      <ul class="nav-list">
        <li class="ni"><a class="nl" href="${PUB}index.html">Track</a></li>
        <li class="ni">
          <button class="nl">Ship <span class="ch">▾</span></button>
          <div class="fly">
            <div class="fly-lbl">Start Shipping</div>
            <a class="fl" href="quote.html">Get a Quote</a>
            <a class="fl" href="quote.html">Book a Shipment</a>
            <div class="fdiv"></div>
            <div class="fly-lbl">Services</div>
            <a class="fl" href="air-freight.html">Express Air Freight</a>
            <a class="fl" href="ocean-freight.html">Ocean Freight</a>
            <a class="fl" href="road-freight.html">Domestic Road Freight</a>
            <a class="fl" href="express-parcel.html">Express Parcel Delivery</a>
          </div>
        </li>
        <li class="ni">
          <button class="nl">Solutions <span class="ch">▾</span></button>
          <div class="fly">
            <a class="fl" href="international-shipping.html">International Shipping</a>
            <a class="fl" href="customs.html">Customs &amp; Brokerage</a>
            <a class="fl" href="warehousing.html">Warehousing &amp; 3PL</a>
            <a class="fl" href="supply-chain.html">Supply Chain Management</a>
            <a class="fl" href="ecommerce.html">E-Commerce Fulfillment</a>
          </div>
        </li>
        <li class="ni">
          <button class="nl">Business <span class="ch">▾</span></button>
          <div class="fly">
            <a class="fl" href="business-account.html">Open a Business Account</a>
            <a class="fl" href="business-account.html">Volume Discounts</a>
            <a class="fl" href="api-integration.html">API &amp; Tech Integration</a>
            <a class="fl" href="enterprise.html">Enterprise Solutions</a>
          </div>
        </li>
        <li class="ni"><a class="nl" href="history.html">Our Story</a></li>
        <li class="ni"><a class="nl" href="contact.html">Support</a></li>
      </ul>
    </nav>
    <button class="h-chat-btn" onclick="if(window.openChatWidget)openChatWidget()">💬 Live Support</button>
  </div>
</header>`;
  }

  function buildFooter() {
    return `
<footer>
  <div class="footer-top">
    <div class="ft-inner">
      <div>
        <img class="f-logo-img" src="${ROOT}assets/images/logos/footer_logo.png" alt="Global Cargo Shipping Company"/>
        <div class="f-desc">America's premier international freight and logistics company. Headquartered in New York, serving US businesses and individuals since 1990 with honesty, precision, and care.</div>
        <div class="f-address">
          <strong>US Headquarters</strong>
          One World Trade Center, Suite 8500<br>New York, NY 10007, United States<br>
          📞 1-800-GCSC-HUB &nbsp;|&nbsp; ✉ support@globalcargo360.com
        </div>
        <div class="f-socials">
          <a class="f-soc" href="#" title="LinkedIn">in</a>
          <a class="f-soc" href="#" title="Twitter / X">𝕏</a>
          <a class="f-soc" href="#" title="Facebook">f</a>
          <a class="f-soc" href="#" title="Instagram">📷</a>
        </div>
      </div>
      <div>
        <div class="f-col-title">Services</div>
        <ul class="f-links">
          <li><a href="${PUB}index.html">Track Shipment</a></li>
          <li><a href="air-freight.html">Air Freight</a></li>
          <li><a href="ocean-freight.html">Ocean Freight</a></li>
          <li><a href="road-freight.html">US Road Freight</a></li>
          <li><a href="customs.html">Customs Clearance</a></li>
          <li><a href="warehousing.html">Warehousing &amp; 3PL</a></li>
        </ul>
      </div>
      <div>
        <div class="f-col-title">Company</div>
        <ul class="f-links">
          <li><a href="history.html">Our History</a></li>
          <li><a href="about.html">Leadership Team</a></li>
          <li><a href="careers.html">Careers at GCSC</a></li>
          <li><a href="contact.html">Press &amp; Media</a></li>
          <li><a href="sustainability.html">Sustainability</a></li>
          <li><a href="contact.html">Investor Relations</a></li>
        </ul>
      </div>
      <div>
        <div class="f-col-title">Support</div>
        <ul class="f-links">
          <li><a href="contact.html">US Customer Service</a></li>
          <li><a href="faq.html">FAQs</a></li>
          <li><a href="contact.html">US Office Locator</a></li>
          <li><a href="contact.html">File a Claim</a></li>
          <li><a href="#" onclick="if(window.openChatWidget)openChatWidget();return false">Live Chat</a></li>
          <li><a href="${ROOT}admin/login.html">Admin Portal</a></li>
        </ul>
      </div>
    </div>
  </div>
  <div class="footer-bot">
    <div class="fb-inner">
      <span>© 2025 Global Cargo Shipping Company Inc. — All rights reserved. Registered in New York, USA.</span>
      <div>
        <a href="privacy.html">Privacy</a><a href="privacy.html">Cookies</a><a href="terms.html">Terms</a><a href="contact.html">Accessibility</a>
      </div>
    </div>
  </div>
</footer>`;
  }

  // Inject into page
  document.addEventListener('DOMContentLoaded', function () {
    const navEl = document.getElementById('gcsc-nav');
    if (navEl) navEl.innerHTML = buildNav();
    const ftEl = document.getElementById('gcsc-footer');
    if (ftEl) ftEl.innerHTML = buildFooter();

    // Highlight active nav item
    const links = document.querySelectorAll('.nl, .fl');
    links.forEach(link => {
      if (link.href && link.href !== '#' && path.endsWith(link.getAttribute('href'))) {
        link.classList.add('act');
      }
    });
  });
})();
