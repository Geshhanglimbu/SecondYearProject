import { Routes, Route } from "react-router-dom";
import Login from "./pages/login.jsx";
import Register from "./pages/Register.jsx";
import CitizenDashboard from "./pages/citizenDashboard.jsx";
import NewRequest from "./pages/NewRequest.jsx";
import Payment from "./pages/Payment";
import PaymentSuccess, { PaymentFailed } from "./pages/PaymentSuccess";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<CitizenDashboard />} />
      <Route path="/new-request" element={<NewRequest />} />
      <Route path="/payment"        element={<Payment />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/failed"  element={<PaymentFailed />} />
    </Routes>
  );
}

export default App;
