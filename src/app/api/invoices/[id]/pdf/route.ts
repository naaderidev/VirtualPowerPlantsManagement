import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatApiDate } from "@/lib/persian-date";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CUSTOMER_ROLES,
  FINANCIAL_ROLES,
  isCustomerUser,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { apiError, handleRouteError } from "@/lib/api-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...FINANCIAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        settlement: {
          include: {
            contract: {
              include: {
                parties: { include: { party: true } },
              },
            },
            asset: true,
          },
        },
      },
    });

    if (!invoice) {
      return apiError(404, "NOT_FOUND", "صورتحساب پیدا نشد.", { request });
    }

    if (
      isCustomerUser(auth.user) &&
      !invoice.settlement.contract.parties.some(({ party }) =>
        auth.user.accessiblePartyIds.includes(party.id)
      )
    ) {
      return forbiddenResponse();
    }

    // Create PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(20);
    doc.text("INVOICE", 105, 20, { align: "center" });

    // Invoice Number
    doc.setFontSize(12);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 20, 35);
    doc.text(`Issue date (Solar Hijri): ${formatApiDate(invoice.issueDate, "issueDate")}`, 20, 42);
    doc.text(`Due date (Solar Hijri): ${formatApiDate(invoice.dueDate, "dueDate")}`, 20, 49);

    // Status
    doc.setFontSize(10);
    doc.text(`Status: ${invoice.status}`, 150, 35);

    // From/To Section
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("From:", 20, 65);
    doc.setFont("helvetica", "normal");
    doc.text("VPP Energy Management System", 20, 72);
    doc.text("Virtual Power Plant", 20, 79);

    doc.setFont("helvetica", "bold");
    doc.text("To:", 120, 65);
    doc.setFont("helvetica", "normal");
    const partyName = invoice.settlement?.contract?.parties[0]?.party?.displayName || "N/A";
    doc.text(partyName, 120, 72);

    // Settlement Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Settlement Details:", 20, 95);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Settlement No: ${invoice.settlement?.settlementNumber || "N/A"}`, 20, 102);
    doc.text(`Contract: ${invoice.settlement?.contract?.contractNumber || "N/A"}`, 20, 109);
    doc.text(`Asset: ${invoice.settlement?.asset?.name || "N/A"}`, 20, 116);
    doc.text(
      `Period (Solar Hijri): ${invoice.settlement ? formatApiDate(invoice.settlement.periodStart, "periodStart") : "-"} - ${invoice.settlement ? formatApiDate(invoice.settlement.periodEnd, "periodEnd") : "-"}`,
      20,
      123
    );

    // Items Table
    const tableData = [
      ["Energy Accepted (kWh)", `${invoice.settlement?.energyAccepted?.toLocaleString() || "0"}`],
      ["Unit Price (IRR)", `${invoice.settlement?.unitPrice?.toLocaleString() || "0"}`],
      ["Base Amount (IRR)", `${invoice.settlement?.baseAmount?.toLocaleString() || "0"}`],
      ["Tax (9%) (IRR)", `${invoice.settlement?.taxAmount?.toLocaleString() || "0"}`],
    ];

    autoTable(doc, {
      startY: 135,
      head: [["Description", "Amount"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 70, halign: "right" },
      },
    });

    // Total
    const finalY = (
      doc as typeof doc & { lastAutoTable?: { finalY: number } }
    ).lastAutoTable?.finalY || 180;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total Amount:", 20, finalY + 15);
    doc.text(`${invoice.amount?.toLocaleString() || "0"} IRR`, 20, finalY + 22);

    // Notes
    if (invoice.notes) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Notes:", 20, finalY + 35);
      doc.text(invoice.notes, 20, finalY + 42);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text("VPP - Virtual Power Plant Energy Management System", 105, 280, { align: "center" });

    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(request, error, "generate invoice PDF");
  }
}
