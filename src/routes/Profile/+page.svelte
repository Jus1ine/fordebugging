<script lang="ts">
    import { goto } from '$app/navigation';
    import { uploadedImages, type GalleryImage, userProfile } from '$lib';
    import { onMount } from 'svelte';

    let showEditModal = false;
    let fileInput: HTMLInputElement;

    // Local state for editing
    let newUserName = '';
    let newProfilePicture = '';
    let selectedMoods: string[] = [];

    let selectedTab: 'Posts' | 'About' = 'Posts';

    let isEditingAbout = false;
    let newAboutText = '';

    const moods = [
        { value: 'Professional', color: 'bg-blue-50 text-blue-600' },
        { value: 'Active', color: 'bg-green-50 text-green-600' },
        { value: 'Chill', color: 'bg-purple-50 text-purple-600' },
        { value: 'Happy', color: 'bg-yellow-50 text-yellow-600' },
        { value: 'Sad', color: 'bg-red-50 text-red-600' },
        { value: 'Angry', color: 'bg-orange-50 text-orange-600' },
        { value: 'Nothing', color: 'bg-gray-50 text-gray-600' }
    ];

    // Calculate total likes and comments
    $: totalLikes = $uploadedImages.reduce((total, image) => total + (image.likes?.length || 0), 0);
    $: totalComments = $uploadedImages.reduce((total, image) => total + (image.comments?.length || 0), 0);

    function toggleEditModal() {
        showEditModal = !showEditModal;
        if (showEditModal) {
            newUserName = $userProfile.userName;
            newProfilePicture = $userProfile.profilePicture;
            selectedMoods = $userProfile.moods;
        }
    }

    function saveProfileChanges() {
        userProfile.update(profile => ({
            ...profile,
            userName: newUserName,
            profilePicture: newProfilePicture || profile.profilePicture,
            moods: selectedMoods
        }));
        showEditModal = false;
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newProfilePicture = e.target?.result as string;
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    function exitProfile() {
        goto('/viewgallery');
    }

    function toggleAboutEdit() {
        isEditingAbout = !isEditingAbout;
        if (isEditingAbout) {
            newAboutText = $userProfile.aboutText;
        }
    }

    function saveAboutText() {
        userProfile.update(profile => ({
            ...profile,
            aboutText: newAboutText
        }));
        isEditingAbout = false;
    }

    function toggleMood(mood: string) {
        if (selectedMoods.includes(mood)) {
            selectedMoods = selectedMoods.filter(m => m !== mood);
        } else {
            selectedMoods = [...selectedMoods, mood];
        }
    }
</script>

<div class="container mx-auto p-4 relative min-h-screen bg-white">
    <!-- Profile Header -->
    <div class="relative pt-16">
        <!-- Back Button -->
        <button 
            on:click={exitProfile}
            class="fixed top-4 left-4 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-[#e09f3e] hover:bg-white border border-[#e09f3e] transition-all duration-200 flex items-center space-x-2 shadow-sm z-10"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back</span>
        </button>
        
        <div class="max-w-5xl mx-auto px-4 mt-24">
            <div class="relative -mt-20">
                <div class="bg-white rounded-lg shadow-lg">
                    <!-- Profile Header -->
                    <div class="p-6">
                        <div class="flex flex-col sm:flex-row items-start gap-6">
                            <!-- Avatar -->
                            <div class="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                                <img 
                                    src={$userProfile.profilePicture} 
                                    alt="Profile" 
                                    class="w-full h-full object-cover"
                                />
                            </div>
                            
                            <div class="flex-1">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <h2 class="text-2xl font-bold text-gray-900">{$userProfile.userName}</h2>
                                        <p class="text-sm text-gray-500">u/{$userProfile.userName} • Joined 2 years ago</p>
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            {#each $userProfile.moods as mood}
                                                {#if moods.find(m => m.value === mood)}
                                                    <span class="px-3 py-1 text-sm {moods.find(m => m.value === mood)?.color ?? 'bg-gray-50 text-gray-600'} rounded-full font-medium">
                                                        {mood}
                                                    </span>
                                                {/if}
                                            {/each}
                                        </div>
                                    </div>
                                    <button 
                                        on:click={toggleEditModal}
                                        class="px-4 py-2 bg-white text-[#e09f3e] border border-[#e09f3e] rounded-lg hover:bg-[#e09f3e]/10 transition-colors duration-300"
                                    >
                                        Edit Profile
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation Tabs -->
                    <div class="border-t border-gray-200">
                        <nav class="flex space-x-8 px-6" aria-label="Profile navigation">
                            <button 
                                class={`px-1 py-4 text-sm font-medium ${selectedTab === 'Posts' ? 'text-[#e09f3e] border-b-2 border-[#e09f3e]' : 'text-gray-500 hover:text-gray-700'}`}
                                on:click={() => selectedTab = 'Posts'}
                            >
                                Posts
                            </button>
                            <button 
                                class={`px-1 py-4 text-sm font-medium ${selectedTab === 'About' ? 'text-[#e09f3e] border-b-2 border-[#e09f3e]' : 'text-gray-500 hover:text-gray-700'}`}
                                on:click={() => selectedTab = 'About'}
                            >
                                About
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Image Grid (Pinterest Style) -->
    {#if selectedTab === 'Posts'}
        <div class="max-w-7xl mx-auto px-4 py-8">
            {#if $uploadedImages.length === 0}
                <div class="text-center text-gray-500 py-8">
                    <p>No images uploaded yet. Start uploading in the Gallery!</p>
                </div>
            {:else}
                <div class="text-center mb-6">
                    <h2 class="text-xl font-semibold text-gray-900">
                        Your Posts ({$uploadedImages.length})
                    </h2>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {#each $uploadedImages as image (image.id)}
                        <div class="rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                            <img 
                                src={image.url} 
                                alt="User uploaded image" 
                                class="w-full h-48 object-cover"
                            />
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    {#if selectedTab === 'About'}
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="bg-white rounded-lg shadow-sm p-6 space-y-6">
                <!-- User Stats Section -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="text-center p-4 bg-gray-50 rounded-lg">
                        <div class="text-2xl font-bold text-gray-900">{$uploadedImages.length}</div>
                        <div class="text-sm text-gray-600">Total Posts</div>
                    </div>
                    <div class="text-center p-4 bg-gray-50 rounded-lg">
                        <div class="text-2xl font-bold text-gray-900">{totalLikes}</div>
                        <div class="text-sm text-gray-600">Total Likes</div>
                    </div>
                    <div class="text-center p-4 bg-gray-50 rounded-lg">
                        <div class="text-2xl font-bold text-gray-900">{totalComments}</div>
                        <div class="text-sm text-gray-600">Total Comments</div>
                    </div>
                </div>

                <!-- User Info Section -->
                <div class="space-y-4">
                    <!-- About Section -->
                    <div class="mt-8">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-semibold">About</h3>
                            <button 
                                on:click={toggleAboutEdit}
                                class="px-3 py-1.5 text-[#e09f3e] border border-[#e09f3e] rounded-md hover:bg-[#e09f3e]/10 transition-colors duration-300"
                            >
                                {isEditingAbout ? 'Save' : 'Edit'}
                            </button>
                        </div>
                        
                        {#if isEditingAbout}
                            <textarea
                                bind:value={$userProfile.aboutText}
                                class="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                rows="4"
                            ></textarea>
                        {:else}
                            <p class="text-gray-600">{$userProfile.aboutText || 'No about information added yet.'}</p>
                        {/if}

                        <!-- Moods Section -->
                        <div class="mt-6">
                            <h4 class="text-lg font-medium mb-3">Moods</h4>
                            <div class="flex flex-wrap gap-2">
                                {#each $userProfile.moods || [] as mood}
                                    <span class="px-3 py-1 rounded-full text-sm 
                                        {moods.find(m => m.value === mood)?.color || 'bg-gray-50 text-gray-600'}">
                                        {mood}
                                    </span>
                                {/each}
                                {#if !$userProfile.moods?.length}
                                    <span class="text-gray-500 text-sm">No moods selected</span>
                                {/if}
                            </div>
                        </div>

                        <!-- Joined Date -->
                        <div class="mt-6">
                            <h4 class="text-lg font-medium mb-2">Joined</h4>
                            <p class="text-gray-600">
                                {new Date($userProfile.joinedDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

<!-- Edit Profile Modal -->
{#if showEditModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto transform transition-all duration-300 ease-in-out scale-100 hover:shadow-3xl">
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">Edit Profile</h2>
                    <button 
                        on:click={() => showEditModal = false}
                        class="text-gray-500 hover:text-gray-800 transition-colors rounded-full p-2 hover:bg-gray-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                        <div class="relative w-32 h-32 mx-auto">
                            <div 
                                class="rounded-lg overflow-hidden border-4 border-white shadow-lg cursor-pointer"
                                on:click={() => fileInput?.click()}
                            >
                                <img 
                                    src={newProfilePicture || $userProfile.profilePicture} 
                                    alt="Preview" 
                                    class="w-full h-full object-cover"
                                />
                                <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center transition-all duration-300">
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        class="h-8 w-8 text-white opacity-0 hover:opacity-100" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                    >
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <input 
                            type="file" 
                            bind:this={fileInput}
                            on:change={handleFileSelect} 
                            accept="image/*" 
                            class="hidden"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input
                            type="text"
                            bind:value={newUserName}
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#e09f3e] focus:ring-2 focus:ring-[#e09f3e]/50 transition-all duration-300"
                            placeholder="Enter your username"
                        />
                    </div>

                    <div class="relative z-10">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Moods (Select Multiple)</label>
                        <div class="mt-2 flex justify-center flex-wrap gap-2">
                            {#each moods as mood}
                                <button
                                    class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 
                                    {selectedMoods.includes(mood.value) 
                                        ? 'bg-[#e09f3e] text-white ring-2 ring-[#e09f3e]' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                                    on:click={() => toggleMood(mood.value)}
                                >
                                    {mood.value}
                                </button>
                            {/each}
                        </div>
                        {#if selectedMoods.length > 0}
                            <p class="text-xs text-gray-500 text-center mt-2">
                                Selected: {selectedMoods.join(', ')}
                            </p>
                        {/if}
                    </div>
                </div>

                <div class="mt-6 flex justify-center space-x-3">
                    <button
                        on:click={() => showEditModal = false}
                        class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        on:click={saveProfileChanges}
                        class="px-4 py-2 bg-[#e09f3e] text-white rounded-md hover:bg-[#e09f3e]/90 transition-colors duration-300 transform active:scale-95"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* For Firefox masonry grid support */
    @-moz-document url-prefix() {
        .columns-1 { column-count: 1; }
        .columns-2 { column-count: 2; }
        .columns-3 { column-count: 3; }
        .columns-4 { column-count: 4; }
    }
</style>