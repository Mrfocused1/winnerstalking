// ---------------------------------------------------------------------------
// app.js  –  Podcast directory UI logic
// Expects globals: FULL_EPISODES, CLIPS  (defined in data.js)
// ---------------------------------------------------------------------------

(function () {
  "use strict";

  // ---- constants ----------------------------------------------------------
  var PAGE_SIZE = 6;

  // ---- state --------------------------------------------------------------
  var currentTab = "full_episode";
  var currentData = [];
  var visibleCount = 0;
  var searchTerm = "";
  var debounceTimer = null;

  // ---- DOM refs -----------------------------------------------------------
  var videoGrid   = document.getElementById("videoGrid");
  var loadMoreBtn = document.getElementById("loadMoreBtn");
  var searchInput = document.getElementById("searchInput");
  var modal       = document.getElementById("videoModal");
  var modalTitle  = document.getElementById("modalTitle");
  var modalPlayer = document.getElementById("modalVideoWrapper");
  var modalClose  = document.getElementById("modalClose");
  var modalOverlay = document.getElementById("modalOverlay");
  var tabButtons  = document.querySelectorAll(".tab-btn");
  var nav         = document.getElementById("navbar");
  var navToggle   = document.getElementById("navToggle");
  var navLinks    = document.getElementById("navLinks");
  var featuredWrapper = document.getElementById("featuredVideoWrapper");
  var featuredInfo    = document.getElementById("featuredInfo");

  // ========================================================================
  // FEATURED / LATEST EPISODE
  // ========================================================================
  function initFeatured() {
    if (FULL_EPISODES && FULL_EPISODES.length && featuredWrapper) {
      var latest = FULL_EPISODES[0];
      featuredWrapper.style.cursor = 'pointer';
      featuredWrapper.innerHTML =
        '<img src="https://img.youtube.com/vi/' + latest.id + '/hqdefault.jpg" ' +
        'alt="' + escapeAttr(latest.title) + '" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">' +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;' +
        'background:rgba(189,3,0,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
        '<i class="fas fa-play" style="color:#fff;font-size:2rem;margin-left:4px;"></i></div>';
      var fImg = featuredWrapper.querySelector('img');
      fImg.addEventListener('error', function() {
        if (this.src.indexOf('hqdefault') !== -1) {
          this.src = 'https://img.youtube.com/vi/' + latest.id + '/mqdefault.jpg';
        } else {
          this.src = 'https://img.youtube.com/vi/' + latest.id + '/default.jpg';
        }
      });
      featuredWrapper.addEventListener('click', function() {
        openModal(latest);
      });
      if (featuredInfo) {
        featuredInfo.innerHTML =
          '<h3>' + escapeHTML(latest.title) + '</h3>' +
          '<p>' + escapeHTML(latest.duration) + '</p>';
      }
    }
  }

  // ========================================================================
  // TAB SWITCHING
  // ========================================================================
  function activateTab(tab) {
    currentTab = tab;
    tabButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    resetSearch();
    refreshGrid();
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      activateTab(btn.dataset.tab);
    });
  });

  // ========================================================================
  // VIDEO GRID RENDERING
  // ========================================================================
  function sourceData() {
    return currentTab === "full_episode" ? FULL_EPISODES : CLIPS;
  }

  function filteredData() {
    var data = sourceData();
    if (searchTerm) {
      var q = searchTerm.toLowerCase();
      data = data.filter(function (v) {
        return v.title.toLowerCase().indexOf(q) !== -1;
      });
    }
    return sortData(data);
  }

  function buildCard(video) {
    var card = document.createElement("div");
    card.className = "video-card";
    card.setAttribute("data-video-id", video.id);

    card.innerHTML =
      '<div class="card-thumbnail">' +
        '<img src="' + escapeAttr(video.thumbnail) + '" alt="' + escapeAttr(video.title) + '" loading="lazy">' +
        '<span class="card-duration">' + escapeHTML(video.duration) + '</span>' +
        '<div class="card-play-icon"><i class="fas fa-play"></i></div>' +
      '</div>' +
      '<div class="card-info">' +
        '<h3 class="card-title">' + escapeHTML(video.title) + '</h3>' +
      '</div>';

    // Handle broken thumbnails – fall back to hqdefault
    var img = card.querySelector("img");
    img.addEventListener("error", function () {
      if (this.src.indexOf("mqdefault") !== -1) {
        this.src = "https://img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
      } else if (this.src.indexOf("hqdefault") !== -1) {
        this.src = "https://img.youtube.com/vi/" + video.id + "/default.jpg";
      }
    });

    card.addEventListener("click", function () {
      openModal(video);
    });

    return card;
  }

  function refreshGrid() {
    currentData = filteredData();
    visibleCount = 0;
    videoGrid.innerHTML = "";
    showMore();
  }

  function showMore() {
    var end = Math.min(visibleCount + PAGE_SIZE, currentData.length);
    for (var i = visibleCount; i < end; i++) {
      videoGrid.appendChild(buildCard(currentData[i]));
    }
    visibleCount = end;
    updateLoadMore();
  }

  // ========================================================================
  // PAGINATION / LOAD MORE
  // ========================================================================
  function updateLoadMore() {
    if (visibleCount >= currentData.length) {
      loadMoreBtn.style.display = "none";
    } else {
      loadMoreBtn.style.display = "";
      loadMoreBtn.textContent = "Load More (" + (currentData.length - visibleCount) + " remaining)";
    }
  }

  loadMoreBtn.addEventListener("click", showMore);

  // ========================================================================
  // FILTER DROPDOWN
  // ========================================================================
  var filterBtn = document.getElementById("filterBtn");
  var filterDropdown = document.getElementById("filterDropdown");
  var filterOptions = document.querySelectorAll(".filter-option");
  var currentSort = "newest";

  filterBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    filterDropdown.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (!filterDropdown.contains(e.target) && e.target !== filterBtn) {
      filterDropdown.classList.remove("open");
    }
  });

  filterOptions.forEach(function (opt) {
    opt.addEventListener("click", function () {
      filterOptions.forEach(function (o) { o.classList.remove("active"); });
      opt.classList.add("active");
      currentSort = opt.dataset.sort;
      filterDropdown.classList.remove("open");
      refreshGrid();
    });
  });

  function sortData(data) {
    var sorted = data.slice();
    switch (currentSort) {
      case "oldest":
        sorted.reverse();
        break;
      case "longest":
        sorted.sort(function (a, b) { return b.durationSec - a.durationSec; });
        break;
      case "shortest":
        sorted.sort(function (a, b) { return a.durationSec - b.durationSec; });
        break;
      case "az":
        sorted.sort(function (a, b) { return a.title.localeCompare(b.title); });
        break;
      case "za":
        sorted.sort(function (a, b) { return b.title.localeCompare(a.title); });
        break;
      // "newest" = default order from data.js
    }
    return sorted;
  }

  // ========================================================================
  // SEARCH
  // ========================================================================
  function resetSearch() {
    searchTerm = "";
    if (searchInput) searchInput.value = "";
  }

  searchInput.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      searchTerm = searchInput.value.trim();
      refreshGrid();
      if (currentData.length === 0 && searchTerm) {
        videoGrid.innerHTML =
          '<div class="no-results">' +
          '<i class="fas fa-search"></i>' +
          '<p>No ' + (currentTab === "full_episode" ? "episodes" : "clips") +
          ' found matching "' + escapeHTML(searchTerm) + '"</p>' +
          '</div>';
      }
    }, 300);
  });

  // ========================================================================
  // VIDEO MODAL
  // ========================================================================
  function openModal(video) {
    modalTitle.textContent = video.title;
    modalPlayer.innerHTML =
      '<iframe src="' + escapeAttr(video.embed) + '?autoplay=1" ' +
      'frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("active");
    modalPlayer.innerHTML = "";
    document.body.style.overflow = "";
  }

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  // ========================================================================
  // SMOOTH SCROLL NAVIGATION
  // ========================================================================
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var href = this.getAttribute("href");
      // Handle clips nav link - switch to clips tab and scroll to episodes section
      if (href === "#clips") {
        e.preventDefault();
        activateTab("clip");
        var episodesSection = document.getElementById("episodes");
        if (episodesSection) {
          episodesSection.scrollIntoView({ behavior: "smooth" });
        }
        // Close mobile nav if open
        if (navLinks) navLinks.classList.remove("open");
        if (navToggle) navToggle.classList.remove("open");
        return;
      }
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
        // Close mobile nav if open
        if (navLinks) navLinks.classList.remove("open");
        if (navToggle) navToggle.classList.remove("open");
      }
    });
  });

  function highlightNavLinks() {
    var sections = document.querySelectorAll("section[id]");
    var scrollY = window.scrollY;
    sections.forEach(function (section) {
      var top = section.offsetTop - 100;
      var height = section.offsetHeight;
      var id = section.getAttribute("id");
      var link = document.querySelector('.nav-links a[href="#' + id + '"]');
      if (link) {
        if (scrollY >= top && scrollY < top + height) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      }
    });
  }

  // ========================================================================
  // HERO CTA - "Watch Latest Episode" button
  // ========================================================================
  var heroCtas = document.querySelectorAll('.hero-buttons .btn-primary');
  heroCtas.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (FULL_EPISODES && FULL_EPISODES.length) {
        openModal(FULL_EPISODES[0]);
      }
    });
  });

  // ========================================================================
  // NAVBAR SCROLL BEHAVIOR
  // ========================================================================
  function handleNavScroll() {
    if (!nav) return;
    if (window.scrollY > 10) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }

  window.addEventListener("scroll", function () {
    handleNavScroll();
    highlightNavLinks();
  });

  // ========================================================================
  // MOBILE NAV TOGGLE
  // ========================================================================
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      navToggle.classList.toggle("open");
      navLinks.classList.toggle("open");
    });
  }

  // ========================================================================
  // UTILITY HELPERS
  // ========================================================================
  function escapeHTML(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ========================================================================
  // CONTACT FORM
  // ========================================================================
  var contactForm = document.getElementById("contactForm");
  var contactType = document.getElementById("contactType");
  var socialGroup = document.getElementById("socialGroup");
  var formSuccess = document.getElementById("formSuccess");

  if (contactType) {
    contactType.addEventListener("change", function () {
      socialGroup.style.display = this.value === "guest" ? "block" : "none";
    });
  }

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      contactForm.querySelector(".contact-submit").style.display = "none";
      formSuccess.style.display = "block";
      setTimeout(function () {
        contactForm.reset();
        socialGroup.style.display = "none";
        contactForm.querySelector(".contact-submit").style.display = "";
        formSuccess.style.display = "none";
      }, 4000);
    });
  }

  // ========================================================================
  // INIT
  // ========================================================================
  initFeatured();
  activateTab("full_episode");
  handleNavScroll();
})();
