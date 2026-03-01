import { Routes, Route } from "react-router-dom";
import Login from "./pages/login.jsx";
import Register from "./pages/Register.jsx";
import CitizenDashboard from "./pages/citizenDashboard.jsx";
import NewRequest from "./pages/NewRequest.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<CitizenDashboard />} />
      <Route path="/new-request" element={<NewRequest />} />
    </Routes>
  );
}

export default App;
