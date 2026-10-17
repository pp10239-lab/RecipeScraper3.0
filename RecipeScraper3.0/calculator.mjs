export function normalizeMaterialName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/\*\d+$/, "");
}

export function calculateRequirements(selectedRecipes, recipeIndex, prices = {}) {
  const materials = new Map();
  const production = [];

  for (const selection of selectedRecipes) {
    const recipe = recipeIndex.get(selection.recipeId);
    if (!recipe) continue;

    const targetQuantity = Math.max(1, Math.floor(Number(selection.quantity) || 1));
    const craftQuantity = Math.max(1, Math.floor(Number(recipe.craft_quantity) || 1));
    const batchCount = Math.ceil(targetQuantity / craftQuantity);
    const outputQuantity = batchCount * craftQuantity;

    production.push({
      recipe,
      targetQuantity,
      batchCount,
      outputQuantity,
      extraQuantity: outputQuantity - targetQuantity,
    });

    for (const ingredient of recipe.materials ?? []) {
      const name = String(ingredient.name ?? "").trim();
      const key = normalizeMaterialName(name);
      const quantityPerBatch = Number(ingredient.quantity);
      if (!name || !key || !Number.isFinite(quantityPerBatch) || quantityPerBatch < 0) continue;

      const existing = materials.get(key) ?? {
        key,
        name,
        quantity: 0,
        price: null,
        cost: null,
      };
      existing.quantity += quantityPerBatch * batchCount;
      const savedPrice = prices[key];
      if (savedPrice !== undefined && savedPrice !== null && savedPrice !== "" && Number.isFinite(Number(savedPrice)) && Number(savedPrice) >= 0) {
        existing.price = Number(savedPrice);
      }
      materials.set(key, existing);
    }
  }

  let pricedCost = 0;
  let missingPriceCount = 0;
  for (const material of materials.values()) {
    if (material.price === null) {
      missingPriceCount += 1;
      continue;
    }
    material.cost = material.quantity * material.price;
    pricedCost += material.cost;
  }

  return {
    production,
    materials: [...materials.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
    materialCount: materials.size,
    missingPriceCount,
    pricedCost,
  };
}
