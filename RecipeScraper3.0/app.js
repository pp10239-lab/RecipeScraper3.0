const recipeFiles = [
  "blue_cg_accessory_recipe.json",
  "blue_cg_armor_recipe.json",
  "blue_cg_axe_recipe.json",
  "blue_cg_bomb_recipe.json",
  "blue_cg_boots_recipe.json",
  "blue_cg_bow_recipe.json",
  "blue_cg_clothes_recipe.json",
  "blue_cg_cooking_recipe.json",
  "blue_cg_dagger_recipe.json",
  "blue_cg_external_wound_medicine_recipe.json",
  "blue_cg_gloves_recipe.json",
  "blue_cg_hat_recipe.json",
  "blue_cg_healing_medicine_recipe.json",
  "blue_cg_helmet_recipe.json",
  "blue_cg_pet_accessory_recipe.json",
  "blue_cg_pet_collar_recipe.json",
  "blue_cg_pet_crystal_recipe.json",
  "blue_cg_pet_heavy_armor_recipe.json",
  "blue_cg_pet_light_armor_recipe.json",
  "blue_cg_potion_recipe.json",
  "blue_cg_shield_recipe.json",
  "blue_cg_shoes_recipe.json",
  "blue_cg_spear_recipe.json",
  "blue_cg_staff_recipe.json",
  "blue_cg_sword_recipe.json",
  "blue_cg_throwing_recipe.json",
  "blue_cg_transformation_card_recipe.json",
];

const materialFiles = [
  "blue_cg_clipping_materials.json",
  "blue_cg_hunting_materials.json",
  "blue_cg_logging_materials.json",
  "blue_cg_mining_materials.json",
  "blue_cg_other_recipe_materials.json",
];

const storageKey = "blue-cg-recipe-calculator-v1";
const state = {
  recipeGroups: [],
  recipes: new Map(),
  materials: [],
  selectedRecipes: [],
  prices: {},
};

const { calculateRequirements, normalizeMaterialName } = RecipeCalculator;

const elements = {
  error: document.querySelector("#app-error"),
  status: document.querySelector("#app-status"),
  category: document.querySelector("#category-select"),
  recipe: document.querySelector("#recipe-select"),
  grouping: document.querySelector("#recipe-grouping"),
  targetQuantity: document.querySelector("#target-quantity"),
  recipeCount: document.querySelector("#recipe-count"),
  selectedRecipes: document.querySelector("#selected-recipes"),
  summaryCards: document.querySelector("#summary-cards"),
  materialsTable: document.querySelector("#materials-table-wrap"),
  materialSearch: document.querySelector("#material-search"),
  priceCount: document.querySelector("#price-count"),
  priceTable: document.querySelector("#price-table-wrap"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value)} G`;
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function showStatus(message) {
  elements.status.textContent = message;
  elements.status.hidden = false;
  window.setTimeout(() => {
    elements.status.hidden = true;
  }, 4000);
}

function readPriceSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    if (saved.prices && typeof saved.prices === "object") state.prices = saved.prices;
    if (Array.isArray(saved.selectedRecipes)) state.selectedRecipes = saved.selectedRecipes;
  } catch (error) {
    showError(`無法讀取瀏覽器中儲存的單價設定：${error.message}`);
  }
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      prices: state.prices,
      selectedRecipes: state.selectedRecipes,
    }));
  } catch (error) {
    showError(`無法儲存設定到瀏覽器：${error.message}。請確認瀏覽器儲存空間可用。`);
  }
}

async function loadJsonFiles(folder, files) {
  return Promise.all(files.map(async (filename) => {
    const response = await fetch(`./${folder}/${filename}`);
    if (!response.ok) throw new Error(`讀取 ${folder}/${filename} 失敗（HTTP ${response.status}）`);
    return { filename, data: await response.json() };
  }));
}

function addMaterial(name, category, source) {
  const key = normalizeMaterialName(name);
  if (!key) return;
  const current = state.materials.find((material) => material.key === key);
  if (current) {
    if (source === "catalog" && current.source !== "catalog") {
      current.name = name;
      current.category = category || "other";
      current.source = source;
    } else if (current.category === "other" && category && category !== "other") {
      current.category = category;
    }
    return;
  }
  state.materials.push({ key, name, category: category || "other", source });
}

function buildRecipeIndex(files) {
  state.recipeGroups = files.map(({ filename, data }) => ({
    filename,
    title: data.page_title || filename.replace(/^blue_cg_|_recipe\.json$/g, ""),
    recipes: (data.recipes ?? []).map((recipe, index) => {
      const id = `${filename}:${index}`;
      const indexed = { ...recipe, id, category: data.page_title || filename };
      state.recipes.set(id, indexed);
      return indexed;
    }),
  }));
  const count = state.recipeGroups.reduce((total, group) => total + group.recipes.length, 0);
  elements.recipeCount.textContent = `${state.recipeGroups.length} 個類別 · ${count} 個配方`;
}

function buildMaterialsIndex(files) {
  for (const { data } of files) {
    for (const resource of data.resources ?? []) {
      addMaterial(resource.name, resource.category, "catalog");
    }
  }
  for (const recipe of state.recipes.values()) {
    for (const ingredient of recipe.materials ?? []) {
      addMaterial(ingredient.name, "other", "recipe");
    }
  }
  state.materials.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

function renderRecipeOptions() {
  const group = state.recipeGroups.find((entry) => entry.filename === elements.category.value);
  elements.recipe.replaceChildren();
  for (const recipe of group?.recipes ?? []) {
    const option = document.createElement("option");
    option.value = recipe.id;
    option.textContent = `${recipe.name} · Lv.${recipe.level}${recipe.level_code ? ` ${recipe.level_code}` : ""}`;
    elements.recipe.append(option);
  }
}

function renderCategories() {
  elements.category.replaceChildren();
  for (const group of state.recipeGroups) {
    const option = document.createElement("option");
    option.value = group.filename;
    option.textContent = group.title;
    elements.category.append(option);
  }
  renderRecipeOptions();
}

function renderSelectedRecipes() {
  if (state.selectedRecipes.length === 0) {
    elements.selectedRecipes.innerHTML = '<div class="empty-state">還沒有加入配方。從上方選擇道具並加入清單。</div>';
    return;
  }

  const renderRecipeRow = (selection, index) => {
    const recipe = state.recipes.get(selection.recipeId);
    if (!recipe) return "";
    const craftQuantity = Math.max(1, Number(recipe.craft_quantity) || 1);
    const batches = Math.ceil(selection.quantity / craftQuantity);
    const output = batches * craftQuantity;
    const outputHint = craftQuantity > 1
      ? `每批製作 ${craftQuantity} 個 · 需製作 ${batches} 批 · 產出 ${output} 個${output > selection.quantity ? `（多 ${output - selection.quantity} 個）` : ""}`
      : `Lv.${recipe.level}${recipe.level_code ? ` · ${recipe.level_code}` : ""}`;
    return `
      <article class="recipe-row">
        <div>
          <div class="recipe-title-line">
            <strong>${escapeHtml(recipe.name)}</strong>
            <span class="recipe-category-tag">${escapeHtml(recipe.category)}</span>
          </div>
          <small>${escapeHtml(outputHint)}</small>
        </div>
        <label class="recipe-target">
          <span>目標數量</span>
          <input data-selection-index="${index}" type="number" min="1" step="1" value="${selection.quantity}" aria-label="${escapeHtml(recipe.name)}目標數量">
        </label>
        <button class="remove-button" type="button" data-remove-index="${index}" aria-label="移除 ${escapeHtml(recipe.name)}">×</button>
      </article>`;
  };
  const indexedSelections = state.selectedRecipes.map((selection, index) => ({ selection, index }));

  if (elements.grouping.value !== "category") {
    elements.selectedRecipes.innerHTML = indexedSelections
      .map(({ selection, index }) => renderRecipeRow(selection, index))
      .join("");
    return;
  }

  const groups = new Map();
  for (const entry of indexedSelections) {
    const recipe = state.recipes.get(entry.selection.recipeId);
    if (!recipe) continue;
    const category = recipe.category || "其他";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(entry);
  }
  elements.selectedRecipes.innerHTML = [...groups.entries()].map(([category, entries]) => `
    <section class="recipe-category-group">
      <div class="recipe-group-heading">
        <h4>${escapeHtml(category)}</h4>
        <span>${entries.length} 項</span>
      </div>
      <div class="recipe-group-items">
        ${entries.map(({ selection, index }) => renderRecipeRow(selection, index)).join("")}
      </div>
    </section>`).join("");
}

function renderSummary() {
  const summary = calculateRequirements(state.selectedRecipes, state.recipes, state.prices);
  const missingLabel = summary.missingPriceCount === 0
    ? "所有素材單價都已設定"
    : `${summary.missingPriceCount} 種素材尚未設定單價`;
  elements.summaryCards.innerHTML = `
    <article class="summary-card"><span>素材種類</span><strong>${formatNumber(summary.materialCount)}</strong></article>
    <article class="summary-card"><span>已知素材成本</span><strong>${formatMoney(summary.pricedCost)}</strong></article>
    <article class="summary-card ${summary.missingPriceCount ? "is-warning" : ""}"><span>價格狀態</span><strong>${escapeHtml(missingLabel)}</strong></article>`;

  if (summary.materials.length === 0) {
    elements.materialsTable.innerHTML = '<div class="empty-state">加入配方後，這裡會彙總所需素材與成本。</div>';
    return;
  }

  const rows = summary.materials.map((material) => `
    <tr>
      <td>${escapeHtml(material.name)}</td>
      <td class="number-cell">${formatNumber(material.quantity)}</td>
      <td class="price-cell ${material.price === null ? "price-missing" : ""}">${material.price === null ? "未設定" : formatMoney(material.price)}</td>
      <td class="number-cell ${material.cost === null ? "price-missing" : ""}">${material.cost === null ? "—" : formatMoney(material.cost)}</td>
    </tr>`).join("");
  elements.materialsTable.innerHTML = `
    <table class="data-table">
      <thead><tr><th>素材</th><th class="number-cell">需求數量</th><th class="price-cell">單價</th><th class="number-cell">小計</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderPriceTable() {
  const query = elements.materialSearch.value.trim().toLocaleLowerCase("zh-Hant");
  const filtered = state.materials.filter((material) => (
    !query
    || material.name.toLocaleLowerCase("zh-Hant").includes(query)
    || material.category.toLocaleLowerCase("zh-Hant").includes(query)
  ));
  elements.priceCount.textContent = `顯示 ${filtered.length} / ${state.materials.length} 種素材`;
  if (filtered.length === 0) {
    elements.priceTable.innerHTML = '<div class="empty-state">找不到符合的素材。</div>';
    return;
  }
  elements.priceTable.innerHTML = `
    <table class="data-table">
      <thead><tr><th>素材</th><th>分類</th><th class="number-cell">單件成本（G）</th><th>狀態</th></tr></thead>
      <tbody>${filtered.map((material) => {
        const value = state.prices[material.key] ?? "";
        const isSet = value !== "" && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0;
        return `<tr>
          <td>${escapeHtml(material.name)}</td>
          <td><span class="category-tag">${escapeHtml(material.category)}</span></td>
          <td class="number-cell"><input class="price-input" type="number" min="0" step="0.01" inputmode="decimal" data-price-key="${escapeHtml(material.key)}" value="${isSet ? escapeHtml(value) : ""}" placeholder="尚未設定" aria-label="${escapeHtml(material.name)}單件成本"></td>
          <td><span class="price-tag ${isSet ? "is-set" : ""}">${isSet ? "已設定" : "未設定"}</span></td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

function setTab(tabName) {
  for (const button of document.querySelectorAll(".tab-button")) {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  }
  document.querySelector("#planner-panel").hidden = tabName !== "planner";
  document.querySelector("#prices-panel").hidden = tabName !== "prices";
  if (tabName === "prices") renderPriceTable();
}

function addSelection() {
  const recipeId = elements.recipe.value;
  const recipe = state.recipes.get(recipeId);
  if (!recipe) return;
  const quantity = Math.max(1, Math.floor(Number(elements.targetQuantity.value) || 1));
  state.selectedRecipes.push({ recipeId, quantity });
  elements.targetQuantity.value = "1";
  saveState();
  render();
}

function render() {
  renderSelectedRecipes();
  renderSummary();
}

function exportPrices() {
  const prices = Object.fromEntries(
    Object.entries(state.prices).filter(([, value]) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0),
  );
  const blob = new Blob([`${JSON.stringify({ version: 1, prices }, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "blue-cg-material-prices.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function attachEvents() {
  elements.category.addEventListener("change", renderRecipeOptions);
  document.querySelector("#add-recipe").addEventListener("click", addSelection);
  elements.targetQuantity.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addSelection();
  });
  document.querySelector("#clear-recipes").addEventListener("click", () => {
    state.selectedRecipes = [];
    saveState();
    render();
  });
  elements.grouping.addEventListener("change", renderSelectedRecipes);
  elements.selectedRecipes.addEventListener("change", (event) => {
    const index = Number(event.target.dataset.selectionIndex);
    if (!Number.isInteger(index) || !state.selectedRecipes[index]) return;
    state.selectedRecipes[index].quantity = Math.max(1, Math.floor(Number(event.target.value) || 1));
    saveState();
    render();
  });
  elements.selectedRecipes.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-index]");
    if (!button) return;
    state.selectedRecipes.splice(Number(button.dataset.removeIndex), 1);
    saveState();
    render();
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.querySelectorAll("[data-open-tab]").forEach((link) => {
    link.addEventListener("click", () => setTab(link.dataset.openTab));
  });
  elements.materialSearch.addEventListener("input", renderPriceTable);
  elements.priceTable.addEventListener("change", (event) => {
    const input = event.target.closest("[data-price-key]");
    if (!input) return;
    const value = input.value.trim();
    if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      input.setCustomValidity("請輸入大於或等於 0 的數字，或留空代表尚未設定。");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    if (value === "") delete state.prices[input.dataset.priceKey];
    else state.prices[input.dataset.priceKey] = Number(value);
    saveState();
    renderPriceTable();
    renderSummary();
  });
  document.querySelector("#export-prices").addEventListener("click", exportPrices);
}

async function start() {
  readPriceSettings();
  try {
    const [recipeData, materialData] = window.RECIPE_DATA
      ? [
        recipeFiles.map((filename) => ({ filename, data: window.RECIPE_DATA.recipe[filename] })).filter((entry) => entry.data),
        materialFiles.map((filename) => ({ filename, data: window.RECIPE_DATA.material[filename] })).filter((entry) => entry.data),
      ]
      : await Promise.all([
        loadJsonFiles("recipe", recipeFiles),
        loadJsonFiles("material", materialFiles),
      ]);
    if (recipeData.length !== recipeFiles.length || materialData.length !== materialFiles.length) {
      throw new Error("內嵌資料不完整，請重新產生離線版");
    }
    buildRecipeIndex(recipeData);
    buildMaterialsIndex(materialData);
    renderCategories();
    attachEvents();
    render();
  } catch (error) {
    showError(`無法載入配方或素材資料：${error.message}。請從專案根目錄啟動本機網頁伺服器，再重新整理頁面。`);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
