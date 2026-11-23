/* ============ 1. SUPABASE CLIENT ============ */
const publicConfig = window.BOOKIVO_SUPABASE_CONFIG || {};
const SUPABASE_URL = publicConfig.url || "";
const SUPABASE_PUBLISHABLE_KEY = publicConfig.publishableKey || "";
const mainPage = new URL('../index.html',location.href);
const preferredPage = new URL(sessionStorage.getItem('bv_after_signin') || mainPage.href, mainPage);
const allowedReturn = ['read.html','my-books.html','cart.html','Free calculater/index.html','thankyou.html','account.html','index.html'];
for(let index=1;index<=12;index++) allowedReturn.push('BOOK-'+index+'/index.html');
const REDIRECT_AFTER_LOGIN = preferredPage.origin===mainPage.origin &&
  allowedReturn.some(name=>preferredPage.pathname===new URL(name,mainPage).pathname) ? preferredPage.href : mainPage.href;

const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && window.supabase);
const supabaseClient = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;



/* ============ 2. UI: slide login panel up / down ============ */
const card = document.getElementById("card");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const toLogin = document.getElementById("toLogin");
const toSignup = document.getElementById("toSignup");
const msgLogin = document.getElementById("msgLogin");
const msgSignup = document.getElementById("msgSignup");

function setMsg(el, text, type) {
  el.textContent = text;
  el.className = "msg" + (type ? " " + type : "");
}
function setOpen(open) {
  card.classList.toggle("open", open);
  toLogin.setAttribute("aria-expanded", String(open));
  if (open) { loginForm.removeAttribute("inert"); signupForm.setAttribute("inert", ""); }
  else { loginForm.setAttribute("inert", ""); signupForm.removeAttribute("inert"); }
  setMsg(msgLogin, ""); setMsg(msgSignup, "");
}
toLogin.addEventListener("click", () => { if (!card.classList.contains("open")) setOpen(true); });
toSignup.addEventListener("click", () => { if (card.classList.contains("open")) setOpen(false); });

/* ============ 3. TOAST (bottom centre) ============ */
const toastEl = document.getElementById("toast");
let toastTimer;
function toast(text, type, ms) {
  clearTimeout(toastTimer);
  toastEl.textContent = text;
  toastEl.className = "toast " + (type || "ok");
  void toastEl.offsetWidth;                       // restart the transition
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}
function ensureConfigured() {
  if (configured) return true;
  toast("BOOKIVO could not connect to Supabase. Please refresh and try again.", "err", 3500);
  return false;
}
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ============ 4. EMAIL + OTP (Supabase) ============ */
/* mode "signup": creates the user if new.  mode "login": only existing users. */
function setupOtp(form, mode, msgEl) {
  const signupAttempt = crypto.randomUUID();
  const email = form.email, otp = form.otp, vbtn = form.querySelector(".verify");
  let sentTo = null, verifiedEmail = null, timer = null;

  function resetVerifyBtn() {
    clearInterval(timer);
    vbtn.disabled = false; vbtn.textContent = "Verify"; vbtn.className = "verify";
  }
  function startCooldown(sec) {
    let n = sec;
    vbtn.disabled = true; vbtn.className = "verify wait"; vbtn.textContent = n + "s";
    timer = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(timer); vbtn.disabled = false; vbtn.className = "verify"; vbtn.textContent = "Resend"; }
      else vbtn.textContent = n + "s";
    }, 1000);
  }

  // Click "Verify": send the OTP to the email
  vbtn.addEventListener("click", async () => {
    const e = email.value.trim();
    if (!e) return toast("Please enter your email", "err");
    if (!validEmail(e)) return toast("Please enter a valid email", "err");
    if (!ensureConfigured()) return;

    vbtn.disabled = true; vbtn.textContent = "…";
    const options = { shouldCreateUser: mode === "signup" };
    if (mode === "signup") options.data = { username: form.username.value.trim(), signup_attempt: signupAttempt };
    let result;
    try {
      if(mode==='signup'){const {data,error}=await supabaseClient.functions.invoke('bookivo-store',{body:{action:'account-exists',email:e}});if(error)throw new Error('Could not check your email. Please retry.');if(data.exists){resetVerifyBtn();loginForm.email.value=e;setOpen(true);return toast('You already have an account. Please log in.','err');}}
      result = await supabaseClient.auth.signInWithOtp({ email: e, options });
    } catch (error) {
      resetVerifyBtn();
      return toast(error.message || "Could not send the code. Please try again.", "err", 3000);
    }
    const { error } = result;
    if (error) { resetVerifyBtn(); return toast(error.message, "err", 3000); }

    sentTo = e;
    toast("OTP sent successfully", "ok");
    startCooldown(30);
    otp.value = ""; otp.focus();
  });

  // Typing the 6 digits verifies automatically
  otp.addEventListener("input", async () => {
    otp.value = otp.value.replace(/\D/g, "").slice(0, 6);
    if (otp.value.length < 6) return;
    if (verifiedEmail) return;
    if (!sentTo || sentTo !== email.value.trim()) {
      otp.value = "";
      return toast("Click Verify to get an OTP first", "err");
    }
    if (!ensureConfigured()) return;

    otp.disabled = true;
    let result;
    try {
      result = await supabaseClient.auth.verifyOtp({ email: sentTo, token: otp.value, type: "email" });
    } catch (error) {
      otp.disabled = false;
      otp.value = "";
      otp.focus();
      return toast(error.message || "Could not verify the code. Please try again.", "err", 3000);
    }
    const { error } = result;
    otp.disabled = false;
    if (error) {
      otp.value = ""; otp.focus();
      return toast("YOU ENTERED WRONG OTP.. TRY AGAIN", "err");
    }
    if (mode === 'signup' && result.data.user.user_metadata?.signup_attempt !== signupAttempt) {
      await supabaseClient.auth.signOut({scope:'local'});
      resetVerifyBtn(); otp.value = ''; sentTo = null;
      return toast('You already have an account. Please log in.', 'err');
    }
    verifiedEmail = sentTo;
    clearInterval(timer);
    vbtn.disabled = true; vbtn.className = "verify done"; vbtn.textContent = "✓";
    otp.readOnly = true;
    setMsg(msgEl, "");
    toast("Verified", "ok", 1500);
  });

  // Changing the email after verifying cancels the verification
  email.addEventListener("input", () => {
    if (verifiedEmail && email.value.trim() !== verifiedEmail) {
      verifiedEmail = null; sentTo = null; otp.readOnly = false; otp.value = "";
      resetVerifyBtn();
      if (supabaseClient) supabaseClient.auth.signOut();
    }
  });

  return { isVerified: () => !!verifiedEmail };
}

const signupOtp = setupOtp(signupForm, "signup", msgSignup);
const loginOtp = setupOtp(loginForm, "login", msgLogin);

/* ============ 5. SUBMIT BUTTONS ============ */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = signupForm.username.value.trim();
  const email = signupForm.email.value.trim();
  if (!username) return toast("Please enter your name", "err");
  if (!email) return toast("Please enter your email", "err");
  if (!signupOtp.isVerified()) return toast("Please verify your email", "err");

  const submit = signupForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const { error } = await supabaseClient.auth.updateUser({ data: { username } });
    if (error) throw error;

  } catch (error) {
    submit.disabled = false;
    return toast(error.message || "Could not save your profile. Please try again.", "err", 3000);
  }
  toast("Account created!", "ok", 1500);
  setTimeout(() => (window.location.href = REDIRECT_AFTER_LOGIN), 3000);
});

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!loginForm.email.value.trim()) return toast("Please enter your email", "err");
  if (!loginOtp.isVerified()) return toast("Please verify your email", "err");
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  toast("Logged in!", "ok", 1500);
  setTimeout(() => (window.location.href = REDIRECT_AFTER_LOGIN), 3000);
});

document.querySelectorAll("[data-google]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (!ensureConfigured()) return;
    btn.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: REDIRECT_AFTER_LOGIN },
      });
      if (error) toast(error.message, "err", 3000);
    } catch (error) {
      toast(error.message || "Google sign-in could not start. Please try again.", "err", 3000);
    } finally {
      btn.disabled = false;
    }
  });
});

if (configured) {
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = REDIRECT_AFTER_LOGIN;
  });
}

/* ============ 6. Mirror-cut (faceted glass) overlay on the blue gradient ============ */
(function () {
  const cv = document.getElementById("bg"), ctx = cv.getContext("2d");
  const rng = (s) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  function draw() {
    const w = card.clientWidth, h = card.clientHeight, d = window.devicePixelRatio || 1;
    cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const r = rng(7), cols = 4, rows = 7, cw = w / cols, ch = h / rows;
    const P = [];
    for (let y = 0; y <= rows; y++) {
      P[y] = [];
      for (let x = 0; x <= cols; x++) {
        const edgeX = x === 0 || x === cols, edgeY = y === 0 || y === rows;
        P[y][x] = [
          x * cw + (edgeX ? 0 : (r() - .5) * cw * .8),
          y * ch + (edgeY ? 0 : (r() - .5) * ch * .8),
        ];
      }
    }
    function tri(a, b, c) {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      const light = r();
      ctx.fillStyle = light > .5
        ? "rgba(255,255,255," + (light - .5) * .22 + ")"
        : "rgba(8,20,90," + (.5 - light) * .22 + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = .8; ctx.stroke();
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const a = P[y][x], b = P[y][x + 1], c = P[y + 1][x], e = P[y + 1][x + 1];
      if (r() > .5) { tri(a, b, c); tri(b, e, c); } else { tri(a, b, e); tri(a, e, c); }
    }
  }
  draw();
  window.addEventListener("resize", draw);
})();
