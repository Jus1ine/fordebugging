<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from "svelte";
    import { initializeApp, getApps, getApp } from "firebase/app";
    import { getFirestore, collection, doc, setDoc, getDocs } from "firebase/firestore";
    import { getAuth, signInWithEmailAndPassword, type User, onAuthStateChanged } from "firebase/auth";
    import { firebaseConfig } from "$lib/firebaseConfig";
    import { browser } from '$app/environment';
    import { currentUser } from '../authStore';

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    
    let email = '';
    let password = '';
    let showPassword = false;
    let errorMessage = '';
    let isLoading = false;
  
    onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user);
        if (user) {
            currentUser.set(user);
        } else {
            currentUser.set(null);
        }
    });

    $: if ($currentUser) {
        console.log('User is logged in:', $currentUser);
        goto('/viewgallery');
    } else {
        console.log('User is not logged in');
    }
  
    async function handleSubmit() {
        errorMessage = '';
        isLoading = true;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            if (user) {
                // Store user session data
                const userDoc = doc(firestore, 'users', user.uid);
                await setDoc(userDoc, {
                    lastLogin: new Date().toISOString(),
                    email: user.email,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                
                // Redirect to gallery page
                goto('/viewgallery');
            }
        } catch (error: any) {
            console.error('Login error:', error);
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                default:
                    errorMessage = 'An error occurred during login';
            }
        } finally {
            isLoading = false;
        }
    }
  
    function togglePassword() {
        showPassword = !showPassword;
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
            <h2>Login</h2>
            {#if errorMessage}
                <div class="error-message">{errorMessage}</div>
            {/if}
            <form on:submit|preventDefault={handleSubmit}>
                <input 
                    type="email" 
                    bind:value={email} 
                    placeholder="Email" 
                    required
                    disabled={isLoading}
                />
                
                <div class="password-input">
                    <input 
                        type={showPassword ? 'text' : 'password'} 
                        bind:value={password} 
                        placeholder="Password" 
                        required
                        disabled={isLoading}
                    />
                    <button 
                        type="button" 
                        class="toggle-password"
                        on:click={togglePassword}
                        disabled={isLoading}
                    >
                        {#if showPassword}
                            <i class="fas fa-eye-slash"></i>
                        {:else}
                            <i class="fas fa-eye"></i>
                        {/if}
                    </button>
                </div>

                <button type="submit" class="login-btn" disabled={isLoading}>
                    {#if isLoading}
                        <i class="fas fa-spinner fa-spin"></i> Loading...
                    {:else}
                        Login
                    {/if}
                </button>
                
                <div class="links">
                    <a href="/forgot-password" class="forgot-link">Forgot Password?</a>
                    <div class="signup-prompt">
                        Don't have an Account? <a href="/signin" on:click|preventDefault={() => goto('/signin')}>Sign Up</a>
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
  
    .forgot-link {
      color: #ff8c00;
      text-decoration: none;
      font-size: 14px;
      display: block;
      margin-bottom: 10px;
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
  
    .error-message {
      color: red;
      text-align: center;
      margin-bottom: 10px;
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
    }
  </style>