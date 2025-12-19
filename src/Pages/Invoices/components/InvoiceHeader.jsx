import React from "react";

const InvoiceHeader = ({ viewportWidth, viewportHeight }) => (
  <header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
    <div>
      <p className="text-uppercase text-muted mb-1">Invoice Center</p>
      <h1 className="h3 fw-bold mb-2">Invoices Dashboard</h1>
      <p className="text-muted mb-0">
        Track invoice totals and follow up with clients quickly.
      </p>
    </div>
    <div className="text-md-end mt-3 mt-md-0">
      <p className="text-muted mb-1">Viewport</p>
      <span className="badge text-bg-light">
        {viewportWidth} × {viewportHeight}
      </span>
    </div>
  </header>
);

export default InvoiceHeader;
