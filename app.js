/* ============================================================
   ✅ PART A — ADMIN PANEL + SONG LIBRARY
============================================================ */

/* SONG STATE */
let songLibraryCache = [];
let songLibraryUnsubscribe = null;
let selectedSongForApply = null;
let editingSongId = null;
let pendingSongFile = null;

/* ADMIN EMAILS */
const ADMIN_EMAILS = [
  "appcreator001.harshitkumar@gmail.com",
  "satender8510815609@gmail.com"
];

function isAdminUser(){
  return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}

/* ============================================================
   SONG LIBRARY LISTENER (Real-time)
============================================================ */
function startSongLibraryListener(){
  if(songLibraryUnsubscribe){ songLibraryUnsubscribe(); songLibraryUnsubscribe = null; }

  songLibraryUnsubscribe = onSnapshot(
    query(collection(db, "song_library")),
    snapshot=>{
      songLibraryCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      songLibraryCache.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));

      // Render admin panel if open
      const adminModal = $("adminSongLibraryModal");
      if(adminModal && adminModal.classList.contains("show")){
        renderAdminSongLibrary();
      }

      // Render picker if open
      const pickerModal = $("songPickerModal");
      if(pickerModal && pickerModal.classList.contains("show")){
        renderSongPickerList($("songSearchInput")?.value || "");
      }
    },
    error=>console.error("Song library listener:", error)
  );
}

/* ============================================================
   SHOW/HIDE ADMIN BUTTON BASED ON USER
============================================================ */
function updateAdminVisibility(){
  const adminBtn = $("adminSongLibraryBtn");
  if(!adminBtn) return;

  if(isAdminUser()){
    adminBtn.style.display = "flex";
  }else{
    adminBtn.style.display = "none";
  }
}

/* ============================================================
   OPEN ADMIN SONG LIBRARY
============================================================ */
function openAdminSongLibrary(){
  if(!isAdminUser()){
    toast("Only admin can access");
    return;
  }

  hideModal("advancedSettingsModal");
  showModal("adminSongLibraryModal");

  renderAdminSongLibrary();
  startSongLibraryListener();
}

/* ============================================================
   RENDER ADMIN SONG LIBRARY
============================================================ */
function renderAdminSongLibrary(){
  const container = $("songLibraryList");
  if(!container) return;

  const countEl = $("songCount");
  if(countEl) countEl.textContent = songLibraryCache.length + " songs";

  if(!songLibraryCache.length){
    container.innerHTML = `
      <div class="song-library-empty">
        <span class="icon">🎵</span>
        <h3>No songs yet</h3>
        <p>Tap "Add New Song" to add your first song</p>
      </div>
    `;
    return;
  }

  container.innerHTML = songLibraryCache.map(s => `
    <div class="song-library-item">
      <div class="song-thumb">🎵</div>
      <div class="song-info">
        <strong>${esc(s.name || "Untitled")}</strong>
        <small>${esc(s.artist || "Unknown")} · ${esc(s.category || "Other")}</small>
      </div>
      <div class="song-actions">
        <button class="play-btn" data-play-song="${esc(s.id)}">▶</button>
        <button class="edit-btn" data-edit-song="${esc(s.id)}">✏️</button>
        <button class="delete-btn" data-delete-song="${esc(s.id)}">🗑️</button>
      </div>
    </div>
  `).join("");
}

/* ============================================================
   OPEN ADD SONG MODAL
============================================================ */
function openAddSongModal(){
  if(!isAdminUser()){ toast("Only admin"); return; }

  editingSongId = null;
  pendingSongFile = null;

  $("addSongTitle").textContent = "➕ Add Song";
  $("songName").value = "";
  $("songArtist").value = "";
  $("songCategory").value = "Bollywood";
  $("songFile").value = "";
  $("songFileSelected").classList.add("hidden");
  $("songUploadStatus").textContent = "";
  $("songUploadProgress").classList.remove("active");
  $("songUploadProgressBar").style.width = "0%";

  hideModal("adminSongLibraryModal");
  showModal("addSongModal");
}

/* ============================================================
   OPEN EDIT SONG MODAL
============================================================ */
function openEditSongModal(songId){
  if(!isAdminUser()){ toast("Only admin"); return; }

  const song = songLibraryCache.find(s => s.id === songId);
  if(!song){ toast("Song not found"); return; }

  editingSongId = songId;
  pendingSongFile = null;

  $("addSongTitle").textContent = "✏️ Edit Song";
  $("songName").value = song.name || "";
  $("songArtist").value = song.artist || "";
  $("songCategory").value = song.category || "Bollywood";
  $("songFile").value = "";

  // Show current file
  $("songFileName").textContent = song.name + " (current)";
  $("songFileSelected").classList.remove("hidden");

  $("songUploadStatus").textContent = "";
  $("songUploadProgress").classList.remove("active");

  hideModal("adminSongLibraryModal");
  showModal("addSongModal");
}

/* ============================================================
   SONG FILE SELECT
============================================================ */
$("songUploadZone")?.addEventListener("click", ()=>{
  $("songFile")?.click();
});

$("songFile")?.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;

  if(file.size > 100 * 1024 * 1024){
    toast("File too large (max 100MB)");
    e.target.value = "";
    return;
  }

  pendingSongFile = file;
  $("songFileName").textContent = file.name;
  $("songFileSelected").classList.remove("hidden");
  $("songFileSelected").style.display = "flex";
});

$("songFileRemoveBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  pendingSongFile = null;
  $("songFile").value = "";
  $("songFileSelected").classList.add("hidden");
});

/* ============================================================
   SAVE SONG (Add or Edit)
============================================================ */
$("saveSongBtn")?.addEventListener("click", async ()=>{
  if(!isAdminUser()){ toast("Only admin"); return; }

  const name = $("songName").value.trim();
  const artist = $("songArtist").value.trim();
  const category = $("songCategory").value;
  const status = $("songUploadStatus");

  if(!name){
    status.style.color = "#ed4956";
    status.textContent = "Song name required";
    return;
  }

  // For NEW song, file is required
  if(!editingSongId && !pendingSongFile){
    status.style.color = "#ed4956";
    status.textContent = "Please select a song file";
    return;
  }

  const btn = $("saveSongBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Saving..."; }
  status.style.color = "#7c3aed";
  status.textContent = "Saving...";

  try{
    let audioURL = "";

    // If new file uploaded
    if(pendingSongFile){
      status.textContent = "Uploading audio...";
      $("songUploadProgress").classList.add("active");

      // Upload to Cloudinary as video resource (works for audio)
      audioURL = await uploadAudioToCloudinary(pendingSongFile, (pct)=>{
        $("songUploadProgressBar").style.width = pct + "%";
        status.textContent = "Uploading " + pct + "%";
      });
    }else if(editingSongId){
      // Keep existing URL
      const existing = songLibraryCache.find(s => s.id === editingSongId);
      audioURL = existing?.audioURL || "";
    }

    if(editingSongId){
      // Update
      await updateDoc(doc(db, "song_library", editingSongId), {
        name,
        artist,
        category,
        audioURL,
        updatedAt: serverTimestamp()
      });
      toast("✅ Song updated");
    }else{
      // Create new
      await addDoc(collection(db, "song_library"), {
        name,
        artist,
        category,
        audioURL,
        createdBy: currentUser.uid,
        createdByName: currentProfile?.name || "Admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast("✅ Song added");
    }

    status.style.color = "#22c55e";
    status.textContent = "✅ Saved!";

    setTimeout(()=>{
      hideModal("addSongModal");
      showModal("adminSongLibraryModal");
      renderAdminSongLibrary();
    }, 700);

  }catch(err){
    console.error("Save song error:", err);
    status.style.color = "#ed4956";
    status.textContent = "Error: " + err.message;
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "✅ Save Song"; }
    $("songUploadProgress").classList.remove("active");
  }
});

/* ============================================================
   UPLOAD AUDIO TO CLOUDINARY
============================================================ */
function uploadAudioToCloudinary(file, onProgress){
  return new Promise((resolve, reject)=>{
    // Use "video" endpoint for audio files
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.onload = ()=>{
      if(xhr.status >= 200 && xhr.status < 300){
        try{
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        }catch(e){ reject(e); }
      }else{
        reject(new Error("Upload failed: " + xhr.status));
      }
    };

    xhr.onerror = ()=> reject(new Error("Network error"));

    xhr.upload.onprogress = e=>{
      if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100));
    };

    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("resource_type", "video");
    form.append("file", file);

    xhr.send(form);
  });
}

/* ============================================================
   PLAY SONG PREVIEW (Admin)
============================================================ */
let previewAudio = null;

function playSongPreview(songId){
  const song = songLibraryCache.find(s => s.id === songId);
  if(!song || !song.audioURL){ toast("No audio"); return; }

  // Stop existing
  if(previewAudio){ previewAudio.pause(); previewAudio = null; }

  previewAudio = new Audio(song.audioURL);
  previewAudio.play().then(()=>{
    toast("▶ Playing: " + song.name);
  }).catch(()=>{
    toast("Play failed");
  });

  previewAudio.onended = ()=>{
    toast("⏹ Stopped");
    previewAudio = null;
  };
}

/* ============================================================
   DELETE SONG
============================================================ */
async function deleteSong(songId){
  if(!isAdminUser()){ toast("Only admin"); return; }

  const song = songLibraryCache.find(s => s.id === songId);
  if(!song) return;

  if(!confirm(`Delete "${song.name}"?`)) return;

  try{
    await deleteDoc(doc(db, "song_library", songId));
    toast("🗑️ Song deleted");
  }catch(e){
    console.error("Delete song error:", e);
    toast("Delete failed");
  }
}

/* ============================================================
   ADMIN SONG LIBRARY CLICK HANDLERS
============================================================ */
document.addEventListener("click", async (e)=>{
  const t = e.target;

  // Open admin panel
  const adminBtn = t.closest("#adminSongLibraryBtn");
  if(adminBtn){
    e.preventDefault(); e.stopPropagation();
    openAdminSongLibrary();
    return;
  }

  // Add song button
  const addBtn = t.closest("#addSongBtn");
  if(addBtn){
    e.preventDefault(); e.stopPropagation();
    openAddSongModal();
    return;
  }

  // Play song
  const playBtn = t.closest("[data-play-song]");
  if(playBtn){
    e.preventDefault(); e.stopPropagation();
    playSongPreview(playBtn.dataset.playSong);
    return;
  }

  // Edit song
  const editBtn = t.closest("[data-edit-song]");
  if(editBtn){
    e.preventDefault(); e.stopPropagation();
    openEditSongModal(editBtn.dataset.editSong);
    return;
  }

  // Delete song
  const delBtn = t.closest("[data-delete-song]");
  if(delBtn){
    e.preventDefault(); e.stopPropagation();
    await deleteSong(delBtn.dataset.deleteSong);
    return;
  }

  // Song picker item select
  const pickerItem = t.closest("[data-pick-song]");
  if(pickerItem){
    e.preventDefault(); e.stopPropagation();
    const songId = pickerItem.dataset.pickSong;

    // Toggle selection
    document.querySelectorAll("#songPickerList .song-picker-item").forEach(el => {
      el.classList.remove("selected");
      const check = el.querySelector(".check-icon");
      if(check) check.textContent = "";
    });

    pickerItem.classList.add("selected");
    const check = pickerItem.querySelector(".check-icon");
    if(check) check.textContent = "✓";

    selectedSongForApply = songLibraryCache.find(s => s.id === songId) || null;
    return;
  }
});

/* ============================================================
   SONG PICKER (User-facing)
============================================================ */
let songPickerContext = null; // 'story' or 'video' or 'story_edit'

function openSongPicker(context){
  songPickerContext = context || "story";
  selectedSongForApply = null;

  showModal("songPickerModal");
  startSongLibraryListener();
  renderSongPickerList("");
}

function renderSongPickerList(searchText){
  const container = $("songPickerList");
  if(!container) return;

  const q = (searchText || "").toLowerCase().trim();

  let list = songLibraryCache;
  if(q){
    list = list.filter(s => 
      (s.name || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q)
    );
  }

  if(!list.length){
    container.innerHTML = `
      <div class="song-library-empty">
        <span class="icon">🎵</span>
        <h3>No songs ${q ? "found" : "yet"}</h3>
        <p>${q ? "Try another search" : "Admin will add songs soon"}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="song-picker-item" data-pick-song="${esc(s.id)}">
      <div class="song-thumb">🎵</div>
      <div class="song-info">
        <strong>${esc(s.name || "Untitled")}</strong>
        <small>${esc(s.artist || "Unknown")} · ${esc(s.category || "")}</small>
      </div>
      <div class="check-icon"></div>
    </div>
  `).join("");
}

/* Song search */
$("songSearchInput")?.addEventListener("input", (e)=>{
  renderSongPickerList(e.target.value);
});

/* Confirm song selection */
$("confirmSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  if(!selectedSongForApply){
    toast("Select a song first");
    return;
  }

  // Apply based on context
  if(songPickerContext === "story"){
    applySongToStory(selectedSongForApply);
  }else if(songPickerContext === "video"){
    applySongToVideo(selectedSongForApply);
  }else if(songPickerContext === "story_edit"){
    applySongToStoryEdit(selectedSongForApply);
  }

  hideModal("songPickerModal");
});

/* Remove song */
$("removeSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  if(songPickerContext === "story"){
    removeSongFromStory();
  }else if(songPickerContext === "video"){
    removeSongFromVideo();
  }else if(songPickerContext === "story_edit"){
    removeSongFromStoryEdit();
  }

  hideModal("songPickerModal");
});

/* ============================================================
   AUTO-START SONG LISTENER ON LOGIN
============================================================ */
// Hook into auth state - start listener when user logs in
const _origOnAuth = onAuthStateChanged;
onAuthStateChanged(auth, (user)=>{
  if(user){
    setTimeout(()=>{
      startSongLibraryListener();
      updateAdminVisibility();
    }, 1500);
  }else{
    if(songLibraryUnsubscribe){ songLibraryUnsubscribe(); songLibraryUnsubscribe = null; }
    songLibraryCache = [];
  }
});

console.log("✅ PART A — Admin Song Library loaded!");
/* ============================================================
   ✅ PART B — STORY EDIT/DELETE + MENU + SONG/STICKER APPLY
============================================================ */

/* STORY EDIT STATE */
let currentStoryId = null;
let currentStoryData = null;
let editingStorySong = null;
let editingStorySticker = null;
let editingStoryFile = null;
let storyTrimStart = 0;
let storyTrimEnd = 0;
let editingStoryTrim = false;

/* ============================================================
   STORY MORE MENU (3-dot)
============================================================ */
$("storyMoreBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  const group = groupedStories[currentStoryUserIndex];
  if(!group) return;

  const story = group.stories[currentStoryIndex];
  if(!story){ return; }

  // Only show menu for own story
  if(story.userId !== currentUser?.uid){
    toast("You can only manage your own story");
    return;
  }

  currentStoryId = story.id;
  currentStoryData = story;

  pauseStoryTimer();
  showModal("storyMenuModal");
});

/* ============================================================
   STORY MENU — EDIT
============================================================ */
$("storyMenuEditBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault();
  e.stopPropagation();

  if(!currentStoryId || !currentStoryData){
    toast("Story not loaded");
    return;
  }

  hideModal("storyMenuModal");
  await openEditStoryModal(currentStoryId);
});

async function openEditStoryModal(storyId){
  try{
    const storySnap = await getDoc(doc(db, "stories", storyId));
    if(!storySnap.exists()){
      toast("Story not found");
      return;
    }

    const story = { id: storyId, ...storySnap.data() };

    // Check ownership
    if(story.userId !== currentUser.uid){
      toast("Not your story");
      return;
    }

    // Setup preview
    if(story.mediaType === "video"){
      $("editStoryPreview").classList.add("hidden");
      $("editStoryVideoPreview").classList.remove("hidden");
      $("editStoryVideoPreview").src = story.mediaURL;
    }else{
      $("editStoryVideoPreview").classList.add("hidden");
      $("editStoryPreview").classList.remove("hidden");
      $("editStoryPreview").src = story.mediaURL;
    }

    // Setup fields
    $("editStoryCaption").value = story.caption || "";
    editingStorySong = story.song || null;
    editingStorySticker = story.sticker || null;
    editingStoryFile = null;

    $("editStoryStatus").textContent = "";
    $("editStoryStatus").style.color = "var(--muted)";

    // Show which song/sticker is selected
    updateEditStorySongBtn();
    updateEditStoryStickerBtn();

    showModal("editStoryModal");

  }catch(e){
    console.error("openEditStoryModal:", e);
    toast("Failed to open");
  }
}

function updateEditStorySongBtn(){
  const btn = $("editStoryChangeSongBtn");
  if(!btn) return;

  if(editingStorySong){
    btn.innerHTML = `🎵 ${esc(editingStorySong.name || "Song")} ✓`;
    btn.style.borderColor = "var(--primary)";
    btn.style.color = "var(--primary)";
  }else{
    btn.innerHTML = "🎵 Add Song";
    btn.style.borderColor = "";
    btn.style.color = "";
  }
}

function updateEditStoryStickerBtn(){
  const btn = $("editStoryChangeStickerBtn");
  if(!btn) return;

  if(editingStorySticker){
    btn.innerHTML = `${editingStorySticker.icon || "😀"} Sticker ✓`;
    btn.style.borderColor = "var(--primary)";
    btn.style.color = "var(--primary)";
  }else{
    btn.innerHTML = "😀 Add Sticker";
    btn.style.borderColor = "";
    btn.style.color = "";
  }
}

/* ============================================================
   SAVE STORY EDIT
============================================================ */
$("saveStoryEditBtn")?.addEventListener("click", async ()=>{
  if(!currentStoryId) return;

  const caption = $("editStoryCaption").value.trim();
  const status = $("editStoryStatus");
  const btn = $("saveStoryEditBtn");

  if(btn){ btn.disabled = true; btn.textContent = "Saving..."; }
  status.textContent = "Saving...";
  status.style.color = "#7c3aed";

  try{
    const updates = {
      caption,
      song: editingStorySong || null,
      sticker: editingStorySticker || null,
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, "stories", currentStoryId), updates);

    status.textContent = "✅ Saved!";
    status.style.color = "#22c55e";

    toast("✅ Story updated");

    // Reload story viewer
    setTimeout(async ()=>{
      hideModal("editStoryModal");
      closeStoryViewer();
      await new Promise(r => setTimeout(r, 300));
      // Reload stories
      startStoriesListener();
    }, 700);

  }catch(err){
    console.error("Save story error:", err);
    status.textContent = "Error: " + err.message;
    status.style.color = "#ed4956";
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "✅ Save Changes"; }
  }
});

/* ============================================================
   STORY MENU — DELETE
============================================================ */
$("storyMenuDeleteBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault();
  e.stopPropagation();

  if(!currentStoryId){
    toast("Story not loaded");
    return;
  }

  if(!confirm("Delete this story permanently?")) return;

  try{
    await deleteDoc(doc(db, "stories", currentStoryId));

    hideModal("storyMenuModal");
    closeStoryViewer();

    toast("🗑️ Story deleted");

  }catch(e){
    console.error("Delete story error:", e);
    toast("Failed to delete");
  }
});

/* ============================================================
   EDIT STORY — CHANGE SONG
============================================================ */
$("editStoryChangeSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  // Open song picker with context "story_edit"
  window.__songPickerContext = "story_edit";
  songPickerContext = "story_edit";
  selectedSongForApply = editingStorySong;

  hideModal("editStoryModal");
  openSongPicker("story_edit");

  // Pre-select current song
  setTimeout(()=>{
    if(editingStorySong){
      const item = document.querySelector(`[data-pick-song="${editingStorySong.id}"]`);
      if(item){
        item.classList.add("selected");
        const check = item.querySelector(".check-icon");
        if(check) check.textContent = "✓";
      }
    }
  }, 300);
});

/* ============================================================
   APPLY SONG TO STORY EDIT
============================================================ */
function applySongToStoryEdit(song){
  editingStorySong = song;
  updateEditStorySongBtn();
  hideModal("songPickerModal");
  showModal("editStoryModal");
  toast("🎵 " + song.name + " selected");
}

function removeSongFromStoryEdit(){
  editingStorySong = null;
  updateEditStorySongBtn();
  hideModal("songPickerModal");
  showModal("editStoryModal");
  toast("🔇 Song removed");
}

/* ============================================================
   EDIT STORY — CHANGE STICKER
============================================================ */
$("editStoryChangeStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  window.__stickerContext = "story_edit";
  hideModal("editStoryModal");
  openStickerPicker("story_edit");

  // Pre-select current sticker
  setTimeout(()=>{
    if(editingStorySticker){
      // Highlight current if emoji
      if(editingStorySticker.type === "emoji"){
        document.querySelectorAll(".sticker-item").forEach(el=>{
          if(el.dataset.sticker === editingStorySticker.icon){
            el.style.background = "var(--primary)";
            el.style.color = "white";
          }
        });
      }
      // Fill text if text sticker
      if(editingStorySticker.type === "text"){
        $("stickerTabs")?.querySelector('[data-stab="text"]')?.click();
        $("textStickerInput").value = editingStorySticker.text || "";
      }
    }
  }, 300);
});

/* ============================================================
   APPLY STICKER TO STORY EDIT
============================================================ */
function applyStickerToStoryEdit(sticker){
  editingStorySticker = sticker;
  updateEditStoryStickerBtn();
  hideModal("stickerPickerModal");
  showModal("editStoryModal");
  toast("😀 Sticker added");
}

function removeStickerFromStoryEdit(){
  editingStorySticker = null;
  updateEditStoryStickerBtn();
  hideModal("stickerPickerModal");
  showModal("editStoryModal");
  toast("Sticker removed");
}

/* ============================================================
   APPLY SONG TO STORY (NEW STORY UPLOAD)
============================================================ */
let pendingStorySong = null;
let pendingStorySticker = null;
let pendingStoryTrim = { start: 0, end: 0, applied: false };

function applySongToStory(song){
  pendingStorySong = song;

  // Update UI
  const status = $("storySelectedMedia");
  if(status){
    status.textContent = "🎵 " + song.name + " selected";
  }

  // Update button
  const btn = $("storyAddSongBtn");
  if(btn){
    btn.innerHTML = `🎵 ${esc(song.name).slice(0, 12)} ✓`;
    btn.style.borderColor = "var(--primary)";
    btn.style.color = "var(--primary)";
  }

  toast("🎵 Song added");
}

function removeSongFromStory(){
  pendingStorySong = null;
  const status = $("storySelectedMedia");
  if(status) status.textContent = "";
  const btn = $("storyAddSongBtn");
  if(btn){
    btn.innerHTML = "🎵 Song";
    btn.style.borderColor = "";
    btn.style.color = "";
  }
  toast("🔇 Song removed");
}

/* ============================================================
   APPLY STICKER TO STORY (NEW STORY UPLOAD)
============================================================ */
function applyStickerToStory(sticker){
  pendingStorySticker = sticker;

  // Update button
  const btn = $("storyAddStickerBtn");
  if(btn){
    btn.innerHTML = `${sticker.icon || "😀"} ✓`;
    btn.style.borderColor = "var(--primary)";
    btn.style.color = "var(--primary)";
  }

  toast("😀 Sticker added");
}

function removeStickerFromStory(){
  pendingStorySticker = null;
  const btn = $("storyAddStickerBtn");
  if(btn){
    btn.innerHTML = "😀 Sticker";
    btn.style.borderColor = "";
    btn.style.color = "";
  }
  toast("Sticker removed");
}

/* ============================================================
   APPLY SONG TO VIDEO (UPLOAD PANEL)
============================================================ */
let pendingVideoSong = null;
let pendingVideoSticker = null;
let pendingVideoTrim = { start: 0, end: 0, applied: false };
let pendingVideoRotation = 0;
let pendingVideoMuted = false;

function applySongToVideo(song){
  pendingVideoSong = song;
  const status = $("videoEditStatus");
  if(status){
    status.textContent = "🎵 " + song.name + " selected";
  }
  const btn = $("editVideoSongBtn");
  if(btn){
    btn.innerHTML = `🎵 ${esc(song.name).slice(0, 10)} ✓`;
    btn.style.borderColor = "var(--primary)";
    btn.style.color = "var(--primary)";
  }
  toast("🎵 Song selected");
}

function removeSongFromVideo(){
  pendingVideoSong = null;
  const status = $("videoEditStatus");
  if(status) status.textContent = "";
  const btn = $("editVideoSongBtn");
  if(btn){
    btn.innerHTML = "🎵 Song";
    btn.style.borderColor = "";
    btn.style.color = "";
  }
  toast("🔇 Song removed");
}

/* ============================================================
   APPLY STICKER TO VIDEO
============================================================ */
function applyStickerToVideo(sticker){
  pendingVideoSticker = sticker;
  const status = $("videoEditStatus");
  if(status){
    status.textContent = `${sticker.icon || "😀"} Sticker selected`;
  }
  const btn = $("editVideoStickerBtn");
  if(btn){
    btn.innerHTML = `${sticker.icon || "😀"} ✓`;
    btn.style.borderColor = "var(--primary)";
    btn.style.color = "var(--primary)";
  }
  toast("😀 Sticker selected");
}

function removeStickerFromVideo(){
  pendingVideoSticker = null;
  const status = $("videoEditStatus");
  if(status) status.textContent = "";
  const btn = $("editVideoStickerBtn");
  if(btn){
    btn.innerHTML = "😀 Sticker";
    btn.style.borderColor = "";
    btn.style.color = "";
  }
  toast("Sticker removed");
}

/* ============================================================
   STICKER PICKER — CORE LOGIC
============================================================ */
let stickerPickerContext = null;
let selectedStickerColor = "#ffffff";
let selectedStickerEmoji = null;
let selectedStickerText = null;

function openStickerPicker(context){
  stickerPickerContext = context || "story";
  selectedStickerEmoji = null;
  selectedStickerText = null;
  selectedStickerColor = "#ffffff";

  // Reset tabs
  document.querySelectorAll("#stickerTabs .yt-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('#stickerTabs .yt-tab[data-stab="emoji"]')?.classList.add("active");
  $("stickerEmojiTab")?.classList.remove("hidden");
  $("stickerTextTab")?.classList.add("hidden");

  // Clear previous selection
  document.querySelectorAll(".sticker-item").forEach(el=>{
    el.style.background = "";
    el.style.color = "";
  });
  $("textStickerInput").value = "";

  showModal("stickerPickerModal");
}

/* Sticker Tabs */
document.addEventListener("click", (e)=>{
  const tab = e.target.closest("#stickerTabs .yt-tab");
  if(!tab) return;
  e.preventDefault();
  e.stopPropagation();

  const stab = tab.dataset.stab;
  document.querySelectorAll("#stickerTabs .yt-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");

  if(stab === "emoji"){
    $("stickerEmojiTab")?.classList.remove("hidden");
    $("stickerTextTab")?.classList.add("hidden");
  }else{
    $("stickerEmojiTab")?.classList.add("hidden");
    $("stickerTextTab")?.classList.remove("hidden");
  }
});

/* Emoji Sticker Select */
document.addEventListener("click", (e)=>{
  const item = e.target.closest(".sticker-item");
  if(!item) return;
  e.preventDefault();
  e.stopPropagation();

  // Deselect all
  document.querySelectorAll(".sticker-item").forEach(el=>{
    el.style.background = "";
    el.style.color = "";
  });

  // Select current
  item.style.background = "var(--primary)";
  item.style.color = "white";

  selectedStickerEmoji = item.dataset.sticker;
  selectedStickerText = null;
});

/* Text Color Select */
document.addEventListener("click", (e)=>{
  const colorEl = e.target.closest(".text-sticker-color");
  if(!colorEl) return;
  e.preventDefault();
  e.stopPropagation();

  document.querySelectorAll(".text-sticker-color").forEach(el=>{
    el.classList.remove("selected");
  });
  colorEl.classList.add("selected");

  selectedStickerColor = colorEl.dataset.color;
});

/* Confirm Sticker */
$("confirmStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  let sticker = null;

  // Check emoji
  if(selectedStickerEmoji){
    sticker = {
      type: "emoji",
      icon: selectedStickerEmoji
    };
  }else{
    // Check text
    const text = $("textStickerInput").value.trim();
    if(text){
      sticker = {
        type: "text",
        text: text,
        icon: text.slice(0, 3) || "✏️",
        color: selectedStickerColor
      };
    }
  }

  if(!sticker){
    toast("Select emoji or enter text");
    return;
  }

  // Apply based on context
  if(stickerPickerContext === "story"){
    applyStickerToStory(sticker);
  }else if(stickerPickerContext === "video"){
    applyStickerToVideo(sticker);
  }else if(stickerPickerContext === "story_edit"){
    applyStickerToStoryEdit(sticker);
  }

  hideModal("stickerPickerModal");
});

/* Remove Sticker */
$("removeStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  if(stickerPickerContext === "story"){
    removeStickerFromStory();
  }else if(stickerPickerContext === "video"){
    removeStickerFromVideo();
  }else if(stickerPickerContext === "story_edit"){
    removeStickerFromStoryEdit();
  }

  hideModal("stickerPickerModal");
});

/* ============================================================
   BUTTON HANDLERS (Story + Video Editor)
============================================================ */

/* Story Add Song Button */
$("storyAddSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  songPickerContext = "story";
  openSongPicker("story");
});

/* Story Add Sticker Button */
$("storyAddStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openStickerPicker("story");
});

/* Story Trim Button */
$("storyTrimBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  // Open trim for story video
  if(storyMediaType !== "video"){
    toast("Trim only for videos");
    return;
  }

  // Use video trim modal but flag for story
  window.__trimContext = "story";
  openVideoTrimModal($("storyVideoPreview"));
});

/* Video Editor — Song Button */
$("editVideoSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  songPickerContext = "video";
  openSongPicker("video");
});

/* Video Editor — Sticker Button */
$("editVideoStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  openStickerPicker("video");
});

/* Video Editor — Trim Button */
$("editVideoTrimBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  window.__trimContext = "video";
  openVideoTrimModal($("uploadPreview"));
});

/* ============================================================
   SHOW EDIT BAR WHEN VIDEO SELECTED
============================================================ */
const _origVideoFileChange = $("videoFile")?.onchange;

$("videoFile")?.addEventListener("change", ()=>{
  setTimeout(()=>{
    const editBar = $("videoEditBar");
    if(editBar && $("videoFile").files[0]){
      editBar.style.display = "block";
    }
  }, 200);
});

/* ============================================================
   SHOW STORY EDITOR TOOLS WHEN MEDIA SELECTED
============================================================ */
$("storyFile")?.addEventListener("change", ()=>{
  setTimeout(()=>{
    const tools = $("storyEditorTools");
    if(tools && ($("storyImagePreview").src || $("storyVideoPreview").src)){
      tools.classList.remove("hidden");
    }
  }, 200);
});

/* ============================================================
   STORY VIEWER — SONG + STICKER DISPLAY
============================================================ */
function displayStorySong(story){
  const overlay = $("storySongOverlay");
  if(!overlay) return;

  if(story.song && story.song.audioURL){
    overlay.classList.remove("hidden");
    $("storySongTitle").textContent = story.song.name || "Song";
    $("storySongArtist").textContent = story.song.artist || "Unknown";

    // Play audio
    if(window.__storyAudio){
      window.__storyAudio.pause();
    }
    window.__storyAudio = new Audio(story.song.audioURL);
    window.__storyAudio.loop = true;
    window.__storyAudio.volume = 0.5;
    window.__storyAudio.play().catch(()=>{});

  }else{
    overlay.classList.add("hidden");
    if(window.__storyAudio){
      window.__storyAudio.pause();
      window.__storyAudio = null;
    }
  }
}

function displayStorySticker(story){
  const overlay = $("storyStickerOverlay");
  if(!overlay) return;

  if(story.sticker){
    overlay.style.display = "block";

    if(story.sticker.type === "emoji"){
      overlay.textContent = story.sticker.icon || "😀";
      overlay.style.color = "";
      overlay.style.fontSize = "80px";
    }else if(story.sticker.type === "text"){
      overlay.textContent = story.sticker.text || "";
      overlay.style.color = story.sticker.color || "#ffffff";
      overlay.style.fontSize = "40px";
      overlay.style.fontWeight = "900";
      overlay.style.textShadow = "2px 2px 8px rgba(0,0,0,0.6)";
    }
  }else{
    overlay.style.display = "none";
    overlay.textContent = "";
  }
}

/* Hook into loadCurrentStory to display song+sticker */
const _origLoadCurrentStory = loadCurrentStory;
loadCurrentStory = function(){
  _origLoadCurrentStory.call(this);

  // After load, display song + sticker
  setTimeout(()=>{
    const group = groupedStories[currentStoryUserIndex];
    if(!group) return;
    const story = group.stories[currentStoryIndex];
    if(!story) return;

    displayStorySong(story);
    displayStorySticker(story);
  }, 100);
};

/* Stop audio when story viewer closes */
const _origCloseStoryViewer = closeStoryViewer;
closeStoryViewer = function(){
  if(window.__storyAudio){
    window.__storyAudio.pause();
    window.__storyAudio = null;
  }

  const songOverlay = $("storySongOverlay");
  if(songOverlay) songOverlay.classList.add("hidden");

  const stickerOverlay = $("storyStickerOverlay");
  if(stickerOverlay){
    stickerOverlay.style.display = "none";
    stickerOverlay.textContent = "";
  }

  _origCloseStoryViewer.call(this);
};

/* Pause audio when story paused */
const _origPauseStoryTimer = pauseStoryTimer;
pauseStoryTimer = function(){
  if(window.__storyAudio) window.__storyAudio.pause();
  _origPauseStoryTimer.call(this);
};

const _origResumeStoryTimer = resumeStoryTimer;
resumeStoryTimer = function(){
  if(window.__storyAudio) window.__storyAudio.play().catch(()=>{});
  _origResumeStoryTimer.call(this);
};

/* ============================================================
   SAVE STORY WITH SONG + STICKER ON UPLOAD
============================================================ */
const _origStoryUploadBtn = $("storyUploadBtn");
if(_origStoryUploadBtn){
  const _origClick = _origStoryUploadBtn.onclick;

  _origStoryUploadBtn.addEventListener("click", async (e)=>{
    // If a song/sticker is selected, they'll be included via pendingStorySong/pendingStorySticker
    // But since we don't modify the upload function directly, we need a different approach

    // This handler just stores values for the next upload
    // Actual upload happens in the original handler
  });
}

/* Override upload function to include song+sticker */
async function saveStoryWithExtras(storyId){
  const updates = {};

  if(pendingStorySong){
    updates.song = pendingStorySong;
  }
  if(pendingStorySticker){
    updates.sticker = pendingStorySticker;
  }
  if(pendingStoryTrim.applied){
    updates.trimStart = pendingStoryTrim.start;
    updates.trimEnd = pendingStoryTrim.end;
  }

  if(Object.keys(updates).length){
    try{
      await updateDoc(doc(db, "stories", storyId), updates);
    }catch(e){ console.error("Story extras save error:", e); }
  }
}

/* ============================================================
   VIDEO TRIM MODAL
============================================================ */
let trimVideoElement = null;
let trimVideoDuration = 0;

function openVideoTrimModal(videoEl){
  if(!videoEl || !videoEl.src){
    toast("No video selected");
    return;
  }

  trimVideoElement = videoEl;

  const trimPreview = $("trimPreviewVideo");
  trimPreview.src = videoEl.src;
  trimPreview.load();

  trimPreview.addEventListener("loadedmetadata", ()=>{
    trimVideoDuration = trimPreview.duration || 0;

    // Setup sliders
    $("trimStartRange").max = trimVideoDuration;
    $("trimEndRange").max = trimVideoDuration;
    $("trimStartRange").value = 0;
    $("trimEndRange").value = trimVideoDuration;

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

$("trimStartRange")?.addEventListener("input", ()=>{
  const start = Number($("trimStartRange").value);
  const end = Number($("trimEndRange").value);
  if(start > end){
    $("trimEndRange").value = start;
  }
  updateTrimLabels();
});

$("trimEndRange")?.addEventListener("input", ()=>{
  const start = Number($("trimStartRange").value);
  const end = Number($("trimEndRange").value);
  if(end < start){
    $("trimStartRange").value = end;
  }
  updateTrimLabels();
});

$("trimCancelBtn")?.addEventListener("click", ()=>{
  hideModal("videoTrimModal");
  trimVideoElement = null;
});

$("trimSaveBtn")?.addEventListener("click", ()=>{
  const start = Number($("trimStartRange").value) || 0;
  const end = Number($("trimEndRange").value) || 0;

  if(end - start < 1){
    toast("Minimum 1 second required");
    return;
  }

  const trimData = {
    start: start,
    end: end,
    applied: true,
    duration: end - start
  };

  if(window.__trimContext === "story"){
    pendingStoryTrim = trimData;
    const status = $("storySelectedMedia");
    if(status) status.textContent = `✂️ Trimmed: ${formatDuration(start)} - ${formatDuration(end)}`;
    toast("✂️ Trim applied to story");

  }else if(window.__trimContext === "video"){
    pendingVideoTrim = trimData;
    const status = $("videoEditStatus");
    if(status) status.textContent = `✂️ Trimmed: ${formatDuration(start)} - ${formatDuration(end)}`;
    toast("✂️ Trim applied to video");
  }

  hideModal("videoTrimModal");
  trimVideoElement = null;
});

/* ============================================================
   TEST HELPER
============================================================ */
console.log("✅ PART B — Story Edit/Delete + Menu loaded!");
console.log("📋 Available functions:");
console.log("  - Story 3-dot menu: Edit + Delete");
console.log("  - applySongToStory(song)");
console.log("  - applyStickerToStory(sticker)");
console.log("  - applySongToVideo(song)");
console.log("  - applyStickerToVideo(sticker)");
console.log("  - applySongToStoryEdit(song)");
console.log("  - applyStickerToStoryEdit(sticker)");
console.log("  - openVideoTrimModal(videoEl)");
/* ============================================================
   ✅ PART C — VIDEO EDITOR (Rotate / Mute / Preview)
============================================================ */

/* VIDEO EDIT STATE (already declared in Part B) */
// pendingVideoSong, pendingVideoSticker, pendingVideoTrim
// pendingVideoRotation, pendingVideoMuted

/* ============================================================
   VIDEO ROTATE BUTTON
============================================================ */
$("editVideoRotateBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){
    toast("Select a video first");
    return;
  }

  // Rotate by 90 degrees
  pendingVideoRotation = (pendingVideoRotation + 90) % 360;

  // Apply rotation to preview
  videoEl.style.transform = `rotate(${pendingVideoRotation}deg)`;
  videoEl.style.transition = "transform 0.3s ease";

  // Update button label
  const btn = $("editVideoRotateBtn");
  if(btn){
    btn.innerHTML = `🔄 ${pendingVideoRotation}°`;
    if(pendingVideoRotation !== 0){
      btn.style.borderColor = "var(--primary)";
      btn.style.color = "var(--primary)";
    }else{
      btn.style.borderColor = "";
      btn.style.color = "";
    }
  }

  // Update status
  const status = $("videoEditStatus");
  if(status){
    status.textContent = `🔄 Rotated ${pendingVideoRotation}°`;
  }

  toast(`🔄 Rotated ${pendingVideoRotation}°`);
});

/* ============================================================
   VIDEO MUTE TOGGLE
============================================================ */
$("editVideoMuteBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){
    toast("Select a video first");
    return;
  }

  pendingVideoMuted = !pendingVideoMuted;

  // Apply mute
  videoEl.muted = pendingVideoMuted;

  // Update button
  const btn = $("editVideoMuteBtn");
  if(btn){
    if(pendingVideoMuted){
      btn.innerHTML = "🔇 Muted";
      btn.style.borderColor = "var(--primary)";
      btn.style.color = "var(--primary)";
    }else{
      btn.innerHTML = "🔊 Sound";
      btn.style.borderColor = "";
      btn.style.color = "";
    }
  }

  const status = $("videoEditStatus");
  if(status){
    status.textContent = pendingVideoMuted ? "🔇 Video muted" : "🔊 Sound on";
  }

  toast(pendingVideoMuted ? "🔇 Muted" : "🔊 Sound on");
});

/* ============================================================
   VIDEO PREVIEW BUTTON
============================================================ */
$("editVideoPreviewBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();

  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){
    toast("Select a video first");
    return;
  }

  // Use the main video player modal
  const playerVideo = $("videoPlayerVideo");
  if(playerVideo){
    playerVideo.src = videoEl.src;
    playerVideo.muted = pendingVideoMuted;
    playerVideo.style.transform = `rotate(${pendingVideoRotation}deg)`;

    // Hide actions in preview
    ["videoPlayerLikeBtn", "videoPlayerCommentBtn", "videoPlayerShareBtn",
     "videoPlayerSaveBtn", "videoPlayerPlaylistBtn"].forEach(id => {
      const btn = $(id);
      if(btn) btn.style.display = "none";
    });

    // Show title
    const titleEl = $("videoPlayerTitle");
    if(titleEl) titleEl.textContent = "🎬 Preview";

    const metaEl = $("videoPlayerMeta");
    if(metaEl){
      let info = [];
      if(pendingVideoRotation) info.push(`Rotate: ${pendingVideoRotation}°`);
      if(pendingVideoMuted) info.push("Muted");
      if(pendingVideoTrim.applied) info.push(`Trim: ${formatDuration(pendingVideoTrim.start)} - ${formatDuration(pendingVideoTrim.end)}`);
      if(pendingVideoSong) info.push(`🎵 ${pendingVideoSong.name}`);
      if(pendingVideoSticker) info.push(`😀 ${pendingVideoSticker.icon}`);
      metaEl.textContent = info.join(" · ") || "Original video";
    }

    const descEl = $("videoPlayerDesc");
    if(descEl){
      descEl.textContent = $("videoTitle")?.value || "";
      descEl.style.display = descEl.textContent ? "block" : "none";
    }

    // Reset rotations
    setTimeout(()=>{
      playerVideo.play().catch(()=>{});
    }, 300);

    showModal("videoPlayerModal");
  }
});

/* ============================================================
   RESET VIDEO EDITOR (after upload or on error)
============================================================ */
function resetVideoEditor(){
  pendingVideoSong = null;
  pendingVideoSticker = null;
  pendingVideoTrim = { start: 0, end: 0, applied: false };
  pendingVideoRotation = 0;
  pendingVideoMuted = false;

  const videoEl = $("uploadPreview");
  if(videoEl){
    videoEl.style.transform = "";
    videoEl.muted = false;
  }

  // Reset buttons
  const songBtn = $("editVideoSongBtn");
  if(songBtn){
    songBtn.innerHTML = "🎵 Song";
    songBtn.style.borderColor = "";
    songBtn.style.color = "";
  }

  const stickerBtn = $("editVideoStickerBtn");
  if(stickerBtn){
    stickerBtn.innerHTML = "😀 Sticker";
    stickerBtn.style.borderColor = "";
    stickerBtn.style.color = "";
  }

  const rotateBtn = $("editVideoRotateBtn");
  if(rotateBtn){
    rotateBtn.innerHTML = "🔄 Rotate";
    rotateBtn.style.borderColor = "";
    rotateBtn.style.color = "";
  }

  const muteBtn = $("editVideoMuteBtn");
  if(muteBtn){
    muteBtn.innerHTML = "🔇 Mute";
    muteBtn.style.borderColor = "";
    muteBtn.style.color = "";
  }

  const status = $("videoEditStatus");
  if(status) status.textContent = "";

  // Hide edit bar
  const editBar = $("videoEditBar");
  if(editBar) editBar.style.display = "none";
}

/* ============================================================
   SAVE VIDEO EDIT DATA TO FIRESTORE
============================================================ */
async function saveVideoEditsToFirestore(videoId){
  const updates = {};

  if(pendingVideoRotation !== 0){
    updates.rotation = pendingVideoRotation;
  }
  if(pendingVideoMuted){
    updates.muted = true;
  }
  if(pendingVideoTrim.applied){
    updates.trimStart = pendingVideoTrim.start;
    updates.trimEnd = pendingVideoTrim.end;
  }
  if(pendingVideoSong){
    updates.song = pendingVideoSong;
  }
  if(pendingVideoSticker){
    updates.sticker = pendingVideoSticker;
  }

  if(Object.keys(updates).length){
    try{
      await updateDoc(doc(db, "videos", videoId), updates);
      return true;
    }catch(e){
      console.error("Video edits save error:", e);
      return false;
    }
  }

  return true;
}

/* ============================================================
   VIDEO PREVIEW MODAL — RESET ON CLOSE
============================================================ */
const _origHideModal = hideModal;
hideModal = function(id){
  if(id === "videoPlayerModal"){
    const playerVideo = $("videoPlayerVideo");
    if(playerVideo){
      playerVideo.style.transform = "";
      playerVideo.muted = false;
    }
  }
  _origHideModal.call(this, id);
};

/* ============================================================
   VIDEO ROTATE — SHOW STYLED PREVIEW IN FEED
============================================================ */
function applyVideoRotationToElement(videoEl, rotation){
  if(!videoEl || !rotation) return;

  // For 90/270 rotation, container needs adjustment
  if(rotation === 90 || rotation === 270){
    videoEl.style.transform = `rotate(${rotation}deg) scale(${1.3})`;
  }else{
    videoEl.style.transform = `rotate(${rotation}deg)`;
  }
}

/* ============================================================
   VIDEO EDIT STATUS — REAL-TIME UPDATES
============================================================ */
function updateVideoEditStatus(){
  const status = $("videoEditStatus");
  if(!status) return;

  let parts = [];

  if(pendingVideoTrim.applied){
    parts.push(`✂️ ${formatDuration(pendingVideoTrim.start)} - ${formatDuration(pendingVideoTrim.end)}`);
  }
  if(pendingVideoRotation){
    parts.push(`🔄 ${pendingVideoRotation}°`);
  }
  if(pendingVideoMuted){
    parts.push("🔇 Muted");
  }
  if(pendingVideoSong){
    parts.push(`🎵 ${pendingVideoSong.name}`);
  }
  if(pendingVideoSticker){
    parts.push(`😀 Sticker`);
  }

  status.textContent = parts.length ? parts.join(" · ") : "No edits applied";
}

/* ============================================================
   UPLOAD — INCLUDE VIDEO EDITS
============================================================ */
/* Hook into publish to save edits after upload */
const _origPublishBtn = $("publishBtn");
if(_origPublishBtn){
  const originalOnClick = _origPublishBtn.onclick;

  _origPublishBtn.addEventListener("click", async (e)=>{
    // Wait a bit for video doc to be created
    setTimeout(async ()=>{
      // Find the latest video by this user
      try{
        const q = query(
          collection(db, "videos"),
          where("userId", "==", currentUser.uid)
        );
        const snap = await getDocs(q);
        if(!snap.empty){
          // Get the most recent one
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          docs.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
          const latestVideoId = docs[0].id;

          // Save edits
          await saveVideoEditsToFirestore(latestVideoId);

          // Reset editor
          resetVideoEditor();
        }
      }catch(err){
        console.error("Save video edits error:", err);
      }
    }, 2500);
  });
}

/* ============================================================
   VIDEO FILE CHANGE — SHOW EDIT BAR
============================================================ */
$("videoFile")?.addEventListener("change", ()=>{
  setTimeout(()=>{
    const editBar = $("videoEditBar");
    if(editBar && $("videoFile").files[0]){
      editBar.style.display = "block";
      updateVideoEditStatus();
    }
  }, 300);
});

/* ============================================================
   VIDEO PLAYER — APPLY ROTATION/MUTE/TRIM WHEN OPENING
============================================================ */
const _origOpenVideoPlayer = window.openVideoPlayer;
window.openVideoPlayer = function(videoId){
  const v = videosCache.find(x => x.id === videoId);

  if(v){
    // Apply rotation
    if(v.rotation){
      const playerVideo = $("videoPlayerVideo");
      if(playerVideo){
        setTimeout(()=>{
          playerVideo.style.transition = "transform 0.3s ease";
          if(v.rotation === 90 || v.rotation === 270){
            playerVideo.style.transform = `rotate(${v.rotation}deg) scale(1.3)`;
          }else{
            playerVideo.style.transform = `rotate(${v.rotation}deg)`;
          }
        }, 200);
      }
    }

    // Apply mute
    if(v.muted){
      const playerVideo = $("videoPlayerVideo");
      if(playerVideo){
        setTimeout(()=>{ playerVideo.muted = true; }, 200);
      }
    }

    // Apply song
    if(v.song && v.song.audioURL){
      setTimeout(()=>{
        if(window.__videoAudio){
          window.__videoAudio.pause();
        }
        window.__videoAudio = new Audio(v.song.audioURL);
        window.__videoAudio.loop = true;
        window.__videoAudio.volume = 0.5;
        window.__videoAudio.play().catch(()=>{});
      }, 300);
    }
  }

  // Call original
  _origOpenVideoPlayer.call(this, videoId);
};

/* ============================================================
   VIDEO PLAYER — STOP AUDIO ON CLOSE
============================================================ */
document.addEventListener("click", (e)=>{
  const closeBtn = e.target.closest('[data-close="videoPlayerModal"]');
  if(closeBtn){
    if(window.__videoAudio){
      window.__videoAudio.pause();
      window.__videoAudio = null;
    }
    const playerVideo = $("videoPlayerVideo");
    if(playerVideo){
      playerVideo.style.transform = "";
      playerVideo.muted = false;
    }
  }
});

/* ============================================================
   RESET EDITOR ON PAGE CHANGE
============================================================ */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", ()=>{
    if(btn.dataset.panel !== "uploadPanel"){
      // Keep edits but hide bar
      const editBar = $("videoEditBar");
      if(editBar && !$("videoFile").files[0]){
        editBar.style.display = "none";
      }
    }
  });
});

/* ============================================================
   TEST HELPER
============================================================ */
console.log("✅ PART C — Video Editor loaded!");
console.log("📋 Available functions:");
console.log("  - Video Rotate (0°/90°/180°/270°)");
console.log("  - Video Mute toggle");
console.log("  - Video Preview modal");
console.log("  - Video Trim (from Part B)");
console.log("  - saveVideoEditsToFirestore()");
console.log("  - resetVideoEditor()");
/* ============================================================
   ✅ PART D — FEED SONG/STICKER DISPLAY + FINAL INIT
============================================================ */

/* ============================================================
   VIDEO CARD — SONG + STICKER DISPLAY IN FEED
============================================================ */
function createVideoCard(v){
  const isSaved = mySavesCache.has(v.id);
  const views = Number(v.views || 0);
  const mine = currentUser && v.userId === currentUser.uid;

  // Song badge
  let songBadge = "";
  if(v.song && v.song.name){
    songBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(124,58,237,0.15);color:var(--primary);font-size:10px;font-weight:600;border-radius:8px;margin-top:4px">🎵 ${esc(v.song.name)}</span>`;
  }

  // Sticker badge
  let stickerBadge = "";
  if(v.sticker){
    const icon = v.sticker.type === "emoji" ? v.sticker.icon : v.sticker.text;
    if(icon){
      stickerBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(236,72,153,0.15);color:#ec4899;font-size:10px;font-weight:600;border-radius:8px;margin-top:4px;margin-left:4px">${esc(icon)}</span>`;
    }
  }

  // Rotation style
  const rotationStyle = v.rotation ? `transform: rotate(${v.rotation}deg);` : "";
  const scaleStyle = (v.rotation === 90 || v.rotation === 270) ? "scale(1.3);" : "";

  return `
  <div class="video-card" data-id="${esc(v.id)}" data-open-video="${esc(v.id)}">
    <div class="thumbnail">
      <video src="${esc(v.videoURL)}#t=0.5" preload="metadata" muted playsinline
             style="${rotationStyle}${scaleStyle}"></video>
      <span class="duration" data-duration-for="${esc(v.id)}">0:00</span>
      ${v.muted ? `<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:white;font-size:11px;padding:3px 8px;border-radius:8px;font-weight:600">🔇</span>` : ""}
    </div>
    <div class="video-info">
      <img class="channel-avatar post-open-user" data-uid="${esc(v.userId)}"
           src="${avatar(v.userPhoto, v.userName)}" alt="${esc(v.userName)}">
      <div class="video-details">
        <h3 class="video-title">${esc(v.title || "Untitled")}</h3>
        <p class="channel-name">
          ${esc(v.username || v.userName || "User")}
          <span class="verified">✓</span>
        </p>
        <p class="video-meta">
          ${formatViewsShort(views)} views
          <span class="dot">•</span>
          ${timeAgoYouTube(v.createdAt)}
        </p>
        ${songBadge || stickerBadge ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${songBadge}${stickerBadge}</div>` : ""}
      </div>
      ${mine || isAdminUser() ? `<button class="video-more" onclick="event.stopPropagation();event.preventDefault();openVideoMenu('${esc(v.id)}')">⋮</button>` : ""}
    </div>
  </div>
  `;
}

/* ============================================================
   VIDEO PLAYER — APPLY ROTATION/MUTE/SONG ON OPEN
============================================================ */
const _origOpenVideoPlayerPartC = window.openVideoPlayer;
window.openVideoPlayer = function(videoId){
  const v = videosCache.find(x => x.id === videoId);

  if(v){
    // Reset first
    const playerVideo = $("videoPlayerVideo");
    if(playerVideo){
      playerVideo.style.transform = "";
      playerVideo.muted = false;
    }
    if(window.__videoAudio){
      window.__videoAudio.pause();
      window.__videoAudio = null;
    }

    // Apply rotation
    if(v.rotation){
      setTimeout(()=>{
        if(playerVideo){
          playerVideo.style.transition = "transform 0.3s ease";
          if(v.rotation === 90 || v.rotation === 270){
            playerVideo.style.transform = `rotate(${v.rotation}deg) scale(1.3)`;
          }else{
            playerVideo.style.transform = `rotate(${v.rotation}deg)`;
          }
        }
      }, 300);
    }

    // Apply mute
    if(v.muted && playerVideo){
      setTimeout(()=>{ playerVideo.muted = true; }, 300);
    }

    // Apply song
    if(v.song && v.song.audioURL){
      setTimeout(()=>{
        window.__videoAudio = new Audio(v.song.audioURL);
        window.__videoAudio.loop = true;
        window.__videoAudio.volume = 0.5;
        window.__videoAudio.play().catch(()=>{});
      }, 400);
    }

    // Add song info in meta
    const metaEl = $("videoPlayerMeta");
    if(metaEl){
      let extraInfo = [];
      if(v.song) extraInfo.push(`🎵 ${v.song.name}`);
      if(v.muted) extraInfo.push("🔇 Muted");
      if(v.rotation) extraInfo.push(`🔄 ${v.rotation}°`);

      const baseMeta = formatViews(v.views) + " · " + timeAgo(v.createdAt);
      if(extraInfo.length){
        metaEl.innerHTML = `${baseMeta}<br><span style="font-size:11px;color:var(--primary)">${extraInfo.join(" · ")}</span>`;
      }else{
        metaEl.textContent = baseMeta;
      }
    }
  }

  // Call original from Part C
  _origOpenVideoPlayerPartC.call(this, videoId);
};

/* ============================================================
   STORY VIEWER — SONG + STICKER DISPLAY (Override from Part B)
============================================================ */
const _origLoadCurrentStoryPartD = loadCurrentStory;
loadCurrentStory = function(){
  // First stop any running audio
  if(window.__storyAudio){
    window.__storyAudio.pause();
    window.__storyAudio = null;
  }

  _origLoadCurrentStoryPartD.call(this);

  setTimeout(()=>{
    const group = groupedStories[currentStoryUserIndex];
    if(!group) return;
    const story = group.stories[currentStoryIndex];
    if(!story) return;

    /* ---- SONG ---- */
    const songOverlay = $("storySongOverlay");
    if(songOverlay){
      if(story.song && story.song.audioURL){
        songOverlay.classList.remove("hidden");
        $("storySongTitle").textContent = story.song.name || "Song";
        $("storySongArtist").textContent = story.song.artist || "Unknown";

        // Play audio
        window.__storyAudio = new Audio(story.song.audioURL);
        window.__storyAudio.loop = true;
        window.__storyAudio.volume = 0.5;
        window.__storyAudio.play().catch(()=>{});
      }else{
        songOverlay.classList.add("hidden");
      }
    }

    /* ---- STICKER ---- */
    const stickerOverlay = $("storyStickerOverlay");
    if(stickerOverlay){
      if(story.sticker){
        stickerOverlay.style.display = "block";

        if(story.sticker.type === "emoji"){
          stickerOverlay.textContent = story.sticker.icon || "😀";
          stickerOverlay.style.color = "";
          stickerOverlay.style.fontSize = "80px";
          stickerOverlay.style.fontWeight = "";
          stickerOverlay.style.textShadow = "0 2px 8px rgba(0,0,0,0.4)";
        }else if(story.sticker.type === "text"){
          stickerOverlay.textContent = story.sticker.text || "";
          stickerOverlay.style.color = story.sticker.color || "#ffffff";
          stickerOverlay.style.fontSize = "40px";
          stickerOverlay.style.fontWeight = "900";
          stickerOverlay.style.textShadow = "2px 2px 8px rgba(0,0,0,0.6)";
        }
      }else{
        stickerOverlay.style.display = "none";
        stickerOverlay.textContent = "";
      }
    }

    /* ---- TRIM (if applied) ---- */
    const mediaContainer = $("storyMedia");
    const videoEl = mediaContainer?.querySelector("video");
    if(videoEl && story.trimStart && story.trimEnd){
      videoEl.currentTime = story.trimStart;
      videoEl.addEventListener("timeupdate", ()=>{
        if(videoEl.currentTime >= story.trimEnd){
          videoEl.currentTime = story.trimStart;
        }
      });
    }

  }, 200);
};

/* ============================================================
   STOP ALL AUDIO WHEN VIEWER CLOSES
============================================================ */
const _origCloseStoryViewerPartD = closeStoryViewer;
closeStoryViewer = function(){
  if(window.__storyAudio){
    window.__storyAudio.pause();
    window.__storyAudio = null;
  }
  const songOverlay = $("storySongOverlay");
  if(songOverlay) songOverlay.classList.add("hidden");

  const stickerOverlay = $("storyStickerOverlay");
  if(stickerOverlay){
    stickerOverlay.style.display = "none";
    stickerOverlay.textContent = "";
  }

  _origCloseStoryViewerPartD.call(this);
};

/* ============================================================
   STORY PAUSE — PAUSE AUDIO TOO
============================================================ */
const _origPauseStoryPartD = pauseStoryTimer;
pauseStoryTimer = function(){
  if(window.__storyAudio) window.__storyAudio.pause();
  _origPauseStoryPartD.call(this);
};

const _origResumeStoryPartD = resumeStoryTimer;
resumeStoryTimer = function(){
  if(window.__storyAudio) window.__storyAudio.play().catch(()=>{});
  _origResumeStoryPartD.call(this);
};

/* ============================================================
   VIDEO PLAYER CLOSE — STOP AUDIO
============================================================ */
document.addEventListener("click", (e)=>{
  const closeBtn = e.target.closest('[data-close="videoPlayerModal"]');
  if(closeBtn){
    if(window.__videoAudio){
      window.__videoAudio.pause();
      window.__videoAudio = null;
    }
    const playerVideo = $("videoPlayerVideo");
    if(playerVideo){
      playerVideo.style.transform = "";
      playerVideo.muted = false;
    }
  }
});

/* ============================================================
   ADMIN — UPDATE STORY/VISIBILITY
============================================================ */
async function adminForceDeleteVideo(videoId){
  if(!isAdminUser()){ toast("Not admin"); return; }

  const videoSnap = await getDoc(doc(db, "videos", videoId));
  if(!videoSnap.exists()){ toast("Not found"); return; }

  if(!confirm("ADMIN: Force delete this video?")) return;

  try{
    const comments = await getDocs(collection(db, "videos", videoId, "comments"));
    for(const c of comments.docs) await deleteDoc(c.ref);
    const likes = await getDocs(collection(db, "videos", videoId, "likes"));
    for(const l of likes.docs) await deleteDoc(l.ref);
    const views = await getDocs(collection(db, "videos", videoId, "views"));
    for(const v of views.docs) await deleteDoc(v.ref);

    await deleteDoc(doc(db, "videos", videoId));
    toast("🗑️ Force deleted");
  }catch(e){
    console.error("Admin delete error:", e);
    toast("Failed");
  }
}

/* ============================================================
   ADMIN — UPDATE ADMIN BUTTON VISIBILITY (already in Part A)
============================================================ */
const _origUpdateAdminVisibility = updateAdminVisibility;
updateAdminVisibility = function(){
  _origUpdateAdminVisibility.call(this);
};

/* ============================================================
   FINAL INIT — APPLY ALL HOOKS AFTER LOGIN
============================================================ */
const _origOnAuthPartD = onAuthStateChanged;
onAuthStateChanged(auth, (user)=>{
  if(user){
    setTimeout(()=>{
      startSongLibraryListener();
      updateAdminVisibility();
      console.log("🎵 Song library active");
    }, 2000);
  }
});

/* ============================================================
   APPLY VIDEO EDIT CHANGES TO FEED CARDS (real-time)
============================================================ */
// Already handled in createVideoCard - reads from Firestore on each render

/* ============================================================
   ROTATION FIX FOR PREVIEW IN VIDEO PLAYER
============================================================ */
const _origResetVideoPlayerPartD = resetVideoPlayer;
resetVideoPlayer = function(){
  const playerVideo = $("videoPlayerVideo");
  if(playerVideo){
    playerVideo.style.transform = "";
    playerVideo.muted = false;
    playerVideo.style.transition = "";
  }
  if(window.__videoAudio){
    window.__videoAudio.pause();
    window.__videoAudio = null;
  }
  _origResetVideoPlayerPartD.call(this);
};

/* ============================================================
   STORY UPLOAD — INCLUDE SONG + STICKER AFTER UPLOAD
============================================================ */
async function applyPendingStoryExtras(){
  if(!currentUser) return;

  // Get latest story from this user
  try{
    const q = query(
      collection(db, "stories"),
      where("userId", "==", currentUser.uid)
    );
    const snap = await getDocs(q);
    if(snap.empty) return;

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
    const latestStoryId = docs[0].id;

    const updates = {};
    if(pendingStorySong) updates.song = pendingStorySong;
    if(pendingStorySticker) updates.sticker = pendingStorySticker;
    if(pendingStoryTrim.applied){
      updates.trimStart = pendingStoryTrim.start;
      updates.trimEnd = pendingStoryTrim.end;
    }

    if(Object.keys(updates).length){
      await updateDoc(doc(db, "stories", latestStoryId), updates);

      // Reset
      pendingStorySong = null;
      pendingStorySticker = null;
      pendingStoryTrim = { start: 0, end: 0, applied: false };

      // Reset buttons
      const songBtn = $("storyAddSongBtn");
      if(songBtn){
        songBtn.innerHTML = "🎵 Song";
        songBtn.style.borderColor = "";
        songBtn.style.color = "";
      }

      const stickerBtn = $("storyAddStickerBtn");
      if(stickerBtn){
        stickerBtn.innerHTML = "😀 Sticker";
        stickerBtn.style.borderColor = "";
        stickerBtn.style.color = "";
      }

      const status = $("storySelectedMedia");
      if(status) status.textContent = "";
    }
  }catch(err){
    console.error("Story extras error:", err);
  }
}

/* Hook into story upload button */
$("storyUploadBtn")?.addEventListener("click", async ()=>{
  setTimeout(async ()=>{
    if($("storyUploadBtn")?.disabled === false){
      // Upload finished
      await applyPendingStoryExtras();
    }
  }, 3000);
});

/* ============================================================
   STORY TRIM — PLAY ONLY SELECTED PORTION IN VIEWER
============================================================ */
document.addEventListener("loadedmetadata", (e)=>{
  if(e.target.tagName !== "VIDEO") return;
  const videoEl = e.target;

  // Check if inside story viewer
  const mediaContainer = $("storyMedia");
  if(!mediaContainer || !mediaContainer.contains(videoEl)) return;

  // Get current story
  const group = groupedStories[currentStoryUserIndex];
  if(!group) return;
  const story = group.stories[currentStoryIndex];
  if(!story || !story.trimStart || !story.trimEnd) return;

  videoEl.currentTime = story.trimStart;

  videoEl.addEventListener("timeupdate", ()=>{
    if(videoEl.currentTime >= story.trimEnd){
      videoEl.currentTime = story.trimStart;
    }
  });
}, true);

/* ============================================================
   VIDEO DELETE — FORCE USER + ADMIN (Final Override)
============================================================ */
window.deleteVideo = async function(videoId){
  if(!currentUser) return;

  const ref = doc(db, "videos", videoId);
  const snap = await getDoc(ref);

  if(!snap.exists()){ toast("Not found"); return; }

  const ownerId = snap.data().userId;
  const isOwnerUser = ownerId === currentUser.uid;
  const isAdmin = isAdminUser();

  if(!isOwnerUser && !isAdmin){
    toast("You can't delete this video");
    return;
  }

  if(!confirm(isAdmin && !isOwnerUser ? "ADMIN: Delete this video?" : "Delete this video?")) return;

  try{
    const comments = await getDocs(collection(db, "videos", videoId, "comments"));
    for(const c of comments.docs) await deleteDoc(c.ref);
    const likes = await getDocs(collection(db, "videos", videoId, "likes"));
    for(const l of likes.docs) await deleteDoc(l.ref);
    const views = await getDocs(collection(db, "videos", videoId, "views"));
    for(const v of views.docs) await deleteDoc(v.ref);

    await deleteDoc(ref);

    const q = query(collection(db, "videos"), where("userId", "==", ownerId));
    const ownerVideos = await getDocs(q);
    await updateDoc(doc(db, "profiles", ownerId), { videos: ownerVideos.size });

    toast(isAdmin && !isOwnerUser ? "🗑️ Video deleted (admin)" : "🗑️ Video deleted");
  }catch(e){
    console.error("deleteVideo error:", e);
    toast("Failed: " + e.message);
  }
};

/* ============================================================
   VIDEO MORE MENU (3-dot on video card)
============================================================ */
window.openVideoMenu = function(videoId){
  const v = videosCache.find(x => x.id === videoId);
  if(!v){ toast("Not found"); return; }

  const mine = currentUser && v.userId === currentUser.uid;
  const isAdmin = isAdminUser();
  const canDelete = mine || isAdmin;
  const canEdit = mine;

  if(!canDelete && !canEdit){
    toast("You can't manage this video");
    return;
  }

  let options = [];
  if(canEdit) options.push("1 = ✏️ Edit");
  if(canDelete) options.push("2 = 🗑️ Delete" + (isAdmin && !mine ? " (ADMIN)" : ""));
  options.push("3 = ❌ Cancel");

  const action = prompt("Choose action:\n\n" + options.join("\n") + "\n\nEnter number:");

  if(action === "1" && canEdit){
    openEditVideo(videoId);
  }else if(action === "2" && canDelete){
    window.deleteVideo(videoId);
  }
};

/* ============================================================
   ALL FUNCTIONS — FINAL CHECK
============================================================ */
function _finalCheck(){
  const required = [
    "startSongLibraryListener",
    "openAdminSongLibrary",
    "openSongPicker",
    "openStickerPicker",
    "openVideoTrimModal",
    "applySongToStory",
    "applyStickerToStory",
    "applySongToVideo",
    "applyStickerToVideo"
  ];

  const missing = [];
  required.forEach(fn => {
    if(typeof window[fn] !== "function"){
      missing.push(fn);
    }
  });

  if(missing.length){
    console.warn("⚠️ Missing functions:", missing);
  }else{
    console.log("✅ All functions loaded");
  }
}

setTimeout(_finalCheck, 5000);

/* ============================================================
   FINAL INIT — RUN ONCE
============================================================ */
console.log("✅ PART D — Final loaded!");
console.log("🎉 ReelHub — Full System Ready");
console.log("📋 Features:");
console.log("  ✅ Admin Song Library");
console.log("  ✅ Story Edit + Delete");
console.log("  ✅ Story Song + Sticker");
console.log("  ✅ Video Song + Sticker");
console.log("  ✅ Video Trim + Rotate + Mute");
console.log("  ✅ Video Delete (User + Admin)");
console.log("  ✅ Story Video Trim");