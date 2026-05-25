const synth = new window.GruntSynth();
const VOICES = window.VOICE_PRESETS;
const EXAMPLES = window.EXAMPLE_PHRASES;
const SLIDERS = window.SLIDER_DEFS;

const state = Object.fromEntries(
  Object.values(VOICES).map((voice) => [voice.id, { ...voice.defaults }])
);

const voiceGrid = document.querySelector("#voice-grid");

function formatValue(key, value, unit) {
  if (key === "pitch") {
    return `${Math.round(value)} ${unit}`;
  }

  return `${Number(value).toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

function normalizePreview(text) {
  const normalized = synth.normalizePhoneticText(text);
  return normalized || "empty";
}

function updateValueLabel(voiceId, key) {
  const label = document.querySelector(`[data-value-for="${voiceId}-${key}"]`);
  if (!label) {
    return;
  }

  const sliderDef = SLIDERS.find((item) => item.key === key);
  label.textContent = formatValue(key, state[voiceId][key], sliderDef.unit);
}

function updateTextMeta(voiceId) {
  const meta = document.querySelector(`[data-text-meta="${voiceId}"]`);
  if (!meta) {
    return;
  }

  meta.textContent = `Lautschrift: ${normalizePreview(state[voiceId].text)}`;
}

async function playText(voiceId, text) {
  await synth.playText(state[voiceId], text);
}

async function playBoth(text) {
  await synth.playText(state.male, text);
  window.setTimeout(() => {
    synth.playText(state.female, text);
  }, 170);
}

function setAllVoiceText(text) {
  Object.keys(state).forEach((voiceId) => {
    state[voiceId].text = text;
    const input = document.querySelector(`[data-text-input="${voiceId}"]`);
    if (input) {
      input.value = text;
    }
    updateTextMeta(voiceId);
  });
}

function buildVoiceCard(voice) {
  const card = document.createElement("article");
  card.className = "voice-card";
  card.dataset.voice = voice.id;

  const controls = SLIDERS.map((slider) => `
    <label class="slider-row">
      <div class="slider-meta">
        <span>${slider.label}</span>
        <span data-value-for="${voice.id}-${slider.key}">${formatValue(slider.key, state[voice.id][slider.key], slider.unit)}</span>
      </div>
      <input
        type="range"
        min="${slider.min}"
        max="${slider.max}"
        step="${slider.step}"
        value="${state[voice.id][slider.key]}"
        data-voice="${voice.id}"
        data-slider="${slider.key}"
      >
    </label>
  `).join("");

  const presetButtons = voice.presets.map((preset, index) => `
    <button
      class="${index === 0 ? "secondary" : "ghost"}"
      type="button"
      data-preset-voice="${voice.id}"
      data-preset-index="${index}"
    >
      ${preset.label}
    </button>
  `).join("");

  const exampleButtons = EXAMPLES.map((phrase) => `
    <button
      class="ghost"
      type="button"
      data-example-voice="${voice.id}"
      data-example-text="${phrase}"
    >
      ${phrase}
    </button>
  `).join("");

  card.innerHTML = `
    <div class="voice-tag">${voice.label}</div>
    <h2>${voice.label} Voice</h2>
    <p>${voice.description}</p>
    <div class="controls">${controls}</div>
    <div class="section-heading">
      <h3>Presets</h3>
    </div>
    <div class="preset-buttons">${presetButtons}</div>
    <div class="section-heading">
      <h3>Input</h3>
    </div>
    <div class="text-playground">
      <input
        type="text"
        class="text-input"
        value="${state[voice.id].text}"
        data-text-input="${voice.id}"
        placeholder="Lautschrift: wuhuu, aa-rgh, khra, zh, ny, tsch"
        aria-label="${voice.label} text input"
      >
      <button type="button" class="secondary" data-play-text="${voice.id}">Play</button>
      <button type="button" class="ghost" data-compare-text="${voice.id}">Play Both</button>
    </div>
    <p class="caption text-meta" data-text-meta="${voice.id}">Lautschrift: ${normalizePreview(state[voice.id].text)}</p>
    <div class="section-heading">
      <h3>Examples</h3>
    </div>
    <div class="mini-buttons">${exampleButtons}</div>
  `;

  return card;
}

function renderVoiceCards() {
  voiceGrid.innerHTML = "";
  Object.values(VOICES).forEach((voice) => {
    voiceGrid.appendChild(buildVoiceCard(voice));
  });
}

function syncVoiceStateToControls(voiceId, values) {
  Object.entries(values).forEach(([key, value]) => {
    const slider = document.querySelector(`[data-voice="${voiceId}"][data-slider="${key}"]`);
    if (!slider) {
      return;
    }

    slider.value = value;
    updateValueLabel(voiceId, key);
  });
}

function attachEvents() {
  document.addEventListener("input", (event) => {
    const slider = event.target.closest("input[type='range']");
    if (slider) {
      const { voice, slider: key } = slider.dataset;
      state[voice][key] = Number(slider.value);
      updateValueLabel(voice, key);
      return;
    }

    const textInput = event.target.closest("[data-text-input]");
    if (textInput) {
      state[textInput.dataset.textInput].text = textInput.value;
      updateTextMeta(textInput.dataset.textInput);
    }
  });

  document.addEventListener("click", async (event) => {
    const guideButton = event.target.closest("[data-guide-example]");
    if (guideButton) {
      const text = guideButton.dataset.guideExample;
      setAllVoiceText(text);
      await playBoth(text);
      return;
    }

    const presetButton = event.target.closest("[data-preset-voice]");
    if (presetButton) {
      const { presetVoice, presetIndex } = presetButton.dataset;
      const preset = VOICES[presetVoice].presets[Number(presetIndex)];
      state[presetVoice] = { ...state[presetVoice], ...preset.values };
      syncVoiceStateToControls(presetVoice, preset.values);

      await playText(presetVoice, state[presetVoice].text);
      return;
    }

    const exampleButton = event.target.closest("[data-example-voice]");
    if (exampleButton) {
      const { exampleVoice, exampleText } = exampleButton.dataset;
      const input = document.querySelector(`[data-text-input="${exampleVoice}"]`);
      state[exampleVoice].text = exampleText;
      if (input) {
        input.value = exampleText;
      }
      updateTextMeta(exampleVoice);
      await playText(exampleVoice, exampleText);
      return;
    }

    const playButton = event.target.closest("[data-play-text]");
    if (playButton) {
      const voiceId = playButton.dataset.playText;
      await playText(voiceId, state[voiceId].text);
      return;
    }

    const compareButton = event.target.closest("[data-compare-text]");
    if (compareButton) {
      const voiceId = compareButton.dataset.compareText;
      await playBoth(state[voiceId].text);
    }
  });

  document.addEventListener("keydown", async (event) => {
    const textInput = event.target.closest("[data-text-input]");
    if (textInput && event.key === "Enter") {
      event.preventDefault();
      const voiceId = textInput.dataset.textInput;
      await playText(voiceId, state[voiceId].text);
    }
  });
}

renderVoiceCards();
attachEvents();
