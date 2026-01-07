import React from "react";
import {
  formatCurrency,
  getReceiptMeta,
  sumReceiptAmounts,
} from "../utils/recordUtils";

function PaymentReceiptsTable({
  receipts = [],
  emptyMessage = "No payments received for this request yet.",
  showTotal = true,
  totalAmount = null,
}) {
  if (!receipts.length) {
    return <p className="text-muted small mb-0">{emptyMessage}</p>;
  }

  const computedTotal =
    totalAmount === null ? sumReceiptAmounts(receipts) : totalAmount;

  return (
    <>
      <div className="table-responsive border rounded">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Un Utilized</th>
              <th>Bank RECO</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt, index) => {
              const {
                receiptAmount,
                receiptDate,
                receiptNumber,
                receiptMode,
                unUtilizedAmount,
                receiptReconcilation,
                receiptNote,
              } = getReceiptMeta(receipt);
              const rowKey =
                receipt.ID ||
                receipt.Payment_Receipt_ID ||
                receipt.Reference_Number ||
                `receipt-${index}`;
              return (
                <tr key={rowKey}>
                  <td>{receiptNumber}</td>
                  <td>{receiptDate}</td>
                  <td>{formatCurrency(receiptAmount)}</td>
                  <td>{receiptMode}</td>
                   <td>{unUtilizedAmount}</td>
                  <td>{receiptReconcilation}</td>
                  <td>{receiptNote}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showTotal && (
        <div className="text-end text-muted small mt-2">
          Total Received: <strong>{formatCurrency(computedTotal)}</strong>
        </div>
      )}
    </>
  );
}

export default PaymentReceiptsTable;
