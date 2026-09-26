/* ============================================================
   ReelHub - app.js PART 1/3
   Config + State + Helpers + Ad + Auth + Profile + Videos + Stories
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCAiAXZjIFcbmueefZpx1SXc-_ELa57-rE",
  authDomain: "reelhu.firebaseapp.com",
  projectId: "reelhu",
  storageBucket: "reelhu.firebasestorage.app",
  messagingSenderId: "883255506643",
  appId: "1:883255506643:web:600256ed9bb47a4f828626",
  measurementId: "G-FY9N5XNF6Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const CLOUDINARY_CLOUD_NAME = "s3eresx6";
const CLOUDINARY_UPLOAD_PRESET = "reelhub_upload";
const ADMIN_EMAILS = ["appcreator001.harshitkumar@gmail.com", "satender8510815609@gmail.com"];
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORY_DURATION_IMAGE = 5000;
const STORY_DURATION_VIDEO_MAX = 15000;
const VAULT_AUTO_LOCK_MS = 5 * 60 * 1000;
const VAULT_MAX_FILE_SIZE = 30 * 1024 * 1024;
const VAULT_MAX_FILES = 100;
const MESSAGE_COOLDOWN = 1500;
const GROUP_MAX_MEMBERS = 100;
const GROUP_MAX_PDF_SIZE = 50 * 1024 * 1024;
const GROUP_MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const GROUP_MAX_PHOTO_SIZE = 20 * 1024 * 1024;
const MONETIZATION_REQUIREMENTS = { followers: 10, watchTime: 3600, views: 50 };

/* STATE */
let currentUser = null;
let currentProfile = null;
let videosCache = [];
let myFollowsCache = new Set();
let mySavesCache = new Set();
let myChatsCache = [];
let myPlaylistsCache = [];
let myFollowRequestsCache = [];
let mySentRequestsCache = new Set();
let blockedUsersCache = new Set();
let watchHistoryCache = [];
let continueWatchingCache = [];
let videosUnsubscribe = null;
let notificationsUnsubscribe = null;
let commentsUnsubscribe = null;
let chatUnsubscribe = null;
let chatsListUnsubscribe = null;
let playlistsUnsubscribe = null;
let presenceUnsubscribe = null;
let followRequestsUnsubscribe = null;
let storiesUnsubscribe = null;
let vaultUnsubscribe = null;
let heartbeatInterval = null;
let blockedUsersUnsubscribe = null;
let watchHistoryUnsubscribe = null;
let onlineUsersCache = {};
let unreadChatsCache = {};
let chatLastReadCache = {};
let currentCommentVideoId = null;
let currentChatId = null;
let currentChatUser = null;
let shareVideoId = null;
let uploadVisibility = "public";
let uploadType = "long";
let uploadCategory = "all";
let currentProfileTab = "videos";
let currentPlaylistVideoId = null;
let selectedPlaylists = new Set();
let currentPlaylistView = null;
let deepLinkChecked = false;
let viewingProfileUid = null;
let uploadContentType = "video";
let pendingThumbnailFile = null;
let pendingVideoFilter = "none";
let pendingVideoSpeed = 1;
let pendingTextOverlay = "";
let pendingTextPosition = "top";
let videoMenuVideoId = null;
let reportTargetType = "video";
let reportTargetId = null;
let currentCategory = "all";
let storiesCache = [];
let groupedStories = [];
let currentStoryUserIndex = 0;
let currentStoryIndex = 0;
let storyProgressRAF = null;
let storyPaused = false;
let storyStartTime = 0;
let storyDuration = 5000;
let storyElapsed = 0;
let storyUploadFile = null;
let storyMediaType = null;
let currentStoryId = null;
let currentStoryData = null;
let pendingStorySong = null;
let pendingStorySticker = null;
let pendingStoryTrim = { start: 0, end: 0, applied: false };
let pendingVideoSong = null;
let pendingVideoSticker = null;
let pendingVideoTrim = { start: 0, end: 0, applied: false };
let pendingVideoRotation = 0;
let pendingVideoMuted = false;
let trimVideoElement = null;
let trimVideoDuration = 0;
let myGroupsCache = [];
let currentGroupId = null;
let currentGroupData = null;
let groupJoinRequestsCache = [];
let myGroupsUnsubscribe = null;
let groupRequestsUnsubscribe = null;
let groupChatUnsubscribe = null;
let songLibraryCache = [];
let songLibraryUnsubscribe = null;
let selectedSongForApply = null;
let songPickerContext = null;
let stickerPickerContext = null;
let selectedStickerColor = "#ffffff";
let selectedStickerEmoji = null;
let previewAudio = null;
let editingSongId = null;
let pendingSongFile = null;
let modalHistoryStack = [];
let vaultPinVerified = false;
let vaultUnlockTime = 0;
let vaultAutoLockEnabled = true;
let vaultFilesCache = [];
let vaultUploading = false;
let splashHidden = false;
let authResolved = false;
const presenceListenersMap = new Map();
const processingMessages = new Set();
let lastSentMessageTime = 0;
const processingLikes = new Set();
const processingViews = new Set();
const processingSaves = new Set();
let currentWatchSession = { videoId: null, startTime: null };

let adSettings = { masterDisabled: false, typeDisabled: { banner: false, popup: false, video: false }, userDisabled: {} };
let adSettingsUnsubscribe = null;
let userAdsUnsubscribe = null;

/* HELPERS */
const $ = id => document.getElementById(id);

function esc(v){
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function timeValue(v){
  if(!v) return 0;
  if(typeof v.toMillis === "function") return v.toMillis();
  return new Date(v).getTime() || 0;
}
function avatar(url, name){
  return url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name || "User") + "&background=7c3aed&color=fff";
}
function toast(msg){
  const el = $("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.classList.remove("show"), 2500);
}
function timeAgo(v){
  const t = timeValue(v);
  if(!t) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return "just now";
  const min = Math.floor(sec/60);
  if(min < 60) return min + "m";
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + "h";
  const day = Math.floor(hr/24);
  if(day < 7) return day + "d";
  const wk = Math.floor(day/7);
  if(wk < 4) return wk + "w";
  return new Date(t).toLocaleDateString();
}
function timeAgoShort(v){
  const t = timeValue(v);
  if(!t) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return "now";
  const min = Math.floor(sec/60);
  if(min < 60) return min + "m";
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + "h";
  return Math.floor(hr/24) + "d";
}
function timeAgoYouTube(v){
  const t = timeValue(v);
  if(!t) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return "just now";
  const min = Math.floor(sec/60);
  if(min < 60) return min + " minutes ago";
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + " hours ago";
  const day = Math.floor(hr/24);
  if(day < 7) return day + " days ago";
  const wk = Math.floor(day/7);
  if(wk < 4) return wk + " weeks ago";
  const mo = Math.floor(day/30);
  if(mo < 12) return mo + " months ago";
  return Math.floor(day/365) + " years ago";
}
function formatViews(num){
  num = Number(num || 0);
  if(num < 1000) return num + " views";
  if(num < 1000000) return (num/1000).toFixed(1).replace(".0","") + "K views";
  if(num < 1000000000) return (num/1000000).toFixed(1).replace(".0","") + "M views";
  return (num/1000000000).toFixed(1) + "B views";
}
function formatViewsShort(num){
  num = Number(num || 0);
  if(num < 1000) return String(num);
  if(num < 1000000) return (num/1000).toFixed(1).replace(".0","") + "K";
  if(num < 1000000000) return (num/1000000).toFixed(1).replace(".0","") + "M";
  return (num/1000000000).toFixed(1) + "B";
}
function formatDuration(seconds){
  if(!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if(h > 0) return h + ":" + String(m).padStart(2,"0") + ":" + String(sec).padStart(2,"0");
  return m + ":" + String(sec).padStart(2,"0");
}
function formatFileSize(bytes){
  if(!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}
function getFileIcon(fileName, fileType){
  const name = (fileName || "").toLowerCase();
  const type = (fileType || "").toLowerCase();
  if(type.includes("pdf") || name.endsWith(".pdf")) return { icon: "📄", cls: "pdf" };
  if(name.endsWith(".doc") || name.endsWith(".docx")) return { icon: "📝", cls: "doc" };
  if(name.endsWith(".zip") || name.endsWith(".rar")) return { icon: "🗜️", cls: "zip" };
  if(name.endsWith(".ppt") || name.endsWith(".pptx")) return { icon: "📊", cls: "doc" };
  if(name.endsWith(".xls") || name.endsWith(".xlsx")) return { icon: "📊", cls: "doc" };
  if(name.endsWith(".txt")) return { icon: "📃", cls: "other" };
  return { icon: "📎", cls: "other" };
}
function isAdminUser(){
  return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}
function isUserBlocked(uid){ return blockedUsersCache.has(uid); }

/* AD CONTROL */
function canShowAd(adType, userId){
  if(adSettings.masterDisabled === true) return false;
  if(userId && adSettings.userDisabled[userId] === true) return false;
  if(adType && adSettings.typeDisabled[adType] === true) return false;
  return true;
}
window.showMyAd = function(adType, targetUserId, adCallback){
  if(!canShowAd(adType, targetUserId || currentUser?.uid)){
    console.log("🚫 Ad blocked:", adType);
    return;
  }
  if(typeof adCallback === "function") adCallback();
};
function startAdSettingsListener(){
  if(adSettingsUnsubscribe){ adSettingsUnsubscribe(); adSettingsUnsubscribe = null; }
  if(userAdsUnsubscribe){ userAdsUnsubscribe(); userAdsUnsubscribe = null; }
  adSettingsUnsubscribe = onSnapshot(doc(db, "ad_settings", "global"),
    snap => {
      if(snap.exists()){
        const d = snap.data();
        adSettings.masterDisabled = d.masterDisabled === true;
        adSettings.typeDisabled = d.typeDisabled || { banner: false, popup: false, video: false };
      }
    }, error => console.error("Ad settings listener error:", error));
  userAdsUnsubscribe = onSnapshot(collection(db, "ad_settings", "global", "users"),
    snap => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data().disabled === true; });
      adSettings.userDisabled = map;
    }, error => console.error("User ads listener error:", error));
}

/* MODAL */
function showModal(id){
  const el = $(id);
  if(!el) return;
  if(el.classList.contains("show")) return;
  el.classList.add("show");
  try{ window.history.pushState({ modalId: id, reelhubModal: true }, "", window.location.href); modalHistoryStack.push(id); }catch(e){}
}
function hideModal(id){
  const el = $(id);
  if(!el) return;
  if(!el.classList.contains("show")) return;
  el.classList.remove("show");
  const idx = modalHistoryStack.indexOf(id);
  if(idx > -1) modalHistoryStack.splice(idx, 1);
  if(id === "videoPlayerModal"){
    const videoEl = $("videoPlayerVideo");
    if(videoEl){ videoEl.pause(); videoEl.src = ""; videoEl.style.transform = ""; videoEl.muted = false; }
    if(window.__videoAudio){ window.__videoAudio.pause(); window.__videoAudio = null; }
  }
}

/* SPLASH */
function hideSplash(){
  if(splashHidden) return;
  splashHidden = true;
  document.body.classList.add("app-ready");
  const splash = $("splashScreen");
  if(splash){ splash.classList.add("fade-out"); setTimeout(()=> splash.remove(), 500); }
}
function prepareInitialState(){
  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
  document.body.classList.remove("app-ready");
}

/* SUSPENSION */
function showSuspensionScreen(profile){
  const screen = $("suspensionScreen");
  if(!screen) return;
  const reason = profile.suspendReason || "Violation of Terms";
  const duration = profile.suspendDuration || "Temporary";
  const until = profile.suspendUntil ? new Date(timeValue(profile.suspendUntil)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : "Permanent";
  const date = profile.suspendedAt ? new Date(timeValue(profile.suspendedAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : "—";
  if($("suspensionReason")) $("suspensionReason").textContent = reason;
  if($("suspensionDuration")) $("suspensionDuration").textContent = duration;
  if($("suspensionUntil")) $("suspensionUntil").textContent = until;
  if($("suspensionDate")) $("suspensionDate").textContent = date;
  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
  hideSplash();
  screen.classList.remove("hidden");
}
async function checkSuspension(uid){
  if(!uid) return false;
  try{
    const snap = await getDocs(query(collection(db, "profiles"), where("uid", "==", uid)));
    if(snap.empty) return false;
    const profileData = snap.docs[0].data();
    if(!profileData.suspended) return false;
    if(profileData.suspendUntil){
      const untilTime = timeValue(profileData.suspendUntil);
      if(Date.now() > untilTime){
        await updateDoc(doc(db, "profiles", snap.docs[0].id), { suspended: false, suspendReason: "", suspendDuration: "", suspendUntil: null, autoUnsuspendedAt: serverTimestamp() });
        toast("✅ Suspension ended");
        return false;
      }
    }
    showSuspensionScreen(profileData);
    return true;
  }catch(e){ console.error("Suspension check error:", e); return false; }
}

$("suspensionLogoutBtn")?.addEventListener("click", async ()=>{
  if(!confirm("Logout?")) return;
  try{ await signOut(auth); window.location.reload(); }catch(e){}
});

/* WATCH TIME */
function startWatchTimer(videoId){
  if(!currentUser || !videoId) return;
  if(currentWatchSession.videoId === videoId && currentWatchSession.startTime) return;
  if(currentWatchSession.videoId && currentWatchSession.startTime) stopWatchTimer();
  currentWatchSession = { videoId, startTime: Date.now() };
}
async function stopWatchTimer(){
  if(!currentWatchSession.videoId || !currentWatchSession.startTime) return;
  if(!currentUser) return;
  const elapsed = Math.floor((Date.now() - currentWatchSession.startTime) / 1000);
  const videoId = currentWatchSession.videoId;
  currentWatchSession = { videoId: null, startTime: null };
  if(elapsed < 3) return;
  try{
    const videoRef = doc(db, "videos", videoId);
    const videoSnap = await getDoc(videoRef);
    if(!videoSnap.exists()) return;
    const ownerId = videoSnap.data().userId;
    if(ownerId === currentUser.uid) return;
    await updateDoc(videoRef, { watchTime: increment(elapsed) });
    await updateDoc(doc(db, "profiles", ownerId), { totalWatchTime: increment(elapsed) });
  }catch(e){}
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") stopWatchTimer(); });
window.addEventListener("beforeunload", () => { stopWatchTimer(); });

/* CLOUDINARY */
function uploadToCloudinary(file, onProgress){
  return new Promise((resolve,reject)=>{
    let resource = "image";
    if(file.type.startsWith("video/")) resource = "video";
    else if(!file.type.startsWith("image/")) resource = "raw";
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resource}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 5 * 60 * 1000;
    xhr.onload = ()=>{ if(xhr.status >= 200 && xhr.status < 300){ try{ resolve(JSON.parse(xhr.responseText).secure_url); }catch(e){ reject(e); } } else reject(new Error("Upload failed: " + xhr.status)); };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.ontimeout = ()=> reject(new Error("Upload timeout"));
    xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("file", file);
    xhr.send(form);
  });
}
function uploadAudioToCloudinary(file, onProgress){
  return new Promise((resolve, reject)=>{
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 5 * 60 * 1000;
    xhr.onload = ()=>{ if(xhr.status >= 200 && xhr.status < 300){ try{ resolve(JSON.parse(xhr.responseText).secure_url); }catch(e){ reject(e); } } else reject(new Error("Upload failed: " + xhr.status)); };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.ontimeout = ()=> reject(new Error("Audio upload timeout"));
    xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("resource_type", "video");
    form.append("file", file);
    xhr.send(form);
  });
}

/* ============================================================
   AUTH — Email + Signup + Forgot Password
============================================================ */
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    if(tabName === "login"){ $("loginForm")?.classList.remove("hidden"); $("signupForm")?.classList.add("hidden"); }
    else { $("loginForm")?.classList.add("hidden"); $("signupForm")?.classList.remove("hidden"); }
    const status = $("loginStatus");
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  });
});
$("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const status = $("loginStatus");
  if(!email || !password){ if(status){ status.textContent = "Email and password required"; status.style.color = "#ed4956"; } return; }
  if(status){ status.textContent = "Logging in..."; status.style.color = "#7c3aed"; }
  try{ 
    await signInWithEmailAndPassword(auth, email, password); 
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; } 
  }
  catch(err){ 
    console.error("Login error:", err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; } 
  }
});
$("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const status = $("loginStatus");
  if(!name || !email || !password){ if(status){ status.textContent = "All fields required"; status.style.color = "#ed4956"; } return; }
  if(password.length < 6){ if(status){ status.textContent = "Password must be 6+ chars"; status.style.color = "#ed4956"; } return; }
  if(status){ status.textContent = "Creating account..."; status.style.color = "#7c3aed"; }
  try{
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCred.user, { displayName: name });
    try{ await sendEmailVerification(userCred.user); }catch(e){}
    if(status){ status.textContent = "✅ Account created!"; status.style.color = "#22c55e"; }
  }catch(err){ 
    console.error("Signup error:", err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; } 
  }
});
$("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const status = $("loginStatus");
  if(!email){ if(status){ status.textContent = "Enter your email first"; status.style.color = "#ed4956"; } return; }
  try{ 
    await sendPasswordResetEmail(auth, email); 
    if(status){ status.textContent = "✅ Reset email sent!"; status.style.color = "#22c55e"; } 
    setTimeout(() => { if(status) status.style.color = "#ed4956"; }, 4000); 
  }
  catch(err){ 
    console.error("Reset error:", err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; } 
  }
});
function getAuthError(code){
  const errors = {
    "auth/email-already-in-use": "This email is already registered",
    "auth/invalid-email": "Invalid email address",
    "auth/weak-password": "Password too weak (min 6 characters)",
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/invalid-credential": "Invalid email or password",
    "auth/too-many-requests": "Too many attempts. Try again later",
    "auth/network-request-failed": "Network error. Check your internet",
    "auth/user-disabled": "This account has been disabled",
    "auth/operation-not-allowed": "Email/Password login is not enabled"
  };
  return errors[code] || "Something went wrong. Please try again";
}

/* ============================================================
   ✅ GOOGLE LOGIN — ROBUST VERSION (Debug Enabled)
============================================================ */
function attachGoogleLogin(){
  const btn = document.getElementById("googleLogin");
  if(!btn){
    console.error("❌ googleLogin button HTML mein nahi mila!");
    return false;
  }
  if(btn.dataset.listenerAttached === "1"){
    console.log("ℹ️ Google listener already attached");
    return true;
  }
  btn.dataset.listenerAttached = "1";

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("🔵 Google button clicked — START");

    const status = document.getElementById("loginStatus");
    if(status){ status.textContent = "Opening Google..."; status.style.color = "#7c3aed"; }

    try{
      console.log("🔵 auth:", auth);
      console.log("🔵 provider:", provider);
      console.log("🔵 Calling signInWithPopup...");

      const result = await signInWithPopup(auth, provider);

      console.log("✅✅✅ Google login SUCCESS:", result.user.email);
      if(status){ status.textContent = "✅ Login successful!"; status.style.color = "#22c55e"; }

    }catch(error){
      console.error("❌❌❌ Google error:", error.code, error.message);
      if(status){ 
        status.textContent = "❌ " + (error.code || "error"); 
        status.style.color = "#ed4956"; 
      }

      if(error.code === "auth/operation-not-allowed"){
        alert("Admin action: Firebase Console → Authentication → Sign-in method → Google → Enable karo");
        return;
      }
      if(error.code === "auth/unauthorized-domain"){
        alert("Admin action: Firebase Console → Authentication → Settings → Authorized domains → apna domain add karo");
        return;
      }

      // Fallback: popup blocked → redirect
      if(error.code === "auth/popup-blocked" || 
         error.code === "auth/popup-closed-by-user" ||
         error.code === "auth/cancelled-popup-request"){
        console.log("🔄 Popup blocked — trying redirect fallback...");
        try{
          await signInWithRedirect(auth, provider);
        }catch(e){
          console.error("Redirect error:", e);
          if(status){ status.textContent = "Redirect failed: " + e.message; status.style.color = "#ed4956"; }
        }
      }
    }
  });
  console.log("✅ Google login listener attached");
  return true;
}

/* Attach now if DOM ready, else wait */
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", () => {
    if(!attachGoogleLogin()){
      setTimeout(attachGoogleLogin, 500);
      setTimeout(attachGoogleLogin, 1500);
    }
  });
} else {
  if(!attachGoogleLogin()){
    setTimeout(attachGoogleLogin, 500);
    setTimeout(attachGoogleLogin, 1500);
  }
}

getRedirectResult(auth)
  .then(result => { 
    if(result && result.user) console.log("✅ Redirect login success:", result.user.email); 
  })
  .catch(err => console.error("Redirect result error:", err));

/* ============================================================
   PROFILE
============================================================ */
async function createProfile(){
  const ref = doc(db, "profiles", currentUser.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const displayName = currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User");
    await setDoc(ref, {
      uid: currentUser.uid,
      name: displayName,
      username: displayName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20) || "user" + Date.now().toString().slice(-5),
      age: "", gender: "", bio: "", photo: currentUser.photoURL || "",
      followers: 0, following: 0, videos: 0, private: false, suspended: false,
      suspendReason: "", suspendDuration: "", suspendUntil: null, suspendedAt: null,
      bannerType: "gradient", bannerGradient: "linear-gradient(135deg, #7c3aed, #ec4899)", bannerURL: "",
      vaultPin: "", vaultEnabled: false, totalWatchTime: 0, totalViews: 0,
      monetizationStatus: "none", upiId: "", pinnedVideos: [], createdAt: serverTimestamp()
    });
  }
}
async function getProfile(uid){
  const snap = await getDoc(doc(db, "profiles", uid));
  if(!snap.exists()){
    return { uid, name:"User", username:"user", age:"", gender:"", bio:"", photo:"", followers:0, following:0, videos:0, private:false, suspended:false, bannerType:"gradient", bannerGradient:"linear-gradient(135deg, #7c3aed, #ec4899)", bannerURL:"", vaultPin: "", vaultEnabled: false, totalWatchTime: 0, totalViews: 0, monetizationStatus: "none", upiId: "", pinnedVideos: [] };
  }
  const d = snap.data();
  return { uid, ...d, followers: Number(d.followers || 0), following: Number(d.following || 0), videos: Number(d.videos || 0), private: d.private === true, suspended: d.suspended === true, bannerType: d.bannerType || "gradient", bannerGradient: d.bannerGradient || "linear-gradient(135deg, #7c3aed, #ec4899)", bannerURL: d.bannerURL || "", vaultPin: d.vaultPin || "", vaultEnabled: d.vaultEnabled === true, totalWatchTime: Number(d.totalWatchTime || 0), totalViews: Number(d.totalViews || 0), monetizationStatus: d.monetizationStatus || "none", upiId: d.upiId || "", pinnedVideos: Array.isArray(d.pinnedVideos) ? d.pinnedVideos : [] };
}
async function loadProfile(){
  if(!currentUser) return;
  currentProfile = await getProfile(currentUser.uid);
  $("profileName").textContent = currentProfile.name || "User";
  $("profileUsername").textContent = "@" + (currentProfile.username || "user");
  $("profilePhoto").src = avatar(currentProfile.photo, currentProfile.name);
  $("navProfileAvatar").src = avatar(currentProfile.photo, currentProfile.name);
  $("followersCount").textContent = currentProfile.followers || 0;
  $("followingCount").textContent = currentProfile.following || 0;
  $("videosCount").textContent = currentProfile.videos || 0;
  let extra = [];
  if(currentProfile.age) extra.push("Age: " + currentProfile.age);
  if(currentProfile.gender) extra.push(currentProfile.gender);
  $("profileExtra").textContent = extra.join(" · ");
  $("profileBio").textContent = currentProfile.bio || "";
  updateProfileTabCounts();
  updatePrivateToggleUI();
  applyBanner(currentProfile);
  addBannerEditButton();
}
function updatePrivateToggleUI(){
  const toggle = $("privateAccountToggle");
  if(!toggle) return;
  if(currentProfile?.private){ toggle.textContent = "ON"; toggle.style.color = "#22c55e"; }
  else { toggle.textContent = "OFF"; toggle.style.color = "var(--muted)"; }
}
async function loadMyFollows(){
  if(!currentUser) return;
  myFollowsCache = new Set();
  try{ const snap = await getDocs(query(collection(db,"follows"), where("follower","==",currentUser.uid))); snap.forEach(d => myFollowsCache.add(d.data().following)); }catch(e){}
}
async function loadMySaves(){
  if(!currentUser) return;
  mySavesCache = new Set();
  try{ const snap = await getDocs(query(collection(db,"saves"), where("userId","==",currentUser.uid))); snap.forEach(d => mySavesCache.add(d.data().videoId)); }catch(e){}
}
async function loadMySentRequests(){
  if(!currentUser) return;
  mySentRequestsCache = new Set();
  try{ const snap = await getDocs(query(collection(db,"follow_requests"), where("from","==",currentUser.uid))); snap.forEach(d => mySentRequestsCache.add(d.data().to)); }catch(e){}
}
async function loadBlockedUsers(){
  if(!currentUser) return;
  blockedUsersCache = new Set();
  try{ const snap = await getDocs(query(collection(db, "blocked_users"), where("blockerId", "==", currentUser.uid))); snap.forEach(d => blockedUsersCache.add(d.data().blockedId)); }catch(e){}
}
function startBlockedUsersListener(){
  if(blockedUsersUnsubscribe){ blockedUsersUnsubscribe(); blockedUsersUnsubscribe = null; }
  if(!currentUser) return;
  blockedUsersUnsubscribe = onSnapshot(query(collection(db, "blocked_users"), where("blockerId", "==", currentUser.uid)),
    snapshot=>{
      blockedUsersCache = new Set();
      snapshot.forEach(d => blockedUsersCache.add(d.data().blockedId));
      renderFeed();
      renderShorts();
    }, error=>console.error("Blocked listener error:", error));
}
async function loadWatchHistory(){
  if(!currentUser) return;
  watchHistoryCache = [];
  continueWatchingCache = [];
  try{
    const snap = await getDocs(query(collection(db, "watch_history"), where("userId", "==", currentUser.uid)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a,b)=> timeValue(b.watchedAt) - timeValue(a.watchedAt));
    watchHistoryCache = items;
    continueWatchingCache = items.filter(i => i.progress > 3 && i.duration > 0 && i.progress < (i.duration - 5)).slice(0, 10);
    renderWatchHistory();
    renderContinueWatching();
  }catch(e){}
}
function startWatchHistoryListener(){
  if(watchHistoryUnsubscribe){ watchHistoryUnsubscribe(); watchHistoryUnsubscribe = null; }
  if(!currentUser) return;
  watchHistoryUnsubscribe = onSnapshot(query(collection(db, "watch_history"), where("userId", "==", currentUser.uid)),
    snapshot=>{
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a,b)=> timeValue(b.watchedAt) - timeValue(a.watchedAt));
      watchHistoryCache = items;
      continueWatchingCache = items.filter(i => i.progress > 3 && i.duration > 0 && i.progress < (i.duration - 5)).slice(0, 10);
      renderWatchHistory();
      renderContinueWatching();
    }, error=>console.error("Watch history listener error:", error));
}
function stopAllPresenceListeners(){
  presenceListenersMap.forEach(unsub => { try{ unsub(); }catch(e){} });
  presenceListenersMap.clear();
}
function startPresenceHeartbeat(){
  if(!currentUser) return;
  if(heartbeatInterval) clearInterval(heartbeatInterval);
  updatePresence();
  heartbeatInterval = setInterval(updatePresence, 30000);
  if(!window.__presenceVisibilityBound){
    window.__presenceVisibilityBound = true;
    document.addEventListener("visibilitychange", ()=>{ 
      if(document.visibilityState === "hidden") markOffline(); 
      else updatePresence(); 
    });
    window.addEventListener("beforeunload", markOffline);
  }
}

/* AUTH STATE */
onAuthStateChanged(auth, async user => {
  if(user){
    currentUser = user;
    $("loginPage")?.classList.add("hidden");
    
    const isSuspended = await checkSuspension(user.uid);
    if(isSuspended){ hideSplash(); authResolved = true; return; }
    
    $("app")?.classList.remove("hidden");
    hideSplash();
    
    await createProfile();
    await loadProfile();
    await loadMyFollows();
    await loadMySaves();
    await loadMySentRequests();
    await loadBlockedUsers();
    await loadWatchHistory();

    if(typeof startRealtimeVideos === "function") startRealtimeVideos();
    if(typeof startNotifications === "function") startNotifications();
    if(typeof startChatsListListener === "function") startChatsListListener();
    if(typeof startPlaylistsListener === "function") startPlaylistsListener();
    if(typeof startPresenceHeartbeat === "function") startPresenceHeartbeat();
    if(typeof startFollowRequestsListener === "function") startFollowRequestsListener();
    if(typeof startStoriesListener === "function") startStoriesListener();
    if(typeof startVaultListener === "function") startVaultListener();
    if(typeof startMyGroupsListener === "function") startMyGroupsListener();
    if(typeof startSongLibraryListener === "function") startSongLibraryListener();
    if(typeof updateAdminVisibility === "function") updateAdminVisibility();
    if(typeof startAdSettingsListener === "function") startAdSettingsListener();
    if(typeof startBlockedUsersListener === "function") startBlockedUsersListener();
    if(typeof startWatchHistoryListener === "function") startWatchHistoryListener();

    try{ window.history.replaceState({ reelhubHome: true }, "", window.location.href); }catch(e){}
    try{ window.history.pushState({ reelhubApp: true }, "", window.location.href); }catch(e){}
    setTimeout(() => { if(typeof checkDeepLink === "function") checkDeepLink(); }, 1500);
    authResolved = true;
  } else {
    if(currentUser && typeof markOffline === "function") await markOffline();
    currentUser = null;
    currentProfile = null;
    videosCache = [];
    storiesCache = [];
    groupedStories = [];
    vaultFilesCache = [];
    myGroupsCache = [];
    songLibraryCache = [];
    watchHistoryCache = [];
    continueWatchingCache = [];
    myFollowsCache.clear();
    mySavesCache.clear();
    mySentRequestsCache.clear();
    blockedUsersCache.clear();
    onlineUsersCache = {};
    unreadChatsCache = {};
    chatLastReadCache = {};
    modalHistoryStack = [];
    vaultPinVerified = false;
    if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }
    if(notificationsUnsubscribe){ notificationsUnsubscribe(); notificationsUnsubscribe = null; }
    if(chatsListUnsubscribe){ chatsListUnsubscribe(); chatsListUnsubscribe = null; }
    if(playlistsUnsubscribe){ playlistsUnsubscribe(); playlistsUnsubscribe = null; }
    if(presenceUnsubscribe){ presenceUnsubscribe(); presenceUnsubscribe = null; }
    if(followRequestsUnsubscribe){ followRequestsUnsubscribe(); followRequestsUnsubscribe = null; }
    if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
    if(vaultUnsubscribe){ vaultUnsubscribe(); vaultUnsubscribe = null; }
    if(myGroupsUnsubscribe){ myGroupsUnsubscribe(); myGroupsUnsubscribe = null; }
    if(groupRequestsUnsubscribe){ groupRequestsUnsubscribe(); groupRequestsUnsubscribe = null; }
    if(groupChatUnsubscribe){ groupChatUnsubscribe(); groupChatUnsubscribe = null; }
    if(songLibraryUnsubscribe){ songLibraryUnsubscribe(); songLibraryUnsubscribe = null; }
    if(heartbeatInterval){ clearInterval(heartbeatInterval); heartbeatInterval = null; }
    if(adSettingsUnsubscribe){ adSettingsUnsubscribe(); adSettingsUnsubscribe = null; }
    if(userAdsUnsubscribe){ userAdsUnsubscribe(); userAdsUnsubscribe = null; }
    if(blockedUsersUnsubscribe){ blockedUsersUnsubscribe(); blockedUsersUnsubscribe = null; }
    if(watchHistoryUnsubscribe){ watchHistoryUnsubscribe(); watchHistoryUnsubscribe = null; }
    adSettings = { masterDisabled: false, typeDisabled: { banner: false, popup: false, video: false }, userDisabled: {} };
    stopAllPresenceListeners();
    processingLikes.clear();
    processingSaves.clear();
    processingViews.clear();
    processingMessages.clear();
    $("app")?.classList.add("hidden");
    $("loginPage")?.classList.remove("hidden");
    $("suspensionScreen")?.classList.add("hidden");
    hideSplash();
    authResolved = true;
  }
});
console.log("✅ Part 1/3 loaded — Auth + Profile");

/* ============================================================
   VIDEO CARD + FEED + SHORTS
============================================================ */
function createVideoCard(v){
  const views = Number(v.views || 0);
  const mine = currentUser && v.userId === currentUser.uid;
  const isAdmin = isAdminUser();
  const isPinned = currentProfile?.pinnedVideos?.includes(v.id);
  const isPhoto = v.isPhoto === true;
  let songBadge = "";
  if(v.song && v.song.name){ songBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(124,58,237,0.15);color:var(--primary);font-size:10px;font-weight:600;border-radius:8px;margin-top:4px">🎵 ${esc(v.song.name)}</span>`; }
  let stickerBadge = "";
  if(v.sticker){ const icon = v.sticker.type === "emoji" ? v.sticker.icon : v.sticker.text; if(icon){ stickerBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(236,72,153,0.15);color:#ec4899;font-size:10px;font-weight:600;border-radius:8px;margin-top:4px;margin-left:4px">${esc(icon)}</span>`; } }
  const rotationStyle = v.rotation ? `transform: rotate(${v.rotation}deg);` : "";
  const scaleStyle = (v.rotation === 90 || v.rotation === 270) ? "scale(1.3);" : "";
  const filterStyle = v.filter && v.filter !== "none" ? `filter: ${v.filter};` : "";
  let thumbnailHTML;
  if(isPhoto){ thumbnailHTML = `<img src="${esc(v.videoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;${filterStyle}" loading="lazy">`; }
  else if(v.thumbnail){ thumbnailHTML = `<img src="${esc(v.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;${filterStyle}">`; }
  else { thumbnailHTML = `<video src="${esc(v.videoURL)}#t=0.5" preload="metadata" muted playsinline style="${rotationStyle}${scaleStyle}${filterStyle}"></video>`; }
  return `
  <div class="video-card" data-id="${esc(v.id)}" data-open-video="${esc(v.id)}">
    <div class="thumbnail" style="position:relative">
      ${thumbnailHTML}
      ${!isPhoto ? `<span class="duration" data-duration-for="${esc(v.id)}">0:00</span>` : `<span class="duration" style="background:rgba(124,58,237,0.9)">📷</span>`}
      ${v.muted ? `<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:white;font-size:11px;padding:3px 8px;border-radius:8px;font-weight:600">🔇</span>` : ""}
      ${isPinned ? `<span style="position:absolute;top:8px;left:8px;background:rgba(124,58,237,0.9);color:white;font-size:10px;padding:3px 8px;border-radius:8px;font-weight:700">📌 PINNED</span>` : ""}
    </div>
    <div class="video-info">
      <img class="channel-avatar post-open-user" data-uid="${esc(v.userId)}" src="${avatar(v.userPhoto, v.userName)}" alt="${esc(v.userName)}">
      <div class="video-details">
        <h3 class="video-title">${esc(v.title || "Untitled")}</h3>
        <p class="channel-name">${esc(v.username || v.userName || "User")} <span class="verified">✓</span></p>
        <p class="video-meta">${formatViewsShort(views)} views <span class="dot">•</span> ${timeAgoYouTube(v.createdAt)}</p>
        ${songBadge || stickerBadge ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${songBadge}${stickerBadge}</div>` : ""}
      </div>
      ${mine || isAdmin ? `<button class="video-more" onclick="event.stopPropagation();event.preventDefault();openVideoMenuModal('${esc(v.id)}')">⋮</button>` : ""}
    </div>
  </div>`;
}

function renderFeed(){
  const feed = $("feed");
  if(!feed) return;
  let list = videosCache.filter(v => v.type !== "short" && (v.visibility !== "private" || v.userId === currentUser?.uid) && !isUserBlocked(v.userId));
  if(currentCategory === "trending"){
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    list = list.filter(v => timeValue(v.createdAt) > sevenDaysAgo);
    list.sort((a,b)=> (b.views || 0) - (a.views || 0));
    list = list.slice(0, 50);
  } else if(currentCategory !== "all"){ list = list.filter(v => v.category === currentCategory); }
  if(currentCategory === "all" && currentProfile?.pinnedVideos?.length){
    const pinned = [];
    const rest = [];
    list.forEach(v => { if(currentProfile.pinnedVideos.includes(v.id) && v.userId === currentUser?.uid) pinned.push(v); else rest.push(v); });
    list = [...pinned, ...rest];
  }
  if(!list.length){
    feed.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="icon">📹</span><h3>No videos yet</h3><p>Upload your first video or follow creators</p></div>`;
    return;
  }
  feed.innerHTML = list.map(v => createVideoCard(v)).join("");
  list.filter(v => !v.isPhoto).forEach(v => loadVideoDuration(v.id, v.videoURL));
}

document.querySelectorAll("#categoryChips .chip").forEach(chip => {
  chip.addEventListener("click", ()=>{
    document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentCategory = chip.dataset.cat || "all";
    renderFeed();
  });
});

function loadVideoDuration(videoId, videoURL){
  if(!videoURL) return;
  const tempVideo = document.createElement("video");
  tempVideo.preload = "metadata";
  tempVideo.src = videoURL;
  tempVideo.addEventListener("loadedmetadata", () => {
    const duration = formatDuration(tempVideo.duration);
    const badge = document.querySelector(`[data-duration-for="${videoId}"]`);
    if(badge) badge.textContent = duration;
    tempVideo.src = "";
  });
  tempVideo.addEventListener("error", () => {
    const badge = document.querySelector(`[data-duration-for="${videoId}"]`);
    if(badge) badge.textContent = "0:00";
  });
}

function startRealtimeVideos(){
  if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }
  videosUnsubscribe = onSnapshot(collection(db,"videos"),
    snapshot=>{
      videosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      videosCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
      renderFeed();
      renderShorts();
      loadMyVideos();
      if(mySavesCache.size > 0){ renderSavedVideos(); updateProfileTabCounts(); }
      if($("publicProfileModal")?.classList.contains("show")){
        const uid = $("publicProfileModal").dataset.uid;
        if(uid) loadPublicVideos(uid);
      }
    }, error => console.error("Videos listener error:", error));
}

function renderShorts(){
  const container = $("reelsContainer");
  if(!container) return;
  const list = videosCache.filter(v => v.type === "short" && (v.visibility !== "private" || v.userId === currentUser?.uid) && !isUserBlocked(v.userId));
  if(!list.length){
    container.innerHTML = `<div class="reel-empty"><div style="font-size:56px;margin-bottom:14px">🎞️</div><h3 style="font-size:17px;margin-bottom:6px">No Shorts yet</h3><p>Upload your first Short to see it here</p></div>`;
    return;
  }
  container.innerHTML = list.map(v => createReel(v)).join("");
  setTimeout(setupReelsObserver, 100);
}

function createReel(v){
  const isFollowing = myFollowsCache.has(v.userId);
  const mine = currentUser && v.userId === currentUser.uid;
  const isSaved = mySavesCache.has(v.id);
  const views = Number(v.views || 0);
  return `
  <div class="reel-item" data-id="${esc(v.id)}">
    <video src="${esc(v.videoURL)}" loop playsinline webkit-playsinline preload="metadata" muted data-video-id="${esc(v.id)}"></video>
    <div class="reel-overlay">
      <div class="reel-info">
        <div class="reel-user">
          <img class="post-open-user" data-uid="${esc(v.userId)}" src="${avatar(v.userPhoto, v.userName)}">
          <strong>@${esc(v.username || v.userName)}</strong>
          ${!mine ? `<button class="follow-btn-sm" data-follow-uid="${esc(v.userId)}" data-action="follow">${isFollowing ? "Following" : "Follow"}</button>` : ""}
        </div>
        ${v.title ? `<div class="reel-title">${esc(v.title)}</div>` : ""}
        ${v.description ? `<div class="reel-desc">${esc(v.description)}</div>` : ""}
      </div>
    </div>
    <div class="reel-views">👁️ ${formatViewsShort(views)}</div>
    <div class="reel-actions">
      <div class="reel-action like-btn" id="reel-like-${esc(v.id)}" data-like-video="${esc(v.id)}" data-reel="true"><span class="icon">🤍</span><small class="like-count">${v.likes || 0}</small></div>
      <div class="reel-action" data-comment-video="${esc(v.id)}"><span class="icon">💬</span><small>Comment</small></div>
      <div class="reel-action" data-share-video="${esc(v.id)}"><span class="icon">📤</span><small>Share</small></div>
      <div class="reel-action save-btn ${isSaved?"saved":""}" data-save-video="${esc(v.id)}"><span class="icon">${isSaved ? "🔖" : "📑"}</span><small>Save</small></div>
    </div>
  </div>`;
}

let reelObserver = null;
function setupReelsObserver(){
  if(reelObserver) reelObserver.disconnect();
  const container = $("reelsContainer");
  if(!container) return;
  const videos = container.querySelectorAll("video");
  reelObserver = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const vid = entry.target;
      if(entry.isIntersecting) vid.play().catch(()=>{});
      else vid.pause();
    });
  }, { threshold: 0.6, root: container });
  videos.forEach(v => reelObserver.observe(v));
}

/* STORIES */
function startStoriesListener(){
  if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
  if(!currentUser) return;
  storiesUnsubscribe = onSnapshot(collection(db, "stories"),
    snapshot=>{
      const now = Date.now();
      storiesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (now - timeValue(s.createdAt)) < STORY_LIFETIME_MS && !isUserBlocked(s.userId));
      storiesCache.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
      groupStories();
      renderStoriesBar();
    }, error=>console.error("Stories listener error:", error));
}
function groupStories(){
  const map = {};
  storiesCache.forEach(s=>{
    if(!map[s.userId]){ map[s.userId] = { userId: s.userId, userName: s.userName || "User", userPhoto: s.userPhoto || "", stories: [], latestAt: 0 }; }
    map[s.userId].stories.push(s);
    const t = timeValue(s.createdAt);
    if(t > map[s.userId].latestAt) map[s.userId].latestAt = t;
  });
  groupedStories = Object.values(map);
  groupedStories.forEach(g=>{ g.stories.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt)); });
  groupedStories.sort((a,b)=>{
    if(a.userId === currentUser?.uid) return -1;
    if(b.userId === currentUser?.uid) return 1;
    return b.latestAt - a.latestAt;
  });
}
function renderStoriesBar(){
  const bar = $("storiesBar");
  if(!bar) return;
  if(!currentUser){ bar.innerHTML = ""; return; }
  const myGroup = groupedStories.find(g => g.userId === currentUser.uid);
  const otherGroups = groupedStories.filter(g => g.userId !== currentUser.uid);
  let html = "";
  const myPhoto = currentProfile?.photo || "";
  const myName = currentProfile?.name || "You";
  const myHasStory = myGroup && myGroup.stories.length > 0;
  html += `<div class="story-item" data-my-story="true"><div class="story-ring ${myHasStory ? 'active' : 'yours'}"><img src="${avatar(myPhoto, myName)}" alt="You">${!myHasStory ? `<span class="add-icon">+</span>` : ""}</div><div class="story-name">Your Story</div></div>`;
  otherGroups.forEach((g)=>{
    html += `<div class="story-item" data-story-user="${esc(g.userId)}"><div class="story-ring active"><img src="${avatar(g.userPhoto, g.userName)}" alt="${esc(g.userName)}"></div><div class="story-name">${esc(g.userName.split(" ")[0])}</div></div>`;
  });
  bar.innerHTML = html;
}
document.addEventListener("click", (e)=>{
  const myStory = e.target.closest("[data-my-story]");
  if(myStory){
    e.preventDefault(); e.stopPropagation();
    const myGroup = groupedStories.find(g => g.userId === currentUser?.uid);
    if(myGroup && myGroup.stories.length > 0){
      const idx = groupedStories.findIndex(g => g.userId === currentUser.uid);
      openStoryViewer(idx, 0);
    } else openCreateStoryModal();
    return;
  }
  const storyUser = e.target.closest("[data-story-user]");
  if(storyUser){
    e.preventDefault(); e.stopPropagation();
    const uid = storyUser.dataset.storyUser;
    const idx = groupedStories.findIndex(g => g.userId === uid);
    if(idx >= 0) openStoryViewer(idx, 0);
    return;
  }
});

function openCreateStoryModal(){
  storyUploadFile = null; storyMediaType = null; pendingStorySong = null; pendingStorySticker = null; pendingStoryTrim = { start: 0, end: 0, applied: false };
  const imgPrev = $("storyImagePreview"); const vidPrev = $("storyVideoPreview"); const zone = $("storyUploadZone"); const btn = $("storyUploadBtn"); const prog = $("storyUploadProgress"); const status = $("storyUploadStatus"); const tools = $("storyEditorTools");
  if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); }
  if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); }
  if(zone) zone.classList.remove("hidden");
  if(btn) btn.disabled = true;
  if(prog) prog.classList.remove("active");
  if(status) status.textContent = "";
  if(tools) tools.classList.add("hidden");
  const songBtn = $("storyAddSongBtn");
  if(songBtn){ songBtn.innerHTML = "🎵 Song"; songBtn.style.borderColor = ""; songBtn.style.color = ""; }
  const stickerBtn = $("storyAddStickerBtn");
  if(stickerBtn){ stickerBtn.innerHTML = "😀 Sticker"; stickerBtn.style.borderColor = ""; stickerBtn.style.color = ""; }
  const progressBar = $("storyUploadProgressBar");
  if(progressBar) progressBar.style.width = "0%";
  showModal("createStoryModal");
}
$("storyUploadZone")?.addEventListener("click", ()=>{ $("storyFile")?.click(); });
$("storyFile")?.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 30 * 1024 * 1024){ toast("File too large (max 30MB)"); e.target.value = ""; return; }
  storyUploadFile = file;
  storyMediaType = file.type.startsWith("video/") ? "video" : "image";
  const imgPrev = $("storyImagePreview"); const vidPrev = $("storyVideoPreview"); const zone = $("storyUploadZone"); const btn = $("storyUploadBtn"); const tools = $("storyEditorTools");
  if(zone) zone.classList.add("hidden");
  if(tools) tools.classList.remove("hidden");
  const url = URL.createObjectURL(file);
  if(storyMediaType === "image"){ if(imgPrev){ imgPrev.src = url; imgPrev.classList.remove("hidden"); } if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); } }
  else { if(vidPrev){ vidPrev.src = url; vidPrev.classList.remove("hidden"); } if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); } }
  if(btn) btn.disabled = false;
});
$("storyUploadBtn")?.addEventListener("click", async ()=>{
  if(!storyUploadFile || !currentUser){ toast("Select a file first"); return; }
  const btn = $("storyUploadBtn"); const prog = $("storyUploadProgress"); const progBar = $("storyUploadProgressBar"); const status = $("storyUploadStatus");
  if(btn) btn.disabled = true;
  if(prog) prog.classList.add("active");
  if(status) status.textContent = "Uploading...";
  try{
    const url = await uploadToCloudinary(storyUploadFile, (pct)=>{
      if(progBar) progBar.style.width = pct + "%";
      if(status) status.textContent = "Uploading " + pct + "%";
    });
    const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS);
    const storyData = { userId: currentUser.uid, userName: currentProfile?.name || currentUser.displayName || "User", userPhoto: currentProfile?.photo || currentUser.photoURL || "", username: currentProfile?.username || "", mediaURL: url, mediaType: storyMediaType, createdAt: serverTimestamp(), expiresAt: expiresAt };
    if(pendingStorySong) storyData.song = pendingStorySong;
    if(pendingStorySticker) storyData.sticker = pendingStorySticker;
    if(pendingStoryTrim.applied){ storyData.trimStart = pendingStoryTrim.start; storyData.trimEnd = pendingStoryTrim.end; }
    await addDoc(collection(db, "stories"), storyData);
    if(status) status.textContent = "✅ Story shared!";
    toast("✅ Story added");
    setTimeout(()=>{ hideModal("createStoryModal"); }, 500);
  }catch(err){ if(status) status.textContent = "Error: " + err.message; toast("Story upload failed"); }
  finally{ if(btn) btn.disabled = false; }
});

function openStoryViewer(userIndex, storyIndex){
  if(!groupedStories.length) return;
  currentStoryUserIndex = userIndex;
  currentStoryIndex = storyIndex || 0;
  const viewer = $("storyViewer");
  if(viewer){ viewer.classList.add("show"); try{ window.history.pushState({ storyViewer: true }, "", window.location.href); }catch(e){} }
  loadCurrentStory();
}
function closeStoryViewer(){
  const viewer = $("storyViewer");
  if(viewer) viewer.classList.remove("show");
  stopStoryTimer();
  if(window.__storyAudio){ window.__storyAudio.pause(); window.__storyAudio = null; }
  const media = $("storyMedia");
  if(media) media.innerHTML = "";
  const songOverlay = $("storySongOverlay");
  if(songOverlay) songOverlay.classList.add("hidden");
  const stickerOverlay = $("storyStickerOverlay");
  if(stickerOverlay){ stickerOverlay.style.display = "none"; stickerOverlay.textContent = ""; }
}
function loadCurrentStory(){
  stopStoryTimer();
  if(window.__storyAudio){ window.__storyAudio.pause(); window.__storyAudio = null; }
  const group = groupedStories[currentStoryUserIndex];
  if(!group || !group.stories.length){ closeStoryViewer(); return; }
  const story = group.stories[currentStoryIndex];
  if(!story){
    if(currentStoryUserIndex < groupedStories.length - 1){ currentStoryUserIndex++; currentStoryIndex = 0; loadCurrentStory(); }
    else closeStoryViewer();
    return;
  }
  const avatarEl = $("storyViewerAvatar"); const nameEl = $("storyViewerName"); const timeEl = $("storyViewerTime");
  if(avatarEl) avatarEl.src = avatar(group.userPhoto, group.userName);
  if(nameEl) nameEl.textContent = group.userName;
  if(timeEl) timeEl.textContent = timeAgoShort(story.createdAt) + " ago";
  renderStoryProgress(group.stories.length, currentStoryIndex);
  const mediaContainer = $("storyMedia");
  if(mediaContainer){
    mediaContainer.innerHTML = "";
    if(story.mediaType === "video"){
      const vid = document.createElement("video");
      vid.src = story.mediaURL;
      vid.autoplay = true; vid.playsInline = true; vid.muted = false; vid.preload = "auto";
      vid.addEventListener("loadedmetadata", ()=>{
        const dur = Math.min((vid.duration || 5) * 1000, STORY_DURATION_VIDEO_MAX);
        startStoryTimer(dur);
        if(story.trimStart && story.trimEnd){ vid.currentTime = story.trimStart; vid.addEventListener("timeupdate", ()=>{ if(vid.currentTime >= story.trimEnd){ vid.currentTime = story.trimStart; } }); }
      });
      vid.addEventListener("ended", ()=>{ nextStory(); });
      vid.addEventListener("error", ()=>{ nextStory(); });
      mediaContainer.appendChild(vid);
      vid.play().catch(()=>{});
    } else {
      const img = document.createElement("img");
      img.src = story.mediaURL;
      img.alt = "";
      img.addEventListener("load", ()=>{ startStoryTimer(STORY_DURATION_IMAGE); });
      img.addEventListener("error", ()=>{ nextStory(); });
      mediaContainer.appendChild(img);
    }
  }
  const songOverlay = $("storySongOverlay");
  if(songOverlay){
    if(story.song && story.song.audioURL){
      songOverlay.classList.remove("hidden");
      $("storySongTitle").textContent = story.song.name || "Song";
      $("storySongArtist").textContent = story.song.artist || "Unknown";
      window.__storyAudio = new Audio(story.song.audioURL);
      window.__storyAudio.loop = true; window.__storyAudio.volume = 0.5;
      window.__storyAudio.play().catch(()=>{});
    } else songOverlay.classList.add("hidden");
  }
  const stickerOverlay = $("storyStickerOverlay");
  if(stickerOverlay){
    if(story.sticker){
      stickerOverlay.style.display = "block";
      if(story.sticker.type === "emoji"){ stickerOverlay.textContent = story.sticker.icon || "😀"; stickerOverlay.style.fontSize = "80px"; stickerOverlay.style.textShadow = "0 2px 8px rgba(0,0,0,0.4)"; }
      else if(story.sticker.type === "text"){ stickerOverlay.textContent = story.sticker.text || ""; stickerOverlay.style.color = story.sticker.color || "#ffffff"; stickerOverlay.style.fontSize = "40px"; stickerOverlay.style.fontWeight = "900"; stickerOverlay.style.textShadow = "2px 2px 8px rgba(0,0,0,0.6)"; }
    } else { stickerOverlay.style.display = "none"; stickerOverlay.textContent = ""; }
  }
  const viewsCounter = $("storyViewsCounter");
  if(viewsCounter) viewsCounter.classList.add("hidden");
  if(story.userId !== currentUser?.uid) markStoryViewed(story.id);
  const footer = $("storyFooter");
  if(footer){
    if(story.userId === currentUser?.uid) footer.style.display = "none";
    else { footer.style.display = "flex"; const input = $("storyReplyInput"); if(input) input.value = ""; }
  }
}
function renderStoryProgress(total, current){
  const bar = $("storyProgressBar");
  if(!bar) return;
  let html = "";
  for(let i = 0; i < total; i++){
    let fillClass = i < current ? "complete" : "";
    html += `<div class="story-progress-segment"><div class="story-progress-fill ${fillClass}" data-seg="${i}"></div></div>`;
  }
  bar.innerHTML = html;
}
function startStoryTimer(duration){ stopStoryTimer(); storyDuration = duration; storyStartTime = Date.now(); storyElapsed = 0; storyPaused = false; updateStoryProgressLoop(); }
function updateStoryProgressLoop(){
  if(storyPaused) return;
  const elapsed = Date.now() - storyStartTime;
  storyElapsed = elapsed;
  const pct = Math.min((elapsed / storyDuration) * 100, 100);
  const fill = document.querySelector(`[data-seg="${currentStoryIndex}"]`);
  if(fill) fill.style.width = pct + "%";
  if(elapsed >= storyDuration){ nextStory(); return; }
  storyProgressRAF = requestAnimationFrame(updateStoryProgressLoop);
}
function stopStoryTimer(){ if(storyProgressRAF){ cancelAnimationFrame(storyProgressRAF); storyProgressRAF = null; } }
function pauseStoryTimer(){ if(storyPaused) return; storyPaused = true; storyElapsed = Date.now() - storyStartTime; if(window.__storyAudio) window.__storyAudio.pause(); if(storyProgressRAF){ cancelAnimationFrame(storyProgressRAF); storyProgressRAF = null; } }
function resumeStoryTimer(){ if(!storyPaused) return; storyPaused = false; storyStartTime = Date.now() - storyElapsed; if(window.__storyAudio) window.__storyAudio.play().catch(()=>{}); updateStoryProgressLoop(); }
function nextStory(){
  stopStoryTimer();
  const group = groupedStories[currentStoryUserIndex];
  if(!group){ closeStoryViewer(); return; }
  if(currentStoryIndex < group.stories.length - 1){ currentStoryIndex++; loadCurrentStory(); }
  else { if(currentStoryUserIndex < groupedStories.length - 1){ currentStoryUserIndex++; currentStoryIndex = 0; loadCurrentStory(); } else closeStoryViewer(); }
}
function prevStory(){
  stopStoryTimer();
  if(currentStoryIndex > 0){ currentStoryIndex--; loadCurrentStory(); }
  else { if(currentStoryUserIndex > 0){ currentStoryUserIndex--; const group = groupedStories[currentStoryUserIndex]; currentStoryIndex = group ? group.stories.length - 1 : 0; loadCurrentStory(); } }
}
async function markStoryViewed(storyId){
  if(!currentUser || !storyId) return;
  try{ const viewRef = doc(db, "stories", storyId, "views", currentUser.uid); const snap = await getDoc(viewRef); if(!snap.exists()) await setDoc(viewRef, { userId: currentUser.uid, viewedAt: serverTimestamp() }); }catch(e){}
}
$("storyProgressBar")?.addEventListener("click", (e)=>{ const seg = e.target.closest("[data-seg]"); if(!seg) return; const idx = Number(seg.dataset.seg); if(!Number.isNaN(idx)){ currentStoryIndex = idx; loadCurrentStory(); } });
$("storyNextZone")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); nextStory(); });
$("storyPrevZone")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); prevStory(); });
$("storyCloseBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); closeStoryViewer(); });

let storyHoldTimer = null;
const storyMediaEl = $("storyMedia");
if(storyMediaEl){
  storyMediaEl.addEventListener("touchstart", ()=>{ storyHoldTimer = setTimeout(()=>{ pauseStoryTimer(); }, 250); }, { passive: true });
  storyMediaEl.addEventListener("touchend", ()=>{ if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; } resumeStoryTimer(); }, { passive: true });
  storyMediaEl.addEventListener("mousedown", ()=>{ storyHoldTimer = setTimeout(()=>{ pauseStoryTimer(); }, 250); });
  storyMediaEl.addEventListener("mouseup", ()=>{ if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; } resumeStoryTimer(); });
  storyMediaEl.addEventListener("mouseleave", ()=>{ if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; } resumeStoryTimer(); });
}
$("storySendBtn")?.addEventListener("click", async (e)=>{ e.preventDefault(); e.stopPropagation(); await sendStoryReply(); });
$("storyReplyInput")?.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); sendStoryReply(); } });
async function sendStoryReply(){
  const input = $("storyReplyInput");
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  const group = groupedStories[currentStoryUserIndex];
  if(!group || group.userId === currentUser?.uid) return;
  const targetUid = group.userId;
  const chatId = [currentUser.uid, targetUid].sort().join("_");
  try{
    await setDoc(doc(db, "chats", chatId), { members: [currentUser.uid, targetUid], updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, "chats", chatId, "messages"), { userId: currentUser.uid, userName: currentProfile?.name || "User", text: "📸 Replied to story: " + text, type: "text", createdAt: serverTimestamp() });
    await updateDoc(doc(db, "chats", chatId), { lastMessage: "📸 Replied to story", updatedAt: serverTimestamp() });
    input.value = "";
    toast("✅ Reply sent");
  }catch(err){ toast("Reply failed"); }
}
document.addEventListener("keydown", (e)=>{
  const viewer = $("storyViewer");
  if(!viewer || !viewer.classList.contains("show")) return;
  if(e.key === "ArrowRight") nextStory();
  else if(e.key === "ArrowLeft") prevStory();
  else if(e.key === "Escape") closeStoryViewer();
});
$("storyMoreBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const group = groupedStories[currentStoryUserIndex];
  if(!group) return;
  const story = group.stories[currentStoryIndex];
  if(!story) return;
  if(story.userId !== currentUser?.uid && !isAdminUser()){ toast("You can only manage your own story"); return; }
  currentStoryId = story.id;
  currentStoryData = story;
  pauseStoryTimer();
  showModal("storyMenuModal");
});
$("storyMenuEditBtn")?.addEventListener("click", async (e)=>{ e.preventDefault(); e.stopPropagation(); if(!currentStoryId) return; hideModal("storyMenuModal"); await openEditStoryModal(currentStoryId); });
async function openEditStoryModal(storyId){
  try{
    const storySnap = await getDoc(doc(db, "stories", storyId));
    if(!storySnap.exists()){ toast("Story not found"); return; }
    const story = { id: storyId, ...storySnap.data() };
    if(story.userId !== currentUser.uid && !isAdminUser()){ toast("Not your story"); return; }
    if(story.mediaType === "video"){ $("editStoryPreview").classList.add("hidden"); $("editStoryVideoPreview").classList.remove("hidden"); $("editStoryVideoPreview").src = story.mediaURL; }
    else { $("editStoryVideoPreview").classList.add("hidden"); $("editStoryPreview").classList.remove("hidden"); $("editStoryPreview").src = story.mediaURL; }
    $("editStoryCaption").value = story.caption || "";
    window.__editingStorySong = story.song || null;
    window.__editingStorySticker = story.sticker || null;
    $("editStoryStatus").textContent = "";
    updateEditStoryButtons();
    showModal("editStoryModal");
  }catch(e){ toast("Failed to open"); }
}
function updateEditStoryButtons(){
  const songBtn = $("editStoryChangeSongBtn");
  if(songBtn){
    if(window.__editingStorySong){ songBtn.innerHTML = `🎵 ${esc(window.__editingStorySong.name || "Song")} ✓`; songBtn.style.borderColor = "var(--primary)"; songBtn.style.color = "var(--primary)"; }
    else { songBtn.innerHTML = "🎵 Add Song"; songBtn.style.borderColor = ""; songBtn.style.color = ""; }
  }
  const stickerBtn = $("editStoryChangeStickerBtn");
  if(stickerBtn){
    if(window.__editingStorySticker){ stickerBtn.innerHTML = `${window.__editingStorySticker.icon || "😀"} Sticker ✓`; stickerBtn.style.borderColor = "var(--primary)"; stickerBtn.style.color = "var(--primary)"; }
    else { stickerBtn.innerHTML = "😀 Add Sticker"; stickerBtn.style.borderColor = ""; stickerBtn.style.color = ""; }
  }
}
$("saveStoryEditBtn")?.addEventListener("click", async ()=>{
  if(!currentStoryId) return;
  const caption = $("editStoryCaption").value.trim();
  const status = $("editStoryStatus");
  const btn = $("saveStoryEditBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Saving..."; }
  status.textContent = "Saving...";
  status.style.color = "#7c3aed";
  try{
    await updateDoc(doc(db, "stories", currentStoryId), { caption, song: window.__editingStorySong || null, sticker: window.__editingStorySticker || null, updatedAt: serverTimestamp() });
    status.textContent = "✅ Saved!";
    status.style.color = "#22c55e";
    toast("✅ Story updated");
    setTimeout(async ()=>{ hideModal("editStoryModal"); closeStoryViewer(); await new Promise(r => setTimeout(r, 300)); startStoriesListener(); }, 700);
  }catch(err){ status.textContent = "Error: " + err.message; status.style.color = "#ed4956"; }
  finally{ if(btn){ btn.disabled = false; btn.textContent = "✅ Save Changes"; } }
});
$("storyMenuDeleteBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(!currentStoryId) return;
  if(!confirm("Delete this story permanently?")) return;
  try{ await deleteDoc(doc(db, "stories", currentStoryId)); hideModal("storyMenuModal"); closeStoryViewer(); toast("🗑️ Story deleted"); }catch(e){}
});

/* SONG LIBRARY */
function startSongLibraryListener(){
  if(songLibraryUnsubscribe){ songLibraryUnsubscribe(); songLibraryUnsubscribe = null; }
  songLibraryUnsubscribe = onSnapshot(query(collection(db, "song_library")),
    snapshot=>{
      songLibraryCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      songLibraryCache.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
    }, error=>console.error("Song library listener:", error));
}
function updateAdminVisibility(){
  const adminBtn = $("adminSongLibraryBtn");
  if(!adminBtn) return;
  adminBtn.style.display = isAdminUser() ? "flex" : "none";
}
function openSongPicker(context){
  songPickerContext = context || "story";
  selectedSongForApply = null;
  showModal("songPickerModal");
  renderSongPickerList("");
}
function renderSongPickerList(searchText){
  const container = $("songPickerList");
  if(!container) return;
  const q = (searchText || "").toLowerCase().trim();
  let list = songLibraryCache;
  if(q) list = list.filter(s => (s.name || "").toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q));
  if(!list.length){ container.innerHTML = `<div class="song-library-empty"><span class="icon">🎵</span><h3>No songs ${q ? "found" : "yet"}</h3><p>${q ? "Try another search" : "Admin will add songs soon"}</p></div>`; return; }
  container.innerHTML = list.map(s => `<div class="song-picker-item" data-pick-song="${esc(s.id)}"><div class="song-thumb">🎵</div><div class="song-info"><strong>${esc(s.name || "Untitled")}</strong><small>${esc(s.artist || "Unknown")} · ${esc(s.category || "")}</small></div><div class="check-icon"></div></div>`).join("");
}
$("songSearchInput")?.addEventListener("input", (e)=>{ renderSongPickerList(e.target.value); });
document.addEventListener("click", (e)=>{
  const pickerItem = e.target.closest("[data-pick-song]");
  if(pickerItem){
    e.preventDefault(); e.stopPropagation();
    const songId = pickerItem.dataset.pickSong;
    document.querySelectorAll("#songPickerList .song-picker-item").forEach(el => { el.classList.remove("selected"); const check = el.querySelector(".check-icon"); if(check) check.textContent = ""; });
    pickerItem.classList.add("selected");
    const check = pickerItem.querySelector(".check-icon"); if(check) check.textContent = "✓";
    selectedSongForApply = songLibraryCache.find(s => s.id === songId) || null;
  }
});
$("confirmSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(!selectedSongForApply){ toast("Select a song first"); return; }
  if(songPickerContext === "story") applySongToStory(selectedSongForApply);
  else if(songPickerContext === "video") applySongToVideo(selectedSongForApply);
  else if(songPickerContext === "story_edit") applySongToStoryEdit(selectedSongForApply);
  hideModal("songPickerModal");
});
$("removeSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(songPickerContext === "story") removeSongFromStory();
  else if(songPickerContext === "video") removeSongFromVideo();
  else if(songPickerContext === "story_edit") removeSongFromStoryEdit();
  hideModal("songPickerModal");
});
function applySongToStory(song){ pendingStorySong = song; const btn = $("storyAddSongBtn"); if(btn){ btn.innerHTML = `🎵 ${esc(song.name).slice(0, 12)} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; } toast("🎵 Song added"); }
function removeSongFromStory(){ pendingStorySong = null; const btn = $("storyAddSongBtn"); if(btn){ btn.innerHTML = "🎵 Song"; btn.style.borderColor = ""; btn.style.color = ""; } toast("🔇 Song removed"); }
function applySongToVideo(song){ pendingVideoSong = song; const status = $("videoEditStatus"); if(status) status.textContent = "🎵 " + song.name + " selected"; const btn = $("editVideoSongBtn"); if(btn){ btn.innerHTML = `🎵 ${esc(song.name).slice(0, 10)} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; } toast("🎵 Song selected"); }
function removeSongFromVideo(){ pendingVideoSong = null; const btn = $("editVideoSongBtn"); if(btn){ btn.innerHTML = "🎵 Song"; btn.style.borderColor = ""; btn.style.color = ""; } toast("🔇 Song removed"); }
function applySongToStoryEdit(song){ window.__editingStorySong = song; updateEditStoryButtons(); hideModal("songPickerModal"); showModal("editStoryModal"); toast("🎵 " + song.name + " selected"); }
function removeSongFromStoryEdit(){ window.__editingStorySong = null; updateEditStoryButtons(); hideModal("songPickerModal"); showModal("editStoryModal"); toast("🔇 Song removed"); }

/* STICKER PICKER */
function openStickerPicker(context){
  stickerPickerContext = context || "story";
  selectedStickerEmoji = null; selectedStickerColor = "#ffffff";
  document.querySelectorAll("#stickerTabs .yt-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('#stickerTabs .yt-tab[data-stab="emoji"]')?.classList.add("active");
  $("stickerEmojiTab")?.classList.remove("hidden");
  $("stickerTextTab")?.classList.add("hidden");
  document.querySelectorAll(".sticker-item").forEach(el=>{ el.style.background = ""; el.style.color = ""; });
  if($("textStickerInput")) $("textStickerInput").value = "";
  showModal("stickerPickerModal");
}
document.addEventListener("click", (e)=>{
  const tab = e.target.closest("#stickerTabs .yt-tab");
  if(!tab) return;
  e.preventDefault(); e.stopPropagation();
  const stab = tab.dataset.stab;
  document.querySelectorAll("#stickerTabs .yt-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  if(stab === "emoji"){ $("stickerEmojiTab")?.classList.remove("hidden"); $("stickerTextTab")?.classList.add("hidden"); }
  else { $("stickerEmojiTab")?.classList.add("hidden"); $("stickerTextTab")?.classList.remove("hidden"); }
});
document.addEventListener("click", (e)=>{
  const item = e.target.closest(".sticker-item");
  if(!item) return;
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll(".sticker-item").forEach(el=>{ el.style.background = ""; el.style.color = ""; });
  item.style.background = "var(--primary)";
  item.style.color = "white";
  selectedStickerEmoji = item.dataset.sticker;
});
document.addEventListener("click", (e)=>{
  const colorEl = e.target.closest(".text-sticker-color");
  if(!colorEl) return;
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll(".text-sticker-color").forEach(el=>{ el.classList.remove("selected"); });
  colorEl.classList.add("selected");
  selectedStickerColor = colorEl.dataset.color;
});
$("confirmStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  let sticker = null;
  if(selectedStickerEmoji) sticker = { type: "emoji", icon: selectedStickerEmoji };
  else { const text = $("textStickerInput")?.value.trim(); if(text) sticker = { type: "text", text: text, icon: text.slice(0, 3) || "✏️", color: selectedStickerColor }; }
  if(!sticker){ toast("Select emoji or enter text"); return; }
  if(stickerPickerContext === "story") applyStickerToStory(sticker);
  else if(stickerPickerContext === "video") applyStickerToVideo(sticker);
  else if(stickerPickerContext === "story_edit") applyStickerToStoryEdit(sticker);
  hideModal("stickerPickerModal");
});
$("removeStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(stickerPickerContext === "story") removeStickerFromStory();
  else if(stickerPickerContext === "video") removeStickerFromVideo();
  else if(stickerPickerContext === "story_edit") removeStickerFromStoryEdit();
  hideModal("stickerPickerModal");
});
function applyStickerToStory(sticker){ pendingStorySticker = sticker; const btn = $("storyAddStickerBtn"); if(btn){ btn.innerHTML = `${sticker.icon || "😀"} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; } toast("😀 Sticker added"); }
function removeStickerFromStory(){ pendingStorySticker = null; const btn = $("storyAddStickerBtn"); if(btn){ btn.innerHTML = "😀 Sticker"; btn.style.borderColor = ""; btn.style.color = ""; } toast("Sticker removed"); }
function applyStickerToVideo(sticker){ pendingVideoSticker = sticker; const status = $("videoEditStatus"); if(status) status.textContent = `${sticker.icon || "😀"} Sticker selected`; const btn = $("editVideoStickerBtn"); if(btn){ btn.innerHTML = `${sticker.icon || "😀"} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; } toast("😀 Sticker selected"); }
function removeStickerFromVideo(){ pendingVideoSticker = null; const btn = $("editVideoStickerBtn"); if(btn){ btn.innerHTML = "😀 Sticker"; btn.style.borderColor = ""; btn.style.color = ""; } toast("Sticker removed"); }
function applyStickerToStoryEdit(sticker){ window.__editingStorySticker = sticker; updateEditStoryButtons(); hideModal("stickerPickerModal"); showModal("editStoryModal"); toast("😀 Sticker added"); }
function removeStickerFromStoryEdit(){ window.__editingStorySticker = null; updateEditStoryButtons(); hideModal("stickerPickerModal"); showModal("editStoryModal"); toast("Sticker removed"); }

$("storyAddSongBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSongPicker("story"); });
$("storyAddStickerBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openStickerPicker("story"); });
$("editVideoSongBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSongPicker("video"); });
$("editVideoStickerBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openStickerPicker("video"); });
$("editStoryChangeSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  selectedSongForApply = window.__editingStorySong;
  hideModal("editStoryModal");
  openSongPicker("story_edit");
  setTimeout(()=>{ if(window.__editingStorySong){ const item = document.querySelector(`[data-pick-song="${window.__editingStorySong.id}"]`); if(item){ item.classList.add("selected"); const check = item.querySelector(".check-icon"); if(check) check.textContent = "✓"; } } }, 300);
});
$("editStoryChangeStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  hideModal("editStoryModal");
  openStickerPicker("story_edit");
  setTimeout(()=>{
    if(window.__editingStorySticker){
      if(window.__editingStorySticker.type === "emoji"){ document.querySelectorAll(".sticker-item").forEach(el=>{ if(el.dataset.sticker === window.__editingStorySticker.icon){ el.style.background = "var(--primary)"; el.style.color = "white"; } }); }
      if(window.__editingStorySticker.type === "text"){ $("stickerTabs")?.querySelector('[data-stab="text"]')?.click(); $("textStickerInput").value = window.__editingStorySticker.text || ""; }
    }
  }, 300);
});

/* VIDEO EDITOR */
$("editVideoRotateBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){ toast("Select a video first"); return; }
  pendingVideoRotation = (pendingVideoRotation + 90) % 360;
  videoEl.style.transform = `rotate(${pendingVideoRotation}deg)`;
  videoEl.style.transition = "transform 0.3s ease";
  const btn = $("editVideoRotateBtn");
  if(btn){ btn.innerHTML = `🔄 ${pendingVideoRotation}°`; if(pendingVideoRotation !== 0){ btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; } else { btn.style.borderColor = ""; btn.style.color = ""; } }
  const status = $("videoEditStatus");
  if(status) status.textContent = `🔄 Rotated ${pendingVideoRotation}°`;
  toast(`🔄 Rotated ${pendingVideoRotation}°`);
});
$("editVideoMuteBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){ toast("Select a video first"); return; }
  pendingVideoMuted = !pendingVideoMuted;
  videoEl.muted = pendingVideoMuted;
  const btn = $("editVideoMuteBtn");
  if(btn){ if(pendingVideoMuted){ btn.innerHTML = "🔇 Muted"; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; } else { btn.innerHTML = "🔊 Sound"; btn.style.borderColor = ""; btn.style.color = ""; } }
  const status = $("videoEditStatus");
  if(status) status.textContent = pendingVideoMuted ? "🔇 Video muted" : "🔊 Sound on";
  toast(pendingVideoMuted ? "🔇 Muted" : "🔊 Sound on");
});
$("editVideoPreviewBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){ toast("Select a video first"); return; }
  const playerVideo = $("videoPlayerVideo");
  if(playerVideo){
    playerVideo.src = videoEl.src;
    playerVideo.muted = pendingVideoMuted;
    playerVideo.style.transform = `rotate(${pendingVideoRotation}deg)`;
    ["videoPlayerLikeBtn", "videoPlayerCommentBtn", "videoPlayerShareBtn", "videoPlayerDownloadBtn", "videoPlayerSaveBtn", "videoPlayerPlaylistBtn"].forEach(id => { const btn = $(id); if(btn) btn.style.display = "none"; });
    if($("videoPlayerTitle")) $("videoPlayerTitle").textContent = "🎬 Preview";
    const metaEl = $("videoPlayerMeta");
    if(metaEl){ let info = []; if(pendingVideoRotation) info.push(`Rotate: ${pendingVideoRotation}°`); if(pendingVideoMuted) info.push("Muted"); if(pendingVideoSong) info.push(`🎵 ${pendingVideoSong.name}`); metaEl.textContent = info.join(" · ") || "Original video"; }
    if($("videoPlayerDesc")){ $("videoPlayerDesc").textContent = $("videoTitle")?.value || ""; $("videoPlayerDesc").style.display = $("videoPlayerDesc").textContent ? "block" : "none"; }
    setTimeout(()=>{ playerVideo.play().catch(()=>{}); }, 300);
    showModal("videoPlayerModal");
  }
});
function openVideoTrimModal(videoEl){
  if(!videoEl || !videoEl.src){ toast("No video selected"); return; }
  trimVideoElement = videoEl;
  const trimPreview = $("trimPreviewVideo");
  trimPreview.src = videoEl.src;
  trimPreview.load();
  trimPreview.addEventListener("loadedmetadata", ()=>{
    trimVideoDuration = trimPreview.duration || 0;
    $("trimStartRange").max = trimVideoDuration; $("trimEndRange").max = trimVideoDuration;
    $("trimStartRange").value = 0; $("trimEndRange").value = trimVideoDuration;
    updateTrimLabels();
  }, { once: true });
  showModal("videoTrimModal");
}
function updateTrimLabels(){
  const start = Number($("trimStartRange").value) || 0;
  const end = Number($("trimEndRange").value) || 0;
  $("trimStartLabel").textContent = formatDuration(start);
  $("trimEndLabel").textContent = formatDuration(end);
  $("trimDurationLabel").textContent = formatDuration(Math.max(0, end - start));
}
$("trimStartRange")?.addEventListener("input", ()=>{ const start = Number($("trimStartRange").value); const end = Number($("trimEndRange").value); if(start > end) $("trimEndRange").value = start; updateTrimLabels(); });
$("trimEndRange")?.addEventListener("input", ()=>{ const start = Number($("trimStartRange").value); const end = Number($("trimEndRange").value); if(end < start) $("trimStartRange").value = end; updateTrimLabels(); });
$("trimCancelBtn")?.addEventListener("click", ()=>{ hideModal("videoTrimModal"); trimVideoElement = null; });
$("trimSaveBtn")?.addEventListener("click", ()=>{
  const start = Number($("trimStartRange").value) || 0;
  const end = Number($("trimEndRange").value) || 0;
  if(end - start < 1){ toast("Minimum 1 second required"); return; }
  const trimData = { start, end, applied: true, duration: end - start };
  if(window.__trimContext === "story"){ pendingStoryTrim = trimData; const status = $("storySelectedMedia"); if(status) status.textContent = `✂️ Trimmed: ${formatDuration(start)} - ${formatDuration(end)}`; toast("✂️ Trim applied to story"); }
  else if(window.__trimContext === "video"){ pendingVideoTrim = trimData; const status = $("videoEditStatus"); if(status) status.textContent = `✂️ Trimmed: ${formatDuration(start)} - ${formatDuration(end)}`; toast("✂️ Trim applied to video"); }
  hideModal("videoTrimModal"); trimVideoElement = null;
});
$("editVideoTrimBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); window.__trimContext = "video"; openVideoTrimModal($("uploadPreview")); });
$("storyTrimBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); if(storyMediaType !== "video"){ toast("Trim only for videos"); return; } window.__trimContext = "story"; openVideoTrimModal($("storyVideoPreview")); });

console.log("✅ Part 1/3 complete");