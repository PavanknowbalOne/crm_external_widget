import "./App.css";
import React, { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const AccountsModule = React.lazy(() =>
  import("./Pages/Accounts/AccountsModule")
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/AccountsModule" element={<AccountsModule />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
