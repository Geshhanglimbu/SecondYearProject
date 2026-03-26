import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/citizenPage/Landingpage.jsx";
import ProfilePage from "./pages/citizenPage/ProfilePage.jsx";
import Login from "./pages/login.jsx";
import Register from "./pages/Register.jsx";
import CitizenDashboard from "./pages/citizenPage/CitizenDashboard.jsx";
import NewRequest from "./pages/citizenPage/NewRequest.jsx";
import Payment from "./pages/citizenPage/Payment.jsx";
import PaymentSuccess, { PaymentFailed } from "./pages/citizenPage/PaymentSuccess.jsx";
import Complaints from "./pages/citizenPage/Complaints.jsx";
import Feedback from "./pages/citizenPage/Feedback.jsx";
import StaffDashboard from "./pages/staffPage/StaffDashboard.jsx";
import AdminDashboard from "./pages/adminPage/AdminDashboard.jsx";
import Leaderboard from "./pages/citizenPage/Leaderboard.jsx";



function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<CitizenDashboard />} />
      <Route path="/staff-dashboard" element={<StaffDashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/new-request" element={<NewRequest />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/failed" element={<PaymentFailed />} />
      <Route path="/complaints" element={<Complaints />} />
      <Route path="/Feedback" element={<Feedback />} />
      <Route path="/leaderboard" element={<Leaderboard />} />


    </Routes>
  );
}

export default App;
