/* ============================================================
   ReelHub - app.js (With Stories + Auth + Private Vault + Back Fix)
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORY_DURATION_IMAGE = 5000;
const STORY_DURATION_VIDEO_MAX = 15000;
const VAULT_AUTO_LOCK_MS = 5 * 60 * 1000;

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

let videosUnsubscribe = null;
let notificationsUnsubscribe = null;
let commentsUnsubscribe = null;
let chatUnsubscribe = null;
let chatsListUnsubscribe = null;
let playlistsUnsubscribe = null;
let presenceUnsubscribe = null;
let followRequestsUnsubscribe = null;
let storiesUnsubscribe = null;
let heartbeatInterval = null;

let onlineUsersCache = {};
let unreadChatsCache = {};
let chatLastReadCache = {};

let currentCommentVideoId = null;
let currentChatId = null;
let currentChatUser = null;
let shareVideoId = null;
let uploadVisibility = "public";
let uploadType = "long";
let currentProfileTab = "videos";
let currentPlaylistVideoId = null;
let selectedPlaylists = new Set();
let currentPlaylistView = null;
let deepLinkChecked = false;
let viewingProfileUid = null;

/* STORIES STATE */
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

/* MODAL HISTORY */
let modalHistoryStack = [];

/* VAULT STATE */
let vaultPinVerified = false;
let vaultUnlockTime = 0;
let vaultAutoLockEnabled = true;

const $ = id => document.getElementById(id);

/* HELPERS */
function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* MODAL MANAGEMENT WITH BACK BUTTON */
function showModal(id){
  const el = $(id);
  if(!el) return;
  if(el.classList.contains("show")) return;
  
  el.classList.add("show");
  
  try{
    window.history.pushState(
      { modalId: id, reelhubModal: true },
      "",
      window.location.href
    );
    modalHistoryStack.push(id);
  }catch(e){}
}

function hideModal(id){
  const el = $(id);
  if(!el) return;
  if(!el.classList.contains("show")) return;
  
  el.classList.remove("show");
  
  const idx = modalHistoryStack.indexOf(id);
  if(idx > -1) modalHistoryStack.splice(idx, 1);
}

function timeValue(v){
  if(!v) return 0;
  if(typeof v.toMillis === "function") return v.toMillis();
  return new Date(v).getTime() || 0;
}

function avatar(url,name){
  return url || "https://ui-avatars.com/api/?name=" +
    encodeURIComponent(name || "User") +
    "&background=7c3aed&color=fff";
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

/* SUSPENSION CHECK */
function showSuspensionScreen(profile){
  const screen = $("suspensionScreen");
  if(!screen) return;

  const reason = profile.suspendReason || "Violation of Terms of Service";
  const duration = profile.suspendDuration || "Temporary";
  const until = profile.suspendUntil ? 
    new Date(timeValue(profile.suspendUntil)).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : "Permanent";
  const date = profile.suspendedAt ?
    new Date(timeValue(profile.suspendedAt)).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : "—";

  const reasonEl = $("suspensionReason");
  const durationEl = $("suspensionDuration");
  const untilEl = $("suspensionUntil");
  const dateEl = $("suspensionDate");

  if(reasonEl) reasonEl.textContent = reason;
  if(durationEl) durationEl.textContent = duration;
  if(untilEl) untilEl.textContent = until;
  if(dateEl) dateEl.textContent = date;

  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
  const splash = $("splashScreen");
  if(splash) splash.classList.add("hidden");

  screen.classList.remove("hidden");
}

async function checkSuspension(uid){
  if(!uid) return false;

  try{
    const snap = await getDocs(
      query(collection(db, "profiles"), where("uid", "==", uid))
    );

    if(snap.empty) return false;

    const profileData = snap.docs[0].data();

    if(!profileData.suspended) return false;

    if(profileData.suspendUntil){
      const untilTime = timeValue(profileData.suspendUntil);
      if(Date.now() > untilTime){
        await updateDoc(doc(db, "profiles", snap.docs[0].id), {
          suspended: false,
          suspendReason: "",
          suspendDuration: "",
          suspendUntil: null,
          autoUnsuspendedAt: serverTimestamp()
        });
        toast("✅ Your suspension has ended");
        return false;
      }
    }

    showSuspensionScreen(profileData);
    return true;

  }catch(e){
    console.error("Suspension check error:", e);
    return false;
  }
}

$("suspensionLogoutBtn")?.addEventListener("click", async ()=>{
  if(!confirm("Logout?")) return;
  try{
    await signOut(auth);
    window.location.reload();
  }catch(e){
    console.error(e);
  }
});

/* ============================================================
   STORIES SYSTEM
============================================================ */

function startStoriesListener(){
  if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
  if(!currentUser) return;

  storiesUnsubscribe = onSnapshot(
    collection(db, "stories"),
    snapshot=>{
      const now = Date.now();
      storiesCache = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const created = timeValue(s.createdAt);
          return (now - created) < STORY_LIFETIME_MS;
        });
      storiesCache.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
      groupStories();
      renderStoriesBar();
    },
    error=>console.error("Stories listener error:", error)
  );
}

function groupStories(){
  const map = {};
  storiesCache.forEach(s=>{
    if(!map[s.userId]){
      map[s.userId] = {
        userId: s.userId,
        userName: s.userName || "User",
        userPhoto: s.userPhoto || "",
        stories: [],
        latestAt: 0
      };
    }
    map[s.userId].stories.push(s);
    const t = timeValue(s.createdAt);
    if(t > map[s.userId].latestAt) map[s.userId].latestAt = t;
  });

  groupedStories = Object.values(map);

  groupedStories.forEach(g=>{
    g.stories.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
  });

  groupedStories.sort((a,b)=>{
    if(a.userId === currentUser?.uid) return -1;
    if(b.userId === currentUser?.uid) return 1;
    return b.latestAt - a.latestAt;
  });
}

function renderStoriesBar(){
  const bar = $("storiesBar");
  if(!bar) return;

  if(!currentUser){
    bar.innerHTML = "";
    return;
  }

  const myGroup = groupedStories.find(g => g.userId === currentUser.uid);
  const otherGroups = groupedStories.filter(g => g.userId !== currentUser.uid);

  let html = "";

  const myPhoto = currentProfile?.photo || "";
  const myName = currentProfile?.name || "You";
  const myHasStory = myGroup && myGroup.stories.length > 0;

  html += `
    <div class="story-item" data-my-story="true">
      <div class="story-ring ${myHasStory ? 'active' : 'yours'}">
        <img src="${avatar(myPhoto, myName)}" alt="You">
        ${!myHasStory ? `<span class="add-icon">+</span>` : ""}
      </div>
      <div class="story-name">Your Story</div>
    </div>
  `;

  otherGroups.forEach((g)=>{
    html += `
      <div class="story-item" data-story-user="${esc(g.userId)}">
        <div class="story-ring active">
          <img src="${avatar(g.userPhoto, g.userName)}" alt="${esc(g.userName)}">
        </div>
        <div class="story-name">${esc(g.userName.split(" ")[0])}</div>
      </div>
    `;
  });

  bar.innerHTML = html;
}

document.addEventListener("click", (e)=>{
  const myStory = e.target.closest("[data-my-story]");
  if(myStory){
    e.preventDefault();
    e.stopPropagation();
    const myGroup = groupedStories.find(g => g.userId === currentUser?.uid);
    if(myGroup && myGroup.stories.length > 0){
      const idx = groupedStories.findIndex(g => g.userId === currentUser.uid);
      openStoryViewer(idx, 0);
    }else{
      openCreateStoryModal();
    }
    return;
  }

  const storyUser = e.target.closest("[data-story-user]");
  if(storyUser){
    e.preventDefault();
    e.stopPropagation();
    const uid = storyUser.dataset.storyUser;
    const idx = groupedStories.findIndex(g => g.userId === uid);
    if(idx >= 0) openStoryViewer(idx, 0);
    return;
  }
});

function openCreateStoryModal(){
  storyUploadFile = null;
  storyMediaType = null;

  const imgPrev = $("storyImagePreview");
  const vidPrev = $("storyVideoPreview");
  const zone = $("storyUploadZone");
  const btn = $("storyUploadBtn");
  const prog = $("storyUploadProgress");
  const status = $("storyUploadStatus");

  if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); }
  if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); }
  if(zone) zone.classList.remove("hidden");
  if(btn) btn.disabled = true;
  if(prog) prog.classList.remove("active");
  if(status) status.textContent = "";

  const progressBar = $("storyUploadProgressBar");
  if(progressBar) progressBar.style.width = "0%";

  showModal("createStoryModal");
}

$("storyUploadZone")?.addEventListener("click", ()=>{
  $("storyFile")?.click();
});

$("storyFile")?.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;

  if(file.size > 30 * 1024 * 1024){
    toast("File too large (max 30MB)");
    e.target.value = "";
    return;
  }

  storyUploadFile = file;
  storyMediaType = file.type.startsWith("video/") ? "video" : "image";

  const imgPrev = $("storyImagePreview");
  const vidPrev = $("storyVideoPreview");
  const zone = $("storyUploadZone");
  const btn = $("storyUploadBtn");

  if(zone) zone.classList.add("hidden");

  const url = URL.createObjectURL(file);

  if(storyMediaType === "image"){
    if(imgPrev){ imgPrev.src = url; imgPrev.classList.remove("hidden"); }
    if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); }
  }else{
    if(vidPrev){ vidPrev.src = url; vidPrev.classList.remove("hidden"); }
    if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); }
  }

  if(btn) btn.disabled = false;
});

$("storyUploadBtn")?.addEventListener("click", async ()=>{
  if(!storyUploadFile || !currentUser){
    toast("Select a file first");
    return;
  }

  const btn = $("storyUploadBtn");
  const prog = $("storyUploadProgress");
  const progBar = $("storyUploadProgressBar");
  const status = $("storyUploadStatus");

  if(btn) btn.disabled = true;
  if(prog) prog.classList.add("active");
  if(status) status.textContent = "Uploading...";

  try{
    const url = await uploadToCloudinary(storyUploadFile, (pct)=>{
      if(progBar) progBar.style.width = pct + "%";
      if(status) status.textContent = "Uploading " + pct + "%";
    });

    const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS);

    await addDoc(collection(db, "stories"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || currentUser.displayName || "User",
      userPhoto: currentProfile?.photo || currentUser.photoURL || "",
      username: currentProfile?.username || "",
      mediaURL: url,
      mediaType: storyMediaType,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt
    });

    try{
      const followersSnap = await getDocs(
        query(collection(db, "follows"), where("following", "==", currentUser.uid))
      );
      for(const d of followersSnap.docs){
        const followerUid = d.data().follower;
        if(followerUid && followerUid !== currentUser.uid){
          await addDoc(collection(db, "notifications"), {
            to: followerUid,
            from: currentUser.uid,
            title: "📸 New Story",
            message: (currentProfile?.name || "Someone") + " added a new story",
            createdAt: serverTimestamp()
          });
        }
      }
    }catch(err){ console.error("Story notify error:", err); }

    if(status) status.textContent = "✅ Story shared!";
    toast("✅ Story added");

    setTimeout(()=>{
      hideModal("createStoryModal");
    }, 500);

  }catch(err){
    console.error("Story upload error:", err);
    if(status) status.textContent = "Error: " + err.message;
    toast("Story upload failed");
  }finally{
    if(btn) btn.disabled = false;
  }
});

/* STORY VIEWER */
function openStoryViewer(userIndex, storyIndex){
  if(!groupedStories.length) return;

  currentStoryUserIndex = userIndex;
  currentStoryIndex = storyIndex || 0;

  const viewer = $("storyViewer");
  if(viewer){
    viewer.classList.add("show");
    try{ window.history.pushState({ storyViewer: true }, "", window.location.href); }catch(e){}
  }

  loadCurrentStory();
}

function closeStoryViewer(){
  const viewer = $("storyViewer");
  if(viewer) viewer.classList.remove("show");

  stopStoryTimer();

  const media = $("storyMedia");
  if(media) media.innerHTML = "";
}

function loadCurrentStory(){
  stopStoryTimer();

  const group = groupedStories[currentStoryUserIndex];
  if(!group || !group.stories.length){
    closeStoryViewer();
    return;
  }

  const story = group.stories[currentStoryIndex];
  if(!story){
    if(currentStoryUserIndex < groupedStories.length - 1){
      currentStoryUserIndex++;
      currentStoryIndex = 0;
      loadCurrentStory();
    }else{
      closeStoryViewer();
    }
    return;
  }

  const avatarEl = $("storyViewerAvatar");
  const nameEl = $("storyViewerName");
  const timeEl = $("storyViewerTime");

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
      vid.autoplay = true;
      vid.playsInline = true;
      vid.muted = false;
      vid.preload = "auto";

      vid.addEventListener("loadedmetadata", ()=>{
        const dur = Math.min((vid.duration || 5) * 1000, STORY_DURATION_VIDEO_MAX);
        startStoryTimer(dur);
      });

      vid.addEventListener("ended", ()=>{ nextStory(); });
      vid.addEventListener("error", ()=>{ toast("Video failed to load"); nextStory(); });

      mediaContainer.appendChild(vid);
      vid.play().catch(()=>{});
    }else{
      const img = document.createElement("img");
      img.src = story.mediaURL;
      img.alt = "";

      img.addEventListener("load", ()=>{ startStoryTimer(STORY_DURATION_IMAGE); });
      img.addEventListener("error", ()=>{ toast("Image failed to load"); nextStory(); });

      mediaContainer.appendChild(img);
    }
  }

  const viewsCounter = $("storyViewsCounter");
  if(viewsCounter) viewsCounter.classList.add("hidden");

  if(story.userId !== currentUser?.uid){
    markStoryViewed(story.id);
  }

  const footer = $("storyFooter");
  if(footer){
    if(story.userId === currentUser?.uid){
      footer.style.display = "none";
    }else{
      footer.style.display = "flex";
      const input = $("storyReplyInput");
      if(input) input.value = "";
    }
  }
}

function renderStoryProgress(total, current){
  const bar = $("storyProgressBar");
  if(!bar) return;

  let html = "";
  for(let i = 0; i < total; i++){
    let fillClass = "";
    if(i < current) fillClass = "complete";
    html += `
      <div class="story-progress-segment">
        <div class="story-progress-fill ${fillClass}" data-seg="${i}"></div>
      </div>
    `;
  }
  bar.innerHTML = html;
}

function startStoryTimer(duration){
  stopStoryTimer();

  storyDuration = duration;
  storyStartTime = Date.now();
  storyElapsed = 0;
  storyPaused = false;

  updateStoryProgressLoop();
}

function updateStoryProgressLoop(){
  if(storyPaused) return;

  const elapsed = Date.now() - storyStartTime;
  storyElapsed = elapsed;

  const pct = Math.min((elapsed / storyDuration) * 100, 100);
  const fill = document.querySelector(`[data-seg="${currentStoryIndex}"]`);
  if(fill) fill.style.width = pct + "%";

  if(elapsed >= storyDuration){
    nextStory();
    return;
  }

  storyProgressRAF = requestAnimationFrame(updateStoryProgressLoop);
}

function stopStoryTimer(){
  if(storyProgressRAF){
    cancelAnimationFrame(storyProgressRAF);
    storyProgressRAF = null;
  }
}

function pauseStoryTimer(){
  if(storyPaused) return;
  storyPaused = true;
  storyElapsed = Date.now() - storyStartTime;
  if(storyProgressRAF){
    cancelAnimationFrame(storyProgressRAF);
    storyProgressRAF = null;
  }
}

function resumeStoryTimer(){
  if(!storyPaused) return;
  storyPaused = false;
  storyStartTime = Date.now() - storyElapsed;
  updateStoryProgressLoop();
}

function nextStory(){
  stopStoryTimer();
  const group = groupedStories[currentStoryUserIndex];
  if(!group) { closeStoryViewer(); return; }

  if(currentStoryIndex < group.stories.length - 1){
    currentStoryIndex++;
    loadCurrentStory();
  }else{
    if(currentStoryUserIndex < groupedStories.length - 1){
      currentStoryUserIndex++;
      currentStoryIndex = 0;
      loadCurrentStory();
    }else{
      closeStoryViewer();
    }
  }
}

function prevStory(){
  stopStoryTimer();
  if(currentStoryIndex > 0){
    currentStoryIndex--;
    loadCurrentStory();
  }else{
    if(currentStoryUserIndex > 0){
      currentStoryUserIndex--;
      const group = groupedStories[currentStoryUserIndex];
      currentStoryIndex = group ? group.stories.length - 1 : 0;
      loadCurrentStory();
    }
  }
}

async function markStoryViewed(storyId){
  if(!currentUser || !storyId) return;
  try{
    const viewRef = doc(db, "stories", storyId, "views", currentUser.uid);
    const snap = await getDoc(viewRef);
    if(!snap.exists()){
      await setDoc(viewRef, {
        userId: currentUser.uid,
        viewedAt: serverTimestamp()
      });
    }
  }catch(e){ console.error("markStoryViewed:", e); }
}

$("storyProgressBar")?.addEventListener("click", (e)=>{
  const seg = e.target.closest("[data-seg]");
  if(!seg) return;
  const idx = Number(seg.dataset.seg);
  if(!Number.isNaN(idx)){
    currentStoryIndex = idx;
    loadCurrentStory();
  }
});

$("storyNextZone")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  nextStory();
});

$("storyPrevZone")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  prevStory();
});

$("storyCloseBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  closeStoryViewer();
});

let storyHoldTimer = null;
const storyMediaEl = $("storyMedia");

if(storyMediaEl){
  storyMediaEl.addEventListener("touchstart", ()=>{
    storyHoldTimer = setTimeout(()=>{ pauseStoryTimer(); }, 250);
  }, { passive: true });

  storyMediaEl.addEventListener("touchend", ()=>{
    if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; }
    resumeStoryTimer();
  }, { passive: true });

  storyMediaEl.addEventListener("mousedown", ()=>{
    storyHoldTimer = setTimeout(()=>{ pauseStoryTimer(); }, 250);
  });

  storyMediaEl.addEventListener("mouseup", ()=>{
    if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; }
    resumeStoryTimer();
  });

  storyMediaEl.addEventListener("mouseleave", ()=>{
    if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; }
    resumeStoryTimer();
  });
}

$("storySendBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault();
  e.stopPropagation();
  await sendStoryReply();
});

$("storyReplyInput")?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){
    e.preventDefault();
    sendStoryReply();
  }
});

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
    await setDoc(doc(db, "chats", chatId), {
      members: [currentUser.uid, targetUid],
      updatedAt: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db, "chats", chatId, "messages"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      text: "📸 Replied to story: " + text,
      type: "text",
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: "📸 Replied to story",
      updatedAt: serverTimestamp()
    });

    input.value = "";
    toast("✅ Reply sent");
  }catch(err){
    console.error("Story reply error:", err);
    toast("Reply failed");
  }
}

document.addEventListener("keydown", (e)=>{
  const viewer = $("storyViewer");
  if(!viewer || !viewer.classList.contains("show")) return;

  if(e.key === "ArrowRight") nextStory();
  else if(e.key === "ArrowLeft") prevStory();
  else if(e.key === "Escape") closeStoryViewer();
});

/* ============================================================
   PRIVATE VAULT SYSTEM
============================================================ */

function isVaultItem(type, id) {
  if(!currentProfile) return false;
  const hidden = currentProfile.hiddenItems || [];
  return hidden.includes(`${type}:${id}`);
}

function getVaultItems() {
  if(!currentProfile) return [];
  return currentProfile.hiddenItems || [];
}

async function hideToVault(type, id) {
  if(!currentUser || !currentProfile) return;
  try {
    const current = currentProfile.hiddenItems || [];
    const key = `${type}:${id}`;
    if(current.includes(key)) return;
    
    const updated = [...current, key];
    await updateDoc(doc(db, "profiles", currentUser.uid), {
      hiddenItems: updated,
      updatedAt: serverTimestamp()
    });
    currentProfile.hiddenItems = updated;
    
    toast(`🔐 Hidden to Vault`);
  } catch(e) {
    console.error("hideToVault:", e);
    toast("Failed to hide");
  }
}

async function unhideFromVault(type, id) {
  if(!currentUser || !currentProfile) return;
  try {
    const current = currentProfile.hiddenItems || [];
    const key = `${type}:${id}`;
    const updated = current.filter(k => k !== key);
    
    await updateDoc(doc(db, "profiles", currentUser.uid), {
      hiddenItems: updated,
      updatedAt: serverTimestamp()
    });
    currentProfile.hiddenItems = updated;
    
    toast("✅ Unhidden");
  } catch(e) {
    console.error("unhideFromVault:", e);
    toast("Failed to unhide");
  }
}

async function clearAllVault() {
  if(!currentUser || !currentProfile) return;
  if(!confirm("Clear all vault content?\n\nAll hidden items will become visible again.")) return;
  try {
    await updateDoc(doc(db, "profiles", currentUser.uid), {
      hiddenItems: [],
      updatedAt: serverTimestamp()
    });
    currentProfile.hiddenItems = [];
    toast("✅ Vault cleared");
    closeVault();
  } catch(e) {
    console.error("clearAllVault:", e);
    toast("Failed to clear");
  }
}

async function saveVaultPin(pin) {
  if(!currentUser) return false;
  try {
    const pinHash = btoa("reelhub_vault_" + pin);
    await updateDoc(doc(db, "profiles", currentUser.uid), {
      vaultPin: pinHash,
      vaultEnabled: true,
      vaultCreatedAt: serverTimestamp()
    });
    currentProfile.vaultPin = pinHash;
    currentProfile.vaultEnabled = true;
    return true;
  } catch(e) {
    console.error("saveVaultPin:", e);
    return false;
  }
}

async function hasVaultPin() {
  if(!currentProfile) return false;
  return !!currentProfile.vaultPin;
}

async function verifyVaultPin(pin) {
  if(!currentProfile || !currentProfile.vaultPin) return false;
  const hash = btoa("reelhub_vault_" + pin);
  return currentProfile.vaultPin === hash;
}

async function openVaultFlow() {
  if(!currentUser) return;
  
  currentProfile = await getProfile(currentUser.uid);
  
  const hasPin = await hasVaultPin();
  
  if(!hasPin) {
    $("newPinInput").value = "";
    $("confirmPinInput").value = "";
    $("pinSetupStatus").textContent = "";
    hideModal("settingsModal");
    hideModal("advancedSettingsModal");
    showModal("pinSetupModal");
    return;
  }
  
  if(vaultPinVerified && (Date.now() - vaultUnlockTime) < VAULT_AUTO_LOCK_MS) {
    hideModal("settingsModal");
    hideModal("advancedSettingsModal");
    openVaultViewer();
    return;
  }
  
  vaultPinVerified = false;
  $("vaultPinInput").value = "";
  $("pinEntryStatus").textContent = "";
  hideModal("settingsModal");
  hideModal("advancedSettingsModal");
  showModal("pinEntryModal");
  
  setTimeout(() => $("vaultPinInput").focus(), 300);
}

$("savePinBtn")?.addEventListener("click", async () => {
  const pin = $("newPinInput").value.trim();
  const confirm = $("confirmPinInput").value.trim();
  const status = $("pinSetupStatus");
  
  if(!/^\d{4}$/.test(pin)) {
    status.style.color = "#ed4956";
    status.textContent = "PIN must be 4 digits";
    return;
  }
  if(pin !== confirm) {
    status.style.color = "#ed4956";
    status.textContent = "PINs don't match";
    return;
  }
  
  status.style.color = "#7c3aed";
  status.textContent = "Saving...";
  
  const ok = await saveVaultPin(pin);
  if(ok) {
    status.style.color = "#22c55e";
    status.textContent = "✅ PIN set!";
    vaultPinVerified = true;
    vaultUnlockTime = Date.now();
    
    setTimeout(() => {
      hideModal("pinSetupModal");
      openVaultViewer();
    }, 600);
  } else {
    status.style.color = "#ed4956";
    status.textContent = "Failed to save PIN";
  }
});

$("unlockVaultBtn")?.addEventListener("click", async () => {
  const pin = $("vaultPinInput").value.trim();
  const status = $("pinEntryStatus");
  const input = $("vaultPinInput");
  
  if(!/^\d{4}$/.test(pin)) {
    status.textContent = "Enter 4-digit PIN";
    input.classList.add("pin-error");
    setTimeout(() => input.classList.remove("pin-error"), 400);
    return;
  }
  
  const valid = await verifyVaultPin(pin);
  if(valid) {
    status.style.color = "#22c55e";
    status.textContent = "✅ Unlocked!";
    vaultPinVerified = true;
    vaultUnlockTime = Date.now();
    
    setTimeout(() => {
      hideModal("pinEntryModal");
      openVaultViewer();
    }, 400);
  } else {
    status.style.color = "#ed4956";
    status.textContent = "❌ Wrong PIN";
    input.value = "";
    input.classList.add("pin-error");
    setTimeout(() => input.classList.remove("pin-error"), 400);
  }
});

$("vaultPinInput")?.addEventListener("keydown", (e) => {
  if(e.key === "Enter") $("unlockVaultBtn")?.click();
});

function openVaultViewer() {
  renderVaultContent();
  showModal("vaultViewerModal");
}

function closeVault() {
  hideModal("vaultViewerModal");
}

function renderVaultContent() {
  const container = $("vaultContent");
  if(!container) return;
  
  const hiddenKeys = getVaultItems();
  
  if(!hiddenKeys.length) {
    container.innerHTML = `
      <div class="vault-empty">
        <span class="icon">🔐</span>
        <h3>Vault is empty</h3>
        <p>Hide videos by tapping the 🔒 button on them</p>
      </div>
    `;
    return;
  }
  
  const videoKeys = hiddenKeys.filter(k => k.startsWith("video:"));
  
  let html = "";
  
  if(videoKeys.length) {
    html += `<div>
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text)">
        🎬 Videos (${videoKeys.length})
      </h3>
      <div class="vault-grid">`;
    
    videoKeys.forEach(key => {
      const vid = key.replace("video:", "");
      const v = videosCache.find(x => x.id === vid);
      if(v) {
        html += `
          <div class="vault-item" data-vault-video="${esc(vid)}">
            <video src="${esc(v.videoURL)}" preload="metadata" muted></video>
            <span class="vault-item-overlay">🔒</span>
            <span class="vault-item-type">🎬</span>
          </div>
        `;
      }
    });
    
    html += `</div></div>`;
  }
  
  container.innerHTML = html;
}

document.addEventListener("click", async (e) => {
  const vaultVideo = e.target.closest("[data-vault-video]");
  if(vaultVideo) {
    const vid = vaultVideo.dataset.vaultVideo;
    if(vid) {
      const action = prompt("Type 1 to OPEN, 2 to UNHIDE:\n\n1 = Open video\n2 = Move out of vault");
      if(action === "1") {
        closeVault();
        setTimeout(() => openVideoPlayer(vid), 200);
      } else if(action === "2") {
        await unhideFromVault("video", vid);
        renderVaultContent();
      }
    }
    return;
  }
});

$("advancedSettingsBtn")?.addEventListener("click", () => {
  hideModal("settingsModal");
  showModal("advancedSettingsModal");
});

$("openVaultBtn")?.addEventListener("click", () => {
  openVaultFlow();
});

$("changePinBtn")?.addEventListener("click", async () => {
  if(!confirm("Change your vault PIN?\n\nYou'll need to set a new one.")) return;
  hideModal("advancedSettingsModal");
  
  $("newPinInput").value = "";
  $("confirmPinInput").value = "";
  $("pinSetupStatus").textContent = "";
  showModal("pinSetupModal");
});

$("vaultSettingsBtn")?.addEventListener("click", () => {
  hideModal("advancedSettingsModal");
  showModal("vaultSettingsModal");
  updateVaultAutoLockUI();
});

function updateVaultAutoLockUI() {
  const toggle = $("vaultAutoLockToggle");
  if(!toggle) return;
  toggle.textContent = vaultAutoLockEnabled ? "ON" : "OFF";
  toggle.style.color = vaultAutoLockEnabled ? "#22c55e" : "var(--muted)";
}

$("vaultAutoLockBtn")?.addEventListener("click", () => {
  vaultAutoLockEnabled = !vaultAutoLockEnabled;
  localStorage.setItem("reelhubVaultAutoLock", vaultAutoLockEnabled ? "1" : "0");
  updateVaultAutoLockUI();
  toast(vaultAutoLockEnabled ? "Auto-lock ON" : "Auto-lock OFF");
});

if(localStorage.getItem("reelhubVaultAutoLock") === "0") {
  vaultAutoLockEnabled = false;
}

$("hideVaultFromSearchBtn")?.addEventListener("click", () => {
  toast("✅ Vault hidden from search");
  hideModal("vaultSettingsModal");
});

$("clearVaultBtn")?.addEventListener("click", async () => {
  await clearAllVault();
});

$("removeVaultBtn")?.addEventListener("click", async () => {
  if(!confirm("Remove Vault completely?\n\nAll hidden items will become visible and PIN will be deleted.")) return;
  try {
    await updateDoc(doc(db, "profiles", currentUser.uid), {
      hiddenItems: [],
      vaultPin: "",
      vaultEnabled: false,
      updatedAt: serverTimestamp()
    });
    currentProfile.hiddenItems = [];
    currentProfile.vaultPin = "";
    currentProfile.vaultEnabled = false;
    toast("✅ Vault removed");
    hideModal("vaultSettingsModal");
    hideModal("advancedSettingsModal");
  } catch(e) {
    console.error(e);
    toast("Failed to remove vault");
  }
});

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && vaultPinVerified) {
    if(vaultAutoLockEnabled && (Date.now() - vaultUnlockTime) > VAULT_AUTO_LOCK_MS) {
      vaultPinVerified = false;
    }
  }
});

/* ONLINE STATUS */
async function updatePresence(){
  if(!currentUser) return;
  try{
    await setDoc(doc(db, "presence", currentUser.uid), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "",
      lastSeen: serverTimestamp(),
      online: true
    }, { merge: true });
  }catch(e){ console.error("Presence update error:", e); }
}

async function markOffline(){
  if(!currentUser) return;
  try{
    await updateDoc(doc(db, "presence", currentUser.uid), {
      online: false,
      lastSeen: serverTimestamp()
    });
  }catch(e){ console.error("Mark offline error:", e); }
}

function startPresenceHeartbeat(){
  if(!currentUser) return;
  if(heartbeatInterval) clearInterval(heartbeatInterval);

  updatePresence();
  heartbeatInterval = setInterval(updatePresence, 30000);

  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "hidden"){
      markOffline();
    }else{
      updatePresence();
    }
  });

  window.addEventListener("beforeunload", markOffline);
}

function startPresenceListener(uids){
  if(presenceUnsubscribe){
    presenceUnsubscribe();
    presenceUnsubscribe = null;
  }

  if(!uids || !uids.length) return;

  const uniqueUids = [...new Set(uids)].filter(u => u && u !== currentUser?.uid);
  if(!uniqueUids.length) return;

  const limitedUids = uniqueUids.slice(0, 10);

  presenceUnsubscribe = onSnapshot(
    query(collection(db, "presence"), where("userId", "in", limitedUids)),
    snapshot=>{
      snapshot.docs.forEach(d=>{
        const data = d.data();
        onlineUsersCache[data.userId] = {
          online: data.online,
          lastSeen: data.lastSeen
        };
      });
      updateOnlineIndicators();
    },
    error=>console.error("Presence listener error:", error)
  );
}

function updateOnlineIndicators(){
  document.querySelectorAll("[data-presence-uid]").forEach(el=>{
    const uid = el.dataset.presenceUid;
    const status = onlineUsersCache[uid];
    
    if(!status){
      el.classList.remove("online");
      el.classList.add("offline");
      el.textContent = "";
      return;
    }

    if(status.online){
      el.classList.add("online");
      el.classList.remove("offline");
      el.textContent = "Active now";
    }else{
      el.classList.remove("online");
      el.classList.add("offline");
      el.textContent = "";
    }
  });

  document.querySelectorAll("[data-dot-uid]").forEach(el=>{
    const uid = el.dataset.dotUid;
    const status = onlineUsersCache[uid];
    if(status?.online){
      el.style.display = "block";
    }else{
      el.style.display = "none";
    }
  });
}

function getOnlineText(uid){
  const status = onlineUsersCache[uid];
  if(!status) return "";
  if(status.online) return "Active now";
  return "";
}

/* CHAT READ STATUS */
async function markChatAsRead(chatId){
  if(!currentUser || !chatId) return;
  try{
    const userKey = "readBy_" + currentUser.uid;
    await updateDoc(doc(db, "chats", chatId), {
      [userKey]: serverTimestamp()
    });
    chatLastReadCache[chatId] = Date.now();
    unreadChatsCache[chatId] = 0;
    updateMsgBadge();
    const inbox = $("dmInboxView");
    if(inbox && !inbox.classList.contains("hidden")){
      renderDMInbox();
    }
  }catch(e){ console.error("Mark read error:", e); }
}

async function countUnreadMessages(chatId, lastReadTimestamp){
  if(!currentUser) return 0;
  try{
    const q = query(collection(db, "chats", chatId, "messages"));
    const snap = await getDocs(q);
    let unreadCount = 0;
    snap.forEach(d => {
      const msg = d.data();
      if(msg.userId === currentUser.uid) return;
      const msgTime = timeValue(msg.createdAt);
      if(msgTime > lastReadTimestamp) unreadCount++;
    });
    return unreadCount;
  }catch(e){ console.error("Unread count error:", e); return 0; }
}

function updateMsgBadge(){
  const badge = $("msgBadge");
  if(!badge) return;
  let unreadChatCount = 0;
  Object.values(unreadChatsCache).forEach(count => {
    if(count > 0) unreadChatCount++;
  });
  if(unreadChatCount > 0){
    badge.textContent = unreadChatCount;
    badge.classList.remove("hidden");
  }else{
    badge.classList.add("hidden");
  }
}

async function calculateAllUnread(){
  if(!currentUser || !myChatsCache.length) {
    updateMsgBadge();
    return;
  }
  for(const chat of myChatsCache){
    try{
      const userKey = "readBy_" + currentUser.uid;
      const lastRead = timeValue(chat[userKey]);
      chatLastReadCache[chat.id] = lastRead;
      const unread = await countUnreadMessages(chat.id, lastRead);
      unreadChatsCache[chat.id] = unread;
    }catch(e){ unreadChatsCache[chat.id] = 0; }
  }
  updateMsgBadge();
}

/* ============================================================
   EMAIL / PASSWORD AUTH
============================================================ */

document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    
    if(tabName === "login"){
      $("loginForm")?.classList.remove("hidden");
      $("signupForm")?.classList.add("hidden");
    }else{
      $("loginForm")?.classList.add("hidden");
      $("signupForm")?.classList.remove("hidden");
    }
    
    const status = $("loginStatus");
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  });
});

$("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const status = $("loginStatus");
  
  if(!email || !password){
    if(status){ status.textContent = "Email and password required"; status.style.color = "#ed4956"; }
    return;
  }
  
  if(status){ status.textContent = "Logging in..."; status.style.color = "#7c3aed"; }
  
  try{
    await signInWithEmailAndPassword(auth, email, password);
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  }catch(err){
    console.error(err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});

$("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const status = $("loginStatus");
  
  if(!name || !email || !password){
    if(status){ status.textContent = "All fields required"; status.style.color = "#ed4956"; }
    return;
  }
  
  if(password.length < 6){
    if(status){ status.textContent = "Password must be at least 6 characters"; status.style.color = "#ed4956"; }
    return;
  }
  
  if(status){ status.textContent = "Creating account..."; status.style.color = "#7c3aed"; }
  
  try{
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCred.user, { displayName: name });
    
    try{
      await sendEmailVerification(userCred.user);
    }catch(e){ console.log("Verification email failed:", e); }
    
    if(status){ status.textContent = "✅ Account created!"; status.style.color = "#22c55e"; }
  }catch(err){
    console.error(err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});

$("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const status = $("loginStatus");
  
  if(!email){
    if(status){ status.textContent = "Enter your email first"; status.style.color = "#ed4956"; }
    return;
  }
  
  try{
    await sendPasswordResetEmail(auth, email);
    if(status){ status.textContent = "✅ Password reset email sent!"; status.style.color = "#22c55e"; }
    setTimeout(() => {
      if(status) status.style.color = "#ed4956";
    }, 4000);
  }catch(err){
    console.error(err);
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
    "auth/operation-not-allowed": "Email/Password login is not enabled",
    "auth/missing-password": "Please enter your password",
    "auth/missing-email": "Please enter your email"
  };
  return errors[code] || "Something went wrong. Please try again";
}

/* NAVIGATION */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", ()=>{
    const panelId = btn.dataset.panel;

    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    $(panelId)?.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");

    if(panelId === "shortsPanel"){
      $("mainTopbar")?.classList.add("hidden");
    }else{
      $("mainTopbar")?.classList.remove("hidden");
    }

    if(panelId === "profilePanel"){
      loadProfile();
      loadMyVideos();
      loadMyPlaylists();
    }

    if(panelId === "messagesPanel"){
      const inbox = $("dmInboxView");
      const chat = $("dmChatView");
      if(inbox){ inbox.classList.remove("hidden"); inbox.style.display = "flex"; }
      if(chat){ chat.classList.add("hidden"); chat.style.display = "none"; }
      if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
      currentChatId = null;
      currentChatUser = null;
      showDMInbox();
    }

    if(panelId === "shortsPanel"){
      setTimeout(setupReelsObserver, 100);
    }
  });
});

function openPanel(id){
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
  const btn = document.querySelector(`[data-panel="${id}"]`);
  btn?.classList.add("active");

  if(id === "shortsPanel"){
    $("mainTopbar")?.classList.add("hidden");
    setTimeout(setupReelsObserver, 100);
  }else{
    $("mainTopbar")?.classList.remove("hidden");
  }

  if(id === "messagesPanel"){
    const inbox = $("dmInboxView");
    const chat = $("dmChatView");
    if(inbox){ inbox.classList.remove("hidden"); inbox.style.display = "flex"; }
    if(chat){ chat.classList.add("hidden"); chat.style.display = "none"; }
    showDMInbox();
  }
}

/* LOGIN (Google) */
$("googleLogin")?.addEventListener("click", async()=>{
  $("loginStatus").textContent = "Opening Google...";
  try{
    await signInWithPopup(auth, provider);
  }catch(error){
    if(error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user"){
      try{ await signInWithRedirect(auth, provider); }
      catch(e){ $("loginStatus").textContent = e.message; }
    }else{
      $("loginStatus").textContent = error.message;
    }
  }
});

getRedirectResult(auth).catch(console.error);

/* PROFILE */
async function createProfile(){
  const ref = doc(db, "profiles", currentUser.uid);
  const snap = await getDoc(ref);

  if(!snap.exists()){
    const displayName = currentUser.displayName || 
      (currentUser.email ? currentUser.email.split("@")[0] : "User");
    
    await setDoc(ref, {
      uid: currentUser.uid,
      name: displayName,
      username: displayName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20) ||
        "user" + Date.now().toString().slice(-5),
      age: "",
      gender: "",
      bio: "",
      photo: currentUser.photoURL || "",
      followers: 0,
      following: 0,
      videos: 0,
      private: false,
      suspended: false,
      suspendReason: "",
      suspendDuration: "",
      suspendUntil: null,
      suspendedAt: null,
      bannerType: "gradient",
      bannerGradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
      bannerURL: "",
      hiddenItems: [],
      vaultPin: "",
      vaultEnabled: false,
      createdAt: serverTimestamp()
    });
  }
}

async function getProfile(uid){
  const snap = await getDoc(doc(db, "profiles", uid));
  if(!snap.exists()){
    return { uid, name:"User", username:"user", age:"", gender:"", bio:"",
             photo:"", followers:0, following:0, videos:0, private:false,
             suspended:false,
             bannerType:"gradient",
             bannerGradient:"linear-gradient(135deg, #7c3aed, #ec4899)",
             bannerURL:"", hiddenItems: [], vaultPin: "", vaultEnabled: false };
  }
  const d = snap.data();
  return {
    uid,
    ...d,
    followers: Number(d.followers || 0),
    following: Number(d.following || 0),
    videos: Number(d.videos || 0),
    private: d.private === true,
    suspended: d.suspended === true,
    bannerType: d.bannerType || "gradient",
    bannerGradient: d.bannerGradient || "linear-gradient(135deg, #7c3aed, #ec4899)",
    bannerURL: d.bannerURL || "",
    hiddenItems: d.hiddenItems || [],
    vaultPin: d.vaultPin || "",
    vaultEnabled: d.vaultEnabled === true
  };
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
  if(currentProfile?.private){
    toggle.textContent = "ON";
    toggle.style.color = "#22c55e";
  }else{
    toggle.textContent = "OFF";
    toggle.style.color = "var(--muted)";
  }
}

async function loadMyFollows(){
  if(!currentUser) return;
  myFollowsCache = new Set();
  try{
    const q = query(collection(db,"follows"), where("follower","==",currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => myFollowsCache.add(d.data().following));
  }catch(e){ console.error(e); }
}

async function loadMySaves(){
  if(!currentUser) return;
  mySavesCache = new Set();
  try{
    const q = query(collection(db,"saves"), where("userId","==",currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => mySavesCache.add(d.data().videoId));
  }catch(e){ console.error(e); }
}

async function loadMySentRequests(){
  if(!currentUser) return;
  mySentRequestsCache = new Set();
  try{
    const q = query(collection(db,"follow_requests"), where("from","==",currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => mySentRequestsCache.add(d.data().to));
  }catch(e){ console.error(e); }
}

/* AUTH STATE */
onAuthStateChanged(auth, async user => {
  if(user){
    currentUser = user;

    const isSuspended = await checkSuspension(user.uid);
    if(isSuspended){ return; }

    await createProfile();
    await loadProfile();
    await loadMyFollows();
    await loadMySaves();
    await loadMySentRequests();

    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");

    startRealtimeVideos();
    startNotifications();
    startChatsListListener();
    startPlaylistsListener();
    startPresenceHeartbeat();
    startFollowRequestsListener();
    startStoriesListener();

    // History state for back button
    try{
      window.history.replaceState({ reelhubHome: true }, "", window.location.href);
    }catch(e){}
    try{
      window.history.pushState({ reelhubApp: true }, "", window.location.href);
    }catch(e){}

    setTimeout(checkDeepLink, 1500);
  }else{
    if(currentUser) await markOffline();

    currentUser = null;
    currentProfile = null;
    videosCache = [];
    storiesCache = [];
    groupedStories = [];
    myFollowsCache.clear();
    mySavesCache.clear();
    mySentRequestsCache.clear();
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
    if(heartbeatInterval){ clearInterval(heartbeatInterval); heartbeatInterval = null; }

    $("app").classList.add("hidden");
    $("loginPage").classList.remove("hidden");
    $("suspensionScreen")?.classList.add("hidden");
  }
});

/* CLOUDINARY */
function uploadToCloudinary(file, onProgress){
  return new Promise((resolve,reject)=>{
    const resource = file.type.startsWith("video/") ? "video" : "image";
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resource}/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.onload = ()=>{
      if(xhr.status >= 200 && xhr.status < 300){
        try{ resolve(JSON.parse(xhr.responseText).secure_url); }
        catch(e){ reject(e); }
      }else reject(new Error("Upload failed: " + xhr.status));
    };

    xhr.onerror = ()=> reject(new Error("Network error"));

    xhr.upload.onprogress = e=>{
      if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100));
    };

    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("file", file);
    xhr.send(form);
  });
}
/* UPLOAD */
$("dropzone")?.addEventListener("click", ()=> $("videoFile").click());

$("videoFile")?.addEventListener("change", e=>{
  const file = e.target.files[0];
  if(!file) return;
  const preview = $("uploadPreview");
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  $("dropzone").classList.add("hidden");
});

$("visibilityGroup")?.addEventListener("click", e=>{
  const el = e.target.closest(".yt-radio");
  if(!el) return;
  $("visibilityGroup").querySelectorAll(".yt-radio").forEach(x => x.classList.remove("selected"));
  el.classList.add("selected");
  uploadVisibility = el.dataset.value;
});

$("typeGroup")?.addEventListener("click", e=>{
  const el = e.target.closest(".yt-radio");
  if(!el) return;
  $("typeGroup").querySelectorAll(".yt-radio").forEach(x => x.classList.remove("selected"));
  el.classList.add("selected");
  uploadType = el.dataset.value;
});

$("publishBtn")?.addEventListener("click", async()=>{
  const file = $("videoFile").files[0];
  const title = $("videoTitle").value.trim();
  const description = $("videoDescription").value.trim();

  if(!file){ toast("Select video first"); return; }
  if(!title){ toast("Title डालो"); return; }
  if(!currentUser){ toast("Login required"); return; }

  $("publishBtn").disabled = true;
  $("uploadProgressWrap").classList.add("active");
  $("uploadStatus").textContent = "Uploading...";

  try{
    const url = await uploadToCloudinary(file, pct=>{
      $("uploadProgressBar").style.width = pct + "%";
      $("uploadStatus").textContent = "Uploading " + pct + "%";
    });

    await addDoc(collection(db,"videos"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || currentUser.displayName || "User",
      username: currentProfile?.username || "",
      userPhoto: currentProfile?.photo || currentUser.photoURL || "",
      videoURL: url,
      title,
      description,
      visibility: uploadVisibility,
      type: uploadType,
      likes: 0,
      views: 0,
      createdAt: serverTimestamp()
    });

    await syncVideoCount(currentUser.uid);

    $("videoFile").value = "";
    $("videoTitle").value = "";
    $("videoDescription").value = "";
    $("uploadPreview").classList.add("hidden");
    $("dropzone").classList.remove("hidden");
    $("uploadProgressBar").style.width = "0%";
    $("uploadProgressWrap").classList.remove("active");
    $("uploadStatus").textContent = "";

    toast("✅ Video published!");
    openPanel("homePanel");
  }catch(error){
    console.error(error);
    $("uploadStatus").textContent = "Error: " + error.message;
    toast("Upload failed");
  }finally{
    $("publishBtn").disabled = false;
  }
});

/* BANNER */
function applyBanner(profile){
  const bannerEl = document.querySelector("#profilePanel .yt-banner");
  if(!bannerEl || !profile) return;

  if(profile.bannerType === "image" && profile.bannerURL){
    bannerEl.style.background = `url(${profile.bannerURL}) center/cover no-repeat`;
    bannerEl.classList.add("banner-image");
  }else if(profile.bannerGradient){
    bannerEl.style.background = profile.bannerGradient;
    bannerEl.classList.remove("banner-image");
  }
}

function addBannerEditButton(){
  const bannerEl = document.querySelector("#profilePanel .yt-banner");
  if(!bannerEl) return;

  bannerEl.querySelector(".banner-edit-btn")?.remove();

  const btn = document.createElement("button");
  btn.className = "banner-edit-btn";
  btn.innerHTML = "🎨 Edit";
  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    showModal("bannerOptionsModal");
  });

  bannerEl.style.position = "relative";
  bannerEl.appendChild(btn);
}

$("changeBannerBtn")?.addEventListener("click", ()=>{
  hideModal("settingsModal");
  showModal("bannerOptionsModal");
});

$("uploadBannerBtn")?.addEventListener("click", ()=>{
  hideModal("bannerOptionsModal");
  $("bannerFile")?.click();
});

$("chooseGradientBtn")?.addEventListener("click", ()=>{
  hideModal("bannerOptionsModal");
  showModal("bannerGradientModal");
});

document.querySelectorAll(".banner-gradient-item").forEach(item => {
  item.addEventListener("click", async () => {
    const gradient = item.dataset.gradient;
    if(!gradient || !currentUser) return;

    try{
      await updateDoc(doc(db, "profiles", currentUser.uid), {
        bannerType: "gradient",
        bannerGradient: gradient,
        bannerURL: "",
        updatedAt: serverTimestamp()
      });

      currentProfile.bannerType = "gradient";
      currentProfile.bannerGradient = gradient;
      currentProfile.bannerURL = "";

      applyBanner(currentProfile);

      document.querySelectorAll(".banner-gradient-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");

      hideModal("bannerGradientModal");
      toast("✅ Banner updated");
    }catch(e){
      console.error(e);
      toast("Failed to update banner");
    }
  });
});

$("bannerFile")?.addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file || !currentUser) return;

  try{
    toast("Uploading banner...");
    const url = await uploadToCloudinary(file, (pct)=>{
      if(pct % 25 === 0) toast("Banner " + pct + "%");
    });

    await updateDoc(doc(db, "profiles", currentUser.uid), {
      bannerType: "image",
      bannerURL: url,
      bannerGradient: "",
      updatedAt: serverTimestamp()
    });

    currentProfile.bannerType = "image";
    currentProfile.bannerURL = url;
    currentProfile.bannerGradient = "";

    applyBanner(currentProfile);
    toast("✅ Banner updated");
  }catch(e){
    console.error(e);
    toast("Failed to upload banner");
  }finally{
    e.target.value = "";
  }
});

/* PRIVATE ACCOUNT */
async function canViewUser(uid){
  if(!uid) return false;
  if(uid === currentUser?.uid) return true;
  const profile = await getProfile(uid);
  if(!profile.private) return true;
  if(myFollowsCache.has(uid)) return true;
  return false;
}

async function canViewUserVideos(uid){
  return await canViewUser(uid);
}

async function sendFollowRequest(targetUid){
  if(!currentUser || targetUid === currentUser.uid) return;
  const reqId = currentUser.uid + "_" + targetUid;
  const ref = doc(db, "follow_requests", reqId);
  try{
    await setDoc(ref, {
      from: currentUser.uid,
      fromName: currentProfile?.name || "User",
      fromPhoto: currentProfile?.photo || "",
      to: targetUid,
      status: "pending",
      createdAt: serverTimestamp()
    });
    mySentRequestsCache.add(targetUid);
    await addDoc(collection(db, "notifications"), {
      to: targetUid,
      from: currentUser.uid,
      title: "🔒 Follow Request",
      message: (currentProfile?.name || "Someone") + " wants to follow you",
      createdAt: serverTimestamp()
    });
    toast("✅ Follow request sent");
  }catch(e){
    console.error(e);
    toast("Request failed");
  }
}

async function cancelFollowRequest(targetUid){
  if(!currentUser) return;
  const reqId = currentUser.uid + "_" + targetUid;
  try{
    await deleteDoc(doc(db, "follow_requests", reqId));
    mySentRequestsCache.delete(targetUid);
    toast("Request cancelled");
  }catch(e){ console.error(e); }
}

async function acceptFollowRequest(fromUid){
  if(!currentUser) return;
  const reqId = fromUid + "_" + currentUser.uid;
  try{
    const followId = fromUid + "_" + currentUser.uid;
    await setDoc(doc(db, "follows", followId), {
      follower: fromUid,
      following: currentUser.uid,
      createdAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "follow_requests", reqId));
    await syncFollowCounts(fromUid);
    await syncFollowCounts(currentUser.uid);
    await addDoc(collection(db, "notifications"), {
      to: fromUid,
      from: currentUser.uid,
      title: "✅ Request Accepted",
      message: (currentProfile?.name || "User") + " accepted your follow request",
      createdAt: serverTimestamp()
    });
    toast("✅ Request accepted");
    renderFollowRequests();
  }catch(e){
    console.error(e);
    toast("Failed to accept");
  }
}

async function rejectFollowRequest(fromUid){
  if(!currentUser) return;
  const reqId = fromUid + "_" + currentUser.uid;
  try{
    await deleteDoc(doc(db, "follow_requests", reqId));
    toast("Request rejected");
    renderFollowRequests();
  }catch(e){
    console.error(e);
    toast("Failed to reject");
  }
}

function startFollowRequestsListener(){
  if(followRequestsUnsubscribe){
    followRequestsUnsubscribe();
    followRequestsUnsubscribe = null;
  }
  if(!currentUser) return;

  followRequestsUnsubscribe = onSnapshot(
    query(collection(db, "follow_requests"), where("to", "==", currentUser.uid)),
    snapshot=>{
      myFollowRequestsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const badge = $("followRequestsBadge");
      if(badge){
        if(myFollowRequestsCache.length > 0){
          badge.textContent = myFollowRequestsCache.length;
          badge.style.display = "inline";
        }else{
          badge.style.display = "none";
        }
      }
      if($("followRequestsModal")?.classList.contains("show")){
        renderFollowRequests();
      }
    }
  );
}

async function renderFollowRequests(){
  const container = $("followRequestsList");
  if(!container) return;

  if(!myFollowRequestsCache.length){
    container.innerHTML = `<div class="yt-empty" style="padding:40px 20px">
      <div style="font-size:48px;margin-bottom:12px">📬</div>
      <h3 style="font-size:16px;margin-bottom:6px">No requests</h3>
      <p style="font-size:13px">Follow requests will appear here</p>
    </div>`;
    return;
  }

  const reqs = [];
  for(const req of myFollowRequestsCache){
    const p = await getProfile(req.from);
    reqs.push({
      uid: req.from,
      name: p.name || req.fromName || "User",
      username: p.username || "",
      photo: p.photo || req.fromPhoto || ""
    });
  }

  container.innerHTML = reqs.map(r=>`
    <div class="person-item">
      <img src="${avatar(r.photo, r.name)}" class="people-open-btn" data-uid="${esc(r.uid)}">
      <div class="info people-open-btn" data-uid="${esc(r.uid)}">
        <strong>${esc(r.name)}</strong>
        <small>@${esc(r.username)}</small>
      </div>
      <button class="follow-btn" data-accept-request="${esc(r.uid)}" style="background:#22c55e">
        Accept
      </button>
      <button class="follow-btn following" data-reject-request="${esc(r.uid)}">
        Reject
      </button>
    </div>
  `).join("");
}

$("privateAccountBtn")?.addEventListener("click", async()=>{
  if(!currentUser || !currentProfile) return;
  const newValue = !currentProfile.private;
  if(newValue && !confirm("Make account private?\n\nOnly followers will see your videos.")) return;
  if(!newValue && !confirm("Make account public?\n\nEveryone will see your videos.")) return;
  try{
    await updateDoc(doc(db, "profiles", currentUser.uid), { private: newValue });
    currentProfile.private = newValue;
    updatePrivateToggleUI();
    toast(newValue ? "🔒 Account is now private" : "🌍 Account is now public");
  }catch(e){
    console.error(e);
    toast("Failed to update");
  }
});

$("followRequestsBtn")?.addEventListener("click", ()=>{
  hideModal("settingsModal");
  showModal("followRequestsModal");
  renderFollowRequests();
});

/* VIDEOS */
function startRealtimeVideos(){
  if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }

  videosUnsubscribe = onSnapshot(collection(db,"videos"), snapshot=>{
    videosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    videosCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));

    renderFeed();
    renderShorts();
    loadMyVideos();

    if(mySavesCache.size > 0){
      renderSavedVideos();
      updateProfileTabCounts();
    }

    if($("publicProfileModal").classList.contains("show")){
      const uid = $("publicProfileModal").dataset.uid;
      if(uid) loadPublicVideos(uid);
    }
  });
}

function renderFeed(){
  const feed = $("feed");
  if(!feed) return;

  const list = videosCache.filter(v =>
    v.type !== "short" &&
    (v.visibility !== "private" || v.userId === currentUser?.uid) &&
    !isVaultItem("video", v.id)
  );

  if(!list.length){
    feed.innerHTML = `<div class="yt-empty">
      <div style="font-size:56px;margin-bottom:14px">📹</div>
      <h3 style="font-size:17px;margin-bottom:6px">No videos yet</h3>
      <p>Follow people or upload your first video</p>
    </div>`;
    return;
  }

  feed.innerHTML = list.map(v => createIGPost(v)).join("");
  list.forEach(v => updateLikeUI(v.id));
}

function createIGPost(v){
  const mine = currentUser && v.userId === currentUser.uid;
  const isFollowing = myFollowsCache.has(v.userId);
  const isSaved = mySavesCache.has(v.id);
  const views = Number(v.views || 0);

  return `
  <article class="ig-post" data-id="${esc(v.id)}">
    <div class="ig-post-head">
      <img class="ig-avatar post-open-user" data-uid="${esc(v.userId)}"
           src="${avatar(v.userPhoto, v.userName)}">
      <div class="ig-post-user post-open-user" data-uid="${esc(v.userId)}">
        <strong>${esc(v.username || v.userName || "User")}</strong>
        <small>${esc(v.title || "")}</small>
      </div>
      ${!mine && currentUser ? `
        <button class="follow-btn ${isFollowing?"following":""}"
                data-follow-uid="${esc(v.userId)}"
                data-action="follow"
                style="padding:6px 14px;font-size:12px;border-radius:8px">
          ${isFollowing ? "Following" : "Follow"}
        </button>
      ` : ""}
      ${mine ? `<button class="more-btn" data-edit-video="${esc(v.id)}">⋯</button>` : ""}
    </div>

    <div class="ig-media" style="position:relative">
      <video src="${esc(v.videoURL)}" controls preload="metadata"
             playsinline webkit-playsinline data-video-id="${esc(v.id)}"></video>
    </div>

    <div class="ig-actions">
      <button class="ig-action-btn like-btn" id="like-${esc(v.id)}"
              data-like-video="${esc(v.id)}">
        <span class="icon">🤍</span>
      </button>
      <button class="ig-action-btn" data-comment-video="${esc(v.id)}">
        <span class="icon">💬</span>
      </button>
      <button class="ig-action-btn" data-share-video="${esc(v.id)}">
        <span class="icon">📤</span>
      </button>
      <button class="ig-action-btn save-btn ${isSaved?"saved":""}"
              data-save-video="${esc(v.id)}">
        <span class="icon">${isSaved ? "🔖" : "📑"}</span>
      </button>
      <div class="spacer"></div>
      ${mine ? `<button class="ig-action-btn" data-delete-video="${esc(v.id)}" style="color:var(--danger)">
        <span class="icon">🗑️</span>
      </button>` : ""}
    </div>

    <div class="ig-likes" id="likes-${esc(v.id)}">${v.likes || 0} likes</div>
    <div class="ig-views">👁️ ${formatViews(views)}</div>

    ${v.description ? `<div class="ig-caption">
      <strong>${esc(v.username || v.userName || "User")}</strong>${esc(v.description)}
    </div>` : ""}

    <div class="ig-time">${timeAgo(v.createdAt)}</div>
  </article>
  `;
}

async function updateLikeUI(videoId){
  if(!currentUser) return;
  try{
    const likeRef = doc(db,"videos",videoId,"likes",currentUser.uid);
    const snap = await getDoc(likeRef);
    const btn = $("like-" + videoId);
    if(!btn) return;

    if(snap.exists()){
      btn.classList.add("liked");
      btn.querySelector(".icon").textContent = "❤️";
    }else{
      btn.classList.remove("liked");
      btn.querySelector(".icon").textContent = "🤍";
    }
  }catch(e){ console.error(e); }
}

function renderShorts(){
  const container = $("reelsContainer");
  if(!container) return;

  const list = videosCache.filter(v =>
    v.type === "short" &&
    (v.visibility !== "private" || v.userId === currentUser?.uid) &&
    !isVaultItem("video", v.id)
  );

  if(!list.length){
    container.innerHTML = `<div class="reel-empty">
      <div style="font-size:56px;margin-bottom:14px">🎞️</div>
      <h3 style="font-size:17px;margin-bottom:6px">No Shorts yet</h3>
      <p>Upload your first Short to see it here</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(v => createReel(v)).join("");
  list.forEach(v => updateReelLikeUI(v.id));
  setTimeout(setupReelsObserver, 100);
}

function createReel(v){
  const isFollowing = myFollowsCache.has(v.userId);
  const mine = currentUser && v.userId === currentUser.uid;
  const isSaved = mySavesCache.has(v.id);
  const views = Number(v.views || 0);

  return `
  <div class="reel-item" data-id="${esc(v.id)}">
    <video src="${esc(v.videoURL)}" loop playsinline webkit-playsinline
           preload="metadata" muted data-video-id="${esc(v.id)}"></video>

    <div class="reel-overlay">
      <div class="reel-info">
        <div class="reel-user">
          <img class="post-open-user" data-uid="${esc(v.userId)}"
               src="${avatar(v.userPhoto, v.userName)}">
          <strong>@${esc(v.username || v.userName)}</strong>
          ${!mine ? `<button class="follow-btn-sm"
            data-follow-uid="${esc(v.userId)}"
            data-action="follow">
            ${isFollowing ? "Following" : "Follow"}
          </button>` : ""}
        </div>
        ${v.title ? `<div class="reel-title">${esc(v.title)}</div>` : ""}
        ${v.description ? `<div class="reel-desc">${esc(v.description)}</div>` : ""}
      </div>
    </div>

    <div class="reel-views">👁️ ${formatViewsShort(views)}</div>

    <div class="reel-actions">
      <div class="reel-action like-btn" id="reel-like-${esc(v.id)}"
           data-like-video="${esc(v.id)}" data-reel="true">
        <span class="icon">🤍</span>
        <small class="like-count">${v.likes || 0}</small>
      </div>
      <div class="reel-action" data-comment-video="${esc(v.id)}">
        <span class="icon">💬</span>
        <small>Comment</small>
      </div>
      <div class="reel-action" data-share-video="${esc(v.id)}">
        <span class="icon">📤</span>
        <small>Share</small>
      </div>
      <div class="reel-action save-btn ${isSaved?"saved":""}" data-save-video="${esc(v.id)}">
        <span class="icon">${isSaved ? "🔖" : "📑"}</span>
        <small>Save</small>
      </div>
      ${mine ? `<div class="reel-action" data-delete-video="${esc(v.id)}">
        <span class="icon">🗑️</span>
        <small>Delete</small>
      </div>` : ""}
    </div>
  </div>
  `;
}

async function updateReelLikeUI(videoId){
  if(!currentUser) return;
  try{
    const likeRef = doc(db,"videos",videoId,"likes",currentUser.uid);
    const snap = await getDoc(likeRef);
    const btn = $("reel-like-" + videoId);
    if(!btn) return;

    if(snap.exists()){
      btn.classList.add("liked");
      btn.querySelector(".icon").textContent = "❤️";
    }else{
      btn.classList.remove("liked");
      btn.querySelector(".icon").textContent = "🤍";
    }
  }catch(e){ console.error(e); }
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
      if(entry.isIntersecting){
        vid.play().catch(()=>{});
      }else{
        vid.pause();
      }
    });
  }, { threshold: 0.6, root: container });

  videos.forEach(v => reelObserver.observe(v));
}

/* GLOBAL CLICK HANDLER */
document.addEventListener("click", async (e)=>{
  const t = e.target;

  const acceptReq = t.closest("[data-accept-request]");
  if(acceptReq){
    e.preventDefault();
    e.stopPropagation();
    const uid = acceptReq.dataset.acceptRequest;
    if(uid) await acceptFollowRequest(uid);
    return;
  }

  const rejectReq = t.closest("[data-reject-request]");
  if(rejectReq){
    e.preventDefault();
    e.stopPropagation();
    const uid = rejectReq.dataset.rejectRequest;
    if(uid) await rejectFollowRequest(uid);
    return;
  }

  const openUser = t.closest(".post-open-user");
  if(openUser){
    e.preventDefault();
    e.stopPropagation();
    const uid = openUser.dataset.uid;
    if(uid) openPublicProfile(uid);
    return;
  }

  const followBtn = t.closest('[data-action="follow"]');
  if(followBtn){
    e.preventDefault();
    e.stopPropagation();
    const uid = followBtn.dataset.followUid;
    if(uid) toggleFollow(uid, followBtn);
    return;
  }

  const likeBtn = t.closest("[data-like-video]");
  if(likeBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = likeBtn.dataset.likeVideo;
    const isReel = likeBtn.dataset.reel === "true";
    if(vid) toggleLike(vid, likeBtn, isReel);
    return;
  }

  const commentBtn = t.closest("[data-comment-video]");
  if(commentBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = commentBtn.dataset.commentVideo;
    if(vid) openComments(vid);
    return;
  }

  const shareBtn = t.closest("[data-share-video]");
  if(shareBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = shareBtn.dataset.shareVideo;
    if(vid) openShareSheet(vid);
    return;
  }

  const saveBtn = t.closest("[data-save-video]");
  if(saveBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = saveBtn.dataset.saveVideo;
    if(vid) toggleSave(vid, saveBtn);
    return;
  }

  const deleteBtn = t.closest("[data-delete-video]");
  if(deleteBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = deleteBtn.dataset.deleteVideo;
    if(vid) deleteVideo(vid);
    return;
  }

  const editBtn = t.closest("[data-edit-video]");
  if(editBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = editBtn.dataset.editVideo;
    if(vid) openEditVideo(vid);
    return;
  }

  const searchOpen = t.closest(".search-open-btn");
  if(searchOpen){
    e.preventDefault();
    e.stopPropagation();
    const uid = searchOpen.dataset.uid;
    if(uid){
      hideModal("searchModal");
      setTimeout(()=> openPublicProfile(uid), 150);
    }
    return;
  }

  const peopleOpen = t.closest(".people-open-btn");
  if(peopleOpen){
    e.preventDefault();
    e.stopPropagation();
    const uid = peopleOpen.dataset.uid;
    if(uid){
      hideModal("peopleModal");
      hideModal("followRequestsModal");
      setTimeout(()=> openPublicProfile(uid), 150);
    }
    return;
  }

  const editC = t.closest("[data-edit-comment]");
  if(editC){
    e.preventDefault();
    e.stopPropagation();
    const [vid, cid] = editC.dataset.editComment.split("|");
    const parent = editC.closest(".comment-item");
    const textEl = parent?.querySelector(".text");
    const oldText = textEl?.textContent || "";
    if(vid && cid) await editComment(vid, cid, oldText);
    return;
  }

  const delC = t.closest("[data-delete-comment]");
  if(delC){
    e.preventDefault();
    e.stopPropagation();
    const [vid, cid] = delC.dataset.deleteComment.split("|");
    if(vid && cid) await deleteComment(vid, cid);
    return;
  }

  const chatItem = t.closest("[data-open-chat]");
  if(chatItem){
    e.preventDefault();
    e.stopPropagation();
    const uid = chatItem.dataset.openChat;
    if(uid) openChat(uid);
    return;
  }

  const editM = t.closest("[data-edit-msg]");
  if(editM){
    e.preventDefault();
    e.stopPropagation();
    await editMessage(editM.dataset.editMsg, editM.dataset.oldText || "");
    return;
  }

  const delM = t.closest("[data-delete-msg]");
  if(delM){
    e.preventDefault();
    e.stopPropagation();
    await deleteMessage(delM.dataset.deleteMsg);
    return;
  }

  const sharedVid = t.closest("[data-open-shared]");
  if(sharedVid){
    e.preventDefault();
    e.stopPropagation();
    const vid = sharedVid.dataset.openShared;
    if(vid) openVideoPlayer(vid);
    return;
  }

  const chatImage = t.closest("[data-open-image]");
  if(chatImage){
    e.preventDefault();
    e.stopPropagation();
    const url = chatImage.dataset.openImage;
    if(url){
      const imgEl = $("largeChatImage");
      if(imgEl) imgEl.src = url;
      showModal("imageViewerModal");
    }
    return;
  }

  const chatVideo = t.closest("[data-open-chat-video]");
  if(chatVideo){
    e.preventDefault();
    e.stopPropagation();
    const url = chatVideo.dataset.openChatVideo;
    if(url) window.open(url, "_blank");
    return;
  }

  const openP = t.closest("[data-open-playlist]");
  if(openP){
    e.preventDefault();
    e.stopPropagation();
    const pid = openP.dataset.openPlaylist;
    if(pid) await openPlaylistDetail(pid);
    return;
  }

  const delP = t.closest("[data-delete-playlist]");
  if(delP){
    e.preventDefault();
    e.stopPropagation();
    const pid = delP.dataset.deletePlaylist;
    if(pid && confirm("Delete this playlist?")){
      try{
        const items = await getDocs(collection(db, "playlists", pid, "items"));
        for(const item of items.docs) await deleteDoc(item.ref);
        await deleteDoc(doc(db, "playlists", pid));
        toast("🗑️ Playlist deleted");
        if(currentPlaylistView === pid){
          hideModal("playlistDetailModal");
          currentPlaylistView = null;
        }
      }catch(err){ toast("Delete failed"); }
    }
    return;
  }

  const toggleP = t.closest("[data-toggle-playlist]");
  if(toggleP){
    e.preventDefault();
    e.stopPropagation();
    const pid = toggleP.dataset.togglePlaylist;
    if(selectedPlaylists.has(pid)){
      selectedPlaylists.delete(pid);
      toggleP.classList.remove("checked");
      const check = toggleP.querySelector(".playlist-select-check");
      if(check) check.textContent = "";
    }else{
      selectedPlaylists.add(pid);
      toggleP.classList.add("checked");
      const check = toggleP.querySelector(".playlist-select-check");
      if(check) check.textContent = "✓";
    }
    return;
  }

  const rmFromP = t.closest("[data-remove-from-playlist]");
  if(rmFromP){
    e.preventDefault();
    e.stopPropagation();
    const [vid, pid] = rmFromP.dataset.removeFromPlaylist.split("|");
    if(vid && pid){
      try{
        await deleteDoc(doc(db, "playlists", pid, "items", pid + "_" + vid));
        await syncAllPlaylistCounts();
        toast("Removed from playlist");
        if(currentPlaylistView === pid) await renderPlaylistDetail(pid);
      }catch(err){ toast("Failed to remove"); }
    }
    return;
  }

  const openPV = t.closest("[data-playlist-video]");
  if(openPV){
    e.preventDefault();
    e.stopPropagation();
    const vid = openPV.dataset.playlistVideo;
    if(vid){
      hideModal("playlistDetailModal");
      setTimeout(()=> openVideoPlayer(vid), 200);
    }
    return;
  }

  const openVideoBtn = t.closest("[data-open-video]");
  if(openVideoBtn){
    const insideStop = t.closest("[data-stop-propagation]");
    if(!insideStop){
      e.preventDefault();
      e.stopPropagation();
      const vid = openVideoBtn.dataset.openVideo;
      if(vid){
        hideModal("playlistDetailModal");
        hideModal("publicProfileModal");
        setTimeout(()=> openVideoPlayer(vid), 100);
      }
    }
    return;
  }

  const chip = t.closest("[data-share-user]");
  if(chip){
    e.preventDefault();
    e.stopPropagation();
    shareToUser(chip.dataset.shareUser);
    return;
  }
});

/* VIEW COUNT */
async function trackView(videoId){
  if(!currentUser || !videoId) return;

  try{
    const viewRef = doc(db, "videos", videoId, "views", currentUser.uid);
    const snap = await getDoc(viewRef);

    if(!snap.exists()){
      await setDoc(viewRef, {
        userId: currentUser.uid,
        viewedAt: serverTimestamp()
      });

      const videoRef = doc(db, "videos", videoId);
      const videoSnap = await getDoc(videoRef);
      if(videoSnap.exists()){
        const currentViews = Number(videoSnap.data().views || 0);
        await updateDoc(videoRef, { views: currentViews + 1 });
      }
    }
  }catch(e){ console.error("trackView:", e); }
}

document.addEventListener("play", (e)=>{
  if(e.target.tagName === "VIDEO"){
    const vid = e.target.dataset.videoId;
    if(vid) trackView(vid);
  }
}, true);

/* LIKE */
async function toggleLike(videoId, btnEl, isReel=false){
  if(!currentUser){ toast("Login required"); return; }

  try{
    const likeRef = doc(db,"videos",videoId,"likes",currentUser.uid);
    const videoRef = doc(db,"videos",videoId);

    const [likeSnap, videoSnap] = await Promise.all([
      getDoc(likeRef),
      getDoc(videoRef)
    ]);

    if(!videoSnap.exists()) return;

    const currentLikes = Number(videoSnap.data().likes || 0);
    const ownerId = videoSnap.data().userId;

    if(likeSnap.exists()){
      await deleteDoc(likeRef);
      await updateDoc(videoRef, { likes: Math.max(0, currentLikes - 1) });

      if(btnEl){
        btnEl.classList.remove("liked");
        const icon = btnEl.querySelector(".icon");
        if(icon) icon.textContent = "🤍";
        const count = btnEl.querySelector(".like-count");
        if(count) count.textContent = Math.max(0, currentLikes - 1);
      }
      const likesEl = $("likes-" + videoId);
      if(likesEl) likesEl.textContent = Math.max(0, currentLikes - 1) + " likes";
    }else{
      await setDoc(likeRef, {
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      await updateDoc(videoRef, { likes: currentLikes + 1 });

      if(btnEl){
        btnEl.classList.add("liked");
        const icon = btnEl.querySelector(".icon");
        if(icon) icon.textContent = "❤️";
        const count = btnEl.querySelector(".like-count");
        if(count) count.textContent = currentLikes + 1;
      }
      const likesEl = $("likes-" + videoId);
      if(likesEl) likesEl.textContent = (currentLikes + 1) + " likes";

      if(ownerId !== currentUser.uid){
        await addDoc(collection(db,"notifications"), {
          to: ownerId,
          from: currentUser.uid,
          title: "❤️ New Like",
          message: (currentProfile?.name || "Someone") + " liked your video",
          createdAt: serverTimestamp()
        });
      }
    }
  }catch(e){
    console.error(e);
    toast("Like error");
  }
}

/* SAVE */
async function toggleSave(videoId, btnEl){
  if(!currentUser){ toast("Login required"); return; }
  if(!videoId) return;

  const saveId = currentUser.uid + "_" + videoId;
  const saveRef = doc(db, "saves", saveId);

  if(btnEl){ btnEl.disabled = true; btnEl.style.opacity = "0.6"; }

  try{
    const snap = await getDoc(saveRef);

    if(snap.exists()){
      await deleteDoc(saveRef);
      mySavesCache.delete(videoId);
      updateAllSaveButtons(videoId, false);
      toast("Removed from saved");
    }else{
      await setDoc(saveRef, {
        userId: currentUser.uid,
        videoId: videoId,
        savedAt: serverTimestamp()
      });
      mySavesCache.add(videoId);
      updateAllSaveButtons(videoId, true);
      toast("✅ Saved");
    }

    updateProfileTabCounts();
    renderSavedVideos();
  }catch(e){
    console.error(e);
    toast("Save failed");
  }finally{
    if(btnEl){ btnEl.disabled = false; btnEl.style.opacity = "1"; }
  }
}

function updateAllSaveButtons(videoId, isSaved){
  document.querySelectorAll(`[data-save-video="${videoId}"]`).forEach(btn=>{
    btn.classList.toggle("saved", isSaved);
    const icon = btn.querySelector(".icon");
    if(icon) icon.textContent = isSaved ? "🔖" : "📑";
  });
}

/* PROFILE TABS */
function updateProfileTabCounts(){
  const vc = $("tabVideosCount");
  const sc = $("tabSavedCount");
  const pc = $("tabPlaylistsCount");
  if(vc) vc.textContent = videosCache.filter(v => 
    v.userId === currentUser?.uid && !isVaultItem("video", v.id)
  ).length;
  if(sc) sc.textContent = mySavesCache.size;
  if(pc) pc.textContent = myPlaylistsCache.length;
}

document.querySelectorAll("#profileTabs .yt-tab").forEach(tab=>{
  tab.addEventListener("click", ()=>{
    const tabName = tab.dataset.tab;
    if(!tabName) return;

    document.querySelectorAll("#profileTabs .yt-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentProfileTab = tabName;

    $("myVideos")?.classList.add("hidden");
    $("playlistsTab")?.classList.add("hidden");
    $("savedVideos")?.classList.add("hidden");
    $("aboutTab")?.classList.add("hidden");

    if(tabName === "videos"){
      $("myVideos")?.classList.remove("hidden");
    }else if(tabName === "saved"){
      $("savedVideos")?.classList.remove("hidden");
      renderSavedVideos();
    }else if(tabName === "playlists"){
      $("playlistsTab")?.classList.remove("hidden");
      renderPlaylistsTab();
    }else if(tabName === "about"){
      $("aboutTab")?.classList.remove("hidden");
      renderAboutTab();
    }
  });
});

function renderAboutTab(){
  const container = $("aboutTab");
  if(!container || !currentProfile) return;

  let rows = [];
  rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;color:var(--muted)">Name</div>
    <div style="font-size:14px;font-weight:500;margin-top:2px">${esc(currentProfile.name || "User")}</div>
  </div>`);
  rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;color:var(--muted)">Username</div>
    <div style="font-size:14px;font-weight:500;margin-top:2px">@${esc(currentProfile.username || "user")}</div>
  </div>`);
  if(currentProfile.age) rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;color:var(--muted)">Age</div>
    <div style="font-size:14px;font-weight:500;margin-top:2px">${esc(currentProfile.age)}</div>
  </div>`);
  if(currentProfile.gender) rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;color:var(--muted)">Gender</div>
    <div style="font-size:14px;font-weight:500;margin-top:2px">${esc(currentProfile.gender)}</div>
  </div>`);
  if(currentProfile.bio) rows.push(`<div style="padding:12px 16px">
    <div style="font-size:12px;color:var(--muted)">Bio</div>
    <div style="font-size:14px;margin-top:2px;line-height:1.5">${esc(currentProfile.bio)}</div>
  </div>`);

  container.innerHTML = rows.join("");
}

function renderSavedVideos(){
  const container = $("savedVideos");
  if(!container) return;

  if(!mySavesCache.size){
    container.innerHTML = `<div class="saved-empty">
      <span class="icon">📑</span>
      <h3>No saved videos</h3>
      <p>Videos you save will appear here</p>
    </div>`;
    return;
  }

  const savedList = videosCache.filter(v => mySavesCache.has(v.id));

  if(!savedList.length){
    container.innerHTML = `<div class="saved-empty">
      <span class="icon">📑</span>
      <h3>No saved videos</h3>
      <p>Videos you save will appear here</p>
    </div>`;
    return;
  }

  container.innerHTML = savedList.map(v => createYTVideoItem(v, v.userId === currentUser?.uid)).join("");
}

/* PLAYLIST */
async function loadMyPlaylists(){
  if(!currentUser) return;
  try{
    const q = query(collection(db, "playlists"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    myPlaylistsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    myPlaylistsCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
    updateProfileTabCounts();
    renderPlaylistsTab();
  }catch(e){ console.error("loadMyPlaylists:", e); }
}

function startPlaylistsListener(){
  if(playlistsUnsubscribe){ playlistsUnsubscribe(); playlistsUnsubscribe = null; }
  if(!currentUser) return;

  playlistsUnsubscribe = onSnapshot(
    query(collection(db,"playlists"), where("userId","==",currentUser.uid)),
    snapshot=>{
      myPlaylistsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      myPlaylistsCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
      updateProfileTabCounts();
      renderPlaylistsTab();
      if(currentPlaylistView) renderPlaylistDetail(currentPlaylistView);
    }
  );
}

function renderPlaylistsTab(){
  const container = $("playlistsTab");
  if(!container) return;

  if(!myPlaylistsCache.length){
    container.innerHTML = `<div class="playlist-empty">
      <span class="icon">🎵</span>
      <h3>No playlists yet</h3>
      <p>Organize your favorite videos into playlists</p>
      <button class="playlist-create-btn" id="createFirstPlaylistBtn">
        ➕ Create Playlist
      </button>
    </div>`;

    const btn = $("createFirstPlaylistBtn");
    if(btn){
      btn.addEventListener("click", ()=>{
        $("playlistName").value = "";
        $("playlistDesc").value = "";
        showModal("createPlaylistModal");
      });
    }
    return;
  }

  container.innerHTML = `
    <button class="playlist-create-btn" id="createNewPlaylistBtn" style="margin-bottom:14px">
      ➕ New Playlist
    </button>
    ${myPlaylistsCache.map(p => {
      const count = p.videoCount || 0;
      const firstVideo = p.coverVideoURL || "";
      return `
      <div class="playlist-card" data-open-playlist="${esc(p.id)}">
        <div class="playlist-cover">
          ${firstVideo 
            ? `<video src="${esc(firstVideo)}" preload="metadata" muted></video>
               <span class="cover-icon">▶️</span>`
            : `<span class="cover-icon">🎵</span>`}
        </div>
        <div class="playlist-info">
          <h4>${esc(p.name || "Untitled")}</h4>
          <div class="meta">${count} ${count === 1 ? "video" : "videos"}</div>
          ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ""}
        </div>
        <div class="playlist-actions">
          <button class="playlist-delete-btn" data-delete-playlist="${esc(p.id)}">Delete</button>
        </div>
      </div>
      `;
    }).join("")}
  `;

  const newBtn = $("createNewPlaylistBtn");
  if(newBtn){
    newBtn.addEventListener("click", ()=>{
      $("playlistName").value = "";
      $("playlistDesc").value = "";
      showModal("createPlaylistModal");
    });
  }
}

async function openPlaylistDetail(playlistId){
  const playlist = myPlaylistsCache.find(p => p.id === playlistId);
  if(!playlist) return;

  currentPlaylistView = playlistId;
  $("playlistDetailTitle").textContent = playlist.name || "Playlist";

  showModal("playlistDetailModal");
  await renderPlaylistDetail(playlistId);
}

async function renderPlaylistDetail(playlistId){
  const playlist = myPlaylistsCache.find(p => p.id === playlistId);
  if(!playlist) return;

  const container = $("playlistDetailContent");
  container.innerHTML = `<div class="yt-empty" style="padding:30px">Loading...</div>`;

  try{
    const itemsSnap = await getDocs(collection(db, "playlists", playlistId, "items"));
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a,b)=> timeValue(b.addedAt) - timeValue(a.addedAt));

    const videoIds = items.map(i => i.videoId);
    const videos = videosCache.filter(v => videoIds.includes(v.id));
    const firstVideo = videos[0];

    container.innerHTML = `
      <div class="playlist-detail-header">
        <div class="playlist-detail-cover">
          ${firstVideo 
            ? `<video src="${esc(firstVideo.videoURL)}" preload="metadata" muted></video>`
            : `🎵`}
        </div>
        <div class="playlist-detail-info">
          <h3>${esc(playlist.name)}</h3>
          <div class="meta">${videos.length} ${videos.length === 1 ? "video" : "videos"}</div>
          ${playlist.description ? `<div class="desc">${esc(playlist.description)}</div>` : ""}
        </div>
      </div>

      ${videos.length === 0 
        ? `<div class="playlist-empty" style="padding:30px">
            <span class="icon">📭</span>
            <p>No videos in this playlist</p>
           </div>`
        : videos.map(v => `
            <div class="playlist-video-item" data-playlist-video="${esc(v.id)}">
              <div class="thumb">
                <video src="${esc(v.videoURL)}" preload="metadata" muted></video>
              </div>
              <div class="info">
                <h4>${esc(v.title || "Untitled")}</h4>
                <div class="stats">${formatViews(v.views)} · ${timeAgo(v.createdAt)}</div>
              </div>
              <button class="remove-btn" data-remove-from-playlist="${esc(v.id)}|${esc(playlistId)}">
                Remove
              </button>
            </div>
          `).join("")}
    `;
  }catch(e){
    console.error("renderPlaylistDetail:", e);
    container.innerHTML = `<div class="yt-empty" style="padding:30px">Error loading playlist</div>`;
  }
}

$("createPlaylistBtn")?.addEventListener("click", async()=>{
  if(!currentUser) return;
  const name = $("playlistName").value.trim();
  const description = $("playlistDesc").value.trim();
  if(!name){ toast("Playlist name डालो"); return; }

  try{
    $("createPlaylistBtn").disabled = true;
    await addDoc(collection(db, "playlists"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      name,
      description,
      videoCount: 0,
      coverVideoURL: "",
      createdAt: serverTimestamp()
    });
    hideModal("createPlaylistModal");
    toast("✅ Playlist created");
  }catch(e){
    console.error(e);
    toast("Failed to create playlist");
  }finally{
    $("createPlaylistBtn").disabled = false;
  }
});

async function openAddToPlaylist(videoId){
  currentPlaylistVideoId = videoId;
  selectedPlaylists = new Set();

  showModal("addToPlaylistModal");
  const container = $("playlistSelectList");
  container.innerHTML = `<div class="yt-empty" style="padding:20px">Loading...</div>`;

  if(!myPlaylistsCache.length){
    container.innerHTML = `<div class="playlist-empty" style="padding:20px">
      <p style="font-size:13px">No playlists yet. Create one!</p>
    </div>`;
    return;
  }

  for(const p of myPlaylistsCache){
    try{
      const itemId = p.id + "_" + videoId;
      const snap = await getDoc(doc(db, "playlists", p.id, "items", itemId));
      if(snap.exists()) selectedPlaylists.add(p.id);
    }catch(e){}
  }

  container.innerHTML = myPlaylistsCache.map(p => {
    const checked = selectedPlaylists.has(p.id);
    return `
    <div class="playlist-select-item ${checked ? "checked" : ""}" 
         data-toggle-playlist="${esc(p.id)}">
      <div class="playlist-select-check">${checked ? "✓" : ""}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${esc(p.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">
          ${p.videoCount || 0} videos
        </div>
      </div>
    </div>
    `;
  }).join("");
}

$("saveToPlaylistBtn")?.addEventListener("click", async()=>{
  if(!currentPlaylistVideoId) return;
  try{
    $("saveToPlaylistBtn").disabled = true;
    for(const p of myPlaylistsCache){
      const itemId = p.id + "_" + currentPlaylistVideoId;
      const itemRef = doc(db, "playlists", p.id, "items", itemId);
      const snap = await getDoc(itemRef);

      if(selectedPlaylists.has(p.id)){
        if(!snap.exists()){
          await setDoc(itemRef, {
            videoId: currentPlaylistVideoId,
            addedAt: serverTimestamp()
          });
        }
      }else{
        if(snap.exists()) await deleteDoc(itemRef);
      }
    }
    await syncAllPlaylistCounts();
    hideModal("addToPlaylistModal");
    toast("✅ Playlists updated");
  }catch(e){
    console.error(e);
    toast("Failed to update playlists");
  }finally{
    $("saveToPlaylistBtn").disabled = false;
  }
});

async function syncAllPlaylistCounts(){
  for(const p of myPlaylistsCache){
    try{
      const items = await getDocs(collection(db, "playlists", p.id, "items"));
      let coverVideoURL = "";
      if(items.size > 0){
        const firstItem = items.docs[0].data();
        const v = videosCache.find(x => x.id === firstItem.videoId);
        if(v) coverVideoURL = v.videoURL;
      }
      await updateDoc(doc(db, "playlists", p.id), {
        videoCount: items.size,
        coverVideoURL: coverVideoURL
      });
    }catch(e){}
  }
}

$("newPlaylistFromAddBtn")?.addEventListener("click", ()=>{
  hideModal("addToPlaylistModal");
  $("playlistName").value = "";
  $("playlistDesc").value = "";
  showModal("createPlaylistModal");
});

/* DEEP LINK */
function getVideoIdFromURL(){
  const params = new URLSearchParams(location.search);
  return params.get("video");
}

async function openVideoByDeepLink(videoId){
  if(!videoId) return;

  let attempts = 0;
  while(videosCache.length === 0 && attempts < 20){
    await new Promise(r => setTimeout(r, 300));
    attempts++;
  }

  const v = videosCache.find(x => x.id === videoId);
  if(!v){ toast("Video not found"); return; }

  if(v.visibility === "private" && v.userId !== currentUser?.uid){
    toast("This video is private");
    return;
  }

  const canView = await canViewUserVideos(v.userId);
  if(!canView){
    toast("This account is private");
    return;
  }

  await trackView(videoId);

  const banner = $("deepLinkBanner");
  if(banner){
    banner.classList.add("show");
    setTimeout(()=> banner.classList.remove("show"), 3000);
  }

  openVideoPlayer(videoId);
}

async function checkDeepLink(){
  if(deepLinkChecked) return;
  const vid = getVideoIdFromURL();
  if(!vid) return;
  deepLinkChecked = true;
  await openVideoByDeepLink(vid);
}

/* VIDEO PLAYER */
window.openVideoPlayer = function(videoId){
  const v = videosCache.find(x => x.id === videoId);
  if(!v){ toast("Video not found"); return; }

  if(v.visibility === "private" && v.userId !== currentUser?.uid){
    toast("This video is private");
    return;
  }

  trackView(videoId);

  const videoEl = $("videoPlayerVideo");
  if(videoEl){
    videoEl.src = v.videoURL;
    videoEl.play().catch(()=>{});
  }

  const titleEl = $("videoPlayerTitle");
  if(titleEl) titleEl.textContent = v.title || "Untitled";

  const metaEl = $("videoPlayerMeta");
  if(metaEl) metaEl.textContent = formatViews(v.views) + " · " + timeAgo(v.createdAt);

  const descEl = $("videoPlayerDesc");
  if(descEl){
    descEl.textContent = v.description || "";
    descEl.style.display = v.description ? "block" : "none";
  }

  const likesEl = $("videoPlayerLikes");
  if(likesEl) likesEl.textContent = (v.likes || 0) + " likes";

  updateVideoPlayerLike(videoId);

  const likeBtn = $("videoPlayerLikeBtn");
  if(likeBtn){
    likeBtn.onclick = (e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggleLike(videoId, likeBtn, false);
    };
  }

  const shareBtn = $("videoPlayerShareBtn");
  if(shareBtn){
    shareBtn.onclick = (e)=>{
      e.preventDefault();
      e.stopPropagation();
      openShareSheet(videoId);
    };
  }

  showModal("videoPlayerModal");
};

async function updateVideoPlayerLike(videoId){
  if(!currentUser) return;
  try{
    const likeRef = doc(db,"videos",videoId,"likes",currentUser.uid);
    const snap = await getDoc(likeRef);
    const btn = $("videoPlayerLikeBtn");
    if(!btn) return;

    if(snap.exists()){
      btn.classList.add("liked");
      btn.querySelector(".icon").textContent = "❤️";
    }else{
      btn.classList.remove("liked");
      btn.querySelector(".icon").textContent = "🤍";
    }
  }catch(e){ console.error(e); }
}

/* SHARE */
async function openShareSheet(videoId){
  shareVideoId = videoId;
  showModal("shareSheet");

  const list = $("shareUserList");
  list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px">Loading...</div>`;

  try{
    const chatUids = new Set();
    myChatsCache.forEach(c=>{
      const other = c.members.find(uid => uid !== currentUser.uid);
      if(other) chatUids.add(other);
    });

    const allUids = new Set([...myFollowsCache, ...chatUids]);

    if(!allUids.size){
      list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px">
        Follow users to share
      </div>`;
      return;
    }

    const chips = [];
    for(const uid of Array.from(allUids).slice(0, 20)){
      const p = await getProfile(uid);
      chips.push(`
        <div class="share-user-chip" data-share-user="${esc(uid)}">
          <img src="${avatar(p.photo, p.name)}">
          <span>${esc(p.name.split(" ")[0])}</span>
        </div>
      `);
    }
    list.innerHTML = chips.join("");
  }catch(e){
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px">Error</div>`;
  }
}

async function shareToUser(uid){
  if(!shareVideoId || !uid) return;
  const v = videosCache.find(x => x.id === shareVideoId);
  if(!v) return;

  const chatId = [currentUser.uid, uid].sort().join("_");

  try{
    await setDoc(doc(db,"chats",chatId), {
      members: [currentUser.uid, uid],
      updatedAt: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db,"chats",chatId,"messages"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      text: "",
      type: "shared_video",
      videoId: shareVideoId,
      videoURL: v.videoURL,
      videoTitle: v.title || "Video",
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db,"chats",chatId), {
      lastMessage: "📹 Shared a video",
      updatedAt: serverTimestamp()
    });

    hideModal("shareSheet");
    toast("✅ Video shared");
  }catch(e){
    console.error(e);
    toast("Share failed");
  }
}

$("shareCopyLink")?.addEventListener("click", async()=>{
  if(!shareVideoId) return;
  const url = location.origin + location.pathname + "?video=" + shareVideoId;
  try{
    await navigator.clipboard.writeText(url);
    toast("Link copied");
    hideModal("shareSheet");
  }catch(e){ toast("Copy failed"); }
});

$("shareNative")?.addEventListener("click", async()=>{
  if(!shareVideoId) return;
  const url = location.origin + location.pathname + "?video=" + shareVideoId;
  try{
    if(navigator.share){
      await navigator.share({
        title: "ReelHub Video",
        text: "Watch this video on ReelHub 🎬",
        url
      });
    }else{
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    }
    hideModal("shareSheet");
  }catch(e){}
});

/* COMMENTS */
function openComments(videoId){
  currentCommentVideoId = videoId;
  showModal("commentsModal");
  loadComments(videoId);
}

function loadComments(videoId){
  if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; }

  commentsUnsubscribe = onSnapshot(
    collection(db,"videos",videoId,"comments"),
    snapshot=>{
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));

      if(!list.length){
        $("commentsList").innerHTML = `<div class="yt-empty">
          <div style="font-size:42px;margin-bottom:10px">💬</div>
          <p>No comments yet</p>
        </div>`;
        return;
      }

      $("commentsList").innerHTML = list.map(c=>{
        const mine = currentUser && c.userId === currentUser.uid;
        return `
        <div class="comment-item">
          <img src="${avatar(c.userPhoto, c.userName)}">
          <div class="comment-content">
            <div class="name">${esc(c.userName || "User")}</div>
            <div class="text">${esc(c.text)}</div>
            <div class="actions">
              <span style="font-size:11px;color:var(--muted)">${timeAgo(c.createdAt)}</span>
              ${mine ? `
                <button data-edit-comment="${esc(videoId)}|${esc(c.id)}">Edit</button>
                <button data-delete-comment="${esc(videoId)}|${esc(c.id)}">Delete</button>
              ` : ""}
            </div>
          </div>
        </div>
        `;
      }).join("");
    }
  );
}

$("sendCommentBtn")?.addEventListener("click", sendComment);
$("commentInput")?.addEventListener("keydown", e=>{ if(e.key === "Enter") sendComment(); });

async function sendComment(){
  const text = $("commentInput").value.trim();
  if(!text || !currentCommentVideoId) return;

  try{
    await addDoc(collection(db,"videos",currentCommentVideoId,"comments"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "",
      text,
      createdAt: serverTimestamp()
    });

    const videoSnap = await getDoc(doc(db,"videos",currentCommentVideoId));
    if(videoSnap.exists()){
      const ownerId = videoSnap.data().userId;
      if(ownerId !== currentUser.uid){
        await addDoc(collection(db,"notifications"), {
          to: ownerId,
          from: currentUser.uid,
          title: "💬 New Comment",
          message: (currentProfile?.name || "Someone") + ": " + text.slice(0,50),
          createdAt: serverTimestamp()
        });
      }
    }
    $("commentInput").value = "";
  }catch(e){ toast("Comment failed"); }
}

async function editComment(videoId, commentId, oldText){
  const text = prompt("Edit comment:", oldText);
  if(text === null) return;
  const clean = text.trim();
  if(!clean) return;
  const ref = doc(db,"videos",videoId,"comments",commentId);
  const snap = await getDoc(ref);
  if(!snap.exists() || snap.data().userId !== currentUser.uid) return;
  await updateDoc(ref, { text: clean, updatedAt: serverTimestamp() });
}

async function deleteComment(videoId, commentId){
  const ref = doc(db,"videos",videoId,"comments",commentId);
  const snap = await getDoc(ref);
  if(!snap.exists() || snap.data().userId !== currentUser.uid) return;
  if(!confirm("Delete comment?")) return;
  await deleteDoc(ref);
}

/* DELETE / EDIT VIDEO */
async function deleteVideo(videoId){
  if(!currentUser) return;
  const ref = doc(db,"videos",videoId);
  const snap = await getDoc(ref);

  if(!snap.exists()){ toast("Not found"); return; }
  if(snap.data().userId !== currentUser.uid){ toast("Not your video"); return; }
  if(!confirm("Delete this video?")) return;

  try{
    const comments = await getDocs(collection(db,"videos",videoId,"comments"));
    for(const c of comments.docs) await deleteDoc(c.ref);

    const likes = await getDocs(collection(db,"videos",videoId,"likes"));
    for(const l of likes.docs) await deleteDoc(l.ref);

    const views = await getDocs(collection(db,"videos",videoId,"views"));
    for(const v of views.docs) await deleteDoc(v.ref);

    await deleteDoc(ref);
    await syncVideoCount(currentUser.uid);
    toast("🗑️ Video deleted");
  }catch(e){ console.error(e); toast("Delete failed"); }
}

async function openEditVideo(videoId){
  const snap = await getDoc(doc(db,"videos",videoId));
  if(!snap.exists()) return;
  const v = snap.data();
  if(v.userId !== currentUser.uid){ toast("Not yours"); return; }

  $("editVideoId").value = videoId;
  $("editVideoTitle").value = v.title || "";
  $("editVideoDescription").value = v.description || "";
  $("editVideoVisibility").value = v.visibility || "public";
  $("editVideoType").value = v.type || "long";
  showModal("editVideoModal");
}

$("saveVideoEditBtn")?.addEventListener("click", async()=>{
  const id = $("editVideoId").value;
  if(!id) return;
  try{
    const ref = doc(db,"videos",id);
    const snap = await getDoc(ref);
    if(!snap.exists() || snap.data().userId !== currentUser.uid) return;

    await updateDoc(ref, {
      title: $("editVideoTitle").value.trim(),
      description: $("editVideoDescription").value.trim(),
      visibility: $("editVideoVisibility").value,
      type: $("editVideoType").value,
      updatedAt: serverTimestamp()
    });
    hideModal("editVideoModal");
    toast("✅ Updated");
  }catch(e){ toast("Update failed"); }
});

/* VIDEO COUNT */
async function syncVideoCount(uid){
  try{
    const q = query(collection(db,"videos"), where("userId","==",uid));
    const snap = await getDocs(q);
    await updateDoc(doc(db,"profiles",uid), { videos: snap.size });

    if(currentProfile && currentProfile.uid === uid){
      currentProfile.videos = snap.size;
      $("videosCount").textContent = snap.size;
    }
  }catch(e){ console.error(e); }
}

/* FOLLOW */
async function toggleFollow(targetUid, btnEl){
  if(!currentUser || targetUid === currentUser.uid) return;

  if(btnEl){ btnEl.disabled = true; btnEl.style.opacity = "0.6"; }

  const id = currentUser.uid + "_" + targetUid;
  const ref = doc(db,"follows",id);

  try{
    const snap = await getDoc(ref);
    const targetProfile = await getProfile(targetUid);

    if(snap.exists()){
      await deleteDoc(ref);
      myFollowsCache.delete(targetUid);
      updateAllFollowButtons(targetUid, false);
      await syncFollowCounts(currentUser.uid);
      await syncFollowCounts(targetUid);
    }else{
      if(targetProfile.private){
        if(mySentRequestsCache.has(targetUid)){
          await cancelFollowRequest(targetUid);
          updateAllFollowButtons(targetUid, "cancelled");
        }else{
          await sendFollowRequest(targetUid);
          updateAllFollowButtons(targetUid, "requested");
        }
      }else{
        await setDoc(ref, {
          follower: currentUser.uid,
          following: targetUid,
          createdAt: serverTimestamp()
        });
        myFollowsCache.add(targetUid);
        updateAllFollowButtons(targetUid, true);

        await addDoc(collection(db,"notifications"), {
          to: targetUid,
          from: currentUser.uid,
          title: "👤 New Follower",
          message: (currentProfile?.name || "Someone") + " started following you",
          createdAt: serverTimestamp()
        });

        await syncFollowCounts(currentUser.uid);
        await syncFollowCounts(targetUid);
      }
    }

    if($("publicProfileModal").classList.contains("show")){
      const uid = $("publicProfileModal").dataset.uid;
      if(uid === targetUid){
        updateFollowButtonState(targetUid);
        await loadPublicVideos(targetUid);
      }
    }
  }catch(e){
    console.error(e);
    toast("Follow failed");
  }finally{
    if(btnEl){ btnEl.disabled = false; btnEl.style.opacity = "1"; }
  }
}

function updateAllFollowButtons(targetUid, state){
  document.querySelectorAll(`[data-follow-uid="${targetUid}"]`).forEach(btn=>{
    if(state === true){
      btn.textContent = "Following";
      btn.classList.add("following");
    }else if(state === false){
      btn.textContent = "Follow";
      btn.classList.remove("following");
    }else if(state === "requested"){
      btn.textContent = "Requested";
      btn.classList.remove("following");
    }else if(state === "cancelled"){
      btn.textContent = "Follow";
      btn.classList.remove("following");
    }
  });
}

async function updateFollowButtonState(targetUid){
  const followed = myFollowsCache.has(targetUid);
  const requested = mySentRequestsCache.has(targetUid);

  const btn = $("publicFollowBtn");
  if(!btn) return;

  if(followed){
    btn.textContent = "Following";
    btn.className = "yt-btn yt-btn-gray";
  }else if(requested){
    btn.textContent = "Requested";
    btn.className = "yt-btn yt-btn-gray";
  }else{
    btn.textContent = "Follow";
    btn.className = "yt-btn yt-btn-primary";
  }
}

async function syncFollowCounts(uid){
  try{
    const [followersSnap, followingSnap] = await Promise.all([
      getDocs(query(collection(db,"follows"), where("following","==",uid))),
      getDocs(query(collection(db,"follows"), where("follower","==",uid)))
    ]);

    await updateDoc(doc(db,"profiles",uid), {
      followers: followersSnap.size,
      following: followingSnap.size
    });

    if(currentProfile && currentProfile.uid === uid){
      currentProfile.followers = followersSnap.size;
      currentProfile.following = followingSnap.size;
      $("followersCount").textContent = followersSnap.size;
      $("followingCount").textContent = followingSnap.size;
    }
  }catch(e){ console.error(e); }
}

/* PUBLIC PROFILE */
async function openPublicProfile(uid){
  if(!uid){ toast("Invalid user"); return; }

  try{
    viewingProfileUid = uid;
    const p = await getProfile(uid);
    $("publicProfileModal").dataset.uid = uid;

    $("publicPhoto").src = avatar(p.photo, p.name);
    $("publicName").textContent = p.name || "User";
    $("publicUsername").textContent = "@" + (p.username || "user");

    let extra = [];
    if(p.age) extra.push("Age: " + p.age);
    if(p.gender) extra.push(p.gender);
    if(p.private) extra.push("🔒 Private");
    if(p.suspended) extra.push("🚫 Suspended");
    $("publicExtra").textContent = extra.join(" · ");

    $("publicFollowers").textContent = p.followers || 0;
    $("publicFollowing").textContent = p.following || 0;
    $("publicVideos").textContent = p.videos || 0;

    const publicBanner = document.querySelector("#publicProfileModal .yt-banner");
    if(publicBanner){
      if(p.bannerType === "image" && p.bannerURL){
        publicBanner.style.background = `url(${p.bannerURL}) center/cover no-repeat`;
      }else if(p.bannerGradient){
        publicBanner.style.background = p.bannerGradient;
      }
    }

    const followBtn = $("publicFollowBtn");
    const newFollowBtn = followBtn.cloneNode(true);
    followBtn.parentNode.replaceChild(newFollowBtn, followBtn);

    const msgBtn = $("publicMessageBtn");
    const newMsgBtn = msgBtn.cloneNode(true);
    msgBtn.parentNode.replaceChild(newMsgBtn, msgBtn);

    const canView = await canViewUser(uid);

    if(currentUser && uid === currentUser.uid){
      newFollowBtn.style.display = "none";
      newMsgBtn.style.display = "none";
      $("privateAccountNotice").classList.add("hidden");
    }else{
      newFollowBtn.style.display = "";
      newMsgBtn.style.display = "";

      await updateFollowButtonState(uid);

      newFollowBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        toggleFollow(uid, newFollowBtn);
      });

      newMsgBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        openChatFromProfile(uid);
      });

      if(!canView && p.private){
        $("privateAccountNotice").classList.remove("hidden");
      }else{
        $("privateAccountNotice").classList.add("hidden");
      }
    }

    await loadPublicVideos(uid);

    const fBtn = $("publicFollowersBtn");
    const newFBtn = fBtn.cloneNode(true);
    fBtn.parentNode.replaceChild(newFBtn, fBtn);
    newFBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      openPeople(uid, "followers");
    });

    const fwBtn = $("publicFollowingBtn");
    const newFwBtn = fwBtn.cloneNode(true);
    fwBtn.parentNode.replaceChild(newFwBtn, fwBtn);
    newFwBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      openPeople(uid, "following");
    });

    startPresenceListener([uid]);

    showModal("publicProfileModal");
  }catch(e){
    console.error("openPublicProfile:", e);
    toast("Error opening profile");
  }
}

async function loadPublicVideos(uid){
  const canView = await canViewUserVideos(uid);
  const container = $("publicVideosList");

  if(!canView){
    container.innerHTML = "";
    return;
  }

  const list = videosCache.filter(v =>
    v.userId === uid &&
    (v.visibility !== "private" || uid === currentUser?.uid) &&
    !isVaultItem("video", v.id)
  );

  if(!list.length){
    container.innerHTML = `<div class="yt-empty" style="padding:30px 0;font-size:13px">
      No videos yet
    </div>`;
    return;
  }

  container.innerHTML = list.map(v => createYTVideoItem(v, uid === currentUser?.uid)).join("");
}

function createYTVideoItem(v, isMine){
  const views = Number(v.views || 0);
  const isHidden = isVaultItem("video", v.id);
  return `
  <div class="yt-video-item" data-open-video="${esc(v.id)}">
    <div class="yt-video-thumb">
      <video src="${esc(v.videoURL)}" preload="metadata" muted></video>
      <div class="view-badge">👁️ ${formatViewsShort(views)}</div>
      ${isMine ? `<button class="vault-hide-btn" data-vault-toggle="${esc(v.id)}">${isHidden ? "🔓" : "🔒"}</button>` : ""}
    </div>
    <div class="yt-video-meta">
      <h4>${esc(v.title || "Untitled")}</h4>
      <div class="views">${formatViews(views)}</div>
      <div class="stats">${v.likes || 0} likes · ${timeAgo(v.createdAt)}</div>
      ${isMine ? `
        <div class="btns" data-stop-propagation>
          <button class="yt-mini-btn primary" data-edit-video="${esc(v.id)}">Edit</button>
          <button class="yt-mini-btn danger" data-delete-video="${esc(v.id)}">Delete</button>
        </div>
      ` : ""}
    </div>
  </div>
  `;
}

/* Vault toggle click handler */
document.addEventListener("click", async (e) => {
  const vaultBtn = e.target.closest("[data-vault-toggle]");
  if(vaultBtn){
    e.preventDefault();
    e.stopPropagation();
    const vid = vaultBtn.dataset.vaultToggle;
    if(!vid) return;
    const isHidden = isVaultItem("video", vid);
    if(isHidden) {
      await unhideFromVault("video", vid);
    } else {
      await hideToVault("video", vid);
      // Reload profile to reflect changes
      currentProfile = await getProfile(currentUser.uid);
    }
    loadMyVideos();
    renderFeed();
    renderShorts();
    return;
  }
});

/* MY VIDEOS */
async function loadMyVideos(){
  if(!currentUser) return;

  const list = videosCache.filter(v => 
    v.userId === currentUser.uid && 
    !isVaultItem("video", v.id)
  );
  const container = $("myVideos");
  if(!container) return;

  if(!list.length){
    container.innerHTML = `<div class="yt-empty" style="padding:40px 20px">
      <div style="font-size:48px;margin-bottom:12px">📹</div>
      <h3 style="font-size:16px;margin-bottom:6px">No videos yet</h3>
      <p style="font-size:13px">Upload your first video</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(v => createYTVideoItem(v, true)).join("");
  updateProfileTabCounts();
}

/* PEOPLE */
async function openPeople(uid, type){
  if(!uid) return;

  $("peopleTitle").textContent = type === "followers" ? "Followers" : "Following";
  $("peopleList").innerHTML = `<div class="yt-empty" style="padding:30px">Loading...</div>`;
  showModal("peopleModal");

  try{
    const q = type === "followers"
      ? query(collection(db,"follows"), where("following","==",uid))
      : query(collection(db,"follows"), where("follower","==",uid));

    const snap = await getDocs(q);

    if(!snap.size){
      $("peopleList").innerHTML = `<div class="yt-empty" style="padding:30px">No users yet</div>`;
      return;
    }

    const people = [];
    for(const d of snap.docs){
      const data = d.data();
      const personUid = type === "followers" ? data.follower : data.following;
      try{ people.push(await getProfile(personUid)); }catch(e){}
    }

    $("peopleList").innerHTML = people.map(p=>{
      const followed = myFollowsCache.has(p.uid);
      const requested = mySentRequestsCache.has(p.uid);
      const isMe = currentUser && p.uid === currentUser.uid;

      let btnText = "Follow";
      if(followed) btnText = "Following";
      else if(requested) btnText = "Requested";

      return `
      <div class="person-item">
        <img class="people-open-btn" data-uid="${esc(p.uid)}"
             src="${avatar(p.photo, p.name)}">
        <div class="info people-open-btn" data-uid="${esc(p.uid)}">
          <strong>${esc(p.name)}${p.suspended ? " 🚫" : ""}</strong>
          <small>@${esc(p.username)}</small>
        </div>
        ${!isMe && currentUser ? `
          <button class="follow-btn ${followed?"following":""}"
                  data-follow-uid="${esc(p.uid)}"
                  data-action="follow">
            ${btnText}
          </button>
        ` : ""}
      </div>
      `;
    }).join("");
  }catch(e){
    console.error("openPeople:", e);
    $("peopleList").innerHTML = `<div class="yt-empty" style="padding:30px">Error</div>`;
  }
}

$("myFollowersBtn")?.addEventListener("click", ()=>{
  if(currentUser) openPeople(currentUser.uid, "followers");
});

$("myFollowingBtn")?.addEventListener("click", ()=>{
  if(currentUser) openPeople(currentUser.uid, "following");
});

/* SEARCH */
$("topSearchBtn")?.addEventListener("click", ()=>{
  showModal("searchModal");
  setTimeout(()=> $("searchInput").focus(), 100);
});

let searchTimeout = null;
$("searchInput")?.addEventListener("input", e=>{
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(()=> doSearch(e.target.value), 300);
});

async function doSearch(value){
  value = value.trim().toLowerCase();
  const container = $("searchResults");

  if(!value){ container.innerHTML = ""; return; }

  container.innerHTML = `<div class="yt-empty" style="padding:20px">Searching...</div>`;

  try{
    const snap = await getDocs(collection(db,"profiles"));
    const users = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(p =>
        String(p.name||"").toLowerCase().includes(value) ||
        String(p.username||"").toLowerCase().includes(value.replace("@",""))
      )
      .slice(0,30);

    if(!users.length){
      container.innerHTML = `<div class="yt-empty" style="padding:20px">No user found</div>`;
      return;
    }

    container.innerHTML = users.map(p=>{
      const followed = myFollowsCache.has(p.uid);
      const requested = mySentRequestsCache.has(p.uid);
      const isMe = currentUser && p.uid === currentUser.uid;

      let btnText = "Follow";
      if(followed) btnText = "Following";
      else if(requested) btnText = "Requested";

      return `
      <div class="person-item">
        <img class="search-open-btn" data-uid="${esc(p.uid)}"
             src="${avatar(p.photo, p.name)}">
        <div class="info search-open-btn" data-uid="${esc(p.uid)}">
          <strong>${esc(p.name)}${p.suspended ? " 🚫" : ""}${p.private ? " 🔒" : ""}</strong>
          <small>@${esc(p.username)}</small>
        </div>
        ${!isMe && currentUser ? `
          <button class="follow-btn ${followed?"following":""}"
                  data-follow-uid="${esc(p.uid)}"
                  data-action="follow">
            ${btnText}
          </button>
        ` : ""}
      </div>
      `;
    }).join("");
  }catch(e){
    console.error(e);
    container.innerHTML = `<div class="yt-empty" style="padding:20px">Error</div>`;
  }
}

/* EDIT PROFILE */
$("editProfileBtn")?.addEventListener("click", async()=>{
  const p = await getProfile(currentUser.uid);
  $("editName").value = p.name || "";
  $("editUsername").value = p.username || "";
  $("editAge").value = p.age || "";
  $("editGender").value = p.gender || "";
  $("editBio").value = p.bio || "";
  $("editPhotoPreview").src = avatar(p.photo, p.name);
  $("profilePhotoFile").value = "";
  showModal("editProfileModal");
});

$("profilePhotoFile")?.addEventListener("change", e=>{
  const file = e.target.files[0];
  if(file) $("editPhotoPreview").src = URL.createObjectURL(file);
});

$("saveProfileBtn")?.addEventListener("click", async()=>{
  if(!currentUser) return;

  const name = $("editName").value.trim();
  const username = $("editUsername").value.trim().toLowerCase()
    .replace(/^@/,"").replace(/[^a-z0-9_]/g,"");
  const age = $("editAge").value.trim();
  const gender = $("editGender").value;
  const bio = $("editBio").value.trim();

  if(!name){ toast("Name डालो"); return; }
  if(!username){ toast("Username डालो"); return; }

  try{
    $("profileSaveStatus").textContent = "Saving...";
    $("saveProfileBtn").disabled = true;

    const q = query(collection(db,"profiles"), where("username","==",username));
    const snap = await getDocs(q);
    if(snap.docs.some(d => d.id !== currentUser.uid)){
      $("profileSaveStatus").textContent = "Username taken";
      $("saveProfileBtn").disabled = false;
      return;
    }

    let photo = currentProfile?.photo || "";
    const file = $("profilePhotoFile").files[0];
    if(file){
      $("profileSaveStatus").textContent = "Uploading photo...";
      photo = await uploadToCloudinary(file);
    }

    await updateDoc(doc(db,"profiles",currentUser.uid), {
      name, username, age, gender, bio, photo,
      updatedAt: serverTimestamp()
    });

    await loadProfile();
    hideModal("editProfileModal");
    $("profileSaveStatus").textContent = "";
    toast("✅ Profile updated");
  }catch(e){
    $("profileSaveStatus").textContent = e.message;
  }finally{
    $("saveProfileBtn").disabled = false;
  }
});

/* SETTINGS */
$("settingsBtn")?.addEventListener("click", ()=> showModal("settingsModal"));

$("darkModeBtn")?.addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("reelhubDark", document.body.classList.contains("dark") ? "1" : "0");
});

if(localStorage.getItem("reelhubDark") === "1"){
  document.body.classList.add("dark");
}

$("privacyPolicyBtn")?.addEventListener("click", ()=>{
  window.location.href = "/ReelHub/privacy.html";
});

$("termsOfServiceBtn")?.addEventListener("click", ()=>{
  window.location.href = "/ReelHub/terms.html";
});

$("deleteAccountBtn")?.addEventListener("click", ()=>{
  window.location.href = "/ReelHub/delete-account.html";
});

$("contactUsBtn")?.addEventListener("click", ()=>{
  window.location.href = "/ReelHub/contact.html";
});

$("logoutBtn")?.addEventListener("click", async()=>{
  if(!confirm("Logout?")) return;
  await markOffline();
  await signOut(auth);
});

$("shareAppBtn")?.addEventListener("click", async()=>{
  const data = {
    title: "ReelHub",
    text: "Join me on ReelHub 🎬",
    url: location.href
  };
  try{
    if(navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
  }catch(e){}
});

/* NOTIFICATIONS */
function startNotifications(){
  if(notificationsUnsubscribe){ notificationsUnsubscribe(); notificationsUnsubscribe = null; }
  if(!currentUser) return;

  notificationsUnsubscribe = onSnapshot(
    query(collection(db,"notifications"), where("to","==",currentUser.uid)),
    snapshot=>{
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));

      const badge = $("alertsBadge");
      if(list.length > 0){
        badge.textContent = Math.min(list.length, 99);
        badge.classList.remove("hidden");
      }else{
        badge.classList.add("hidden");
      }

      if(!list.length){
        $("notificationsList").innerHTML = `<div class="yt-empty" style="padding:30px">
          <div style="font-size:42px;margin-bottom:10px">🔔</div>
          <p>No notifications</p>
        </div>`;
        return;
      }

      $("notificationsList").innerHTML = list.slice(0,50).map(n=>`
        <div style="padding:14px 0;border-bottom:1px solid var(--border)">
          <strong style="font-size:14px">${esc(n.title || "")}</strong>
          <p style="font-size:13px;color:var(--muted);margin-top:4px">${esc(n.message || "")}</p>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${timeAgo(n.createdAt)}</div>
        </div>
      `).join("");
    }
  );
}

$("topAlertsBtn")?.addEventListener("click", ()=> showModal("alertsModal"));

/* MESSAGES */
function startChatsListListener(){
  if(chatsListUnsubscribe){ chatsListUnsubscribe(); chatsListUnsubscribe = null; }
  if(!currentUser) return;

  chatsListUnsubscribe = onSnapshot(
    query(collection(db,"chats"), where("members","array-contains",currentUser.uid)),
    async snapshot=>{
      myChatsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      myChatsCache.sort((a,b)=> timeValue(b.updatedAt) - timeValue(a.updatedAt));

      await calculateAllUnread();

      const inbox = $("dmInboxView");
      if(inbox && !inbox.classList.contains("hidden")){
        renderDMInbox();
      }

      const chatUids = myChatsCache.map(c => c.members.find(uid => uid !== currentUser.uid));
      if(chatUids.length) startPresenceListener(chatUids);
    }
  );
}

function showDMInbox(){
  const inbox = $("dmInboxView");
  const chat = $("dmChatView");
  
  if(inbox){ inbox.classList.remove("hidden"); inbox.style.display = "flex"; }
  if(chat){ chat.classList.add("hidden"); chat.style.display = "none"; }

  if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
  currentChatId = null;
  currentChatUser = null;

  renderDMInbox();
}

function renderDMInbox(){
  const container = $("dmInboxList");
  if(!container) return;

  if(!myChatsCache.length){
    container.innerHTML = `<div class="dm-empty">
      <span class="icon">💬</span>
      <h3>No messages yet</h3>
      <p>Start a conversation with someone</p>
    </div>`;
    return;
  }

  container.innerHTML = myChatsCache.map(c=>{
    const otherUid = c.members.find(uid => uid !== currentUser.uid);
    const unreadCount = unreadChatsCache[c.id] || 0;
    const unreadDot = unreadCount > 0 ? `<span class="dm-unread-dot"></span>` : "";
    
    return `<div class="dm-inbox-item ${unreadCount > 0 ? 'unread' : ''}" data-open-chat="${esc(otherUid)}">
      <div class="avatar-wrapper">
        <img src="${avatar("", "U")}" class="dm-inbox-avatar-${esc(otherUid)}">
        <span class="online-indicator" data-dot-uid="${esc(otherUid)}" style="display:none"></span>
      </div>
      <div class="dm-inbox-info">
        <strong class="dm-inbox-name-${esc(otherUid)}">
          ${unreadDot}Loading...
        </strong>
        <small>${esc(c.lastMessage || "Started a chat")}</small>
      </div>
      <div class="dm-inbox-time">${timeAgo(c.updatedAt)}</div>
    </div>`;
  }).join("");

  myChatsCache.forEach(async c=>{
    const otherUid = c.members.find(uid => uid !== currentUser.uid);
    try{
      const p = await getProfile(otherUid);
      document.querySelectorAll(".dm-inbox-avatar-" + otherUid).forEach(img=>{
        img.src = avatar(p.photo, p.name);
      });
      document.querySelectorAll(".dm-inbox-name-" + otherUid).forEach(el=>{
        el.innerHTML = (unreadChatsCache[c.id] > 0 ? `<span class="dm-unread-dot"></span>` : "") + p.name;
      });
    }catch(e){}
  });

  updateOnlineIndicators();
}

async function openChat(uid){
  if(!currentUser || uid === currentUser.uid) return;

  const p = await getProfile(uid);
  currentChatUser = p;
  currentChatId = [currentUser.uid, uid].sort().join("_");

  setTimeout(()=> markChatAsRead(currentChatId), 500);

  const avatarEl = $("dmChatAvatar");
  const nameEl = $("dmChatName");
  const inbox = $("dmInboxView");
  const chat = $("dmChatView");

  if(avatarEl) avatarEl.src = avatar(p.photo, p.name);
  if(nameEl) nameEl.textContent = p.name || "User";

  if(inbox){ inbox.classList.add("hidden"); inbox.style.display = "none"; }
  if(chat){ chat.classList.remove("hidden"); chat.style.display = "flex"; }

  const statusEl = document.querySelector(".dm-chat-header .info small");
  if(statusEl){
    statusEl.dataset.presenceUid = uid;
    statusEl.textContent = getOnlineText(uid);
    statusEl.classList.add("dm-chat-status");
    if(getOnlineText(uid) === ""){
      statusEl.classList.add("offline");
    }else{
      statusEl.classList.remove("offline");
    }
  }

  const profileBtn = $("dmChatProfileBtn");
  if(profileBtn){
    profileBtn.onclick = (e)=>{
      e.preventDefault();
      e.stopPropagation();
      openPublicProfile(uid);
    };
  }

  hideModal("publicProfileModal");
  hideModal("searchModal");

  startPresenceListener([uid]);

  try{
    await setDoc(doc(db,"chats",currentChatId), {
      members: [currentUser.uid, uid],
      updatedAt: serverTimestamp()
    }, { merge: true });
  }catch(e){
    console.error("Chat create error:", e);
  }

  startChatListener();
}

function openChatFromProfile(uid){
  if(!uid) return;

  hideModal("publicProfileModal");
  hideModal("searchModal");

  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  $("messagesPanel").classList.remove("hidden");
  $("mainTopbar").classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
  const msgBtn = document.querySelector('[data-panel="messagesPanel"]');
  if(msgBtn) msgBtn.classList.add("active");

  setTimeout(()=> openChat(uid), 200);
}

function startChatListener(){
  if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
  if(!currentChatId) return;

  chatUnsubscribe = onSnapshot(
    collection(db,"chats",currentChatId,"messages"),
    snapshot=>{
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));

      const container = $("dmMessages");
      if(!container) return;

      if(!list.length){
        container.innerHTML = `<div class="yt-empty" style="padding:40px 20px;color:var(--muted)">
          <p style="font-size:13px">No messages yet. Say hi! 👋</p>
        </div>`;
        return;
      }

      container.innerHTML = list.map(m=>{
        const mine = m.userId === currentUser.uid;

        if(m.type === "shared_video" && m.videoId){
          return `
          <div class="dm-msg ${mine?"me":"them"}">
            <div class="dm-shared-video" data-open-shared="${esc(m.videoId)}">
              <video src="${esc(m.videoURL || "")}" muted preload="metadata"></video>
              <div class="info"><strong>${esc(m.videoTitle || "Video")}</strong></div>
            </div>
            <small>${timeAgo(m.createdAt)}</small>
            ${mine ? `
              <div class="dm-msg-actions">
                <button data-delete-msg="${esc(m.id)}">Delete</button>
              </div>
            ` : ""}
          </div>
          `;
        }

        if(m.type === "image" && m.imageURL){
          return `
          <div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent">
            <div class="dm-msg-image" data-open-image="${esc(m.imageURL)}">
              <img src="${esc(m.imageURL)}" alt="Photo">
            </div>
            <small style="margin-left:8px">${timeAgo(m.createdAt)}</small>
            ${mine ? `
              <div class="dm-msg-actions" style="margin-left:8px">
                <button data-delete-msg="${esc(m.id)}">Delete</button>
              </div>
            ` : ""}
          </div>
          `;
        }

        if(m.type === "chat_video" && m.videoURL){
          return `
          <div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent">
            <div class="dm-msg-image">
              <video src="${esc(m.videoURL)}" controls playsinline preload="metadata"
                     style="width:100%;display:block;border-radius:12px;max-height:280px;background:#000"
                     data-open-chat-video="${esc(m.videoURL)}"></video>
            </div>
            <small style="margin-left:8px">${timeAgo(m.createdAt)}</small>
            ${mine ? `
              <div class="dm-msg-actions" style="margin-left:8px">
                <button data-delete-msg="${esc(m.id)}">Delete</button>
              </div>
            ` : ""}
          </div>
          `;
        }

        return `
        <div class="dm-msg ${mine?"me":"them"}">
          ${esc(m.text)}
          <small>${timeAgo(m.createdAt)}</small>
          ${mine ? `
            <div class="dm-msg-actions">
              <button data-edit-msg="${esc(m.id)}" data-old-text="${esc(m.text)}">Edit</button>
              <button data-delete-msg="${esc(m.id)}">Delete</button>
            </div>
          ` : ""}
        </div>
        `;
      }).join("");

      container.scrollTop = container.scrollHeight;
    },
    error=>console.error("Chat listener error:", error)
  );
}

$("dmSendBtn")?.addEventListener("click", sendDM);
$("dmInput")?.addEventListener("keydown", e=>{ if(e.key === "Enter") sendDM(); });

async function sendDM(){
  const text = $("dmInput").value.trim();
  if(!text || !currentChatId) return;

  try{
    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      text,
      type: "text",
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db,"chats",currentChatId), {
      lastMessage: text,
      updatedAt: serverTimestamp()
    });

    $("dmInput").value = "";
  }catch(e){
    console.error(e);
    toast("Send failed");
  }
}

async function editMessage(id, oldText){
  const text = prompt("Edit message:", oldText);
  if(text === null) return;
  const clean = text.trim();
  if(!clean) return;
  const ref = doc(db,"chats",currentChatId,"messages",id);
  const snap = await getDoc(ref);
  if(!snap.exists() || snap.data().userId !== currentUser.uid) return;
  await updateDoc(ref, { text: clean, updatedAt: serverTimestamp() });
}

async function deleteMessage(id){
  const ref = doc(db,"chats",currentChatId,"messages",id);
  const snap = await getDoc(ref);
  if(!snap.exists() || snap.data().userId !== currentUser.uid) return;
  if(!confirm("Delete message?")) return;
  await deleteDoc(ref);
}

$("dmBackBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  if(currentChatId) markChatAsRead(currentChatId);
  showDMInbox();
});

$("newMsgBtn")?.addEventListener("click", ()=>{
  showModal("searchModal");
  setTimeout(()=> $("searchInput").focus(), 100);
});

/* CHAT ATTACH */
$("dmAttachBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  const menu = $("dmAttachMenu");
  if(menu) menu.classList.toggle("show");
});

document.addEventListener("click", (e)=>{
  const menu = $("dmAttachMenu");
  const btn = $("dmAttachBtn");
  if(!menu || !btn) return;
  if(!menu.contains(e.target) && !btn.contains(e.target)){
    menu.classList.remove("show");
  }
});

$("attachPhotoBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  $("dmAttachMenu")?.classList.remove("show");
  $("dmPhotoFile")?.click();
});

$("attachVideoBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  $("dmAttachMenu")?.classList.remove("show");
  $("dmVideoFile")?.click();
});

$("dmPhotoFile")?.addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file || !currentChatId) return;
  await sendPhotoInChat(file);
  e.target.value = "";
});

$("dmVideoFile")?.addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file || !currentChatId) return;
  await sendChatVideo(file);
  e.target.value = "";
});

async function sendPhotoInChat(file){
  try{
    toast("Uploading photo...");
    const url = await uploadToCloudinary(file, (pct)=>{
      if(pct % 25 === 0) toast("Photo " + pct + "%");
    });

    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      text: "",
      type: "image",
      imageURL: url,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db,"chats",currentChatId), {
      lastMessage: "📷 Photo",
      updatedAt: serverTimestamp()
    });

    toast("✅ Photo sent");
  }catch(e){
    console.error("Photo send error:", e);
    toast("Photo send failed");
  }
}

async function sendChatVideo(file){
  try{
    toast("Uploading video...");
    const url = await uploadToCloudinary(file, (pct)=>{
      if(pct % 25 === 0) toast("Video " + pct + "%");
    });

    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      text: "",
      type: "chat_video",
      videoURL: url,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db,"chats",currentChatId), {
      lastMessage: "🎥 Video",
      updatedAt: serverTimestamp()
    });

    toast("✅ Video sent");
  }catch(e){
    console.error("Video send error:", e);
    toast("Video send failed");
  }
}

/* MODAL CLOSE */
document.querySelectorAll("[data-close]").forEach(btn=>{
  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const id = btn.dataset.close;
    hideModal(id);

    if(id === "commentsModal"){
      currentCommentVideoId = null;
      if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; }
    }

    if(id === "publicProfileModal"){
      delete $("publicProfileModal").dataset.uid;
      $("privateAccountNotice")?.classList.add("hidden");
    }

    if(id === "playlistDetailModal"){
      currentPlaylistView = null;
    }

    if(id === "videoPlayerModal"){
      const videoEl = $("videoPlayerVideo");
      if(videoEl){
        videoEl.pause();
        videoEl.src = "";
      }
    }

    if(id === "imageViewerModal"){
      const imgEl = $("largeChatImage");
      if(imgEl) imgEl.src = "";
    }
  });
});

document.querySelectorAll(".modal").forEach(modal=>{
  modal.addEventListener("click", e=>{
    if(e.target === modal){
      modal.classList.remove("show");

      if(modal.id === "commentsModal"){
        currentCommentVideoId = null;
        if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; }
      }

      if(modal.id === "publicProfileModal"){
        delete $("publicProfileModal").dataset.uid;
        $("privateAccountNotice")?.classList.add("hidden");
      }

      if(modal.id === "playlistDetailModal"){
        currentPlaylistView = null;
      }

      if(modal.id === "videoPlayerModal"){
        const videoEl = $("videoPlayerVideo");
        if(videoEl){
          videoEl.pause();
          videoEl.src = "";
        }
      }

      if(modal.id === "imageViewerModal"){
        const imgEl = $("largeChatImage");
        if(imgEl) imgEl.src = "";
      }
    }
  });
});

$("shareSheet")?.addEventListener("click", e=>{
  if(e.target === $("shareSheet")){
    $("shareSheet").classList.remove("show");
  }
});

/* DM SEARCH */
$("dmSearchInput")?.addEventListener("input", e=>{
  const val = e.target.value.toLowerCase().trim();
  document.querySelectorAll("#dmInboxList .dm-inbox-item").forEach(item=>{
    const name = item.querySelector("strong")?.textContent.toLowerCase() || "";
    item.style.display = name.includes(val) ? "" : "none";
  });
});

/* START */
openPanel("homePanel");

/* SPLASH SCREEN */
setTimeout(()=>{
  const splash = $("splashScreen");
  if(splash){
    splash.classList.add("fade-out");
    setTimeout(()=> splash.remove(), 500);
  }
}, 2500);
/* ============================================================
   BROWSER BACK BUTTON HANDLER
============================================================ */

window.addEventListener("popstate", (e) => {
  // 1. Story viewer check
  const storyViewer = $("storyViewer");
  if(storyViewer && storyViewer.classList.contains("show")){
    closeStoryViewer();
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }

  // 2. Vault viewer check
  const vaultViewer = $("vaultViewerModal");
  if(vaultViewer && vaultViewer.classList.contains("show")){
    hideModal("vaultViewerModal");
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }

  // 3. Any open modals
  const openModals = document.querySelectorAll(".modal.show");
  if(openModals.length > 0){
    const topModal = openModals[openModals.length - 1];
    const id = topModal.id;
    
    if(id === "commentsModal"){
      currentCommentVideoId = null;
      if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; }
    }
    if(id === "publicProfileModal"){
      delete $("publicProfileModal").dataset.uid;
      $("privateAccountNotice")?.classList.add("hidden");
    }
    if(id === "playlistDetailModal"){
      currentPlaylistView = null;
    }
    if(id === "videoPlayerModal"){
      const videoEl = $("videoPlayerVideo");
      if(videoEl){ videoEl.pause(); videoEl.src = ""; }
    }
    if(id === "imageViewerModal"){
      const imgEl = $("largeChatImage");
      if(imgEl) imgEl.src = "";
    }
    
    topModal.classList.remove("show");
    
    const idx = modalHistoryStack.indexOf(id);
    if(idx > -1) modalHistoryStack.splice(idx, 1);
    
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }
  
  // 4. Share sheet
  const shareSheet = $("shareSheet");
  if(shareSheet && shareSheet.classList.contains("show")){
    shareSheet.classList.remove("show");
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }
  
  // 5. DM chat view — go back to inbox
  const dmChatView = $("dmChatView");
  if(dmChatView && !dmChatView.classList.contains("hidden")){
    if(currentChatId) markChatAsRead(currentChatId);
    showDMInbox();
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }
}, { passive: true });

console.log("✅ ReelHub loaded — Vault + Stories + Auth + Back Button Fix!");