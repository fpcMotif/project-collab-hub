import { expect, test } from "@playwright/test";

test.describe("Board smoke", () => {
  test("board page loads with header and new project action", async ({ page }) => {
    await page.goto("/board");
    await expect(page.getByRole("heading", { name: "项目看板" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新建项目" })).toBeVisible();
  });

  test("user can open new project flow from board", async ({ page }) => {
    await page.goto("/board");
    await page.getByRole("link", { name: "新建项目" }).click();
    await expect(page).toHaveURL(/\/projects\/new/);
  });
});
