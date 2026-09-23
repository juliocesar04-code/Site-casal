import { expect, test, type Page } from "@playwright/test";

// Requires two confirmed accounts in the target environment (never production):
// E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD and E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD.
const accounts = {
  a: { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD },
  b: { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD },
};

test.skip(!accounts.a.email || !accounts.b.email, "test accounts not configured");
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, who: "a" | "b") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(accounts[who].email!);
  await page.getByLabel("Senha").fill(accounts[who].password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);
}

let memoryOfB = "";

test("B creates a draft", async ({ page }) => {
  await signIn(page, "b");
  await page.getByRole("button", { name: "Nova memória" }).first().click();
  await expect(page).toHaveURL(/\/painel\/memorias\/[0-9a-f-]{36}/);
  memoryOfB = page.url().match(/memorias\/([0-9a-f-]{36})/)![1]!;
  await page.getByLabel("Nome de quem vai receber").fill("Destinatário de B");
  await expect(page.getByText("Salvo")).toBeVisible({ timeout: 10_000 });
});

test("A cannot open, preview or upload to B's memory", async ({ page, baseURL }) => {
  test.skip(!memoryOfB, "depends on previous test");
  await signIn(page, "a");

  for (const path of [`/painel/memorias/${memoryOfB}`, `/painel/memorias/${memoryOfB}/visualizar`, `/painel/memorias/${memoryOfB}/cartao`]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Destinatário de B")).toHaveCount(0);
  }

  const upload = await page.request.post("/api/uploads", {
    data: { kind: "image", memoryId: memoryOfB, mime: "image/png", size: 100 },
    headers: { origin: baseURL! },
  });
  expect(upload.status()).toBe(404);
});

test("B deletes the draft and it stops existing", async ({ page }) => {
  test.skip(!memoryOfB, "depends on previous test");
  await signIn(page, "b");
  await page.goto(`/painel/memorias/${memoryOfB}`);
  await page.goto("/painel");
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  const response = await page.goto(`/painel/memorias/${memoryOfB}`);
  expect(response?.status()).toBe(404);
});
