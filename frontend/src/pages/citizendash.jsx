// <!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>EcoConnect Dashboard</title>
//     <style> 

//        /* ==== Reset & Basic Styles ==== */
//     * {
//          margin: 0;
//           padding: 0;
//            box-sizing: border-box; 
//     }
//     body {
//       font-family: 'Segoe UI', Arial, sans-serif;
//       background: linear-gradient(to bottom, #f8fff8, #e6f7e6);
//       color: #333;
//       min-height: 100vh;
//     }

//     /* ==== Header ==== */
//     header {
//       background: white;
//       padding: 15px 30px;
//       box-shadow: 0 2px 10px rgba(0,0,0,0.1);
//       display: flex;
//       justify-content: space-between;
//       align-items: center;
//       width: 100%;
//     }
//     .logo { 
//       font-weight: bold;
//       color: #2e7d32; font-size: 24px; 
//     }
//     .user {
//         font-size: 20px;
//     }

//      .container {
//       max-width: 1300px;
//       margin: 30px auto;
//       padding: 0 20px;
//       display: grid;
//       grid-template-columns: 250px 1fr;
//       gap: 30px;
//     }
//     /* ==== Sidebar ==== */
//     .sidebar {
//       background: white;
//       border-radius: 12px;
//       padding: 20px;
//       box-shadow: 0 4px 15px rgba(0,0,0,0.05);
//       height: 980px;
//       font-size:20px;
//     }
//     .sidebar h3 {
//       background: #4caf50;
//       color: white;
//       padding: 12px;
//       border-radius: 8px;
//       text-align: center;
//       margin-bottom: 20px;
//     }
//     .sidebar ul {
//       list-style: none;
//     }
//     .sidebar ul li {
//       padding: 12px 15px;
//       margin: 8px 0;
//       border-radius: 8px;
//       cursor: pointer;
//       transition: 0.3s;
//     }
//     .sidebar ul li:hover, .sidebar ul li.active {
//       background: #e8f5e9;
//       color: #2e7d32;
//       font-weight: bold;
//     }
//     /* ==== Main Content ==== */
//     .main {
//       display: grid;
//       gap: 25px;
//     }

//     /* Rank Card */
//     .rank-card {
//       background: linear-gradient(135deg, #a5d6a7, #81c784);
//       color: white;
//       padding: 25px;
//       border-radius: 12px;
//       text-align: center;
//       box-shadow: 0 4px 15px rgba(0,0,0,0.1);
//       height: 300px;
//       width: 1000px;
//     }
//     .rank-card h2 { 
//       font-size: 22px;
//       margin-bottom: 10px; 
//     }
//     .points { 
//       font-size: 42px; 
//       font-weight: bold; 
//       margin: 15px 0; 
//     }
//      /* ==== Main Content ==== */
//     .main {
//       display: grid;
//       gap: 25px;
//     }

    

//       /* Activity Cards */
//     .activity-grid {
//       display: grid;
//       grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
//       gap: 40px;
      
      
      
      
//     }
//     .activity-card {
//       background: white;
//       padding: 40px;
//       border-radius: 12px;
//       text-align: center;
//       box-shadow: 0 4px 15px rgba(0,0,0,0.05);
//       height: 200px;
      
//     }
//     .activity-card h3 { 
//       font-size: 18px; 
//       color: #555; 
//       margin-top: 10px; 
//     }


//     /* Activity Cards */
//     .activity-grid {
//       display: grid;
//       grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
//       gap: 20px;
//       margin-top: 30px;
//     }
//     .activity-card {
//       background: white;
//       padding: 25px;
//       border-radius: 12px;
//       text-align: center;
//       box-shadow: 0 4px 15px rgba(0,0,0,0.05);
//     }
//     .activity-card h3 { 
//       font-size: 18px; 
//       color: #555; 
//       margin-top: 10px; }

//     /* Action Buttons */
//     .actions {
//       display: grid;
//       grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
//       gap: 20px;
//       margin-top: 30px;
//     }
//     .action-box {
//       background: white;
//       padding: 25px;
//       border-radius: 12px;
//       box-shadow: 0 4px 15px rgba(0,0,0,0.05);
//       text-align: center;
//     }
//     .btn {
//       background: #209724;
//       color: rgb(243, 235, 235);
//       padding: 12px 24px;
//       border: none;
//       border-radius: 8px;
//       cursor: pointer;
//       font-size: 16px;
//       margin-top: 15px;
//       transition: 0.3s;
//     }
//     .btn:hover { 
//      background: #ebf194;
//      color: rgb(215, 136, 26);
//     transform: scale(1.05); 
//     font-weight: bold;
//    }
    






//     </style>



    
// </head>


// <body>

//   <!-- Header -->
//   <header>
//     <div class="logo">Eco Friendly</div>
//     <div class="user">
//       Hello, Isha 
//     </div>
//   </header>


// <!-- Creating a container-->
//   <div class="container">

//     <!-- Sidebar -->
//     <aside class="sidebar">
//       <h3>Dashboard</h3>
//       <ul>
//         <li class="active">Dashboard</li>
//         <li>New Request</li>
//         <li>Complaints</li>
//         <li>Schedule</li>
//       </ul>
//       <p style="margin-top:40px; font-size:15px; color:#413c3c;">
//         "The best way to reduce waste is not to produce it."
//       </p>
//     </aside>


//      <!-- Main Content -->
//     <main class="main">

//       <!-- Rank Card -->
//       <div class="rank-card">
//         <h2 style="font-size: 25px;">Your eco rank</h2>
//         <div style="font-size:60px;">★★★★★</div>
//         <p style="font-size: 17px; font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;">Clean city, proud citizen. Your effort leads the way !!</p>
//         <div class="points">5,000 points</div>
//         <p style="font-size: 17px; font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;">You have earned</p>
//       </div>

//         <h2 style="text-align:center; margin-top: 20px 0px;">Your Activity</h2>


//         <!-- Activity Cards -->
//       <div class="activity-grid">
//         <div class="activity-card">
//           <div style="font-size:50px;">♻️</div>
//           <h3>Recycled Items</h3>
//           <p style="font-size:28px; font-weight:bold; color:#4caf50;">150 kg</p>
//         </div>
//         <div class="activity-card">
//           <div style="font-size:50px;">🌳</div>
//           <h3>Trees Planted</h3>
//           <p style="font-size:28px; font-weight:bold; color:#4caf50;">12</p>
//         </div>
//         <div class="activity-card">
//           <div style="font-size:50px;">🗑️</div>
//           <h3>Waste Reduced</h3>
//           <p style="font-size:28px; font-weight:bold; color:#4caf50;">37%</p>
//         </div>
//       </div>


//       <!-- Action Boxes -->
//       <div class="actions">
//         <div class="action-box">
//           <h3>Schedule a New Request</h3>
//           <p>Easily schedule a new waste collection or recycling service with just a few clicks.</p>
//           <button class="btn" onclick="openModal()">Schedule Now →</button>
//         </div>

//         <div class="action-box">
//           <h3>Your complaints</h3>
//           <p>View the status and details of your submitted complaints and feedback.</p>
//           <button class="btn">View Complaints →</button>
//         </div>

//         <div class="action-box">
//           <h3>Collection status</h3>
//           <p>Keep track of your upcoming and past waste collection schedules.</p>
//           <p style="margin-top:15px; font-weight:bold;">Next collection: October 15, 2024</p>
//         </div>
//       </div>
//     </main>
// </div>

//     <!--Footer-->
//    <footer style="margin-top:80px; padding:50px 20px; background:white; color:white; text-align:center;">
//   <div style="max-width:1100px; margin:auto; display:grid; grid-template-columns:repeat(auto-fit, minmax(250px,1fr)); gap:30px;">
    
//     <!-- Tagline -->
//     <div>
//       <h2 style="font-size:28px; margin-bottom:10px; color:#166519;">Eco Friendly</h2>
//       <p style="font-size:16px; opacity:0.9; color:#166519;">Connecting communities for a greener, cleaner tomorrow.</p>
//     </div>

//     <!-- Quick Links -->
//     <div>
//       <h3 style="margin-bottom:15px; color:#166519;">Quick Links</h3>
//       <a href="#" style="display:block; color:#166519;; text-decoration:none; margin:8px 0; font-size:15px;">Dashboard</a>
//       <a href="#" style="display:block; color:#166519; text-decoration:none; margin:8px 0; font-size:15px;">New Request</a>
//       <a href="#" style="display:block; color:#166519; text-decoration:none; margin:8px 0; font-size:15px;">Complaints</a>
//       <a href="#" style="display:block; color:#166519; text-decoration:none; margin:8px 0; font-size:15px;">About Us</a>
//     </div>

//     <!-- Contact Details -->
//     <div>
//       <h3 style="margin-bottom:15px; color:#166519;">Contact Us</h3>
//       <p style="margin:10px 0; font-size:15px;">
//         Email: <a href="mailto:support@ecoconnect.com" style="color:#166519; text-decoration:none;">garbage.np@ecoconnect.com</a>
//       </p>
//       <p style="margin:10px 0; font-size:15px; color: #166519;">
//         Phone: <strong>+977 9876543210</strong>
//       </p>
//       <p style="margin:10px 0; font-size:15px; color: #166519;">
//         Helpline: <strong>+977 98053186381</strong> 
//       </p>
//       <p style="margin:10px 0; font-size:15px; color: #166519;">
//         Address: Itahari,<br>123 Eco Street, Sunsari, Nepal
//       </p>
//     </div>
//   </div>

//   <!-- Copyright -->
//   <div style="margin-top:40px; padding-top:20px; border-top:1px solid #2e7d32; font-size:14px; opacity:0.8;">
//     © 2025 Eco Friendly. All rights reserved. | Made with love for a cleaner planet
//   </div>
// </footer>

















//       <!-- ADD THIS CSS in <head> -->
// <style>
//   .sidebar li { position:relative; overflow:hidden; cursor:pointer; padding:14px 20px; border-radius:10px; transition:0.3s; }
//   .sidebar li:hover { background:#e8f5e9; }
//   .sidebar li.active { background:#4caf50; color:white; font-weight:bold; }
//   .ripple { position:absolute; background:rgba(255,255,255,0.6); border-radius:50%; width:10px; height:10px;
//              transform:scale(0); animation:r 0.6s ease-out; pointer-events:none; }
//   @keyframes r { to { transform:scale(20); opacity:0; } }
// </style>

// <!-- ADD THIS SCRIPT before </body> -->
// <script>
    
//   document.querySelectorAll('.sidebar li').forEach(item => {
//     item.addEventListener('click', function(e) {
//       // 1. Make clicked item active
//       document.querySelectorAll('.sidebar li').forEach(i => i.classList.remove('active'));
//       this.classList.add('active');

//       // 2. Show message
//       const page = this.textContent.trim();
//       if(page === 'Dashboard') {
//         alert('You are already on Dashboard!');
//       } else {
//         alert(`Opening ${page} page...`);
//       }

//       // 3. Ripple effect
//       let r = document.createElement('span');
//       r.classList.add('ripple');
//       let x = e.clientX - this.getBoundingClientRect().left;
//       let y = e.clientY - this.getBoundingClientRect().top;
//       r.style.left = x + 'px';
//       r.style.top = y + 'px';
//       this.appendChild(r);
//       setTimeout(() => r.remove(), 600);
//     });
//   });
// </script>
// </body>