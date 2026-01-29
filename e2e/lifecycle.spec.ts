import { test, expect, type APIRequestContext, type Page, type Locator } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api';
const IT_TEAM_ID = '11111111-1111-4111-8111-111111111111';
const HR_TEAM_ID = '22222222-2222-4222-8222-222222222222';
const REQUESTER_EMAIL = 'requester@company.com';
const AGENT_EMAIL = 'agent@company.com';
const LEAD_EMAIL = 'lead@company.com';
const ADMIN_EMAIL = 'admin@company.com';

type TicketResponse = {
  id: string;
  status: string;
  subject: string;
  assignedTeam?: { id: string } | null;
};

async function openAs(page: Page, email: string, path: string) {
  await page.addInitScript((value) => window.localStorage.setItem('demoUserEmail', value), email);
  await page.goto(path, { waitUntil: 'networkidle' });
}

async function openCreateTicketModal(page: Page) {
  await page.getByRole('button', { name: 'New Ticket' }).click();
  await expect(page.getByRole('heading', { name: 'Raise a new ticket' })).toBeVisible();
}

async function waitForTicketOverview(page: Page) {
  await expect(page.getByText('Ticket overview')).toBeVisible();
}

async function waitForSelectOption(select: Locator, label: string) {
  await expect.poll(
    async () => {
      return await select.locator('option').allTextContents();
    },
    { timeout: 15_000 }
  ).toContain(label);
}

async function ensureDepartmentOption(page: Page, label: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const select = page
      .locator('label:has-text("Department")')
      .locator('..')
      .getByRole('combobox');
    try {
      await waitForSelectOption(select, label);
      return select;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      await page.reload({ waitUntil: 'networkidle' });
      await openCreateTicketModal(page);
    }
  }
  throw new Error(`Department option "${label}" not found`);
}

async function createTicket(
  api: APIRequestContext,
  subject: string,
  email: string
): Promise<TicketResponse> {
  const response = await api.post(`${API_BASE}/tickets`, {
    headers: { 'x-user-email': email },
    data: {
      subject,
      description: 'E2E lifecycle test ticket',
      priority: 'P3',
      channel: 'PORTAL',
      assignedTeamId: IT_TEAM_ID
    }
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TicketResponse;
}

async function waitForStatus(
  api: APIRequestContext,
  ticketId: string,
  email: string,
  status: string
) {
  await expect.poll(
    async () => {
      const response = await api.get(`${API_BASE}/tickets/${ticketId}`, {
        headers: { 'x-user-email': email }
      });
      if (!response.ok()) {
        return 'ERROR';
      }
      const body = (await response.json()) as TicketResponse;
      return body.status;
    },
    { timeout: 15_000 }
  ).toBe(status);
}

test('requester creates a ticket and sees it in My Tickets', async ({ page }) => {
  const subject = `E2E Ticket ${Date.now()}`;
  await openAs(page, REQUESTER_EMAIL, '/dashboard');

  await openCreateTicketModal(page);
  const departmentSelect = await ensureDepartmentOption(page, 'IT Service Desk');
  await departmentSelect.selectOption({ label: 'IT Service Desk' });

  await page
    .locator('label:has-text("Subject")')
    .locator('..')
    .locator('input')
    .fill(subject);

  await page
    .locator('label:has-text("Description")')
    .locator('..')
    .locator('textarea')
    .fill('E2E description');

  const [createResponse] = await Promise.all([
    page.waitForResponse((response) => {
      return response.url().includes('/api/tickets') && response.request().method() === 'POST';
    }),
    page.getByRole('button', { name: 'Submit ticket' }).click()
  ]);
  expect(createResponse.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Raise a new ticket' })).toBeHidden({
    timeout: 10_000
  });

  await page.goto('/tickets');
  await page.getByPlaceholder('Search').fill(subject);
  await expect(page.getByText(subject)).toBeVisible();
});

test('agent assigns and transitions a ticket', async ({ page, request }) => {
  const subject = `E2E Assign ${Date.now()}`;
  const ticket = await createTicket(request, subject, REQUESTER_EMAIL);

  await openAs(page, AGENT_EMAIL, `/tickets/${ticket.id}`);
  await waitForTicketOverview(page);

  const assignRow = page.getByRole('button', { name: 'Assign', exact: true }).locator('..');
  await waitForSelectOption(assignRow.locator('select'), 'Agent One');
  await assignRow.locator('select').selectOption({ label: 'Agent One' });
  await assignRow.getByRole('button', { name: 'Assign', exact: true }).click();
  await waitForStatus(request, ticket.id, AGENT_EMAIL, 'ASSIGNED');

  await page.getByRole('button', { name: 'Status tab' }).click();
  const statusRow = page.getByRole('button', { name: 'Update status' }).locator('..');
  await statusRow.locator('select').selectOption({ label: 'In Progress' });
  await page.getByRole('button', { name: 'Update status' }).click();
  await waitForStatus(request, ticket.id, AGENT_EMAIL, 'IN_PROGRESS');
});

test('internal notes are hidden from requester', async ({ page, request }) => {
  const subject = `E2E Notes ${Date.now()}`;
  const ticket = await createTicket(request, subject, REQUESTER_EMAIL);

  await openAs(page, AGENT_EMAIL, `/tickets/${ticket.id}`);
  await waitForTicketOverview(page);

  await page.getByRole('button', { name: 'Internal note' }).click();
  const internalText = `Internal note ${Date.now()}`;
  await page.getByPlaceholder('Add an internal note…').fill(internalText);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(internalText)).toBeVisible();

  await page.getByRole('button', { name: 'Public reply' }).click();
  const publicText = `Public reply ${Date.now()}`;
  await page.getByPlaceholder('Reply to the requester…').fill(publicText);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(publicText)).toBeVisible();

  await openAs(page, REQUESTER_EMAIL, `/tickets/${ticket.id}`);
  await expect(page.getByText(publicText)).toBeVisible();
  await expect(page.getByText(internalText)).toHaveCount(0);

});

test('triage board drag-drop updates status and shows SLA badge', async ({ page, request }) => {
  const subject = `E2E Triage ${Date.now()}`;
  const ticket = await createTicket(request, subject, REQUESTER_EMAIL);

  await openAs(page, LEAD_EMAIL, '/triage');
  await expect(page.getByRole('heading', { name: 'Triage Board', level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder('Search tickets')).toBeVisible();
  await page.getByPlaceholder('Search tickets').fill(subject);

  const ticketCard = page.locator('button', { hasText: subject }).first();
  await expect(ticketCard).toBeVisible();
  await expect(ticketCard.getByText('On track')).toBeVisible();

  const triagedColumn = page.locator('div').filter({ has: page.getByText('Triaged', { exact: true }) }).first();
  await ticketCard.dragTo(triagedColumn);

  await waitForStatus(request, ticket.id, LEAD_EMAIL, 'TRIAGED');
});

test('lead can transfer ticket and becomes read-only', async ({ page, request }) => {
  const subject = `E2E Transfer ${Date.now()}`;
  const ticket = await createTicket(request, subject, REQUESTER_EMAIL);

  await openAs(page, LEAD_EMAIL, `/tickets/${ticket.id}`);
  await waitForTicketOverview(page);

  await page.getByRole('button', { name: 'Transfer tab' }).click();
  const transferCard = page.getByRole('button', { name: 'Transfer', exact: true }).locator('..');
  const teamSelect = transferCard.locator('select').first();
  await waitForSelectOption(teamSelect, 'HR Operations');
  await teamSelect.selectOption({ label: 'HR Operations' });
  await expect(teamSelect).toHaveValue(HR_TEAM_ID);
  const transferButton = transferCard.getByRole('button', { name: 'Transfer' });
  await expect(transferButton).toBeEnabled();
  await transferButton.click();

  await expect.poll(async () => {
    const response = await request.get(`${API_BASE}/tickets/${ticket.id}`, {
      headers: { 'x-user-email': ADMIN_EMAIL }
    });
    if (!response.ok()) {
      return 'ERROR';
    }
    const body = (await response.json()) as TicketResponse;
    return body.assignedTeam?.id ?? 'NONE';
  }, { timeout: 15_000 }).toBe(HR_TEAM_ID);

  const writeAttempt = await request.post(`${API_BASE}/tickets/${ticket.id}/messages`, {
    headers: { 'x-user-email': LEAD_EMAIL },
    data: { body: 'Lead follow-up', type: 'PUBLIC' }
  });
  expect(writeAttempt.status()).toBe(403);
});

test('SLA badge appears on ticket list', async ({ page, request }) => {
  const subject = `E2E SLA ${Date.now()}`;
  await createTicket(request, subject, REQUESTER_EMAIL);

  await openAs(page, AGENT_EMAIL, '/tickets');
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await page.getByPlaceholder('Search').fill(subject);

  const ticketCard = page.locator('button', { hasText: subject }).first();
  await expect(ticketCard).toBeVisible();
  await expect(ticketCard.getByText('On track')).toBeVisible();
});
