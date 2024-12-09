<script>
  import { goto } from '$app/navigation';
  import { userProfile } from '$lib';
  import { initializeApp, getApps, getApp } from "firebase/app";
  import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
  import { firebaseConfig } from "$lib/firebaseConfig";

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);

  let firstName = '';
  let lastName = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let showPassword = false;
  let showConfirmPassword = false;

  function handleSubmit() {
      if (password !== confirmPassword) {
          alert("Passwords do not match!");
          return;
      }

      createUserWithEmailAndPassword(auth, email, password)
          .then((userCredential) => {
              // Signed in
              const user = userCredential.user;
              console.log('User signed up:', user);

              // Update user profile with first and last name
              userProfile.update(profile => ({
                  ...profile,
                  userName: `${firstName} ${lastName}`,
                  firstName: firstName,
                  lastName: lastName,
                  email: email
              }));

              // Navigate to profile or next step
              goto('/Profile');
          })
          .catch((error) => {
              console.error('Error signing up:', error);
              alert(error.message);
          });
  }

  function togglePassword() {
      showPassword = !showPassword;
  }

  function toggleConfirmPassword() {
      showConfirmPassword = !showConfirmPassword;
  }

  function navigateToLogin() {
      goto('/');
  }
</script>

<!-- Add Font Awesome stylesheet -->
<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</svelte:head>

<div class="container">
  <div class="logo-section">
      <img src="/Shiroi.png" alt="SHiROi Logo" class="logo-image">
  </div>
  
  <div class="form-section">
      <div class="login-form">
          <h2>Sign Up</h2>
          <form on:submit|preventDefault={handleSubmit}>
              <div class="name-inputs">
                  <input 
                      type="text" 
                      bind:value={firstName} 
                      placeholder="First Name" 
                      required
                      class="first-name"
                  />
                  <input 
                      type="text" 
                      bind:value={lastName} 
                      placeholder="Last Name" 
                      required
                      class="last-name"
                  />
              </div>
              
              <input 
                  type="email" 
                  bind:value={email} 
                  placeholder="Email" 
                  required
              />
              
              <div class="password-input">
                  <input 
                      type={showPassword ? 'text' : 'password'} 
                      bind:value={password} 
                      placeholder="Password" 
                      required
                  />
                  <button 
                      type="button" 
                      class="toggle-password"
                      on:click={togglePassword}
                  >
                      {#if showPassword}
                          <i class="fas fa-eye-slash"></i>
                      {:else}
                          <i class="fas fa-eye"></i>
                      {/if}
                  </button>
              </div>

              <div class="password-input">
                  <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      bind:value={confirmPassword} 
                      placeholder="Re-type Password" 
                      required
                  />
                  <button 
                      type="button" 
                      class="toggle-password"
                      on:click={toggleConfirmPassword}
                  >
                      {#if showConfirmPassword}
                          <i class="fas fa-eye-slash"></i>
                      {:else}
                          <i class="fas fa-eye"></i>
                      {/if}
                  </button>
              </div>
  
              <button type="submit" class="login-btn">Sign Up</button>
              
              <div class="links">
                  <div class="signup-prompt">
                      Already have an account? <a href="" on:click|preventDefault={navigateToLogin}>Login</a>
                  </div>
              </div>
          </form>
      </div>
  </div>
</div>

<style>
  :global(body) {
      margin: 0;
      padding: 0;
      background-color: white;
  }

  .container {
      display: flex;
      min-height: 100vh;
      width: 100%;
  }

  .logo-section {
      flex: 1;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding-right: 60px;
  }

  .logo-image {
      width: 300px;
      height: auto;
  }

  .form-section {
      flex: 1;
      display: flex;
      align-items: center;
      padding-left: 60px;
  }

  .login-form {
      width: 100%;
      max-width: 350px;
      background-color: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      border: 1px solid #f0f0f0;
  }

  h2 {
      color: #333;
      margin-bottom: 30px;
      text-align: center;
  }

  input {
      width: 100%;
      padding: 12px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
      box-sizing: border-box;
  }

  .name-inputs {
      display: flex;
      gap: 10px;
  }

  .name-inputs input {
      flex: 1;
      margin-bottom: 15px;
  }

  .password-input {
      position: relative;
      margin-bottom: 15px;
  }

  .password-input input {
      margin-bottom: 0;
  }

  .toggle-password {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: #666;
  }

  .toggle-password i {
      font-size: 16px;
  }

  .login-btn {
      width: 100%;
      padding: 12px;
      background-color: #ff8c00;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
      margin-bottom: 15px;
  }

  .links {
      text-align: center;
  }

  .signup-prompt {
      font-size: 14px;
      color: #666;
  }

  .signup-prompt a {
      color: #ff8c00;
      text-decoration: none;
      font-weight: bold;
  }

  @media (max-width: 768px) {
      .container {
          flex-direction: column;
          padding: 20px;
      }
      
      .logo-section {
          justify-content: center;
          padding-right: 0;
          margin-bottom: 40px;
      }

      .form-section {
          padding-left: 0;
      }

      .login-form {
          margin: 0 auto;
      }

      .name-inputs {
          flex-direction: column;
      }
  }
</style>