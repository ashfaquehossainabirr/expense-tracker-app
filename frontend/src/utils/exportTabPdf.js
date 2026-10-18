// Builds and downloads a PDF of one tab's income + expense history.
// jsPDF is loaded on demand so it stays out of the main bundle.

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

// Built-in PDF fonts can't draw symbols like ৳, so amounts use the ISO code (e.g. "BDT 1,200.00").
const money = (amount, currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "BDT",
    currencyDisplay: "code",
  })
    .format(Number(amount) || 0)
    .replace(/\u00a0/g, " ");

const safeFileName = (s) =>
  String(s || "tab")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "tab";

export async function exportTabPdf({ user, tab, incomes, expenses }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable =
    typeof autoTableModule.default === "function"
      ? autoTableModule.default
      : autoTableModule.default?.default;

  const currency = user?.currency;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalIncome - totalExpenses;

  // ---- Header ----
  doc.setFont("courier", "bold");
  doc.setFontSize(20);
  doc.text("Ledger", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`${user?.name || "User"}'s expense history`, margin, 68);
  doc.text(`Tab: ${tab?.name || "—"}`, margin, 83);
  doc.text(`Generated: ${dateFormatter.format(new Date())}`, pageWidth - margin, 68, {
    align: "right",
  });
  doc.setTextColor(0);

  // ---- Summary ----
  autoTable(doc, {
    startY: 100,
    margin: { left: margin, right: margin },
    head: [["Total income", "Total expenses", "Balance", "Entries"]],
    body: [
      [
        money(totalIncome, currency),
        money(totalExpenses, currency),
        `${balance < 0 ? "-" : ""}${money(Math.abs(balance), currency)}`,
        String(incomes.length + expenses.length),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40], fontSize: 9 },
    bodyStyles: { fontSize: 10, fontStyle: "bold" },
  });

  const section = (title, rows, head, color) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, margin, doc.lastAutoTable.finalY + 30);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 38,
      margin: { left: margin, right: margin },
      head: [head],
      body: rows.length ? rows : [[{ content: "No entries yet.", colSpan: 5, styles: { halign: "center", textColor: 120 } }]],
      theme: "striped",
      headStyles: { fillColor: color, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
      columnStyles: { 4: { halign: "right", cellWidth: 90 } },
    });
  };

  section(
    `Income (${incomes.length})`,
    incomes.map((i) => [
      dateFormatter.format(new Date(i.date)),
      i.title,
      i.source,
      i.note || "",
      `+${money(i.amount, currency)}`,
    ]),
    ["Date", "Title", "Source", "Note", "Amount"],
    [13, 115, 119]
  );

  section(
    `Expenses (${expenses.length})`,
    expenses.map((e) => [
      dateFormatter.format(new Date(e.date)),
      e.title,
      e.category,
      e.note || "",
      `-${money(e.amount, currency)}`,
    ]),
    ["Date", "Title", "Category", "Note", "Amount"],
    [176, 48, 48]
  );

  // ---- Page numbers ----
  const pages = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(
      `Page ${p} of ${pages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  }

  doc.save(`ledger-${safeFileName(tab?.name)}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
