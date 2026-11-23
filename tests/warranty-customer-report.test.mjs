/* Customer downloads must match the admin's saved approval PDF, with matching
 * login-phone/reference authorization and no public/private-file shortcuts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { testServer } from "./helpers/server.mjs";

test("customers can download only their approved PDF and it matches the admin report", async () => {
  const server = await testServer();
  const endpoint = "/api/warranty/registrations/report.pdf";
  const offset = path.join(server.directory, "clock-offset");
  const clock = path.join(server.directory, "clock.mjs");
  await writeFile(offset, "0");
  await writeFile(
    clock,
    `import fs from 'node:fs';const realNow=Date.now;Date.now=()=>realNow()+Number(fs.readFileSync(new URL('./clock-offset',import.meta.url),'utf8'));`,
  );
  const request = (route, body, cookie = "", extra = {}) =>
    fetch(server.base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login(mobile) {
    const challenge = await (
      await request("/api/warranty/otp/request", { mobile })
    ).json();
    const result = await request("/api/warranty/otp/verify", {
      challengeId: challenge.challengeId,
      code: challenge.demoCode,
    });
    assert.equal(result.status, 200);
    return result.headers.get("set-cookie").split(";")[0];
  }
  try {
    await server.start([clock]);
    assert.equal(
      (await request(endpoint, { reference: "x".repeat(20000) })).status,
      401,
      "Authenticate before parsing",
    );
    assert.equal(
      (await request(endpoint, {}, "areva_warranty=forged")).status,
      401,
    );
    const owner = await login("9000000000"),
      other = await login("9111111111");
    const options = await (await request("/api/warranty/options")).json();
    const receiptResponse = await request(
      "/api/warranty/receipt",
      {
        name: "customer-report-invoice.pdf",
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.4\nInvoice fixture\n%%EOF").toString("base64"),
      },
      owner,
    );
    assert.equal(receiptResponse.status, 201);
    const receipt = await receiptResponse.json();
    const form = {
      submissionId: crypto.randomUUID(),
      customerName: "Approved report customer",
      email: "report@example.test",
      productId: options.products[0].id,
      purchaseDate: "2026-01-01",
      quantity: "2",
      packSize: "4 L",
      dealerName: "Report dealer",
      dealerAddress: "Invoice dealer road",
      dealerCity: "Pune",
      invoiceNumber: "INVOICE-CUSTOMER-PDF",
      siteAddress: "Private report building",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      notes: "Customer application notes",
      consent: true,
      receiptId: receipt.id,
    };
    const savedResponse = await request(
      "/api/warranty/registrations",
      form,
      owner,
    );
    assert.equal(savedResponse.status, 201, await savedResponse.clone().text());
    const saved = await savedResponse.json();
    const proof = { reference: saved.reference };
    const history = async () =>
      (
        await request(
          "/api/warranty/registrations/history",
          { references: [saved.reference] },
          owner,
        )
      ).json();
    assert.equal((await history()).registrations[0].reportAvailable, false);
    assert.equal((await request(endpoint, proof, owner)).status, 409);
    assert.equal((await request(endpoint, {}, owner)).status, 400);
    assert.equal(
      (await request(endpoint, { reference: "ARV-WR-20261123" }, owner)).status,
      400,
    );
    assert.equal(
      (
        await request(endpoint, proof, owner, {
          Origin: "https://foreign.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(endpoint, proof, owner, {
          "Sec-Fetch-Site": "cross-site",
        })
      ).status,
      403,
    );

    await server.login();
    const adminRoute = "/api/admin/warranties/" + saved.id;
    const before = (await (await server.request(adminRoute)).json())
      .registration;
    const reviewNotes =
      "Purchase invoice checked. APPROVED-CUSTOMER-REVIEW-NOTES.";
    const approved = await server.request(
      adminRoute,
      {
        status: "approved",
        notes: reviewNotes,
        expectedVersion: before.version,
        approvalConfirmed: true,
      },
      "PATCH",
    );
    assert.equal(approved.status, 200, await approved.clone().text());
    const approvedHistory = await history();
    assert.equal(approvedHistory.registrations[0].reportAvailable, true);
    assert.equal(
      JSON.stringify(approvedHistory).includes(reviewNotes),
      false,
      "Card summaries remain minimal",
    );
    assert.equal(
      JSON.stringify(approvedHistory).includes(form.siteAddress),
      false,
    );
    const customerReport = await request(
      endpoint,
      { reference: " " + saved.reference.toLowerCase() + " " },
      owner,
    );
    assert.equal(
      customerReport.status,
      200,
      await customerReport.clone().text(),
    );
    assert.equal(customerReport.headers.get("content-type"), "application/pdf");
    assert.match(customerReport.headers.get("cache-control"), /no-store/);
    assert.equal(
      customerReport.headers.get("x-content-type-options"),
      "nosniff",
    );
    assert.match(
      customerReport.headers.get("content-security-policy"),
      /sandbox/,
    );
    assert.match(
      customerReport.headers.get("content-disposition"),
      new RegExp(saved.reference + "\\.pdf"),
    );
    const bytes = Buffer.from(await customerReport.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    const adminReport = await server.request(adminRoute + "/report.pdf");
    assert.equal(adminReport.status, 200);
    assert.deepEqual(
      bytes,
      Buffer.from(await adminReport.arrayBuffer()),
      "Customer receives the identical saved-snapshot report",
    );

    const task = getDocument({ data: new Uint8Array(bytes) });
    try {
      const pdf = await task.promise;
      const parts = [];
      for (let index = 1; index <= pdf.numPages; index++)
        parts.push(
          (await (await pdf.getPage(index)).getTextContent()).items
            .filter((item) => "str" in item)
            .map((item) => item.str)
            .join(" "),
        );
      const text = parts.join(" ").replace(/\s+/g, " ");
      for (const value of [
        saved.reference,
        form.customerName,
        form.siteAddress,
        form.invoiceNumber,
        form.notes,
        reviewNotes,
        "Approved",
        "admin",
        "+919000000000",
      ])
        assert.ok(
          text.includes(value),
          "Missing saved report content: " + value,
        );
      assert.equal(await pdf.getJSActions(), null);
    } finally {
      await task.destroy();
    }

    assert.equal(
      (await request(endpoint, proof, other)).status,
      404,
      "Full reference alone cannot bypass a different login phone",
    );
    assert.equal(
      (
        await request(
          endpoint,
          {
            ...proof,
            mobile: "+919000000000",
            loginMobile: "+919000000000",
            mobileVerified: true,
          },
          other,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          endpoint,
          { reference: "ARV-WR-20261123-" + crypto.randomUUID() },
          owner,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request(endpoint, undefined, owner)).status,
      404,
      "No unprotected GET download route",
    );
    assert.equal(
      (await request(adminRoute + "/report.pdf", undefined, owner)).status,
      401,
    );
    assert.equal(
      (await request(adminRoute + "/receipt", undefined, owner)).status,
      401,
    );
    const access = JSON.parse(
      await readFile(
        path.join(server.directory, "warranty-history-access.json"),
        "utf8",
      ),
    );
    assert.ok(
      access.some(
        (entry) => entry.registrationId === saved.id && entry.lookupCount >= 3,
      ),
    );
    assert.equal(JSON.stringify(access).includes(owner.split("=")[1]), false);

    /* Final rejection stays an admin-only report, even when the customer holds its reference. */
    const nextReceipt = await request(
      "/api/warranty/receipt",
      {
        name: "rejected-report-invoice.pdf",
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.4\nRejected invoice fixture\n%%EOF").toString(
            "base64",
          ),
      },
      owner,
    );
    assert.equal(nextReceipt.status, 201);
    const rejectedResponse = await request(
      "/api/warranty/registrations",
      {
        ...form,
        receiptId: (await nextReceipt.json()).id,
        submissionId: crypto.randomUUID(),
      },
      owner,
    );
    assert.equal(rejectedResponse.status, 201);
    const rejected = await rejectedResponse.json();
    const rejection = await server.request(
      "/api/admin/warranties/" + rejected.id,
      {
        status: "rejected",
        notes: "Invoice mismatch",
        expectedVersion: 1,
        approvalConfirmed: false,
      },
      "PATCH",
    );
    assert.equal(rejection.status, 200);
    assert.equal(
      (await request(endpoint, { reference: rejected.reference }, owner))
        .status,
      409,
    );

    const page = await request("/warranty");
    assert.match(page.headers.get("cache-control"), /no-store/);
    assert.equal(page.headers.get("x-frame-options"), "DENY");
    assert.match(
      page.headers.get("content-security-policy"),
      /frame-src 'self' blob:/,
    );
    assert.match(
      page.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    assert.match(
      page.headers.get("content-security-policy"),
      /object-src 'none'/,
    );
    const publicPage = await request("/");
    assert.equal(
      /frame-src[^;]*blob:/.test(
        publicPage.headers.get("content-security-policy"),
      ),
      false,
    );

    await writeFile(offset, String(30 * 60000 + 1));
    assert.equal(
      (await request(endpoint, proof, owner)).status,
      401,
      "Expired sessions cannot download PDFs",
    );
    const returning = await login("9000000000");
    assert.equal(
      (await request(endpoint, proof, returning)).status,
      200,
      "A fresh authorized login can reopen the saved PDF",
    );
    await request("/api/warranty/logout", {}, returning);
    assert.equal(
      (await request(endpoint, proof, returning)).status,
      401,
      "Logout revokes report access",
    );
  } finally {
    await server.dispose();
  }
});
