/* =========================================================
   MindPulse — AI Mental Health Score Predictor
   Vanilla JS: validation, API call, animated result rendering
   ========================================================= */

(() => {
  'use strict';

  const API_URL = 'http://127.0.0.1:8000/predict';

  /* ---------------------------------------------------------
     Country list (top countries the model groups explicitly,
     plus a broad set of common countries — anything else the
     user types is simply sent as free text and grouped as
     "Other" by the backend).
  --------------------------------------------------------- */
  const TOP_COUNTRIES = ['India', 'USA', 'Canada', 'Australia', 'UK', 'Germany', 'Mexico', 'Turkey', 'France'];
  const MORE_COUNTRIES = [
    'Japan', 'South Korea', 'China', 'Brazil', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway',
    'South Africa', 'Nigeria', 'Egypt', 'UAE', 'Saudi Arabia', 'Indonesia', 'Philippines', 'Vietnam',
    'Pakistan', 'Bangladesh', 'Russia', 'Poland', 'Ireland', 'New Zealand', 'Singapore', 'Malaysia',
    'Thailand', 'Argentina', 'Chile', 'Colombia', 'Portugal', 'Switzerland', 'Belgium', 'Austria', 'Other'
  ];
  const ALL_COUNTRIES = [...TOP_COUNTRIES, ...MORE_COUNTRIES];

  /* ---------------------------------------------------------
     Element refs
  --------------------------------------------------------- */
  const form = document.getElementById('predictForm');
  const predictBtn = document.getElementById('predictBtn');
  const formGlobalError = document.getElementById('formGlobalError');
  const resultSection = document.getElementById('resultSection');
  const scoreNumber = document.getElementById('scoreNumber');
  const ringFill = document.getElementById('ringFill');
  const statusBadge = document.getElementById('statusBadge');
  const resultDesc = document.getElementById('resultDesc');
  const recoGrid = document.getElementById('recoGrid');
  const retakeBtn = document.getElementById('retakeBtn');

  const countrySearch = document.getElementById('countrySearch');
  const countryHidden = document.getElementById('country');
  const countryList = document.getElementById('countryList');

  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinksMobile = document.getElementById('navLinksMobile');

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Navbar scroll state + mobile menu
  --------------------------------------------------------- */
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  navToggle.addEventListener('click', () => {
    const open = navLinksMobile.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navLinksMobile.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinksMobile.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------------------------------------------------------
     Scroll reveal animations
  --------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---------------------------------------------------------
     Button ripple effect
  --------------------------------------------------------- */
  document.querySelectorAll('.ripple').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const circle = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      circle.className = 'ripple-circle';
      circle.style.width = circle.style.height = `${size}px`;
      circle.style.left = `${e.clientX - rect.left - size / 2}px`;
      circle.style.top = `${e.clientY - rect.top - size / 2}px`;
      this.appendChild(circle);
      setTimeout(() => circle.remove(), 650);
    });
  });

  /* ---------------------------------------------------------
     Searchable country combobox
  --------------------------------------------------------- */
  function renderCountryOptions(filter = '') {
    const q = filter.trim().toLowerCase();
    const matches = ALL_COUNTRIES.filter(c => c.toLowerCase().includes(q));
    countryList.innerHTML = '';

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = `No match — "${filter}" will be used as entered.`;
      countryList.appendChild(empty);
      return;
    }

    matches.slice(0, 40).forEach(c => {
      const opt = document.createElement('div');
      opt.className = 'combo-option';
      opt.setAttribute('role', 'option');
      opt.textContent = c;
      opt.addEventListener('click', () => selectCountry(c));
      countryList.appendChild(opt);
    });
  }

  function selectCountry(name) {
    countrySearch.value = name;
    countryHidden.value = name;
    closeCountryList();
    clearFieldError('country');
  }

  function openCountryList() {
    renderCountryOptions(countrySearch.value);
    countryList.classList.add('open');
  }
  function closeCountryList() {
    countryList.classList.remove('open');
  }

  countrySearch.addEventListener('focus', openCountryList);
  countrySearch.addEventListener('input', () => {
    countryHidden.value = countrySearch.value.trim();
    openCountryList();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.combo-wrap')) closeCountryList();
  });

  /* ---------------------------------------------------------
     FAQ accordion
  --------------------------------------------------------- */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const answer = item.querySelector('.faq-a');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-q').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        b.closest('.faq-item').querySelector('.faq-a').style.maxHeight = null;
      });

      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ---------------------------------------------------------
     Validation
  --------------------------------------------------------- */
  const NUMERIC_RULES = {
    age: { min: 5, max: 100, label: 'Age' },
    avg_daily_usage_hours: { min: 0, max: 24, label: 'Average daily usage hours' },
    daily_unlocks: { min: 0, max: 500, label: 'Daily unlocks' },
    study_hours: { min: 0, max: 24, label: 'Study hours' },
    physical_activity_hours: { min: 0, max: 24, label: 'Physical activity hours' },
    sleep_hours_per_night: { min: 0, max: 24, label: 'Sleep hours' },
  };

  function setFieldError(name, message) {
    const field = form.querySelector(`[name="${name}"]`)?.closest('.field')
      || document.getElementById('countrySearch').closest('.field');
    const errorEl = form.querySelector(`[data-error-for="${name}"]`);
    if (field) field.classList.add('has-error');
    if (errorEl) errorEl.textContent = message;
  }

  function clearFieldError(name) {
    const field = form.querySelector(`[name="${name}"]`)?.closest('.field')
      || document.getElementById('countrySearch').closest('.field');
    const errorEl = form.querySelector(`[data-error-for="${name}"]`);
    if (field) field.classList.remove('has-error');
    if (errorEl) errorEl.textContent = '';
  }

  function clearAllErrors() {
    form.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
    form.querySelectorAll('.field-error').forEach(e => (e.textContent = ''));
    formGlobalError.textContent = '';
  }

  function validateForm(data) {
    let valid = true;

    // Required selects/text
    const requiredFields = ['gender', 'academic_level', 'most_used_platform', 'purpose_of_use', 'stress_level'];
    requiredFields.forEach(name => {
      if (!data[name]) {
        setFieldError(name, 'Please make a selection.');
        valid = false;
      }
    });

    if (!data.country) {
      setFieldError('country', 'Please select or type a country.');
      valid = false;
    }

    // Numeric fields
    Object.entries(NUMERIC_RULES).forEach(([name, rule]) => {
      const raw = data[name];
      if (raw === '' || raw === null || raw === undefined || Number.isNaN(Number(raw))) {
        setFieldError(name, `${rule.label} is required.`);
        valid = false;
        return;
      }
      const num = Number(raw);
      if (num < rule.min || num > rule.max) {
        setFieldError(name, `${rule.label} must be between ${rule.min} and ${rule.max}.`);
        valid = false;
      }
    });

    return valid;
  }

  /* ---------------------------------------------------------
     Form submit -> API call
  --------------------------------------------------------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const formData = new FormData(form);
    const payload = {
      age: formData.get('age'),
      gender: formData.get('gender'),
      country: countryHidden.value.trim(),
      academic_level: formData.get('academic_level'),
      most_used_platform: formData.get('most_used_platform'),
      purpose_of_use: formData.get('purpose_of_use'),
      avg_daily_usage_hours: formData.get('avg_daily_usage_hours'),
      daily_unlocks: formData.get('daily_unlocks'),
      study_hours: formData.get('study_hours'),
      physical_activity_hours: formData.get('physical_activity_hours'),
      sleep_hours_per_night: formData.get('sleep_hours_per_night'),
      stress_level: formData.get('stress_level'),
    };

    if (!validateForm(payload)) {
      formGlobalError.textContent = 'Please fix the highlighted fields before continuing.';
      form.querySelector('.has-error input, .has-error select, .has-error #countrySearch')?.focus();
      return;
    }

    // Cast numerics
    const requestBody = {
      ...payload,
      age: parseInt(payload.age, 10),
      avg_daily_usage_hours: parseFloat(payload.avg_daily_usage_hours),
      daily_unlocks: parseInt(payload.daily_unlocks, 10),
      study_hours: parseFloat(payload.study_hours),
      physical_activity_hours: parseFloat(payload.physical_activity_hours),
      sleep_hours_per_night: parseFloat(payload.sleep_hours_per_night),
    };

    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        let detail = 'The prediction service could not process this request.';
        try {
          const errJson = await res.json();
          if (errJson?.detail) {
            detail = Array.isArray(errJson.detail)
              ? errJson.detail.map(d => d.msg).join(' ')
              : String(errJson.detail);
          }
        } catch (_) { /* ignore parse errors */ }
        throw new Error(detail);
      }

      const json = await res.json();
      const score = Number(json.predicted_mental_health);
      renderResult(score, requestBody);

    } catch (err) {
      formGlobalError.textContent = err.message?.includes('Failed to fetch')
        ? 'Could not reach the prediction server. Make sure the FastAPI backend is running at 127.0.0.1:8000.'
        : `Something went wrong: ${err.message}`;
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    predictBtn.disabled = isLoading;
    predictBtn.classList.toggle('is-loading', isLoading);
  }

  /* ---------------------------------------------------------
     Result rendering
  --------------------------------------------------------- */
  const RING_CIRCUMFERENCE = 2 * Math.PI * 94; // r=94

  function getStatus(score) {
    if (score < 4) return { key: 'risk', label: 'High Risk', color: '#EF4444' };
    if (score <= 7) return { key: 'moderate', label: 'Moderate', color: '#F59E0B' };
    return { key: 'healthy', label: 'Healthy', color: '#10B981' };
  }

  function animateCounter(target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const value = start + (target - start) * eased;
      scoreNumber.textContent = value.toFixed(2);
      if (progress < 1) requestAnimationFrame(tick);
      else scoreNumber.textContent = target.toFixed(2);
    }
    requestAnimationFrame(tick);
  }

  function buildRecommendations(score, input) {
    const recos = [];

    // Sleep
    if (input.sleep_hours_per_night < 6) {
      recos.push({ icon: '🌙', title: 'Sleep', text: 'Aim for 7–9 hours a night — your current sleep is below the range linked to better mood regulation.' });
    } else if (input.sleep_hours_per_night > 9) {
      recos.push({ icon: '🌙', title: 'Sleep', text: 'Keep a consistent wake time — oversleeping can sometimes signal low energy or low mood.' });
    } else {
      recos.push({ icon: '🌙', title: 'Sleep', text: 'Your sleep duration looks healthy — keep a steady schedule to protect it.' });
    }

    // Study
    if (input.study_hours > 8) {
      recos.push({ icon: '📚', title: 'Study', text: 'Long study blocks can build up stress — try the Pomodoro technique with real breaks.' });
    } else if (input.study_hours < 1) {
      recos.push({ icon: '📚', title: 'Study', text: 'A light, steady study routine can reduce last-minute pressure — try short daily sessions.' });
    } else {
      recos.push({ icon: '📚', title: 'Study', text: 'Your study load looks balanced — pair it with regular breaks to stay sharp.' });
    }

    // Stress
    if (input.stress_level === 'High') {
      recos.push({ icon: '🧘', title: 'Stress', text: 'Try daily breathing exercises or journaling, and consider talking to someone you trust.' });
    } else if (input.stress_level === 'Medium') {
      recos.push({ icon: '🧘', title: 'Stress', text: 'Moderate stress is common — short mindfulness breaks can keep it from building up.' });
    } else {
      recos.push({ icon: '🧘', title: 'Stress', text: 'Your stress levels look manageable — keep up whatever is working for you.' });
    }

    // Exercise
    if (input.physical_activity_hours < 1) {
      recos.push({ icon: '🏃', title: 'Exercise', text: 'Even a 20–30 minute walk daily can meaningfully lift mood and energy.' });
    } else {
      recos.push({ icon: '🏃', title: 'Exercise', text: 'Great job staying active — regular movement is one of the strongest mood boosters.' });
    }

    // Digital detox
    if (input.avg_daily_usage_hours > 5 || input.daily_unlocks > 80) {
      recos.push({ icon: '📵', title: 'Digital Detox', text: 'Try screen-free windows (e.g. the first hour after waking) to reduce phone dependency.' });
    } else {
      recos.push({ icon: '📵', title: 'Digital Detox', text: 'Your screen time looks reasonable — keep boundaries around late-night scrolling.' });
    }

    return recos;
  }

  function renderResult(score, input) {
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const clamped = Math.max(0, Math.min(10, score));
    const status = getStatus(clamped);

    // Ring
    const offset = RING_CIRCUMFERENCE - (clamped / 10) * RING_CIRCUMFERENCE;
    requestAnimationFrame(() => {
      ringFill.style.stroke = status.color;
      ringFill.style.strokeDashoffset = offset;
    });

    // Counter
    animateCounter(clamped);

    // Badge
    statusBadge.textContent = status.label;
    statusBadge.className = `status-badge ${status.key}`;

    // Description
    const descMap = {
      risk: 'Your responses suggest elevated strain. Small, consistent changes — plus support from people you trust — can help.',
      moderate: 'Your responses suggest a mixed picture. A few targeted habit changes below could tip things in a healthier direction.',
      healthy: 'Your responses suggest a solid overall balance. Keep reinforcing the habits that are working for you.',
    };
    resultDesc.textContent = descMap[status.key];

    // Recommendations
    recoGrid.innerHTML = '';
    buildRecommendations(clamped, input).forEach(r => {
      const card = document.createElement('div');
      card.className = 'reco-card';
      card.innerHTML = `
        <span class="reco-icon">${r.icon}</span>
        <h4>${r.title}</h4>
        <p>${r.text}</p>
      `;
      recoGrid.appendChild(card);
    });
  }

  retakeBtn.addEventListener('click', () => {
    resultSection.hidden = true;
    document.getElementById('assessment').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

})();
