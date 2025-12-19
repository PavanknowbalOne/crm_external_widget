import React from "react";

export const getUtilizationMeta = (utilization = {}) => {
  const paymentReference =
    utilization.Payment_Received?.zc_display_value ||
    utilization.Payment_Receipt?.zc_display_value ||
    utilization.Payment?.zc_display_value ||
    utilization.Payment_Name ||
    utilization.Payment ||
    "";
  const reference =
    utilization.Utilization_Number ||
    utilization.Reference_Number ||
    utilization.Name ||
    paymentReference ||
    `Utilization ${utilization.ID || ""}`.trim();
  const date =
    utilization.Receipt_Date ||
    utilization.Date ||
    utilization.Payment_Date ||
    utilization.Created_Time ||
    "";
  const rawAmount =
    utilization.Utilization ??
    utilization.Amount ??
    utilization.Payment_Amount ??
    utilization.Applied_Amount ??
    0;
  const amount = Number(rawAmount) || 0;
  const notes =
    utilization.Utilization_Notes ||
    utilization.Notes ||
    utilization.Description ||
    "";

  return {
    reference,
    paymentReference,
    date,
    amount,
    notes,
  };
};

const InvoiceUtilizationsPanel = ({
  utilizations = [],
  isLoading = false,
  error = null,
  formatCurrency,
  emptyMessage = "No payment utilizations available for this invoice.",
}) => {
  const formattedAmount = (value) => {
    if (typeof formatCurrency === "function") {
      return formatCurrency(value);
    }
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return "-";
    }
    return numericValue.toFixed(2);
  };

  const totalUtilized = utilizations.reduce((sum, record) => {
    const { amount } = getUtilizationMeta(record);
    return sum + amount;
  }, 0);

  if (isLoading) {
    return (
      <div className="d-flex align-items-center gap-2 text-muted">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading utilizations…</span>
        </div>
        <span>Fetching payment utilizations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger py-2 px-3 mb-0" role="alert">
        {error}
      </div>
    );
  }

  if (!utilizations.length) {
    return <p className="text-muted small mb-0">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="table-responsive border rounded">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Utilization Number</th>
              <th>Utilization Date</th>
              <th>Receive ID</th>
              <th>Utilization Amount</th>
              <th>Utilization Agent</th>
            </tr>
          </thead>
          <tbody>
            {utilizations.map((utilization, index) => {
              const { reference, paymentReference, date, amount } =
                getUtilizationMeta(utilization);
              const rowKey =
                utilization.ID ||
                utilization.Utilization_ID ||
                utilization.Utilization_Id ||
                `utilization-${index}`;
              const receiptDate =
                utilization.Receipt_Date ||
                date ||
                "—";
              const receiveId =
               utilization["Payment_Received.Receive_ID"] ||
                utilization["Payment_Received.ID"] ||
                utilization.Payment_Received?.ID ||
                utilization.Payment_Received ||
                "—";
              const utilizationAmount =
                utilization.Utilization ??
                utilization.Utilization_Amount ??
                amount;
              const agentName =
                [utilization.Agent?.Name1?.first_name, utilization.Agent?.Name1?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                utilization.Agent?.zc_display_value ||
                utilization.Agent?.Name ||
                utilization.Agent ||
                "—";
              return (
                <tr key={rowKey}>
                  <td>
                    <div className="fw-semibold">{reference}</div>
                    {paymentReference && paymentReference !== reference && (
                      <small className="text-muted d-block">
                        {paymentReference}
                      </small>
                    )}
                  </td>
                  <td>{receiptDate}</td>
                  <td>{receiveId}</td>
                  <td>{formattedAmount(utilizationAmount)}</td>
                  <td>{agentName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-end text-muted small mt-2">
        Total Utilized: <strong>{formattedAmount(totalUtilized)}</strong>
      </div>
    </>
  );
};

export default InvoiceUtilizationsPanel;
