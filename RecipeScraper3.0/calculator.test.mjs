import test from "node:test";
import assert from "node:assert/strict";
import { calculateRequirements, normalizeMaterialName } from "./calculator.mjs";

test("normalizes compatible material labels without merging different materials", () => {
  assert.equal(normalizeMaterialName("風龍蜥 的甲殼"), normalizeMaterialName("風龍蜥的甲殼"));
  assert.notEqual(normalizeMaterialName("勒格耐席鉧條"), normalizeMaterialName("勒格耐席姆條"));
});

test("combines ingredients across selected recipes and applies a shared price", () => {
  const recipes = new Map([
    ["sword", {
      name: "長劍",
      craft_quantity: 1,
      materials: [{ name: "銅條", quantity: 4 }, { name: "木材", quantity: 2 }],
    }],
    ["axe", {
      name: "斧",
      craft_quantity: 1,
      materials: [{ name: "銅條", quantity: 3 }],
    }],
  ]);
  const result = calculateRequirements(
    [{ recipeId: "sword", quantity: 2 }, { recipeId: "axe", quantity: 1 }],
    recipes,
    { [normalizeMaterialName("銅條")]: 10 },
  );
  assert.equal(result.materialCount, 2);
  assert.equal(result.missingPriceCount, 1);
  assert.equal(result.pricedCost, 110);
  assert.deepEqual(
    result.materials.map(({ name, quantity, cost }) => ({ name, quantity, cost })),
    [
      { name: "木材", quantity: 4, cost: null },
      { name: "銅條", quantity: 11, cost: 110 },
    ].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
  );
});

test("rounds requested output up to full craft batches", () => {
  const recipes = new Map([["bomb", {
    name: "蕃茄炸彈",
    craft_quantity: 5,
    materials: [{ name: "蕃茄", quantity: 20 }],
  }]]);
  const result = calculateRequirements([{ recipeId: "bomb", quantity: 6 }], recipes, {});
  assert.equal(result.production[0].batchCount, 2);
  assert.equal(result.production[0].outputQuantity, 10);
  assert.equal(result.production[0].extraQuantity, 4);
  assert.equal(result.materials[0].quantity, 40);
});

test("counts quantities independently for multiple selected batches", () => {
  const recipes = new Map([["item", {
    name: "測試道具",
    craft_quantity: 2,
    materials: [{ name: "木材", quantity: 3 }],
  }]]);
  const result = calculateRequirements([{ recipeId: "item", quantity: 5 }], recipes, {});
  assert.equal(result.production[0].batchCount, 3);
  assert.equal(result.production[0].outputQuantity, 6);
  assert.equal(result.materials[0].quantity, 9);
});
