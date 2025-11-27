import React,{useState} from "react";
import './App.css';

const Login=()=>{
    const [role,setRole]=useState("citizen");
    const [email,setEmail]=useState("");
    const [password,setPassword]=useState("");
    const [showPassword,setShowPassword]=useState(false);
    const [error,setError]=useState("");

    const handleSubmit= async (e) =>{
        e.preventDefault();
        setError("");

        if(!email||!password){
            setError("Please fill in all fields");
            return;
        }
        
        try{
          const response = await fetch('http://localhost:5000/login', {
            method: 'post',
            headers:{'Content-Type':'application/json' },
            body:JSON.stringify({email,password,role}
          ) 
        });
        
        const data = await response.json();

        if(response.ok){
          console.log("Login successful:", data);
          // Handle successful login (e.g., redirect, store token)
        }else{
          setError(data.message ||"login failed");
        }
      } catch(error){
        console.error("server error");
      }
      };
        

 
    return(
      <div className="container">
        <div className="login-box">
          <img 
          src=""
          alt=""
          className=""
          />
          <h1>Welcome Back</h1>
          <p>log in to manage your smart garbage system</p>

          <div className="role-selection">
          <button
         className={`role-btn ${role === 'Admin' ? 'active' : ''}`}
          onClick={()=>setRole('admin')}
          >
            admin
            </button>
          <button
            className={`role-btn ${role === 'citizen' ? 'active' : ''}  `}
            onClick={()=>setRole('citizen')}
            >
            Citizen
            </button>
          <button
          className={`role-btn ${role === 'Staff'? 'active':''}`}
          onClick={()=> setRole('Staff')}
          >
            Staff
          </button>
            </div>

          <form onSubmit={handleSubmit}>
            <label> Email Address</label>
            <div className="input-group">
              <span className="icon"> </span>
              <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e)=> setEmail(e.target.value)}
              required
              />
              </div>
              <label> Password</label>
              <div className="input-group">
                <span className="icon"> </span>
                <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e)=> setPassword (e.target.value)}
               required
              />
              <span
              className="eye-password"
              onClick ={()=> setShowPassword(!showPassword)}
              >
              {showPassword ? '' : ''}
            </span>
          </div>

          <a href="/forgot-password" className="forgot-link">
            Forgot Password?
          </a>

          <button type="submit" className="login-btn">
            Log In
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <p>
          Don't have an account? <a href="/signup">Sign Up</a>
        </p>
      </div>
    </div>
  );
}


export default Login;