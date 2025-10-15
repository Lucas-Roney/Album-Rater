let editMode = false;
let ratingsVisible = false;
let currentPage = 1;
const albumsPerPage = 5;
let lastDeleted = null;
let currentSortOption = localStorage.getItem("sortOption") || "ratingDesc";
const artistsPerPage = 5;
let currentArtistPage = 1;

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

function normalizeAlbumName(name) {
  return name.trim().toLowerCase();
}

function capitalizeAlbumName(name) {
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function capitalizeFirst(str) {
  return typeof str === "string" && str.length > 0
    ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    : "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const localDate = new Date(+year, +month - 1, +day);
  return localDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = "toast";
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 0 10px rgba(0,255,255,0.4);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function updateFavicon(path) {
  const favicon = document.getElementById("dynamic-favicon");
  if (favicon) favicon.href = path;
}

function getGlowClass(rating) {
  if (rating === "S" || rating < 2) return "glow-skip";         // 0–1
  if (rating < 4) return "glow-weak";                            // 2–3
  if (rating < 6) return "glow-decent";                          // 4–5
  if (rating < 7) return "glow-good";                            // 6
  if (rating < 8) return "glow-great";                           // 7
  if (rating < 9) return "glow-excellent";                       // 8
  return "glow-masterpiece";                                     // 9–10+
}

function normalizeGenre(genre) {
  if (!genre) return "Unknown Genre";
  const g = genre.trim().toLowerCase();
  if (["rap", "hip hop", "hip-hop", "hiphop", "hip-hop/rap"].includes(g)) return "Rap";
  if (["r&b", "rnb", "rhythm and blues"].includes(g)) return "R&B";
  if (["electronic", "edm", "dance"].includes(g)) return "Electronic";
  // Add more mappings as needed
  return genre.trim();
}

function getBestRatedTags(sortedAlbums, sortOption) {
  let groupKeyFn, groupLabel;

  if (sortOption.includes("genre")) {
    groupKeyFn = (d) => normalizeGenre(d.genre);
    groupLabel = "in";
  } else if (sortOption.includes("artist")) {
    groupKeyFn = (d) => d.artist || "Unknown Artist";
    groupLabel = "by";
  } else if (sortOption.includes("date")) {
    groupKeyFn = (d) => {
      const year = new Date(d.releaseDate).getFullYear();
      return isNaN(year) ? "Unknown Decade" : `${Math.floor(year / 10) * 10}s`;
    };
    groupLabel = "in";
  } else {
    groupKeyFn = null;
    groupLabel = "";
  }

  const bestByGroup = {};
  let bestOverall = { album: null, rating: -Infinity };

  for (const [album, data] of sortedAlbums) {
    const rating = parseFloat(data.rating);
    if (isNaN(rating)) continue;

    const groupKey = groupKeyFn ? groupKeyFn(data) : null;

    if (groupKey) {
      if (!bestByGroup[groupKey] || rating > bestByGroup[groupKey].rating) {
        bestByGroup[groupKey] = { album, rating };
      }
    }

    if (rating > bestOverall.rating) {
      bestOverall = { album, rating };
    }
  }

  return { bestByGroup, bestOverall, groupKeyFn, groupLabel };
}

function renderAllRatings(sortOption = currentSortOption, page = 1) {
  currentSortOption = sortOption;
  currentPage = page;
  localStorage.setItem("sortOption", sortOption);

  const resultDiv = document.getElementById("result");
  const savedRatings = JSON.parse(localStorage.getItem("albumRatings")) || {};

  if (Object.keys(savedRatings).length === 0) {
    resultDiv.innerHTML = "<p>No ratings saved yet.</p>";
    return;
  }

  // Sort albums
  let sortedAlbums = Object.entries(savedRatings);
  const sorters = {
    ratingAsc: (a, b) => a[1].rating - b[1].rating || a[0].localeCompare(b[0]),
    ratingDesc: (a, b) => b[1].rating - a[1].rating || a[0].localeCompare(b[0]),
    artistAsc: (a, b) => (a[1].artist || "").localeCompare(b[1].artist || ""),
    artistDesc: (a, b) => (b[1].artist || "").localeCompare(a[1].artist || ""),
    genreAsc: (a, b) => (a[1].genre || "").localeCompare(b[1].genre || ""),
    genreDesc: (a, b) => (b[1].genre || "").localeCompare(a[1].genre || ""),
    dateAsc: (a, b) => new Date(a[1].releaseDate || 0) - new Date(b[1].releaseDate || 0),
    dateDesc: (a, b) => new Date(b[1].releaseDate || 0) - new Date(a[1].releaseDate || 0)
  };
  sortedAlbums.sort(sorters[sortOption]);

  // Pagination setup
  const totalPages = Math.ceil(sortedAlbums.length / albumsPerPage);
  const startIndex = (page - 1) * albumsPerPage;
  const paginatedAlbums = sortedAlbums.slice(startIndex, startIndex + albumsPerPage);

  // Build HTML
  const sortIcons = {
    ratingDesc: "🔼", ratingAsc: "🔽",
    artistAsc: "🎤", artistDesc: "🎤",
    genreAsc: "🎧", genreDesc: "🎧",
    dateAsc: "📅", dateDesc: "📅"
  };

  let html = `
    <div id="rating-scale" style="display:flex; gap:12px; align-items:center; font-size:0.85em; margin-bottom:8px;">
      <strong style="color:whitesmoke;">Rating Scale:</strong>
      <div style="display:flex; gap:8px;">
        <div class="glow-rating glow-skip">0–2: Skip</div>
        <div class="glow-rating glow-weak">2–4: Weak</div>
        <div class="glow-rating glow-decent">4–6: Mid</div>
        <div class="glow-rating glow-good">6–7: Good</div>
        <div class="glow-rating glow-great">7–8: Great</div>
        <div class="glow-rating glow-excellent">8–9: Excellent</div>
        <div class="glow-rating glow-masterpiece">9–10: Masterpiece</div>
      </div>
    </div>

    <div style="text-align:right; margin-bottom:8px;">
      <select id="sortSelect">
        <option value="ratingDesc">${sortIcons.ratingDesc} Rating ↑</option>
        <option value="ratingAsc">${sortIcons.ratingAsc} Rating ↓</option>
        <option value="artistAsc">${sortIcons.artistAsc} Artist A → Z</option>
        <option value="artistDesc">${sortIcons.artistDesc} Artist Z → A</option>
        <option value="genreAsc">${sortIcons.genreAsc} Genre A → Z</option>
        <option value="genreDesc">${sortIcons.genreDesc} Genre Z → A</option>
        <option value="dateAsc">${sortIcons.dateAsc} Oldest First</option>
        <option value="dateDesc">${sortIcons.dateDesc} Newest First</option>
      </select>
    </div>
    <div style="display:flex; font-weight:bold; padding:8px 12px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:8px;">
      <div style="flex:1; text-align:left;">Cover & Name</div>
      <div style="flex:1; text-align:center;">Rating</div>
      <div style="flex:1; text-align:right;">Delete</div>
    </div>
    <ul style="list-style:none; padding:0; margin:0;">
  `;

  const { bestByGroup, bestOverall } = getBestRatedTags(sortedAlbums, sortOption);

for (const [album, data] of paginatedAlbums) {
  const displayName = capitalizeAlbumName(album);
  const coverHTML = data.cover
    ? `<img src="${escapeHTML(data.cover)}" alt="Album Cover" style="max-width:50px; vertical-align:middle; border-radius:5px;">`
    : '';

  const ratingDisplay = data.rating === "S" ? "⏭️ Skip" :
                        data.rating === "I" ? "🎵 Interlude" :
                        `${data.rating} / 10`;

  // Determine group key and label based on sort mode
  let groupKey = null;
  let label = "in";

  if (sortOption.includes("genre")) {
    groupKey = data.genre || "Unknown Genre";
  } else if (sortOption.includes("artist")) {
    groupKey = data.artist || "Unknown Artist";
    label = "by";
  } else if (sortOption.includes("date")) {
    const year = new Date(data.releaseDate).getFullYear();
    groupKey = isNaN(year) ? "Unknown Decade" : `${Math.floor(year / 10) * 10}s`;
  }

  // Trophy logic
  const isBestInGroup = groupKey && bestByGroup[groupKey]?.album === album;
  const isBestOverall = bestOverall.album === album;

  let tagHTML = "";
  if (isBestInGroup && isBestOverall) {
    tagHTML = `<div class="best-tag overall">🏆🏆 Best rated ${label} ${escapeHTML(groupKey)}</div>`;
  } else if (isBestInGroup) {
    tagHTML = `<div class="best-tag">🏆 Best rated ${label} ${escapeHTML(groupKey)}</div>`;
  }

  html += `
    <li class="rating-item" data-album="${escapeHTML(album)}" style="margin:6px 0; display:flex; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; cursor:pointer;">
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${coverHTML}<strong>${escapeHTML(displayName)}</strong>
        </div>
        ${tagHTML}
        ${getVisibleMetadata(sortOption, data)}
      </div>
      <div style="flex:1; text-align:center;">
        <span class="glow-rating ${getGlowClass(data.rating)}">${ratingDisplay}</span>
      </div>
      <div style="flex:1; text-align:right;">
        <button class="delete-btn" data-album="${escapeHTML(album)}">🗑</button>
      </div>
    </li>
  `;
}
  html += "</ul>";

  // Pagination controls
if (totalPages > 1) {
  const maxVisible = 5;
  const pageButtons = [];

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
  } else {
    pageButtons.push(1);
    if (currentPage > 3) pageButtons.push("…");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pageButtons.push(i);
    if (currentPage < totalPages - 2) pageButtons.push("…");
    pageButtons.push(totalPages);
  }

  html += `<div class="pagination-bar">`;

  // ⬅️ Arrow (left-aligned)
  if (currentPage > 1) {
    html += `<button class="page-arrow left" data-page="${currentPage - 1}">⬅️</button>`;
  } else {
    html += `<button class="page-arrow left" disabled>⬅️</button>`;
  }

  // Page buttons (centered)
  html += `<div class="page-buttons">`;
  pageButtons.forEach(p => {
    if (p === "…") {
      html += `<span class="ellipsis">…</span>`;
    } else {
      html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
    }
  });
  html += `</div>`;

  // ➡️ Arrow (right-aligned)
  if (currentPage < totalPages) {
    html += `<button class="page-arrow right" data-page="${currentPage + 1}">➡️</button>`;
  } else {
    html += `<button class="page-arrow right" disabled>➡️</button>`;
  }

  html += `</div>`;
}

resultDiv.innerHTML = html;
document.getElementById("sortSelect").value = sortOption;

// Wire up interactions
document.getElementById("sortSelect").addEventListener("change", e =>
  renderAllRatings(e.target.value, 1)
);

resultDiv.querySelectorAll(".delete-btn").forEach(btn =>
  btn.addEventListener("click", e => {
    e.stopPropagation();
    deleteRating(btn.dataset.album);
  })
);

resultDiv.querySelectorAll(".rating-item").forEach(item =>
  item.addEventListener("click", e => {
    if (!e.target.classList.contains("delete-btn")) {
      editRating(item.dataset.album);
    }
  })
);

resultDiv.querySelectorAll(".page-btn").forEach(btn =>
  btn.addEventListener("click", () =>
    renderAllRatings(sortOption, parseInt(btn.dataset.page))
  )
);

resultDiv.querySelectorAll(".page-arrow").forEach(btn =>
  btn.addEventListener("click", () =>
    renderAllRatings(sortOption, parseInt(btn.dataset.page))
  )
);

  resultDiv.querySelectorAll(".page-btn").forEach(btn =>
    btn.addEventListener("click", () =>
      renderAllRatings(sortOption, parseInt(btn.dataset.page))
    )
  );

    resultDiv.querySelectorAll(".page-arrow").forEach(btn =>
    btn.addEventListener("click", () =>
      renderAllRatings(sortOption, parseInt(btn.dataset.page))
    )
  );
}

function getVisibleMetadata(sortOption, data) {
  const parts = [];
  if (sortOption.startsWith("artist") && data.artist)
    parts.push(escapeHTML(data.artist));
  if (sortOption.startsWith("genre") && data.genre)
    parts.push(escapeHTML(capitalizeFirst(data.genre)));
  if (sortOption.startsWith("date") && data.releaseDate)
    parts.push(formatDate(data.releaseDate));
  return parts.length ? `<div style="font-size:0.9em; color:#ccc;">${parts.join(" • ")}</div>` : "";
}

function searchAlbum(event = null, prefillKey = null, forceViewOnly = false, overrideInput = null) {
  if (event?.preventDefault) event.preventDefault();

  const resultDiv = document.getElementById("result");
  const savedRatings = JSON.parse(localStorage.getItem("albumRatings")) || {};
  const cancelBtn = document.getElementById("toggleRatingsBtn");
  document.getElementById("analyticsPanel").style.display = "none";

  let albumInput = overrideInput ?? document.getElementById("album-name").value.trim();
  let albumKey, albumDisplayName, existingData = null;

  if (prefillKey) {
    albumKey = prefillKey;
    existingData = savedRatings[albumKey] || null;
    albumDisplayName = capitalizeAlbumName(albumKey);
    document.getElementById("album-name").value = albumDisplayName;
    editMode = !forceViewOnly;
  } else {
    if (!albumInput) {
      resultDiv.innerHTML = "<p>Please enter an album name.</p>";
      resultDiv.style.display = "block";
      return;
    }
    albumKey = normalizeAlbumName(albumInput);
    albumDisplayName = capitalizeAlbumName(albumInput);
    existingData = savedRatings[albumKey] || null;
    editMode = false;
  }

  cancelBtn.textContent = editMode ? "❌ Cancel" : "View All Ratings";
  cancelBtn.classList.toggle("cancel-mode", editMode);

  // 🔍 Fuzzy album and artist suggestions
  if (!existingData && !overrideInput) {
    const albumMatches = fuzzyMatch(albumKey, Object.keys(savedRatings));
    const artistMatches = Object.entries(savedRatings)
      .filter(([_, data]) => fuzzyMatch(albumKey, [data.artist || ""]).length > 0)
      .map(([key]) => key);

    if (albumMatches.length || artistMatches.length) {
      let html = `<p>No exact match found. Did you mean:</p><ul style="list-style:none; padding:0;">`;
      albumMatches.forEach(m => {
        html += `<li><button class="suggest-btn">${capitalizeAlbumName(m)}</button></li>`;
      });
      artistMatches.forEach(m => {
        html += `<li><button class="suggest-btn">${capitalizeAlbumName(m)}</button> <span style="color:#ccc;">(artist match)</span></li>`;
      });
      html += `</ul><div style="margin-top:10px;">
        <button id="forceRateBtn" class="rate-anyway-btn">No Rate "${escapeHTML(albumInput)}"</button>
      </div>`;

      resultDiv.innerHTML = html;
      resultDiv.style.display = "block";

      document.getElementById("forceRateBtn")?.addEventListener("click", () => {
        document.getElementById("album-name").value = albumInput;
        searchAlbum(null, null, false, albumInput);
      });

      resultDiv.querySelectorAll(".suggest-btn").forEach(btn =>
        btn.addEventListener("click", () =>
          searchAlbum(null, normalizeAlbumName(btn.textContent), true)
        )
      );

      return;
    }
  }

  // 🎯 Render rating form or view-only
  if (existingData && forceViewOnly) {
    const glowClass = getGlowClass(existingData.rating);
    const ratingDisplay = existingData.rating === "S" ? "⏭️ Skip" :
                          existingData.rating === "I" ? "🎵 Interlude" :
                          `${existingData.rating} / 10`;
    const albumId = extractSpotifyAlbumId(existingData.spotifyURL);
    const coverHTML = existingData.cover
      ? `<img src="${escapeHTML(existingData.cover)}" alt="Album Cover" style="max-width:200px; display:block; margin:10px auto; border-radius:10px;">`
      : '';
    const spotifyEmbedHTML = albumId
      ? `<div id="spotify-player" style="margin-top:10px;">
           <iframe src="https://open.spotify.com/embed/album/${albumId}" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:10px;"></iframe>
         </div>`
      : '';

    resultDiv.innerHTML = `
      <h2>${escapeHTML(albumDisplayName)}</h2>
      <div style="margin-bottom:10px; font-size:0.9em; color:#ccc;">
        ${escapeHTML(existingData.artist || "")} • ${escapeHTML(capitalizeFirst(existingData.genre || ""))} • ${formatDate(existingData.releaseDate) || ""}
      </div>
      ${coverHTML}
      ${spotifyEmbedHTML}
      <p><strong>Rating:</strong> <span class="glow-rating ${glowClass}">${ratingDisplay}</span></p>
      <div style="text-align:center; margin-top:12px;">
        <button type="button" class="edit-single-btn" data-album="${escapeHTML(albumKey)}">✏️ Edit</button>
        <button type="button" class="delete-single-btn" data-album="${escapeHTML(albumKey)}">🗑 Delete</button>
      </div>
    `;

    resultDiv.querySelector('.edit-single-btn')?.addEventListener('click', () => editRating(albumKey));
    resultDiv.querySelector('.delete-single-btn')?.addEventListener('click', () => deleteRating(albumKey));
  } else {
    renderRatingForm(albumKey, albumDisplayName, existingData);
  }

  resultDiv.style.display = "block";
  ratingsVisible = false;
}

function populateAlbumSuggestions() {
  const savedRatings = JSON.parse(localStorage.getItem("albumRatings")) || {};
  const albumNames = Object.keys(savedRatings);
  const datalist = document.getElementById("albumSuggestions");

  datalist.innerHTML = albumNames
    .map(key => {
      const displayName = savedRatings[key]?.displayName || capitalizeAlbumName(key);
      return `<option value="${escapeHTML(displayName)}">`;
    })
    .join("");
}

function extractSpotifyAlbumId(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/album\/([a-zA-Z0-9]+)(\?|$)/);
  return match ? match[1] : null;
}

function renderRatingForm(albumKey, albumDisplayName, existingData) {
  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = `
    <h2>${escapeHTML(albumDisplayName)}</h2>
    <form id="rating-form">
      <label>Artist: <input type="text" id="artist" placeholder="e.g. Kendrick Lamar"></label><br><br>
      <label>Genre: <input type="text" id="genre" placeholder="e.g. Hip-Hop"></label><br><br>
      <label>Release Date: <input type="date" id="release-date"></label><br><br>

      <div id="average-song-container" style="margin-top:10px;">
        <label><input type="radio" name="avgSongMode" value="manual" checked> Average Song Quality (1–10):</label>
        <input type="number" id="avgSong" min="1" max="10" step="any" required><br><br>
        <label><input type="radio" name="avgSongMode" value="individual"> Rate Individual Songs</label>
        <div id="song-entry-container" style="display:none;">
          <label>Number of Songs: <input type="number" id="numSongs" min="1" step="1"></label>
          <button type="button" id="generateSongsBtn">➕ Generate Inputs</button>
          <div id="songsInputs" style="margin-top:10px;"></div>
          <button type="button" id="calcAvgBtn" style="display:none;">⚡ Calculate Average</button>
          <p id="calcResult" style="margin-top:8px; font-weight:bold;"></p>
        </div>
      </div>

      <label>Lyricism (1–10): <input type="number" id="lyricism" min="1" max="10" step="any" required></label><br><br>
      <label>Instrumentation (1–10): <input type="number" id="instrumentation" min="1" max="10" step="any" required></label><br><br>
      <label>Vibe (1–10): <input type="number" id="vibe" min="1" max="10" step="any" required></label><br><br>
      <label>Skips: <input type="number" id="skips" min="0" step="1" required></label><br><br>
      <label>Album Cover URL (optional): <input type="url" id="album-cover" placeholder="https://example.com/cover.jpg"></label><br><br>
      <label>Spotify Album URL (optional): <input type="url" id="spotifyURL" placeholder="https://open.spotify.com/album/..."></label><br><br>

      <button type="submit">💾 Save Rating</button>
    </form>
  `;

  if (existingData) {
    document.getElementById("avgSong").value = existingData.avgSong ?? "";
    document.getElementById("lyricism").value = existingData.lyricism ?? "";
    document.getElementById("instrumentation").value = existingData.instrumentation ?? "";
    document.getElementById("vibe").value = existingData.vibe ?? "";
    document.getElementById("skips").value = existingData.skips ?? 0;
    document.getElementById("album-cover").value = existingData.cover ?? "";
    document.getElementById("spotifyURL").value = existingData.spotifyURL ?? "";
    document.getElementById("artist").value = existingData.artist ?? "";
    document.getElementById("genre").value = existingData.genre ?? "";
    document.getElementById("release-date").value = existingData.releaseDate ?? "";
  }

    if (existingData?.songs && Object.keys(existingData.songs).length > 0) {
    document.querySelector('input[value="individual"]').checked = true;
    document.getElementById("song-entry-container").style.display = "block";
    document.getElementById("avgSong").disabled = true;
    document.getElementById("calcAvgBtn").style.display = "inline-block";

    const songsInputs = document.getElementById("songsInputs");
    songsInputs.innerHTML = "";

    Object.entries(existingData.songs).forEach(([title, song], i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "song-input";

      const label = document.createElement("label");
      label.textContent = `${title}: `;

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "1–10, S, I";
      input.pattern = "[0-9]|10|S|I";
      input.style.textTransform = "uppercase";
      input.value = song.rating;

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      songsInputs.appendChild(wrapper);
    });
  }

  wireUpRatingForm(albumKey, albumDisplayName);
}

function wireUpRatingForm(albumKey, albumDisplayName) {
  const resultDiv = document.getElementById("result");

  resultDiv.addEventListener("change", () => {
    const avgMode = document.querySelector('input[name="avgSongMode"]:checked');
    const songEntryContainer = document.getElementById("song-entry-container");
    const calcAvgBtn = document.getElementById("calcAvgBtn");
    const avgSongInput = document.getElementById("avgSong");

    if (!avgMode) return;

    if (avgMode.value === "individual") {
      songEntryContainer.style.display = "block";
      calcAvgBtn.style.display = "inline-block";
      avgSongInput.disabled = true;
      avgSongInput.value = "";
    } else {
      songEntryContainer.style.display = "none";
      calcAvgBtn.style.display = "none";
      avgSongInput.disabled = false;
    }
  });

  const generateSongsBtn = document.getElementById("generateSongsBtn");
  const songsInputs = document.getElementById("songsInputs");
  const calcAvgBtn = document.getElementById("calcAvgBtn");
  const calcResult = document.getElementById("calcResult");

  generateSongsBtn?.addEventListener("click", () => {
    const numSongs = parseInt(document.getElementById("numSongs").value);
    songsInputs.innerHTML = "";

    if (isNaN(numSongs) || numSongs <= 0) {
      songsInputs.innerHTML = "<p>Please enter a valid number of songs.</p>";
      return;
    }

    for (let i = 1; i <= numSongs; i++) {
      const wrapper = document.createElement("div");
      wrapper.className = "song-input";

      const label = document.createElement("label");
      label.textContent = `Song ${i}: `;

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "1–10, S, I";
      input.pattern = "[0-9]|10|S|I";
      input.style.textTransform = "uppercase";

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      songsInputs.appendChild(wrapper);
    }
  });

  calcAvgBtn?.addEventListener("click", () => {
    const inputs = songsInputs.querySelectorAll("input");
    let total = 0, count = 0, skips = 0;

    inputs.forEach((input) => {
      const val = input.value.trim().toUpperCase();
      if (val === "I") return;
      if (val === "S") { skips++; return; }

      const num = parseFloat(val);
      if (!isNaN(num) && num >= 1 && num <= 10) {
        total += num;
        count++;
      }
    });

    const avgInput = document.getElementById("avgSong");
    const resultText = document.getElementById("calcResult");
    const skipsInput = document.getElementById("skips");
    if (skipsInput) skipsInput.value = skips;

    if (count === 0) {
      resultText.textContent = "Average: N/A (no rated songs)";
      if (avgInput) avgInput.value = "";
    } else {
      const avg = (total / count).toFixed(2);
      resultText.textContent = `Average: ${avg} | Skips: ${skips}`;
      if (avgInput) avgInput.value = avg;
    }
  });

  document.getElementById("rating-form").addEventListener("submit", e => {
    e.preventDefault();
    const lyricism = parseFloat(document.getElementById("lyricism").value);
    const instrumentation = parseFloat(document.getElementById("instrumentation").value);
    const vibe = parseFloat(document.getElementById("vibe").value);
    const skips = parseInt(document.getElementById("skips").value, 10);
    const coverURL = document.getElementById("album-cover").value.trim();
    const spotifyURL = document.getElementById("spotifyURL").value.trim();
    const avgSong = parseFloat(document.getElementById("avgSong").value);
    const artist = document.getElementById("artist").value.trim();
    const genre = document.getElementById("genre").value.trim();
    const releaseDate = document.getElementById("release-date").value;
    const songs = {};
    const avgMode = document.querySelector('input[name="avgSongMode"]:checked')?.value;
    if (avgMode === "individual") {
      const songInputs = document.querySelectorAll(".song-input input");
      songInputs.forEach((input, i) => {
        const val = input.value.trim().toUpperCase();
        if (!val) return;

        songs[`Song ${i + 1}`] = { rating: val }; // You can expand this later to include notes
      });
    }

    if ([lyricism, instrumentation, vibe, avgSong].some(v => isNaN(v) || v < 1 || v > 10) || skips < 0) {
      alert("Please enter valid numbers (1–10) for ratings and non-negative skips.");
      return;
    }

    const weightedScore = (avgSong * 2 + lyricism * 1.5 + instrumentation * 1.5 + vibe * 1.5) / 6.5 - skips * 0.2;
    const finalRating = Math.max(1, Math.min(10, parseFloat(weightedScore.toFixed(2))));
    const normalizedKey = normalizeAlbumName(albumDisplayName);
    const savedRatings = JSON.parse(localStorage.getItem("albumRatings")) || {};

    savedRatings[normalizedKey] = {
      rating: finalRating, avgSong, lyricism, instrumentation, vibe, skips,
      artist, genre, releaseDate, cover: coverURL, spotifyURL, songs 
    };

    localStorage.setItem("albumRatings", JSON.stringify(savedRatings));
    showToast("Rating saved!");

    const coverHTML = coverURL
      ? `<img src="${escapeHTML(coverURL)}" alt="Album Cover" style="max-width:200px; display:block; margin:10px auto; border-radius:10px;">`
      : '';

    const glowClass = getGlowClass(finalRating);
    searchAlbum(null, normalizeAlbumName(albumDisplayName), true);
  });
}

function deleteRating(albumKey) {
  if (!albumKey) return;
  if (!confirm("Are you sure you want to delete this rating?")) return;

  const savedRatings = JSON.parse(localStorage.getItem('albumRatings')) || {};
  if (!(albumKey in savedRatings)) return;

  delete savedRatings[albumKey];
  localStorage.setItem('albumRatings', JSON.stringify(savedRatings));
  populateAlbumSuggestions();

  showToast("Rating deleted.");

  const resultDiv = document.getElementById('result');
  if (ratingsVisible) {
    renderAllRatings();
  } else {
    resultDiv.innerHTML = "";
    resultDiv.style.display = "none";
  }
}

function editRating(albumKey) {
  if (!albumKey) return;
  document.getElementById('album-name').value = capitalizeAlbumName(albumKey);
  searchAlbum(null, albumKey, false); // ✅ force edit mode
  populateAlbumSuggestions();
}

function toggleRatings() {
  const resultDiv = document.getElementById('result');
  const button = document.getElementById('toggleRatingsBtn');
  

  if (editMode) {
    editMode = false;
    ratingsVisible = true;
    button.textContent = "View All Ratings";
    button.classList.remove("cancel-mode");
    button.style.backgroundColor = ""; // reset to default
    renderAllRatings(currentSortOption, currentPage);
    return;
  }

  if (!ratingsVisible) {
  renderAllRatings(currentSortOption, currentPage);
  resultDiv.style.display = "block";
  resultDiv.classList.remove("fade-in");
  void resultDiv.offsetWidth; // force reflow
  resultDiv.classList.add("fade-in");

  button.textContent = "Collapse All Ratings";
  ratingsVisible = true;
} else {
    resultDiv.innerHTML = "";
    resultDiv.style.display = "none";
    button.textContent = "View All Ratings";
    ratingsVisible = false;
  }
}

function setupEventListeners() {
  const toggleBtn = document.getElementById('toggleRatingsBtn');
  const analyticsBtn = document.getElementById('analyticsBtn');
  const resultDiv = document.getElementById('result');
  const analyticsPanel = document.getElementById('analyticsPanel');
  const searchBtn = document.getElementById('search-btn');
  const albumInput = document.getElementById('album-name');
  

  // ✅ Wire up Search button
  searchBtn?.addEventListener("click", () => searchAlbum(null, null, true)); // ✅ force view-only

  // ✅ Support Enter key in search input
  albumInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") searchAlbum(e, null, true); // ✅ force view-only
});

  // ✅ Wire up View All Ratings button
  toggleBtn?.addEventListener('click', () => {
    analyticsPanel.style.display = "none";
    editMode = false;

    if (!ratingsVisible) {
  renderAllRatings(currentSortOption, currentPage);
  resultDiv.style.display = "block";
  resultDiv.classList.remove("fade-in");
  void resultDiv.offsetWidth;
  resultDiv.classList.add("fade-in");
  toggleBtn.textContent = "Collapse All Ratings";

  // ✅ Reset styling in case it was in cancel mode
  toggleBtn.classList.remove("cancel-mode");
  toggleBtn.style.backgroundColor = ""; // or set your default blue here

  ratingsVisible = true;
} else {
  resultDiv.innerHTML = "";
  resultDiv.style.display = "none";
  toggleBtn.textContent = "View All Ratings";
  toggleBtn.classList.remove("cancel-mode");
  toggleBtn.style.backgroundColor = "";
  ratingsVisible = false;
}  });

  // ✅ Wire up Analytics button
  analyticsBtn?.addEventListener('click', () => {
    resultDiv.innerHTML = "";
    resultDiv.style.display = "none";
    analyticsPanel.style.display = "block";
    analyticsPanel.classList.remove("fade-in");
    void analyticsPanel.offsetWidth;
    analyticsPanel.classList.add("fade-in");
    switchAnalyticsTab("decade");
  });

  // ✅ Wire up tab switching
  document.querySelectorAll(".analytics-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".analytics-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      switchAnalyticsTab(btn.dataset.tab);
    });
  });
}

function fuzzyMatch(input, candidates, maxDistance = 3) {
  const normalizedInput = normalizeAlbumName(input);
  return candidates.filter(candidate => {
    const distance = levenshtein(normalizedInput, normalizeAlbumName(candidate));
    return distance <= maxDistance;
  });
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function generateAcronym(title) {
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .filter((word, index) => !(index === 0 && word === "the")); // skip "the" if first

  const acronym = words.map(word => {
    if (word === "lp") return "LP"; // preserve LP as two letters
    return word[0];
  }).join("");

  return acronym.toLowerCase(); // final normalization
}

function getAcronymMap(ratings) {
  const map = {};
  for (const key in ratings) {
    const displayName = ratings[key]?.displayName || key;
    const acronym = generateAcronym(displayName);
    map[acronym] = key;
  }
  return map;
}

function getDecadeStats(ratings) {
  const stats = {};

  for (const key in ratings) {
    const album = ratings[key];
    const rawDate = album.releaseDate;

    let year = null;
    if (typeof rawDate === "string") {
      const match = rawDate.match(/\b(19|20)\d{2}\b/);
      if (match) year = parseInt(match[0]);
    }

    if (!year || year < 1900 || year > 2025) continue;

    const decade = `${Math.floor(year / 10) * 10}s`;
    if (!stats[decade]) stats[decade] = { count: 0, totalRating: 0 };

    stats[decade].count++;
    stats[decade].totalRating += album.rating;
  }

  for (const decade in stats) {
    stats[decade].avgRating = +(stats[decade].totalRating / stats[decade].count).toFixed(2);
    delete stats[decade].totalRating;
  }

  return stats;
}

function renderDecadeChart(containerId = "decadeView") {
  const ratings = JSON.parse(localStorage.getItem("albumRatings")) || {};
  const stats = getDecadeStats(ratings);
  const top3 = getTopRatedDecades(ratings);
  console.log("Decade stats:", stats);

  const sortedStats = Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]));

  const container = document.getElementById(containerId);
  container.innerHTML = `
    <canvas id="decadeChart"></canvas>
    <div id="podiumContainer"></div>
  `;

  const ctx = container.querySelector("canvas").getContext("2d");

  if (window.decadeChart && typeof window.decadeChart.destroy === "function") {
    window.decadeChart.destroy();
  }

  window.decadeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedStats.map(([decade]) => decade),
      datasets: [
        {
          label: 'Album Count',
          data: sortedStats.map(([_, data]) => data.count),
          backgroundColor: 'rgba(245, 245, 245, 0.6)',
          borderColor: 'whitesmoke',
          borderWidth: 1
        },
        {
          label: 'Average Rating',
          data: sortedStats.map(([_, data]) => data.avgRating),
          backgroundColor: 'rgba(0, 255, 255, 0.4)',
          borderColor: '#00ffff',
          borderWidth: 1
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: 'whitesmoke' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: 'whitesmoke' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      },
      plugins: {
        legend: { labels: { color: 'whitesmoke' } }
      }
    }
  });

  if (top3.length >= 3) {
    const podiumHTML = `
    <div class="podium">
      <div class="silver">
        <strong class="decade">${top3[1].decade}</strong><br>
        <span>🥈<span class="glow-rating glow-silver">${top3[1].rating}</span> 🥈</span>
      </div>
      <div class="gold">
        <strong class="decade">${top3[0].decade}</strong><br>
        <span>🥇<span class="glow-rating glow-gold">${top3[0].rating}</span> 🥇</span>
      </div>
      <div class="bronze">
        <strong class="decade">${top3[2].decade}</strong><br>
        <span>🥉<span class="glow-rating glow-bronze">${top3[2].rating}</span> 🥉</span>
      </div>
    </div>
  `;
    container.querySelector("#podiumContainer").innerHTML = podiumHTML;
  }
}

function getTopRatedDecades(ratings) {
  const stats = getDecadeStats(ratings);
  const sorted = Object.entries(stats)
    .sort((a, b) => b[1].avgRating - a[1].avgRating)
    .slice(0, 3);

  return sorted.map(([decade, data]) => ({
    decade,
    rating: data.avgRating,
    count: data.count
  }));
}

function getTopRatedGenres(ratings) {
  const genreStats = {};

  Object.values(ratings).forEach(album => {
    const genre = capitalizeFirst(album.genre?.trim() || "Unknown");
    if (!genreStats[genre]) genreStats[genre] = { count: 0, total: 0 };
    genreStats[genre].count++;
    genreStats[genre].total += album.rating;
  });

  const sorted = Object.entries(genreStats)
    .map(([genre, { count, total }]) => ({
      genre,
      rating: +(total / count).toFixed(2),
      count
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  return sorted;
}

analyticsBtn?.addEventListener('click', () => {
  const resultDiv = document.getElementById('result');
  const analyticsPanel = document.getElementById('analyticsPanel');

  resultDiv.innerHTML = "";
  resultDiv.style.display = "none";

  analyticsPanel.style.display = "block";
  analyticsPanel.classList.remove("fade-in");
  void analyticsPanel.offsetWidth;
  analyticsPanel.classList.add("fade-in");

  document.querySelectorAll(".analytics-tabs button").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-tab="decade"]')?.classList.add("active");
  switchAnalyticsTab("decade");
});

function groupByArtist(ratings) {
  const grouped = {};

  for (const key in ratings) {
    const album = ratings[key];
    const artist = album.artist || "Unknown Artist";

    if (!grouped[artist]) grouped[artist] = { albums: [], total: 0 };
    grouped[artist].albums.push({
      name: capitalizeAlbumName(key),
      rating: album.rating,
      releaseDate: album.releaseDate,
      genre: album.genre,
      spotifyUrl: album.spotifyUrl
    });
    grouped[artist].total += album.rating;
  }

  for (const artist in grouped) {
    const count = grouped[artist].albums.length;
    grouped[artist].avgRating = +(grouped[artist].total / count).toFixed(2);

    // ✅ Sort albums chronologically by release date
    grouped[artist].albums.sort((a, b) => {
      const dateA = new Date(a.releaseDate || 0);
      const dateB = new Date(b.releaseDate || 0);
      return dateA - dateB;
    });
  }

  return grouped;
}

function renderArtistBreakdown(containerId = "artistView") {
  const ratings = JSON.parse(localStorage.getItem("albumRatings")) || {};
  const grouped = groupByArtist(ratings);
  const container = document.getElementById(containerId);
  let html = `<div class="artist-breakdown">`;

  const sortedArtists = Object.entries(grouped)
    .sort((a, b) => b[1].avgRating - a[1].avgRating);

  const totalPages = Math.ceil(sortedArtists.length / artistsPerPage);
  const startIndex = (currentArtistPage - 1) * artistsPerPage;
  const paginatedArtists = sortedArtists.slice(startIndex, startIndex + artistsPerPage);

  for (const [artist, data] of paginatedArtists) {
    const avgGlowClass = getGlowClass(data.avgRating);
    html += `<div class="artist-block">
      <div style="display: inline-block; margin-bottom: 6px;">
        <h3 style="margin: 0;">${escapeHTML(artist)} — <span class="glow-rating ${avgGlowClass}">${data.avgRating}</span></h3>
        <div style="height: 1px; background-color: #00ffff; margin-top: 4px;"></div>
      </div>
      <ul>`;
    data.albums.forEach(album => {
      const year = album.releaseDate ? ` (${new Date(album.releaseDate).getFullYear()})` : "";
      const albumGlowClass = getGlowClass(album.rating);
      html += `<li>
        <strong>${escapeHTML(album.name)}${year}</strong> — <span class="glow-rating ${albumGlowClass}">${album.rating}</span>
        ${album.spotifyUrl ? ` <a href="${escapeHTML(album.spotifyUrl)}" target="_blank">▶</a>` : ""}
      </li>`;
    });
    html += `</ul></div>`;
  }

  html += `</div>`;

  // ✅ Add pagination controls
  if (totalPages > 1) {
    html += `<div style="text-align:center; margin-bottom:20px;">`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn${i === currentArtistPage ? ' active' : ''}" data-page="${i}" style="margin:0 4px;">${i}</button>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // ✅ Wire up pagination buttons
  container.querySelectorAll(".page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentArtistPage = parseInt(btn.dataset.page);
      renderArtistBreakdown(containerId);
    });
  });
}

function switchAnalyticsTab(tab) {
  console.log("Switching to tab:", tab);
  document.querySelectorAll(".analytics-view").forEach(view => {
    view.style.display = "none";
  });

  const viewId = tab + "View";
  document.getElementById(viewId).style.display = "block";

  if (tab === "decade") renderDecadeChart(viewId);
  if (tab === "artist") renderArtistBreakdown(viewId);
  if (tab === "genre") renderGenreBreakdown(viewId); // ✅ Add this line
}

function renderGenreBreakdown(containerId = "genreView") {
  const ratings = JSON.parse(localStorage.getItem("albumRatings")) || {};
  const genreStats = {};
  const top3 = getTopRatedGenres(ratings); // ✅ Get top genres

  Object.values(ratings).forEach(album => {
    const genre = capitalizeFirst(album.genre?.trim() || "Unknown");
    if (!genreStats[genre]) genreStats[genre] = { count: 0, total: 0 };
    genreStats[genre].count++;
    genreStats[genre].total += album.rating;
  });

  const sortedGenres = Object.entries(genreStats)
    .map(([genre, { count, total }]) => ({
      genre,
      count,
      avgRating: +(total / count).toFixed(2)
    }))
    .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating);

  const container = document.getElementById(containerId);
  container.innerHTML = `
    <canvas id="genreChart" style="max-height:300px;"></canvas>
    <div id="genrePodiumContainer"></div> <!-- ✅ Podium container -->
  `;

  const ctx = container.querySelector("canvas").getContext("2d");

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedGenres.map(g => g.genre),
      datasets: [
        {
          label: 'Album Count',
          data: sortedGenres.map(g => g.count),
          backgroundColor: 'rgba(245, 245, 245, 0.6)',
          borderColor: 'whitesmoke',
          borderWidth: 1
        },
        {
          label: 'Average Rating',
          data: sortedGenres.map(g => g.avgRating),
          backgroundColor: 'rgba(0, 255, 255, 0.4)',
          borderColor: '#00ffff',
          borderWidth: 1
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: 'whitesmoke' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: 'whitesmoke' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      },
      plugins: {
        legend: { labels: { color: 'whitesmoke' } }
      }
    }
  });

  // ✅ Render genre podium
  if (top3.length >= 3) {
    const podiumHTML = `
      <div class="podium">
      <div class="silver">
        <strong class="genre">${top3[1].genre}</strong><br>
        <span>🥈<span class="glow-rating glow-silver">${top3[1].rating}</span> 🥈</span>
      </div>
      <div class="gold">
        <strong class="genre">${top3[0].genre}</strong><br>
        <span>🥇<span class="glow-rating glow-gold">${top3[0].rating}</span> 🥇</span>
      </div>
      <div class="bronze">
        <strong class="genre">${top3[2].genre}</strong><br>
        <span>🥉<span class="glow-rating glow-bronze">${top3[2].rating}</span> 🥉</span>
      </div>
    </div>
    `;
    container.querySelector("#genrePodiumContainer").innerHTML = podiumHTML;
  }
}
document.addEventListener('DOMContentLoaded', setupEventListeners);
window.addEventListener("DOMContentLoaded", () => {
  populateAlbumSuggestions();
});