import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

function ProtectedRoute({ children }) {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token");
  // Token arriving via OAuth redirect — save it before the auth check runs
  if (urlToken) {
    localStorage.setItem("aria_token", urlToken);
  }
  const token = urlToken || localStorage.getItem("aria_token");
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
