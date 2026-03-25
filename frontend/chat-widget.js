/**
 * GCSC Live Chat Widget
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained, embeddable customer chat widget.
 * Drop <script src="chat-widget.js"></script> into any page — that's it.
 *
 * Features:
 *   ✓ Auto-generates & persists sessionId in localStorage
 *   ✓ Reconnects to same session on page refresh
 *   ✓ Typing indicator (debounced)
 *   ✓ Online/offline detection
 *   ✓ Auto-scroll with "new messages" nudge
 *   ✓ Unread message count (badge on launcher)
 *   ✓ Message timestamps (relative + absolute on hover)
 *   ✓ Read receipts (double tick ✓✓)
 *   ✓ Agent assignment notification
 *   ✓ Smooth entrance animations
 *   ✓ Input validation & sanitization
 *
 * Socket events emitted   : customer_join_chat | customer_send_message | customer_typing
 * Socket events received  : customer_join_chat | receive_message | typing_indicator |
 *                           chat_status_update | message_read
 */

(function () {
  'use strict';

  // Capture script directory for asset paths (must be top-level before DOMContentLoaded)
  const _scriptSrc = (document.currentScript && document.currentScript.src) || '';
  const _scriptDir = _scriptSrc ? _scriptSrc.substring(0, _scriptSrc.lastIndexOf('/') + 1) : '';
  const _logoSrc   = _scriptDir + 'assets/images/logos/logo_transparent.webp';

  // ── Config (auto-detected) ──────────────────────────────────────────────────
  const isLocal  = (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '' ||
    location.protocol === 'file:'
  );
  const SOCKET_URL = (window.CONFIG && window.CONFIG.SOCKET_URL)
    || (isLocal ? 'http://localhost:5000' : 'https://api.globalcargo360.com');

  const LS_SESSION  = 'gcsc_chat_sessionId';
  const LS_NAME     = 'gcsc_chat_name';
  const LS_EMAIL    = 'gcsc_chat_email';

  // ── State ───────────────────────────────────────────────────────────────────
  let socket         = null;
  let sessionId      = localStorage.getItem(LS_SESSION) || null;
  let customerName   = localStorage.getItem(LS_NAME)    || '';
  let customerEmail  = localStorage.getItem(LS_EMAIL)   || '';
  let isOpen         = false;
  let typingTimer    = null;
  let isTypingActive = false;
  let unreadCount    = 0;
  let agentName      = 'Support Agent';
  let agentAssigned  = false;
  let isOnline       = navigator.onLine;
  let scrollLocked   = false; // user has scrolled up
  let pendingImage   = null;  // { dataUrl, fileName } waiting to be sent

  // ── Styles (Brand: GlobalCargo Navy #1A3A8A + Orange #F47920) ───────────────
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap');

    :root {
      --gcsc-navy:      #1A3A8A;
      --gcsc-navy-d:    #0F2557;
      --gcsc-navy-l:    #2E5DB3;
      --gcsc-orange:    #F47920;
      --gcsc-orange-d:  #D4620F;
      --gcsc-surface:   #ffffff;
      --gcsc-bg:        #f4f6f9;
      --gcsc-border:    #e2e6ee;
      --gcsc-text:      #0F1F52;
      --gcsc-muted:     #6B7491;
      --gcsc-shadow:    0 24px 64px rgba(26,58,138,.18), 0 4px 20px rgba(0,0,0,.08);
      --gcsc-radius:    18px;
      --gcsc-r-msg:     14px;
      --gcsc-font:      'Source Sans 3', 'Segoe UI', Arial, sans-serif;
      --gcsc-transition: cubic-bezier(.22,.68,0,1.2);
    }

    /* ── Launcher wrapper (holds button + label) ── */
    #gcsc-launcher-wrap {
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      /* Subtle idle bounce — stops when open */
      animation: gcsc-idle-bounce 3.2s ease-in-out infinite;
    }
    #gcsc-launcher-wrap.open {
      animation: none; /* no bounce when chat is open */
    }

    /* ── "Chat with us" label ── */
    #gcsc-cta-label {
      background: #fff;
      color: var(--gcsc-navy);
      font-family: var(--gcsc-font);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: .01em;
      padding: 5px 13px;
      border-radius: 20px;
      box-shadow: 0 3px 14px rgba(26,58,138,.18), 0 1px 4px rgba(0,0,0,.08);
      white-space: nowrap;
      pointer-events: none;
      border: 1.5px solid rgba(26,58,138,.1);
      /* Entrance animation — slides up after 1.2s delay */
      animation: gcsc-label-in .5s cubic-bezier(.22,.68,0,1.2) 1.2s both;
      position: relative;
    }
    /* Arrow tip pointing down toward the button */
    #gcsc-cta-label::after {
      content: '';
      position: absolute; bottom: -6px; left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #fff;
      border-bottom: none;
      filter: drop-shadow(0 2px 1px rgba(26,58,138,.08));
    }
    /* Orange dot — live indicator */
    #gcsc-cta-label::before {
      content: '';
      display: inline-block;
      width: 7px; height: 7px;
      background: #22c55e;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
      animation: gcsc-pulse-green 2s ease infinite;
      box-shadow: 0 0 0 0 rgba(34,197,94,.5);
    }
    /* Hide label when chat is open */
    #gcsc-launcher-wrap.open #gcsc-cta-label {
      opacity: 0; transform: translateY(6px) scale(.9);
      transition: opacity .2s ease, transform .2s ease;
      pointer-events: none;
    }

    /* ── Launcher button ── */
    #gcsc-launcher {
      width: 62px; height: 62px; border-radius: 50%;
      background: linear-gradient(135deg, var(--gcsc-navy), var(--gcsc-navy-l));
      box-shadow: 0 6px 28px rgba(26,58,138,.5);
      border: none; cursor: pointer; outline: none;
      display: flex; align-items: center; justify-content: center;
      transition: transform .28s var(--gcsc-transition), box-shadow .28s ease;
      position: relative;
      flex-shrink: 0;
    }
    #gcsc-launcher:hover {
      transform: scale(1.1);
      box-shadow: 0 10px 36px rgba(26,58,138,.65);
    }
    #gcsc-launcher:active { transform: scale(.94); }
    #gcsc-launcher svg { width: 27px; height: 27px; fill: #fff; }
    #gcsc-launcher .gcsc-close-icon { display: none; }
    #gcsc-launcher.open .gcsc-chat-icon  { display: none; }
    #gcsc-launcher.open .gcsc-close-icon { display: block; }

    /* Pulse ring on launcher when there are unread messages */
    #gcsc-launcher.has-unread::after {
      content: ''; position: absolute; inset: -4px;
      border-radius: 50%; border: 2.5px solid var(--gcsc-orange);
      animation: gcsc-ring 1.6s ease-out infinite;
    }

    /* Idle bounce — gentle, professional */
    @keyframes gcsc-idle-bounce {
      0%, 100%  { transform: translateY(0);    }
      10%        { transform: translateY(-7px);  }
      20%        { transform: translateY(0);    }
      30%        { transform: translateY(-4px);  }
      40%        { transform: translateY(0);    }
      /* Long pause before next bounce */
    }

    /* Label entrance */
    @keyframes gcsc-label-in {
      from { opacity: 0; transform: translateY(10px) scale(.9); }
      to   { opacity: 1; transform: translateY(0)   scale(1);   }
    }

    /* Badge */
    #gcsc-badge {
      position: absolute; top: -5px; right: -5px;
      background: var(--gcsc-orange); color: #fff;
      font-family: var(--gcsc-font); font-size: 11px; font-weight: 700;
      min-width: 21px; height: 21px; border-radius: 11px;
      display: none; align-items: center; justify-content: center;
      padding: 0 5px; border: 2px solid #fff;
      animation: gcsc-pop .35s var(--gcsc-transition);
    }
    #gcsc-badge.visible { display: flex; }

    /* ── Widget Panel ── */
    #gcsc-panel {
      position: fixed; bottom: 100px; right: 24px; z-index: 99998;
      width: 390px; max-height: 620px;
      border-radius: var(--gcsc-radius);
      background: var(--gcsc-surface);
      box-shadow: var(--gcsc-shadow);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: var(--gcsc-font);
      transform: scale(.88) translateY(24px);
      opacity: 0; pointer-events: none;
      transition: transform .32s var(--gcsc-transition), opacity .26s ease;
    }
    #gcsc-panel.open {
      transform: scale(1) translateY(0);
      opacity: 1; pointer-events: all;
    }

    /* ── Header ── */
    #gcsc-header {
      background: linear-gradient(135deg, var(--gcsc-navy) 0%, var(--gcsc-navy-l) 100%);
      padding: 0;
      color: #fff;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
    }
    #gcsc-header::before {
      content: ''; position: absolute; top: -30px; right: -30px;
      width: 130px; height: 130px; border-radius: 50%;
      background: rgba(244,121,32,.15);
      pointer-events: none;
    }
    .gcsc-header-top {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px 10px;
      border-bottom: 1px solid rgba(255,255,255,.12);
    }
    .gcsc-logo-img {
      height: 34px; width: auto; object-fit: contain;
      filter: brightness(0) invert(1); /* white logo */
    }
    .gcsc-header-body {
      padding: 12px 18px 16px;
      display: flex; align-items: center; gap: 14px;
    }
    .gcsc-avatar-wrap {
      width: 46px; height: 46px; border-radius: 50%;
      background: var(--gcsc-orange);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      border: 2.5px solid rgba(255,255,255,.3);
      box-shadow: 0 3px 14px rgba(0,0,0,.2);
    }
    .gcsc-avatar-wrap svg { width: 24px; height: 24px; fill: #fff; }
    .gcsc-agent-info { flex: 1; }
    .gcsc-agent-name {
      font-size: 16px; font-weight: 700; line-height: 1.2;
      letter-spacing: -.01em; color: #fff;
    }
    .gcsc-status-row {
      display: flex; align-items: center; gap: 6px; margin-top: 3px;
    }
    .gcsc-status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 2px rgba(74,222,128,.4);
      flex-shrink: 0;
      animation: gcsc-pulse-green 2s ease infinite;
    }
    .gcsc-status-dot.offline { background: #9ca3af; box-shadow: none; animation: none; }
    .gcsc-status-text { font-size: 12px; color: rgba(255,255,255,.8); }
    .gcsc-header-subtitle {
      font-size: 12px; color: rgba(255,255,255,.65);
      margin-top: 2px; line-height: 1.3;
    }

    /* ── Orange accent bar ── */
    .gcsc-accent-bar {
      height: 3px;
      background: linear-gradient(90deg, var(--gcsc-orange), #ffb347);
    }

    /* ── Pre-chat form ── */
    #gcsc-prechat {
      padding: 20px 18px;
      display: flex; flex-direction: column; gap: 13px;
      flex: 1; background: var(--gcsc-bg);
    }
    .gcsc-prechat-intro {
      font-size: 14px; color: var(--gcsc-text); font-weight: 600;
      margin-bottom: 2px; line-height: 1.4;
    }
    .gcsc-field { display: flex; flex-direction: column; gap: 5px; }
    .gcsc-field label {
      font-size: 12px; font-weight: 700; color: var(--gcsc-navy);
      text-transform: uppercase; letter-spacing: .04em;
    }
    .gcsc-field input {
      padding: 11px 14px;
      border: 1.5px solid var(--gcsc-border);
      border-radius: 10px; font-size: 14px;
      font-family: var(--gcsc-font); color: var(--gcsc-text);
      outline: none; transition: border-color .2s, box-shadow .2s;
      background: #fff;
    }
    .gcsc-field input:focus {
      border-color: var(--gcsc-navy);
      box-shadow: 0 0 0 3px rgba(26,58,138,.12);
    }
    .gcsc-start-btn {
      margin-top: 4px; padding: 13px;
      background: linear-gradient(135deg, var(--gcsc-orange), var(--gcsc-orange-d));
      color: #fff; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 700; font-family: var(--gcsc-font);
      cursor: pointer; transition: opacity .2s, transform .15s;
      letter-spacing: .02em;
      box-shadow: 0 4px 14px rgba(244,121,32,.4);
    }
    .gcsc-start-btn:hover  { opacity: .9; }
    .gcsc-start-btn:active { transform: scale(.97); }
    .gcsc-start-btn:disabled { opacity: .45; cursor: not-allowed; }

    /* ── Messages ── */
    #gcsc-messages {
      flex: 1; overflow-y: auto; padding: 16px 14px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth; background: var(--gcsc-bg);
      min-height: 0;
    }
    #gcsc-messages::-webkit-scrollbar { width: 3px; }
    #gcsc-messages::-webkit-scrollbar-thumb { background: #c7cfe0; border-radius: 2px; }

    /* ── Message Bubbles ── */
    .gcsc-msg-group {
      display: flex; flex-direction: column;
      animation: gcsc-fadeup .28s ease forwards;
    }
    .gcsc-msg-group.customer { align-items: flex-end; }
    .gcsc-msg-group.admin    { align-items: flex-start; }

    .gcsc-msg-meta {
      font-size: 11px; color: var(--gcsc-muted); margin-bottom: 4px;
      display: flex; align-items: center; gap: 5px;
    }
    .gcsc-msg-group.customer .gcsc-msg-meta { flex-direction: row-reverse; }

    .gcsc-role-tag {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; padding: 1px 6px; border-radius: 5px;
    }
    .gcsc-msg-group.customer .gcsc-role-tag {
      background: rgba(26,58,138,.1); color: var(--gcsc-navy);
    }
    .gcsc-msg-group.admin .gcsc-role-tag {
      background: rgba(244,121,32,.12); color: var(--gcsc-orange-d);
    }

    .gcsc-bubble {
      max-width: 82%; padding: 10px 14px;
      border-radius: var(--gcsc-r-msg);
      font-size: 14px; line-height: 1.55;
      word-break: break-word; position: relative;
    }
    .gcsc-msg-group.customer .gcsc-bubble {
      background: linear-gradient(135deg, var(--gcsc-navy), var(--gcsc-navy-l));
      color: #fff; border-bottom-right-radius: 4px;
      box-shadow: 0 2px 10px rgba(26,58,138,.25);
    }
    .gcsc-msg-group.admin .gcsc-bubble {
      background: #fff; color: var(--gcsc-text);
      border: 1.5px solid var(--gcsc-border);
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 6px rgba(0,0,0,.05);
    }
    .gcsc-timestamp {
      display: block; font-size: 10px; margin-top: 5px;
      opacity: .6; text-align: right;
    }
    .gcsc-msg-group.admin .gcsc-timestamp { text-align: left; }
    .gcsc-tick { font-size: 11px; margin-left: 4px; opacity: .7; }
    .gcsc-tick.read { color: #93c5fd; }

    /* ── Typing ── */
    #gcsc-typing {
      display: none; align-items: center; gap: 8px;
      padding: 0 14px 8px;
      font-size: 12px; color: var(--gcsc-muted);
    }
    #gcsc-typing.visible { display: flex; }
    .gcsc-dots { display: flex; gap: 4px; }
    .gcsc-dots span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--gcsc-orange); display: block;
      animation: gcsc-bounce .9s ease infinite;
    }
    .gcsc-dots span:nth-child(2) { animation-delay: .16s; }
    .gcsc-dots span:nth-child(3) { animation-delay: .32s; }

    /* ── Input bar ── */
    #gcsc-input-bar {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 10px 12px 12px;
      border-top: 1.5px solid var(--gcsc-border);
      background: #fff; flex-shrink: 0;
    }
    /* Attach button */
    #gcsc-attach-btn {
      width: 38px; height: 38px; border-radius: 50%;
      background: none; border: 1.5px solid var(--gcsc-border);
      cursor: pointer; flex-shrink: 0; color: var(--gcsc-muted);
      display: flex; align-items: center; justify-content: center;
      transition: border-color .2s, color .2s;
    }
    #gcsc-attach-btn:hover { border-color: var(--gcsc-navy); color: var(--gcsc-navy); }
    #gcsc-attach-btn svg { width: 17px; height: 17px; fill: currentColor; }
    #gcsc-file-input { display: none; }
    /* Image preview before send */
    #gcsc-img-preview {
      display: none; padding: 8px 14px 0;
      background: #fff; flex-shrink: 0;
    }
    #gcsc-img-preview.visible { display: flex; align-items: center; gap: 10px; }
    #gcsc-img-preview img {
      height: 60px; width: auto; border-radius: 8px;
      border: 1.5px solid var(--gcsc-border); object-fit: cover;
    }
    #gcsc-img-preview span { font-size: 12px; color: var(--gcsc-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #gcsc-img-cancel {
      background: none; border: none; cursor: pointer;
      color: #ef4444; font-size: 18px; line-height: 1; padding: 2px 4px;
    }
    /* Image bubble */
    .gcsc-img-bubble {
      max-width: 200px; border-radius: 12px; display: block;
      border: 1.5px solid var(--gcsc-border); cursor: pointer;
      transition: opacity .2s;
    }
    .gcsc-img-bubble:hover { opacity: .88; }
    /* Upload progress */
    .gcsc-upload-progress {
      font-size: 11px; color: var(--gcsc-muted); margin-top: 4px;
      display: flex; align-items: center; gap: 6px;
    }
    .gcsc-upload-progress::before {
      content: ''; width: 12px; height: 12px; border: 2px solid var(--gcsc-border);
      border-top-color: var(--gcsc-navy); border-radius: 50%;
      animation: gcsc-spin .7s linear infinite; display: block;
    }
    @keyframes gcsc-spin { to { transform: rotate(360deg); } }
    #gcsc-input {
      flex: 1; border: 1.5px solid var(--gcsc-border);
      border-radius: 20px; padding: 10px 15px;
      font-size: 14px; font-family: var(--gcsc-font);
      color: var(--gcsc-text); resize: none; outline: none;
      max-height: 110px; min-height: 42px; overflow-y: auto;
      transition: border-color .2s, box-shadow .2s; line-height: 1.4;
      background: var(--gcsc-bg);
    }
    #gcsc-input:focus {
      border-color: var(--gcsc-navy);
      background: #fff;
      box-shadow: 0 0 0 3px rgba(26,58,138,.1);
    }
    #gcsc-input:disabled { opacity: .5; cursor: not-allowed; }
    #gcsc-send-btn {
      width: 42px; height: 42px; border-radius: 50%;
      background: linear-gradient(135deg, var(--gcsc-orange), var(--gcsc-orange-d));
      border: none; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: transform .18s, opacity .18s;
      box-shadow: 0 3px 10px rgba(244,121,32,.4);
    }
    #gcsc-send-btn:hover  { opacity: .88; transform: scale(1.05); }
    #gcsc-send-btn:active { transform: scale(.92); }
    #gcsc-send-btn:disabled { opacity: .45; cursor: not-allowed; }
    #gcsc-send-btn svg { width: 18px; height: 18px; fill: #fff; margin-left: 2px; }

    /* ── System messages ── */
    .gcsc-system-msg {
      text-align: center; font-size: 11.5px; color: var(--gcsc-muted);
      padding: 5px 14px; background: rgba(26,58,138,.06);
      border-radius: 20px; margin: 2px auto; max-width: 88%;
    }

    /* ── Scroll nudge ── */
    #gcsc-scroll-nudge {
      position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%);
      background: var(--gcsc-navy); color: #fff;
      font-size: 12px; font-family: var(--gcsc-font); font-weight: 600;
      padding: 6px 16px; border-radius: 20px; cursor: pointer;
      display: none; white-space: nowrap;
      box-shadow: 0 4px 14px rgba(26,58,138,.4);
      animation: gcsc-fadeup .25s ease; z-index: 10;
    }
    #gcsc-scroll-nudge.visible { display: block; }

    /* ── Offline banner ── */
    #gcsc-offline-banner {
      display: none; background: #fff7ed;
      color: #9a3412; font-size: 12px; font-family: var(--gcsc-font);
      text-align: center; padding: 7px;
      border-bottom: 1px solid #fed7aa; flex-shrink: 0;
    }
    #gcsc-offline-banner.visible { display: block; }

    /* ── Chat closed ── */
    #gcsc-closed-bar {
      display: none; padding: 14px 16px;
      background: #f0f4ff; border-top: 1.5px solid var(--gcsc-border);
      text-align: center; font-size: 13px; color: var(--gcsc-muted);
      flex-shrink: 0;
    }
    #gcsc-closed-bar.visible { display: block; }
    #gcsc-new-chat-btn {
      margin-top: 8px; padding: 8px 20px;
      background: var(--gcsc-navy); color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 700;
      font-family: var(--gcsc-font); cursor: pointer; transition: opacity .2s;
    }
    #gcsc-new-chat-btn:hover { opacity: .88; }

    /* ── Animations ── */
    @keyframes gcsc-fadeup {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes gcsc-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%            { transform: translateY(-6px); }
    }
    @keyframes gcsc-pop {
      0% { transform: scale(.4); } 70% { transform: scale(1.18); } 100% { transform: scale(1); }
    }
    @keyframes gcsc-ring {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.45); }
    }
    @keyframes gcsc-pulse-green {
      0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,.6); }
      50% { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
    }

    /* ── Mobile ── */
  @media (max-width: 480px) {
    #gcsc-panel {
      width: calc(100vw - 16px); bottom: 92px; right: 8px;
      max-height: calc(100dvh - 106px); border-radius: 14px;
    }
    #gcsc-launcher-wrap { bottom: 14px; right: 10px; gap: 6px; }
    #gcsc-launcher { width: 54px; height: 54px; }
    #gcsc-cta-label { font-size: 11.5px; padding: 4px 11px; }
    .gcsc-bubble { max-width: 88%; }
  }
  `;

  // ── Inject styles ─────────────────────────────────────────────────────────
  function injectStyles() {
    const el = document.createElement('style');
    el.id        = 'gcsc-chat-styles';
    el.textContent = STYLES;
    document.head.appendChild(el);
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  function buildDOM() {
    // ── Launcher wrapper (bounce container)
    const wrap = document.createElement('div');
    wrap.id = 'gcsc-launcher-wrap';

    // ── "Chat with us" label (inside wrap, above button)
    const label = document.createElement('div');
    label.id          = 'gcsc-cta-label';
    label.textContent = 'Chat with us';

    // ── Launcher button
    const launcher = document.createElement('button');
    launcher.id = 'gcsc-launcher';
    launcher.setAttribute('aria-label', 'Open live chat');
    launcher.innerHTML = `
      <svg class="gcsc-chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
      <svg class="gcsc-close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      <span id="gcsc-badge"></span>
    `;

    wrap.appendChild(label);
    wrap.appendChild(launcher);

    // ── Panel
    const panel = document.createElement('div');
    panel.id = 'gcsc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'GCSC Live Chat');
    panel.innerHTML = `
      <!-- Offline Banner -->
      <div id="gcsc-offline-banner">⚠️ You're offline. Messages will send when you reconnect.</div>

      <!-- Header -->
      <div id="gcsc-header">
        <div class="gcsc-header-top">
          <img class="gcsc-logo-img" src="${_logoSrc}" alt="GlobalCargo Shipping" onerror="this.style.display='none'">
          <div class="gcsc-status-row">
            <div class="gcsc-status-dot" id="gcsc-status-dot"></div>
            <span class="gcsc-status-text" id="gcsc-status-text">Online · We reply in minutes</span>
          </div>
        </div>
        <div class="gcsc-header-body">
          <div class="gcsc-avatar-wrap">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
          </div>
          <div class="gcsc-agent-info">
            <div class="gcsc-agent-name" id="gcsc-agent-name">GlobalCargo Support</div>
            <div class="gcsc-header-subtitle">We're here to help — 24/7 shipping assistance</div>
          </div>
        </div>
      </div>
      <div class="gcsc-accent-bar"></div>

      <!-- Pre-chat form (shown until session starts) -->
      <div id="gcsc-prechat">
        <p class="gcsc-prechat-intro">👋 Hey! Tell us your name and we'll connect you with our shipping team right away.</p>
        <div class="gcsc-field">
          <label for="gcsc-name-input">Your Name</label>
          <input id="gcsc-name-input" type="text" placeholder="e.g. John Smith" autocomplete="name" maxlength="80">
        </div>
        <div class="gcsc-field">
          <label for="gcsc-email-input">Email address <span style="font-weight:400;opacity:.6">(optional)</span></label>
          <input id="gcsc-email-input" type="email" placeholder="e.g. john@company.com" autocomplete="email" maxlength="120">
        </div>
        <button class="gcsc-start-btn" id="gcsc-start-btn">Start Chat  →</button>
      </div>

      <!-- Messages list (hidden until session starts) -->
      <div id="gcsc-messages" style="display:none"></div>

      <!-- Typing indicator -->
      <div id="gcsc-typing">
        <div class="gcsc-dots"><span></span><span></span><span></span></div>
        <span id="gcsc-typing-text">Agent is typing…</span>
      </div>

      <!-- Image preview (shown when image is selected) -->
      <div id="gcsc-img-preview">
        <img id="gcsc-preview-img" src="" alt="preview">
        <span id="gcsc-preview-name">image.png</span>
        <button id="gcsc-img-cancel" aria-label="Remove image" title="Remove">✕</button>
      </div>

      <!-- Input bar -->
      <div id="gcsc-input-bar" style="display:none">
        <button id="gcsc-attach-btn" aria-label="Attach image" title="Send a photo">
          <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
        </button>
        <input id="gcsc-file-input" type="file" accept="image/*,image/heic">
        <textarea id="gcsc-input" rows="1" placeholder="Type a message…" maxlength="2000" aria-label="Message"></textarea>
        <button id="gcsc-send-btn" aria-label="Send message" disabled>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>

      <!-- Scroll nudge -->
      <div id="gcsc-scroll-nudge">↓ New messages</div>

      <!-- Chat closed bar -->
      <div id="gcsc-closed-bar">
        <div>This conversation has been closed.</div>
        <button id="gcsc-new-chat-btn">Start a new chat</button>
      </div>
    `;

    document.body.appendChild(wrap);    // wrap contains label + launcher
    document.body.appendChild(panel);
  }

  // ── Socket Connection ─────────────────────────────────────────────────────
  // Handles all 4 socket states correctly:
  //   1. No socket yet         → create it, register callback
  //   2. Connected             → fire callback immediately
  //   3. Connecting (in-flight)→ register callback on existing socket (no duplicate)
  //   4. Disconnected          → reconnect existing socket, register callback
  function connectSocket(onConnectedCb) {
    // State 2: already connected — fire immediately
    if (socket && socket.connected) {
      if (onConnectedCb) onConnectedCb();
      return;
    }

    // State 3: socket exists but still connecting — just attach callback, don't recreate
    if (socket && !socket.connected) {
      if (onConnectedCb) socket.once('connect', onConnectedCb);
      if (socket.disconnected) socket.connect(); // State 4: explicitly reconnect
      return;
    }

    // State 1: no socket at all — load io then create
    if (typeof io !== 'undefined') {
      initSocket(onConnectedCb);
    } else {
      const script   = document.createElement('script');
      script.src     = `${SOCKET_URL}/socket.io/socket.io.js`;
      script.onload  = () => initSocket(onConnectedCb);
      script.onerror = () => {
        console.error('[GCSC Chat] Failed to load socket.io client.');
        // Reset button so user can try again
        const btn = document.getElementById('gcsc-start-btn');
        if (btn) { btn.disabled = false; btn.textContent = 'Start Chat  →'; }
      };
      document.head.appendChild(script);
    }
  }

  function initSocket(onConnectedCb) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    // Register one-time connect callback AFTER socket is created (fixes null race)
    if (onConnectedCb) socket.once('connect', onConnectedCb);

    socket.on('connect', () => {
      console.log('[GCSC Chat] Socket connected:', socket.id);
      updateOnlineStatus(true);
      if (sessionId) joinSession(); // Reconnect to existing session
    });

    socket.on('disconnect', () => {
      console.log('[GCSC Chat] Socket disconnected');
      updateOnlineStatus(false);
    });

    socket.on('connect_error', () => updateOnlineStatus(false));

    // ── Session join confirmation ────────────────────────────────────────
    socket.on('customer_join_chat', (data) => {
      if (!data.success) {
        console.error('[GCSC Chat] Join failed:', data.error);
        return;
      }
      sessionId     = data.sessionId;
      customerName  = data.customer?.name || customerName;
      localStorage.setItem(LS_SESSION, sessionId);

      showChatView();

      // Render history
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(renderMessage);
        scrollToBottom(true);
      } else {
        appendSystemMsg('Chat started. Our team will respond shortly.');
      }

      if (data.status === 'closed') showClosedBar();
    });

    // ── New message ──────────────────────────────────────────────────────
    socket.on('receive_message', (data) => {
      if (data.sessionId !== sessionId) return;
      renderMessage(data.message);

      if (data.message.senderRole === 'admin') {
        if (!isOpen) {
          unreadCount++;
          updateBadge();
        }
        if (scrollLocked) showScrollNudge();
        else scrollToBottom();
      } else {
        scrollToBottom();
      }
    });

    // ── Typing indicator ─────────────────────────────────────────────────
    socket.on('typing_indicator', (data) => {
      if (data.sessionId !== sessionId) return;
      if (data.senderRole === 'admin') {
        const el = document.getElementById('gcsc-typing');
        const tx = document.getElementById('gcsc-typing-text');
        if (data.isTyping) {
          // Always show customer-friendly name — never expose real admin account name
          tx.textContent = 'Support Agent is typing…';
          el.classList.add('visible');
          scrollToBottom();
        } else {
          el.classList.remove('visible');
        }
      }
    });

    // ── Chat status updates ──────────────────────────────────────────────
    socket.on('chat_status_update', (data) => {
      if (data.sessionId !== sessionId) return;

      if (data.type === 'assigned' && data.assignedAdmin) {
        // Always show "Support Agent" — never expose the admin's real account name
        agentName     = 'Support Agent';
        agentAssigned = true;
        document.getElementById('gcsc-agent-name').textContent = 'Support Agent';
        appendSystemMsg('A support agent has joined the conversation. We\'re ready to help!');
      }

      if (data.type === 'closed' || data.status === 'closed') {
        if (data.message) appendSystemMsg(data.message);
        showClosedBar();
        disableInput();
      }
    });

    // ── Read receipts ────────────────────────────────────────────────────
    socket.on('message_read', (data) => {
      if (data.sessionId !== sessionId || data.readBy !== 'admin') return;
      // Mark all customer bubbles as read (double tick)
      document.querySelectorAll('.gcsc-tick').forEach(el => {
        el.textContent = '✓✓';
        el.classList.add('read');
      });
    });
  }

  // ── Join Session ──────────────────────────────────────────────────────────
  function joinSession() {
    if (!socket || !socket.connected) return;
    socket.emit('customer_join_chat', {
      sessionId:    sessionId,
      name:         customerName,
      email:        customerEmail,
    });
  }

  // ── Render a message bubble ───────────────────────────────────────────────
  function renderMessage(msg) {
    const messages = document.getElementById('gcsc-messages');
    const isMe     = (msg.senderRole || msg.sender) === 'customer';
    const text     = msg.message || msg.text || '';
    const ts       = formatTime(msg.timestamp || msg.createdAt);
    const tick     = isMe ? `<span class="gcsc-tick">✓</span>` : '';
    // Never show real admin account name — always "Support Agent"
    const rawName  = isMe ? (msg.senderName || customerName) : 'Support Agent';
    const nameStr  = escapeHTML(rawName);

    const group = document.createElement('div');
    group.className = `gcsc-msg-group ${isMe ? 'customer' : 'admin'}`;

    let bubbleContent = '';
    if (msg.type === 'image' && msg.imageData) {
      // Image message
      bubbleContent = `<img class="gcsc-img-bubble" src="${msg.imageData}"
        alt="${escapeHTML(msg.fileName || 'image')}"
        onclick="window.open(this.src,'_blank')"
        loading="lazy">`;
    } else {
      bubbleContent = escapeHTML(text);
    }

    group.innerHTML = `
      <div class="gcsc-msg-meta">
        <span class="gcsc-sender-name">${nameStr}</span>
        <span class="gcsc-role-tag">${isMe ? '' : 'Agent'}</span>
      </div>
      <div class="gcsc-bubble">
        ${bubbleContent}
        <span class="gcsc-timestamp">${ts}${tick}</span>
      </div>
    `;
    messages.appendChild(group);
  }

  // ── System message ────────────────────────────────────────────────────────
  function appendSystemMsg(text) {
    const messages = document.getElementById('gcsc-messages');
    const div = document.createElement('div');
    div.className   = 'gcsc-system-msg';
    div.textContent = text;
    messages.appendChild(div);
    scrollToBottom();
  }

  // ── Show chat view (hide form, show messages) ─────────────────────────────
  function showChatView() {
    document.getElementById('gcsc-prechat').style.display   = 'none';
    document.getElementById('gcsc-messages').style.display  = 'flex';
    document.getElementById('gcsc-input-bar').style.display = 'flex';
    // Delay focus past the panel open-animation (0.32s) so browser
    // doesn't silently ignore the focus() call while CSS is transitioning
    setTimeout(() => {
      const inp = document.getElementById('gcsc-input');
      const send = document.getElementById('gcsc-send-btn');
      if (inp) { inp.disabled = false; inp.focus(); }
      if (send) send.disabled = false;
    }, 380);
  }

  // ── Show closed bar ───────────────────────────────────────────────────────
  function showClosedBar() {
    document.getElementById('gcsc-closed-bar').classList.add('visible');
    document.getElementById('gcsc-input-bar').style.display = 'none';
    document.getElementById('gcsc-typing').classList.remove('visible');
  }

  // ── Disable input ─────────────────────────────────────────────────────────
  function disableInput() {
    const input = document.getElementById('gcsc-input');
    const send  = document.getElementById('gcsc-send-btn');
    if (input) input.disabled = true;
    if (send)  send.disabled  = true;
  }

  // ── Send a message (text or image) ───────────────────────────────────────
  function sendMessage() {
    const input = document.getElementById('gcsc-input');
    const text  = (input.value || '').trim();

    // Send pending image first if there is one
    if (pendingImage) {
      if (!sessionId || !socket || !socket.connected) return;
      const imgMsg = {
        sessionId,
        message:   pendingImage.fileName || 'image',
        type:      'image',
        imageData: pendingImage.dataUrl,
        fileName:  pendingImage.fileName,
      };
      socket.emit('customer_send_message', imgMsg);
      clearImagePreview();
      // Also send text if typed
      if (text) {
        socket.emit('customer_send_message', { sessionId, message: text });
        input.value = '';
        autoResizeTextarea(input);
      }
      stopTyping();
      return;
    }

    if (!text || !sessionId || !socket || !socket.connected) return;
    socket.emit('customer_send_message', { sessionId, message: text });
    input.value = '';
    autoResizeTextarea(input);
    stopTyping();
  }

  // ── Image preview helpers ──────────────────────────────────────────────────
  function clearImagePreview() {
    pendingImage = null;
    const preview = document.getElementById('gcsc-img-preview');
    const fileIn  = document.getElementById('gcsc-file-input');
    if (preview) preview.classList.remove('visible');
    if (fileIn)  fileIn.value = '';
  }

  // ── Typing indicators ─────────────────────────────────────────────────────
  function onTyping() {
    if (!sessionId || !socket) return;
    if (!isTypingActive) {
      isTypingActive = true;
      socket.emit('customer_typing', { sessionId, isTyping: true });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 2000);
  }

  function stopTyping() {
    if (!isTypingActive) return;
    isTypingActive = false;
    clearTimeout(typingTimer);
    if (socket && sessionId) {
      socket.emit('customer_typing', { sessionId, isTyping: false });
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    const panel    = document.getElementById('gcsc-panel');
    const launcher = document.getElementById('gcsc-launcher');
    const wrap     = document.getElementById('gcsc-launcher-wrap');
    panel.classList.toggle('open', isOpen);
    launcher.classList.toggle('open', isOpen);
    if (wrap) wrap.classList.toggle('open', isOpen); // stops bounce + hides label
    launcher.setAttribute('aria-label', isOpen ? 'Close live chat' : 'Open live chat');

    if (isOpen) {
      unreadCount = 0;
      updateBadge();
      scrollToBottom(true);
      const input = document.getElementById('gcsc-input');
      if (input && input.style.display !== 'none') {
        setTimeout(() => input.focus(), 300);
      }
    }
  }

  function updateBadge() {
    const badge = document.getElementById('gcsc-badge');
    if (unreadCount > 0 && !isOpen) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  function updateOnlineStatus(online) {
    isOnline = online;
    const dot  = document.getElementById('gcsc-status-dot');
    const text = document.getElementById('gcsc-status-text');
    const banner = document.getElementById('gcsc-offline-banner');
    if (dot)  dot.classList.toggle('offline', !online);
    if (text) text.textContent = online ? 'Online · Typically replies in minutes' : 'Reconnecting…';
    if (banner) banner.classList.toggle('visible', !online);
  }

  function scrollToBottom(instant = false) {
    const el = document.getElementById('gcsc-messages');
    if (!el) return;
    if (instant) {
      el.scrollTop = el.scrollHeight;
    } else {
      setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
    }
    hideScrollNudge();
    scrollLocked = false;
  }

  function showScrollNudge() {
    document.getElementById('gcsc-scroll-nudge').classList.add('visible');
  }
  function hideScrollNudge() {
    document.getElementById('gcsc-scroll-nudge').classList.remove('visible');
  }

  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d    = new Date(ts);
    const now  = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1)  return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24)    return `${h}h ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Global API (lets inline onclick="openChatWidget()" work) ────────────
  window.openChatWidget   = function () { if (!isOpen) togglePanel(); };
  window.closeChatWidget  = function () { if (isOpen)  togglePanel(); };
  window.toggleChatWindow = togglePanel; // legacy alias

  // ── Event Wiring ─────────────────────────────────────────────────────────
  function bindEvents() {
    const launcher    = document.getElementById('gcsc-launcher');
    const startBtn    = document.getElementById('gcsc-start-btn');
    const input       = document.getElementById('gcsc-input');
    const sendBtn     = document.getElementById('gcsc-send-btn');
    const scrollNudge = document.getElementById('gcsc-scroll-nudge');
    const newChatBtn  = document.getElementById('gcsc-new-chat-btn');
    const messages    = document.getElementById('gcsc-messages');

    launcher.addEventListener('click', togglePanel);

    startBtn.addEventListener('click', () => {
      const nameInput  = document.getElementById('gcsc-name-input');
      const emailInput = document.getElementById('gcsc-email-input');
      const name  = nameInput.value.trim()  || 'Guest';
      const email = emailInput.value.trim() || '';

      startBtn.disabled    = true;
      startBtn.textContent = 'Connecting…';
      // Clear any previous connection error
      const errEl = document.getElementById('gcsc-conn-error');
      if (errEl) errEl.textContent = '';

      customerName  = name;
      customerEmail = email;
      localStorage.setItem(LS_NAME,  name);
      localStorage.setItem(LS_EMAIL, email);

      // Pass join as callback — fires after socket connects (no race condition)
      let joinTimeout = setTimeout(() => {
        // If showChatView hasn't been called yet — still on the form — unblock UI
        const prechat = document.getElementById('gcsc-prechat');
        if (prechat && prechat.style.display !== 'none') {
          const sb = document.getElementById('gcsc-start-btn');
          if (sb) { sb.disabled = false; sb.textContent = 'Start Chat  →'; }
          // Show error in prechat form area
          let errEl = document.getElementById('gcsc-conn-error');
          if (!errEl) {
            errEl = document.createElement('p');
            errEl.id = 'gcsc-conn-error';
            errEl.style.cssText = 'color:#dc2626;font-size:12px;text-align:center;margin:0';
            prechat.appendChild(errEl);
          }
          errEl.textContent = '⚠ Could not connect. Check your internet and try again.';
        }
      }, 8000);

      connectSocket(() => {
        clearTimeout(joinTimeout);
        socket.emit('customer_join_chat', { sessionId: null, name, email });
      });
    });

    input.addEventListener('input', () => {
      autoResizeTextarea(input);
      onTyping();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    scrollNudge.addEventListener('click', () => scrollToBottom());

    if (messages) {
      messages.addEventListener('scroll', () => {
        const threshold = 80;
        const atBottom  = messages.scrollHeight - messages.scrollTop - messages.clientHeight < threshold;
        scrollLocked    = !atBottom;
        if (atBottom) hideScrollNudge();
      });
    }

    newChatBtn.addEventListener('click', () => {
      // Clear session and restart
      localStorage.removeItem(LS_SESSION);
      sessionId = null;
      document.getElementById('gcsc-messages').innerHTML = '';
      document.getElementById('gcsc-messages').style.display = 'none';
      document.getElementById('gcsc-input-bar').style.display = 'none';
      document.getElementById('gcsc-closed-bar').classList.remove('visible');
      document.getElementById('gcsc-prechat').style.display = 'flex';
      const nameInput  = document.getElementById('gcsc-name-input');
      const startBtn   = document.getElementById('gcsc-start-btn');
      nameInput.value  = '';
      document.getElementById('gcsc-email-input').value = '';
      startBtn.disabled    = false;
      startBtn.textContent = 'Start Chat  →';
    });

    // ── Attach / image upload ────────────────────────────────────────────
    const attachBtn = document.getElementById('gcsc-attach-btn');
    const fileInput = document.getElementById('gcsc-file-input');
    const imgCancel = document.getElementById('gcsc-img-cancel');

    if (attachBtn) attachBtn.addEventListener('click', () => fileInput && fileInput.click());

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        // Validate: images only, max 5 MB
        if (!file.type.startsWith('image/')) {
          appendSystemMsg('Only image files can be sent.');
          fileInput.value = '';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          appendSystemMsg('Image is too large (max 5 MB). Please compress and try again.');
          fileInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          pendingImage = { dataUrl: e.target.result, fileName: file.name };

          // Show preview
          const preview   = document.getElementById('gcsc-img-preview');
          const prevImg   = document.getElementById('gcsc-preview-img');
          const prevName  = document.getElementById('gcsc-preview-name');
          if (prevImg)  prevImg.src         = e.target.result;
          if (prevName) prevName.textContent = file.name;
          if (preview)  preview.classList.add('visible');

          // Focus the text input so user can optionally add a caption
          const inp = document.getElementById('gcsc-input');
          if (inp) { inp.placeholder = 'Add a caption (optional)…'; inp.focus(); }
        };
        reader.readAsDataURL(file);
      });
    }

    if (imgCancel) {
      imgCancel.addEventListener('click', () => {
        clearImagePreview();
        const inp = document.getElementById('gcsc-input');
        if (inp) inp.placeholder = 'Type a message…';
      });
    }

    // Online/Offline detection
    window.addEventListener('online',  () => { updateOnlineStatus(true);  if (socket) socket.connect(); });
    window.addEventListener('offline', () => updateOnlineStatus(false));
  }

  // ── Pre-fill if returning user ────────────────────────────────────────────
  function prefillForm() {
    const nameInput  = document.getElementById('gcsc-name-input');
    const emailInput = document.getElementById('gcsc-email-input');
    if (customerName)  nameInput.value  = customerName;
    if (customerEmail) emailInput.value = customerEmail;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildDOM();
    bindEvents();
    prefillForm();

    // If returning user, connect and immediately rejoin their session
    if (sessionId) {
      connectSocket(); // joinSession() is called in socket.on('connect') handler
    }
  }

  // ── Bootstrap when DOM is ready ───────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
