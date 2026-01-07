import "./App.css";
import React, { Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

const AccountsModule = React.lazy(() =>
  import("./Pages/Accounts/AccountsModule")
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <div className="container py-4">
                <p className="mb-0">
                  <Link to="/AccountsModule">Accounts Module</Link>
                </p>
              </div>
            }
          />
          <Route path="/AccountsModule" element={<AccountsModule />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
