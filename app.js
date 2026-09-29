<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>ReelHu - Login</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
body {
min-height: 100vh;
display: flex; align-items: center; justify-content: center;
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
padding: 20px;
}
.container {
background: #fff;
padding: 40px 30px;
border-radius: 16px;
box-shadow: 0 20px 60px rgba(0,0,0,0.3);
width: 100%; max-width: 400px;
}
h1 { text-align: center; color: #764ba2; margin-bottom: 8px; font-size: 28px; }
.subtitle { text-align: center; color: #888; margin-bottom: 25px; font-size: 14px; }

input {
width: 100%;
padding: 14px;
margin-bottom: 14px;
border: 2px solid #e0e0e0;
border-radius: 10px;
font-size: 15px;
outline: none;
transition: 0.3s;
}
input:focus { border-color: #764ba2; }

button {
width: 100%;
padding: 14px;
background: linear-gradient(135deg, #667eea, #764ba2);
color: #fff;
border: none;
border-radius: 10px;
font-size: 16px;
font-weight: 600;
cursor: pointer;
transition: 0.3s;
}
button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(118,75,162,0.4); }
button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.toggle {
text-align: center; margin-top: 18px; font-size: 14px; color: #666;
}
.toggle span {
color: #764ba2; font-weight: 600; cursor: pointer; text-decoration: underline;
}

.message {
padding: 12px; border-radius: 8px; margin-bottom: 15px;
font-size: 14px; text-align: center; display: none;
}
.error { background: #ffe0e0; color: #c00; display: block; }
.success { background: #e0ffe0; color: #080; display: block; }

.hidden { display: none; }

/* Dashboard */
.dashboard { text-align: center; }
.dashboard h2 { color: #333; margin-bottom: 10px; }
.dashboard p { color: #666; margin-bottom: 20px; word-break: break-all; }
.avatar {
width: 70px; height: 70px; border-radius: 50%;
background: linear-gradient(135deg, #667eea, #764ba2);
color: #fff; display: flex; align-items: center; justify-content: center;
font-size: 28px; font-weight: 700; margin: 0 auto 15px;
}
</style>
</head>
<body>
<div class="container">
<!-- LOGIN / SIGNUP FORM -->
<div id="authBox">
<h1>🎬 ReelHu</h1>
<p class="subtitle" id="formTitle">Login to your account</p>

<div id="message" class="message"></div>

<input type="text" id="name" placeholder="Full Name" class="hidden"/>
<input type="email" id="email" placeholder="Email address" autocomplete="email"/>
<input type="password" id="password" placeholder="Password" autocomplete="current-password"/>

<button id="submitBtn">Login</button>

<p class="toggle">
<span id="toggleText">Don't have an account? Sign Up</span>
</p>
</div>

<!-- DASHBOARD (After Login) -->
<div id="dashboard" class="dashboard hidden">
<div class="avatar" id="avatar">U</div>
<h2 id="welcome">Welcome!</h2>
<p id="userEmail"></p>
<button id="logoutBtn">Logout</button>
</div>
</div>

<!-- Firebase SDK (compat version - easy to use) -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>

<script>
// 🔥 Your Firebase Config
const firebaseConfig = {
apiKey: "AIzaSyCAiAXZjIFcbmueefZpx1SXc-_ELa57-rE",
authDomain: "reelhu.firebaseapp.com",
projectId: "reelhu",
storageBucket: "reelhu.firebasestorage.app",
messagingSenderId: "883255506643",
appId: "1:883255506643:web:600256ed9bb47a4f828626",
measurementId: "G-FY9N5XNF6Z"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Elements
const authBox = document.getElementById('authBox');
const dashboard = document.getElementById('dashboard');
const formTitle = document.getElementById('formTitle');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const toggleText = document.getElementById('toggleText');
const msgBox = document.getElementById('message');
const logoutBtn = document.getElementById('logoutBtn');
const welcome = document.getElementById('welcome');
const userEmailEl = document.getElementById('userEmail');
const avatarEl = document.getElementById('avatar');

let isLoginMode = true;

// Toggle between Login / Signup
toggleText.addEventListener('click', () => {
isLoginMode = !isLoginMode;
clearMessage();
if (isLoginMode) {
formTitle.textContent = "Login to your account";
submitBtn.textContent = "Login";
nameInput.classList.add('hidden');
toggleText.textContent = "Don't have an account? Sign Up";
} else {
formTitle.textContent = "Create your account";
submitBtn.textContent = "Sign Up";
nameInput.classList.remove('hidden');
toggleText.textContent = "Already have an account? Login";
}
});

// Show message
function showMessage(text, type) {
msgBox.textContent = text;
msgBox.className = 'message ' + type;
}
function clearMessage() {
msgBox.textContent = '';
msgBox.className = 'message';
}

// Submit form
submitBtn.addEventListener('click', async () => {
const name = nameInput.value.trim();
const email = emailInput.value.trim();
const password = passInput.value;

if (!email || !password) return showMessage("Email aur password required hai", "error");
if (!isLoginMode && !name) return showMessage("Naam daalo", "error");
if (password.length < 6) return showMessage("Password kam se kam 6 characters ka ho", "error");

submitBtn.disabled = true;
submitBtn.textContent = "Please wait...";
clearMessage();

try {
if (isLoginMode) {
// 🔑 LOGIN
await auth.signInWithEmailAndPassword(email, password);
showMessage("Login successful!", "success");
} else {
// 🆕 SIGNUP
const cred = await auth.createUserWithEmailAndPassword(email, password);
await cred.user.updateProfile({ displayName: name });
showMessage("Account created successfully!", "success");
}
} catch (err) {
showMessage(friendlyError(err.code), "error");
submitBtn.disabled = false;
submitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
}
});

// Logout
logoutBtn.addEventListener('click', () => auth.signOut());

// Auth state observer
auth.onAuthStateChanged(user => {
if (user) {
authBox.classList.add('hidden');
dashboard.classList.remove('hidden');

const displayName = user.displayName || user.email.split('@')[0];
welcome.textContent = Welcome, ${displayName}!;
userEmailEl.textContent = user.email;
avatarEl.textContent = displayName.charAt(0).toUpperCase();
} else {
dashboard.classList.add('hidden');
authBox.classList.remove('hidden');
submitBtn.disabled = false;
submitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
emailInput.value = '';
passInput.value = '';
nameInput.value = '';
clearMessage();
}
});

// Human-readable errors
function friendlyError(code) {
const errors = {
'auth/email-already-in-use': 'Ye email already registered hai',
'auth/invalid-email': 'Email galat hai',
'auth/weak-password': 'Password bahut kamzor hai',
'auth/user-not-found': 'User nahi mila',
'auth/wrong-password': 'Password galat hai',
'auth/invalid-credential': 'Email ya password galat hai',
'auth/too-many-requests': 'Bahut attempts ho gaye, thodi der baad try karo',
'auth/network-request-failed': 'Internet connection check karo'
};
return errors[code] || 'Kuch galat ho gaya, dobara try karo';
}
</script>
</body>
</html>





